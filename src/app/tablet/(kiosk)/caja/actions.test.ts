import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sessionModule from '@/lib/session'
import { abrirCaja, registrarMovimiento } from './actions'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))

const operationId = '11111111-1111-4111-8111-111111111111'

function form(values: Record<string, string>) {
  const data = new FormData()
  Object.entries(values).forEach(([key, value]) => data.set(key, value))
  return data
}

describe('caja actions — RPC idempotentes', () => {
  let rpc: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    rpc = vi.fn().mockResolvedValue({ data: {}, error: null })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: { rpc } as never,
      user: { id: 'user-1' } as never,
      perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
      sucursalId: '22222222-2222-4222-8222-222222222222',
    })
  })

  it('abre por RPC con operationId estable', async () => {
    const result = await abrirCaja(null, form({ monto_inicial: '120.50', operation_id: operationId }))
    expect(result).toBeNull()
    expect(rpc).toHaveBeenCalledWith('ra_abrir_caja_v1', {
      p_operation_id: operationId,
      p_sucursal_id: '22222222-2222-4222-8222-222222222222',
      p_monto_inicial: 120.5,
      p_notas: null,
    })
  })

  it('rechaza operationId inválido antes de tocar la base', async () => {
    const result = await abrirCaja(null, form({ monto_inicial: '10', operation_id: 'no-uuid' }))
    expect(result).toBe('Identificador de operación inválido.')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('registra un movimiento manual solo como efectivo mediante RPC', async () => {
    const result = await registrarMovimiento(null, form({
      operation_id: operationId,
      tipo: 'egreso',
      concepto: 'Fondo de cambio',
      monto: '20.00',
    }))
    expect(result).toBeNull()
    expect(rpc).toHaveBeenCalledWith('ra_registrar_movimiento_caja_v1', {
      p_operation_id: operationId,
      p_sucursal_id: '22222222-2222-4222-8222-222222222222',
      p_tipo: 'egreso',
      p_concepto: 'Fondo de cambio',
      p_monto: 20,
      p_notas: null,
    })
  })
})
