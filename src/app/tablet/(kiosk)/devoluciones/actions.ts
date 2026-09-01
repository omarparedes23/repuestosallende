'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { processSunatNotaCreditoOutboxForDevolucion } from '@/lib/facturacion/outbox'
import { getSession } from '@/lib/session'

const LiquidacionInputSchema = z.object({
  operationId: z.string().uuid(),
  devolucionId: z.string().uuid(),
  referencias: z.record(z.string(), z.string().trim().max(250)).default({}),
})

export type LiquidarDevolucionState = {
  status: 'liquidated' | 'error'
  devolucionId?: string
  message: string
  fiscal: 'not_required' | 'accepted' | 'submitted' | 'pending_review'
}

function returnErrorMessage(message?: string): string {
  if (message?.includes('RA_FORBIDDEN')) return 'Solo un administrador puede recibir y liquidar devoluciones.'
  if (message?.includes('RA_CASHBOX_NOT_OPEN')) return 'La devolución requiere una caja abierta en la sucursal emisora.'
  if (message?.includes('RA_RETURN_FISCAL_RECONCILIATION_REQUIRED')) return 'El comprobante original requiere conciliación fiscal antes de devolverlo.'
  if (message?.includes('RA_CREDIT_NOTE_SERIES_NOT_CONFIGURED')) return 'No hay serie de nota de crédito configurada para la sucursal.'
  if (message?.includes('RA_RETURN_REFERENCE_REQUIRED')) return 'Falta la referencia del reembolso digital.'
  if (message?.includes('RA_IDEMPOTENCY_CONFLICT')) return 'La operación ya fue usada con datos diferentes.'
  return 'No se pudo liquidar la devolución; no se confirmaron efectos parciales.'
}

export async function liquidarDevolucionYEmitirNotaCredito(input: unknown): Promise<LiquidarDevolucionState> {
  const parsed = LiquidacionInputSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', message: 'Datos de devolución inválidos.', fiscal: 'not_required' }
  const { supabase, user, perfil, sucursalId } = await getSession()
  if (!user || !perfil?.empresa_id || !sucursalId) {
    return { status: 'error', message: 'No autenticado o sin tienda activa.', fiscal: 'not_required' }
  }
  if (!['administrador', 'superadmin'].includes(perfil.rol)) {
    return { status: 'error', message: 'Solo un administrador puede liquidar devoluciones.', fiscal: 'not_required' }
  }
  const { data, error } = await supabase.rpc('ra_liquidar_devolucion_v1', {
    p_operation_id: parsed.data.operationId,
    p_devolucion_id: parsed.data.devolucionId,
    p_referencias: parsed.data.referencias,
  } as never)
  if (error || !data) return { status: 'error', message: returnErrorMessage(error?.message), fiscal: 'not_required' }

  const result = data as { devolucionId: string; notaCredito?: { status?: string } }
  revalidatePath('/tablet/ventas')
  if (result.notaCredito?.status !== 'pending') {
    return { status: 'liquidated', devolucionId: result.devolucionId, message: 'Devolución liquidada.', fiscal: 'not_required' }
  }
  try {
    const fiscal = await processSunatNotaCreditoOutboxForDevolucion(result.devolucionId)
    if (fiscal.outcome === 'accepted') {
      return { status: 'liquidated', devolucionId: result.devolucionId, message: 'Devolución liquidada y nota de crédito aceptada.', fiscal: 'accepted' }
    }
    if (fiscal.outcome === 'submitted') {
      return { status: 'liquidated', devolucionId: result.devolucionId, message: 'Devolución liquidada; nota de crédito enviada y pendiente de confirmación.', fiscal: 'submitted' }
    }
  } catch (cause) {
    console.error('[nota-credito-inmediata] emisión posterior al commit falló', cause instanceof Error ? cause.message : 'unknown')
  }
  return { status: 'liquidated', devolucionId: result.devolucionId, message: 'Devolución liquidada. La nota de crédito quedó pendiente para revisión o reintento manual.', fiscal: 'pending_review' }
}

export async function reintentarNotaCreditoDevolucion(devolucionId: string): Promise<LiquidarDevolucionState> {
  if (!z.string().uuid().safeParse(devolucionId).success) {
    return { status: 'error', message: 'Identificador de devolución inválido.', fiscal: 'not_required' }
  }
  const { supabase, user, perfil, sucursalId } = await getSession()
  if (!user || !perfil?.empresa_id || !sucursalId || !['administrador', 'superadmin'].includes(perfil.rol)) {
    return { status: 'error', message: 'Solo un administrador autorizado puede reenviar la nota de crédito.', fiscal: 'not_required' }
  }
  const response = await supabase.from('ra_devoluciones').select('id, sucursal_id')
    .eq('id', devolucionId).eq('empresa_id', perfil.empresa_id).maybeSingle()
  const devolucion = response.data as unknown as { id: string; sucursal_id: string } | null
  const { error } = response
  if (error || !devolucion || devolucion.sucursal_id !== sucursalId) {
    return { status: 'error', message: 'Devolución no encontrada en la tienda activa.', fiscal: 'not_required' }
  }
  try {
    const fiscal = await processSunatNotaCreditoOutboxForDevolucion(devolucionId, true)
    revalidatePath('/tablet/ventas')
    if (fiscal.outcome === 'accepted') return { status: 'liquidated', devolucionId, message: 'Nota de crédito aceptada.', fiscal: 'accepted' }
    if (fiscal.outcome === 'submitted') return { status: 'liquidated', devolucionId, message: 'Nota de crédito enviada y pendiente de confirmación.', fiscal: 'submitted' }
    return { status: 'liquidated', devolucionId, message: 'La nota de crédito continúa pendiente para revisión.', fiscal: 'pending_review' }
  } catch (cause) {
    console.error('[nota-credito-manual] reintento falló', cause instanceof Error ? cause.message : 'unknown')
    return { status: 'liquidated', devolucionId, message: 'La devolución sigue válida; no se pudo emitir la nota de crédito ahora.', fiscal: 'pending_review' }
  }
}
