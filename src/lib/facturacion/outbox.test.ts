import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { emitirComprobante } from './ose'
import { getSunatOutboxErrorForVenta, processSunatNotaCreditoOutboxForDevolucion, processSunatOutboxForVenta } from './outbox'

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }))
vi.mock('./ose', () => ({ emitirComprobante: vi.fn() }))

const ventaId = '11111111-1111-4111-8111-111111111111'
const devolucionId = '22222222-2222-4222-8222-222222222222'

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

  it('devuelve únicamente el mensaje fiscal almacenado para el detalle autorizado de una venta', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { error_code: null, error_message: 'Ya existe F001-00000001 con un payload distinto' },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    vi.mocked(createClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq }),
      }),
    } as never)

    await expect(getSunatOutboxErrorForVenta(ventaId)).resolves.toEqual({
      error_code: null,
      error_message: 'Ya existe F001-00000001 con un payload distinto',
    })
    expect(eq).toHaveBeenCalledWith('venta_id', ventaId)
  })

  it('reclama y finaliza exclusivamente la outbox de la devolución indicada', async () => {
    rpc.mockImplementation((name: string) => {
      if (name === 'ra_claim_sunat_nota_credito_outbox_for_devolucion') {
        return Promise.resolve({ data: [{
          id: 'nc-outbox-1', lease_token: 'lease-nc-1', document_key: devolucionId,
          request_payload: {
            tipo: 'NOTA_CREDITO', serie: 'BC001', correlativo: 1, fechaEmision: '2026-09-01',
            motivoCodigo: '07', motivoDescripcion: 'Devolución por ítem',
            documentoReferencia: { tipo: 'BOLETA', numeroCompleto: 'B001-00000001' },
            comprobanteOriginal: { rucEmisor: '20123456789', razonSocial: 'Empresa SAC', cliente: { nombre: 'Cliente', tipoDocumento: 'DNI', nroDocumento: '12345678' } },
            items: [{ descripcion: 'Filtro', cantidad: 1, valorUnitario: 10, subtotalBase: 10 }],
            subtotal: 10, igv: 1.8, total: 11.8, moneda: 'PEN',
          },
        }], error: null })
      }
      if (name === 'ra_finish_sunat_nota_credito_outbox') return Promise.resolve({ data: true, error: null })
      throw new Error(`RPC inesperada: ${name}`)
    })
    vi.mocked(emitirComprobante).mockResolvedValue({ kind: 'accepted', exito: true, sunat_aceptada: true })

    await expect(processSunatNotaCreditoOutboxForDevolucion(devolucionId)).resolves.toEqual({
      claimed: 1, processed: 1, outcome: 'accepted',
    })
    expect(rpc).toHaveBeenCalledWith('ra_claim_sunat_nota_credito_outbox_for_devolucion', expect.objectContaining({
      p_devolucion_id: devolucionId, p_lease_seconds: 120, p_force_retry: false,
    }))
    expect(rpc).toHaveBeenCalledWith('ra_finish_sunat_nota_credito_outbox', expect.objectContaining({
      p_job_id: 'nc-outbox-1', p_lease_token: 'lease-nc-1', p_outcome: 'accepted',
    }))
  })
})
