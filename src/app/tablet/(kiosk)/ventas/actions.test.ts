import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sessionModule from '@/lib/session'
import { processSunatOutboxForVenta } from '@/lib/facturacion/outbox'
import { enviarVentaAOseSunat, initialEnvioSunatManualState } from './actions'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/facturacion/outbox', () => ({ processSunatOutboxForVenta: vi.fn() }))

const ventaId = '11111111-1111-4111-8111-111111111111'
const sucursalId = '22222222-2222-4222-8222-222222222222'

function form(values: Record<string, string>) {
  const data = new FormData()
  Object.entries(values).forEach(([key, value]) => data.set(key, value))
  return data
}

function ventaQuery(venta: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: venta, error: null })
  const eq = vi.fn()
  eq.mockReturnValue({ eq, maybeSingle })
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq, maybeSingle }),
    }),
    eq,
  }
}

describe('enviarVentaAOseSunat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rechaza a un vendedor antes de consultar o emitir', async () => {
    const supabase = ventaQuery({ id: ventaId, tipo_comprobante: 'boleta', estado: 'pendiente' })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: supabase as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'vendedor', activo: true } as never,
      sucursalId,
    })

    await expect(enviarVentaAOseSunat(initialEnvioSunatManualState, form({ venta_id: ventaId })))
      .resolves.toEqual({ message: 'Solo el administrador puede enviar comprobantes a OSE/SUNAT.', tone: 'error' })
    expect(supabase.from).not.toHaveBeenCalled()
    expect(processSunatOutboxForVenta).not.toHaveBeenCalled()
  })

  it('valida empresa y sucursal antes de reclamar únicamente la venta solicitada', async () => {
    const supabase = ventaQuery({ id: ventaId, tipo_comprobante: 'boleta', estado: 'pendiente' })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: supabase as never,
      user: { id: 'admin-1' } as never,
      perfil: { id: 'admin-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId,
    })
    vi.mocked(processSunatOutboxForVenta).mockResolvedValue({
      claimed: 1,
      processed: 1,
      outcome: 'accepted',
    })

    await expect(enviarVentaAOseSunat(initialEnvioSunatManualState, form({ venta_id: ventaId })))
      .resolves.toEqual({ message: 'Comprobante aceptado por SUNAT.', tone: 'success' })
    expect(supabase.eq).toHaveBeenCalledWith('empresa_id', 'empresa-1')
    expect(supabase.eq).toHaveBeenCalledWith('sucursal_id', sucursalId)
    expect(processSunatOutboxForVenta).toHaveBeenCalledWith(ventaId)
  })

  it('no envía tickets aunque estén pendientes', async () => {
    const supabase = ventaQuery({ id: ventaId, tipo_comprobante: 'ticket', estado: 'pendiente' })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: supabase as never,
      user: { id: 'admin-1' } as never,
      perfil: { id: 'admin-1', empresa_id: 'empresa-1', rol: 'superadmin', activo: true } as never,
      sucursalId,
    })

    await expect(enviarVentaAOseSunat(initialEnvioSunatManualState, form({ venta_id: ventaId })))
      .resolves.toEqual({ message: 'Solo se pueden enviar boletas o facturas pendientes.', tone: 'error' })
    expect(processSunatOutboxForVenta).not.toHaveBeenCalled()
  })
})
