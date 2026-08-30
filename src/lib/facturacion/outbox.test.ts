import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { emitirComprobante } from './ose'
import { processSunatOutboxForVenta } from './outbox'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('./ose', () => ({ emitirComprobante: vi.fn() }))

const ventaId = '11111111-1111-4111-8111-111111111111'

describe('processSunatOutboxForVenta', () => {
  let rpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test'
    rpc = vi.fn()
    vi.mocked(createClient).mockReturnValue({ rpc } as never)
  })

  it('reclama únicamente la outbox de la venta indicada y conserva su lease', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'ra_claim_sunat_outbox_for_venta') {
        return Promise.resolve({
          data: [{
            id: 'outbox-1',
            lease_token: 'lease-1',
            document_key: 'venta-1',
            request_payload: { tipo: 'BOLETA', serie: 'B001', correlativo: 1 },
          }],
          error: null,
        })
      }
      if (name === 'ra_finish_sunat_outbox') return Promise.resolve({ data: true, error: null })
      throw new Error(`RPC inesperada: ${name}`)
    })
    vi.mocked(emitirComprobante).mockResolvedValue({ kind: 'accepted', exito: true, sunat_aceptada: true })

    await expect(processSunatOutboxForVenta(ventaId)).resolves.toEqual({
      claimed: 1,
      processed: 1,
      outcome: 'accepted',
    })
    expect(rpc).toHaveBeenCalledWith('ra_claim_sunat_outbox_for_venta', expect.objectContaining({
      p_venta_id: ventaId,
      p_lease_seconds: 120,
    }))
    expect(rpc).not.toHaveBeenCalledWith('ra_claim_sunat_outbox', expect.anything())
    expect(rpc).toHaveBeenCalledWith('ra_finish_sunat_outbox', expect.objectContaining({
      p_job_id: 'outbox-1',
      p_lease_token: 'lease-1',
      p_outcome: 'accepted',
    }))
  })
})
