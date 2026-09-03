import { createClient } from '@supabase/supabase-js'
import { emitirComprobante, type OseComprobanteInput, type OseComprobanteResult } from './ose'

type OutboxJob = {
  id: string
  lease_token: string
  document_key: string
  request_payload: OseComprobanteInput
}

type CreditNoteOutboxJob = OutboxJob

type CreditNotePayload = {
  tipo: 'NOTA_CREDITO'
  serie: string
  correlativo: number
  fechaEmision: string
  motivoCodigo: '06' | '07'
  motivoDescripcion: string
  documentoReferencia: {
    tipo: 'BOLETA' | 'FACTURA'
    numeroCompleto: string
  }
  comprobanteOriginal: OseComprobanteInput
  items: OseComprobanteInput['items']
  subtotal: number
  igv: number
  total: number
  moneda: OseComprobanteInput['moneda']
  tipoCambio?: number
}

export type SunatOutboxError = {
  error_code: string | null
  error_message: string | null
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase admin no configurado')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

type ProcessedJob = {
  finalized: boolean
  outcome: OseComprobanteResult['kind']
}

async function processJob(
  supabase: ReturnType<typeof adminClient>,
  job: OutboxJob
): Promise<ProcessedJob> {
  const result = await emitirComprobante(job.request_payload, job.document_key)
  const outcome = result.kind
  const { data, error } = await supabase.rpc('ra_finish_sunat_outbox', {
    p_job_id: job.id,
    p_lease_token: job.lease_token,
    p_outcome: outcome,
    p_external_id: result.id_externo ?? null,
    p_http_status: result.http_status ?? null,
    p_error_code: outcome === 'uncertain' ? 'UNCERTAIN_RESULT_REQUIRES_RECONCILIATION' : result.error_code ?? null,
    p_error_message: result.error ?? null,
    p_response_payload: result.response_payload ?? null,
  } as never)
  if (error) throw new Error(`No se pudo finalizar outbox ${job.id}: ${error.message}`)
  return { finalized: data === true, outcome }
}

export function buildCreditNoteInput(payload: CreditNotePayload): OseComprobanteInput {
  const original = payload.comprobanteOriginal
  if (!original?.rucEmisor || !original.razonSocial || !original.cliente
    || !payload.documentoReferencia?.numeroCompleto || !Array.isArray(payload.items)) {
    throw new Error('Payload de nota de crédito incompleto')
  }
  return {
    tipo: 'NOTA_CREDITO',
    serie: payload.serie,
    correlativo: payload.correlativo,
    rucEmisor: original.rucEmisor,
    razonSocial: original.razonSocial,
    fechaEmision: payload.fechaEmision,
    cliente: original.cliente,
    items: payload.items,
    subtotal: payload.subtotal,
    igv: payload.igv,
    total: payload.total,
    moneda: payload.moneda,
    tipoCambio: payload.tipoCambio,
    notaCredito: {
      comprobanteReferenciadoId: payload.documentoReferencia.numeroCompleto,
      tipoDocReferenciado: payload.documentoReferencia.tipo === 'FACTURA' ? '01' : '03',
      motivoCodigo: payload.motivoCodigo,
      motivoDescripcion: payload.motivoDescripcion,
    },
  }
}

async function processCreditNoteJob(
  supabase: ReturnType<typeof adminClient>,
  job: CreditNoteOutboxJob
): Promise<ProcessedJob> {
  let result: OseComprobanteResult
  try {
    result = await emitirComprobante(buildCreditNoteInput(job.request_payload as unknown as CreditNotePayload), job.document_key)
  } catch (cause) {
    result = {
      kind: 'rejected', exito: false,
      error: cause instanceof Error ? cause.message : 'Payload de nota de crédito inválido',
    }
  }
  const { data, error } = await supabase.rpc('ra_finish_sunat_nota_credito_outbox', {
    p_job_id: job.id,
    p_lease_token: job.lease_token,
    p_outcome: result.kind,
    p_external_id: result.id_externo ?? null,
    p_http_status: result.http_status ?? null,
    p_error_code: result.kind === 'uncertain' ? 'UNCERTAIN_RESULT_REQUIRES_RECONCILIATION' : result.error_code ?? null,
    p_error_message: result.error ?? null,
    p_response_payload: result.response_payload ?? null,
  } as never)
  if (error) throw new Error(`No se pudo finalizar outbox NC ${job.id}: ${error.message}`)
  return { finalized: data === true, outcome: result.kind }
}

export async function processSunatOutbox(batchSize = 10) {
  const supabase = adminClient()
  const workerId = `next:${crypto.randomUUID()}`
  const { data, error } = await supabase.rpc('ra_claim_sunat_outbox', {
    p_worker_id: workerId,
    p_limit: Math.min(Math.max(batchSize, 1), 10),
    p_lease_seconds: 120,
  } as never)
  if (error) throw new Error(`No se pudo reclamar outbox: ${error.message}`)
  const jobs = (data ?? []) as unknown as OutboxJob[]
  let processed = 0
  for (let index = 0; index < jobs.length; index += 2) {
    const results = await Promise.allSettled(jobs.slice(index, index + 2).map((job) => processJob(supabase, job)))
    processed += results.filter(
      (result) => result.status === 'fulfilled' && result.value.finalized
    ).length
  }
  return { claimed: jobs.length, processed }
}

export async function processSunatOutboxForVenta(ventaId: string) {
  const supabase = adminClient()
  const workerId = `manual:${crypto.randomUUID()}`
  const { data, error } = await supabase.rpc('ra_claim_sunat_outbox_for_venta', {
    p_worker_id: workerId,
    p_venta_id: ventaId,
    p_lease_seconds: 120,
  } as never)
  if (error) throw new Error(`No se pudo reclamar la outbox de la venta: ${error.message}`)

  const job = (data ?? [])[0] as OutboxJob | undefined
  if (!job) return { claimed: 0, processed: 0, outcome: null }

  const result = await processJob(supabase, job)
  return {
    claimed: 1,
    processed: result.finalized ? 1 : 0,
    outcome: result.outcome,
  }
}

export async function processSunatNotaCreditoOutboxForDevolucion(devolucionId: string, forceRetry = false) {
  const supabase = adminClient()
  const workerId = `immediate-nc:${crypto.randomUUID()}`
  const { data, error } = await supabase.rpc('ra_claim_sunat_nota_credito_outbox_for_devolucion', {
    p_worker_id: workerId,
    p_devolucion_id: devolucionId,
    p_lease_seconds: 120,
    p_force_retry: forceRetry,
  } as never)
  if (error) throw new Error(`No se pudo reclamar la outbox NC: ${error.message}`)
  const job = (data ?? [])[0] as CreditNoteOutboxJob | undefined
  if (!job) return { claimed: 0, processed: 0, outcome: null }
  const result = await processCreditNoteJob(supabase, job)
  return { claimed: 1, processed: result.finalized ? 1 : 0, outcome: result.outcome }
}


export async function getSunatOutboxErrorForVenta(ventaId: string): Promise<SunatOutboxError | null> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('ra_sunat_outbox')
    .select('error_code, error_message')
    .eq('venta_id', ventaId)
    .maybeSingle()
  if (error) throw new Error(`No se pudo consultar el error fiscal: ${error.message}`)
  if (!data) return null
  return {
    error_code: data.error_code ?? null,
    error_message: data.error_message ?? null,
  }
}
