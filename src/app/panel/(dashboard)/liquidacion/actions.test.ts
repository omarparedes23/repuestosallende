import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sessionModule from '@/lib/session'
import { cerrarConLiquidacion, getCajaActiva, revisarLiquidacion } from './actions'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const operationId = '11111111-1111-4111-8111-111111111111'
const cajaId = '22222222-2222-4222-8222-222222222222'

describe('liquidación actions — cierre atómico', () => {
  let rpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: { rpc } as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: 'sucursal-1',
    })
  })

  it('no acepta totales del navegador y delega el cierre a una sola RPC', async () => {
    const result = await cerrarConLiquidacion(operationId, cajaId, 250.5, 'Conteo final')
    expect(result).toBeNull()
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('ra_cerrar_caja_v1', {
      p_operation_id: operationId,
      p_caja_id: cajaId,
      p_efectivo_contado: 250.5,
      p_notas: 'Conteo final',
    })
  })

  it('rechaza un importe inválido antes de llamar RPC', async () => {
    const result = await cerrarConLiquidacion(operationId, cajaId, -1, null)
    expect(result).toBe('Ingresa un efectivo contado válido.')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('revisa una liquidación solo mediante la RPC versionada', async () => {
    const result = await revisarLiquidacion(operationId, cajaId, 'observada', 'Faltante verificado')

    expect(result).toBeNull()
    expect(rpc).toHaveBeenCalledWith('ra_revisar_liquidacion_v1', {
      p_operation_id: operationId,
      p_liquidacion_id: cajaId,
      p_decision: 'observada',
      p_motivo: 'Faltante verificado',
    })
  })

  it('requiere motivo para una revisión', async () => {
    const result = await revisarLiquidacion(operationId, cajaId, 'validada', '   ')

    expect(result).toBe('Indica una decisión y un motivo de hasta 1000 caracteres.')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('no elige una caja de otra sucursal cuando no hay sucursal activa', async () => {
    const from = vi.fn()
    vi.spyOn(sessionModule, 'getSessionFast').mockResolvedValue({
      supabase: { from } as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: null,
    })

    await expect(getCajaActiva()).resolves.toEqual({
      data: null,
      error: 'Selecciona una sucursal en el Tablet antes de liquidar caja.',
    })
    expect(from).not.toHaveBeenCalled()
  })
})
