import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { buildCreditNoteInput } from '../src/lib/facturacion/outbox'
import { emitirComprobante } from '../src/lib/facturacion/ose'

// Verifica el contrato de idempotencia OSE con una NC TEST ya aceptada. No crea
// documentos nuevos: el primer POST es un replay y el segundo es un conflicto 409.
const ENABLED = process.env.RUN_OSE_E2E === '1'

if (ENABLED) {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), '.env.local'))
  } catch {
    // Se usan las variables inyectadas por el entorno cuando no hay .env.local.
  }
}

const describeE2E = ENABLED ? describe : describe.skip

describeE2E('OSE beta E2E — replay de nota de crédito', () => {
  it('repite una NC aceptada y rechaza el mismo key con payload distinto', async () => {
    expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeTruthy()
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    const { data, error } = await supabase
      .from('ra_sunat_nota_credito_outbox' as never)
      .select('document_key,request_payload,external_id,status')
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    expect(error).toBeNull()
    expect(data).toBeTruthy()

    const outbox = data as unknown as {
      document_key: string
      request_payload: unknown
      external_id: string
      status: string
    }
    const input = buildCreditNoteInput(outbox.request_payload as Parameters<typeof buildCreditNoteInput>[0])

    const replay = await emitirComprobante(input, outbox.document_key)
    expect(replay.kind).toBe('accepted')
    expect(replay.http_status).toBe(200)
    expect(replay.id_externo).toBe(outbox.external_id)
    expect(replay.response_payload?.idempotencyReplayed).toBe(true)

    const conflict = await emitirComprobante({
      ...input,
      notaCredito: { ...input.notaCredito!, motivoDescripcion: 'E2E NC payload conflict' },
    }, outbox.document_key)
    expect(conflict.kind).toBe('rejected')
    expect(conflict.http_status).toBe(409)
  })
})
