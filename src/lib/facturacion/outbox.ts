import { createClient } from '@supabase/supabase-js'
import { emitirComprobante, type OseComprobanteInput, type OseComprobanteResult } from './ose'

type OutboxJob = {
  id: string
  lease_token: string
  document_key: string
  request_payload: OseComprobanteInput
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
    p_http_status: null,
    p_error_code: outcome === 'uncertain' ? 'UNCERTAIN_RESULT_REQUIRES_RECONCILIATION' : null,
    p_error_message: result.error ?? null,
    p_response_payload: null,
  } as never)
  if (error) throw new Error(`No se pudo finalizar outbox ${job.id}: ${error.message}`)
  return { finalized: data === true, outcome }
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
