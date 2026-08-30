import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sessionModule from '@/lib/session'
import { registrarCobro } from './actions'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const operationId = '11111111-1111-4111-8111-111111111111'
const ventaId = '22222222-2222-4222-8222-222222222222'
const sucursalId = '33333333-3333-4333-8333-333333333333'

describe('clientes actions — cobro por RPC versionada', () => {
  let rpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: { rpc } as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId,
    })
  })

  it('envía un cobro digital únicamente a ra_registrar_cobro_v2', async () => {
    const result = await registrarCobro(operationId, ventaId, 25.5, '2026-08-30', 'yape', 'PEN', 'YAPE-001')

    expect(result).toEqual({ error: null })
    expect(rpc).toHaveBeenCalledWith('ra_registrar_cobro_v2', {
      p_operation_id: operationId,
      p_sucursal_id: sucursalId,
      p_venta_id: ventaId,
      p_monto: 25.5,
      p_fecha: '2026-08-30',
      p_metodo_pago: 'yape',
      p_moneda_cobro: 'PEN',
      p_tipo_cambio_cobro: null,
      p_referencia: 'YAPE-001',
    })
  })

  it('sanitiza el conflicto idempotente sin exponer el error SQL', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'RA_IDEMPOTENCY_CONFLICT' } })

    await expect(registrarCobro(operationId, ventaId, 25.5, '2026-08-30', 'yape', 'PEN', null))
      .resolves.toEqual({ error: 'El identificador de operación ya fue usado con otros datos.' })
  })
})
