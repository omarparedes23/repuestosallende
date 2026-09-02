import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as sessionModule from '@/lib/session'
import { processSunatNotaCreditoOutboxForDevolucion } from '@/lib/facturacion/outbox'
import { liquidarDevolucionYEmitirNotaCredito } from './actions'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/facturacion/outbox', () => ({ processSunatNotaCreditoOutboxForDevolucion: vi.fn() }))

const devolucionId = '11111111-1111-4111-8111-111111111111'
const operationId = '22222222-2222-4222-8222-222222222222'

function sessionWithRpc(rpc: ReturnType<typeof vi.fn>) {
  vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
    supabase: { rpc } as never,
    user: { id: 'admin-1' } as never,
    perfil: { id: 'admin-1', empresa_id: 'empresa-1', rol: 'administrador', activo: true } as never,
    sucursalId: 'sucursal-1',
  })
}

describe('liquidarDevolucionYEmitirNotaCredito', () => {
  beforeEach(() => vi.clearAllMocks())

  it('confirma el reverso antes de intentar la emisión inmediata', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { devolucionId, notaCredito: { status: 'pending' } }, error: null,
    })
    sessionWithRpc(rpc)
    vi.mocked(processSunatNotaCreditoOutboxForDevolucion).mockResolvedValue({ claimed: 1, processed: 1, outcome: 'accepted' })

    await expect(liquidarDevolucionYEmitirNotaCredito({ operationId, devolucionId, referencias: {} }))
      .resolves.toEqual(expect.objectContaining({ status: 'liquidated', fiscal: 'accepted' }))
    expect(rpc).toHaveBeenCalledWith('ra_liquidar_devolucion_v1', expect.objectContaining({
      p_operation_id: operationId, p_devolucion_id: devolucionId,
    }))
    expect(processSunatNotaCreditoOutboxForDevolucion).toHaveBeenCalledWith(devolucionId)
  })

  it('no deshace la devolución cuando la emisión posterior falla', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { devolucionId, notaCredito: { status: 'pending' } }, error: null,
    })
    sessionWithRpc(rpc)
    vi.mocked(processSunatNotaCreditoOutboxForDevolucion).mockRejectedValue(new Error('OSE caída'))

    await expect(liquidarDevolucionYEmitirNotaCredito({ operationId, devolucionId, referencias: {} }))
      .resolves.toEqual(expect.objectContaining({ status: 'liquidated', fiscal: 'pending_review' }))
  })

  it('permite liquidar al administrador global sin sucursal activa', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { devolucionId }, error: null })
    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: { rpc } as never,
      user: { id: 'admin-global' } as never,
      perfil: { id: 'admin-global', empresa_id: 'empresa-1', rol: 'administrador', activo: true, sucursal_id: null } as never,
      sucursalId: null,
    })

    await expect(liquidarDevolucionYEmitirNotaCredito({ operationId, devolucionId, referencias: {} }))
      .resolves.toEqual(expect.objectContaining({ status: 'liquidated' }))
    expect(rpc).toHaveBeenCalledWith('ra_liquidar_devolucion_v1', expect.objectContaining({ p_devolucion_id: devolucionId }))
  })
})
