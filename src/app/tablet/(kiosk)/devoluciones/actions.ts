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

const SolicitudInputSchema = z.object({
  ventaId: z.string().uuid(),
  motivo: z.string().trim().min(3).max(500),
  items: z.array(z.object({ ventaItemId: z.string().uuid(), cantidad: z.number().positive() })).min(1),
})

const RecepcionInputSchema = z.object({
  devolucionId: z.string().uuid(),
  recibido: z.boolean(),
  condicionDeclarada: z.enum(['apto_reventa', 'dañado', 'incompleto', 'no_recibido']),
  observacion: z.string().trim().max(1000).nullable().optional(),
}).superRefine((value, ctx) => {
  const necesitaObservacion = !value.recibido || value.condicionDeclarada !== 'apto_reventa'
  if (necesitaObservacion && !value.observacion?.trim()) ctx.addIssue({ code: 'custom', message: 'La observación es obligatoria para esta condición.' })
  if (value.recibido && value.condicionDeclarada === 'no_recibido') ctx.addIssue({ code: 'custom', message: 'La condición no coincide con la recepción.' })
  if (!value.recibido && value.condicionDeclarada !== 'no_recibido') ctx.addIssue({ code: 'custom', message: 'La condición no coincide con la recepción.' })
})

const AprobacionInputSchema = z.object({
  devolucionId: z.string().uuid(),
  reingresoAprobado: z.boolean(),
  overrideMotivo: z.string().trim().max(1000).nullable().optional(),
})

const RechazoInputSchema = z.object({
  devolucionId: z.string().uuid(),
  motivo: z.string().trim().min(3).max(1000),
})

export type PostventaActionState = {
  status: 'success' | 'error'
  devolucionId?: string
  message: string
}

export type DevolucionBandeja = {
  id: string
  estado: 'solicitada' | 'recibida' | 'aprobada' | 'liquidada' | 'rechazada'
  motivo: string
  created_at: string
  sucursal_id: string
  venta_numero: string | null
  recepcion_recibido: boolean | null
  condicion_declarada: string | null
  recepcion_observacion: string | null
  reingreso_aprobado: boolean | null
  rechazo_motivo: string | null
  nota_credito: {
    status: 'pending' | 'processing' | 'retry' | 'submitted' | 'accepted' | 'rejected' | 'dead_letter'
    serie: string
    correlativo: number
    attempt_count: number
    next_attempt_at: string
    last_attempt_at: string | null
    error_code: string | null
    error_message: string | null
  } | null
}

export async function getBandejaDevoluciones(): Promise<{ data: DevolucionBandeja[]; error: string | null }> {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return { data: [], error: 'No autenticado.' }
  let query = supabase.from('ra_devoluciones')
    .select('id,estado,motivo,created_at,sucursal_id,recepcion_recibido,condicion_declarada,recepcion_observacion,reingreso_aprobado,rechazo_motivo,ra_ventas(numero_completo)')
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at', { ascending: false })
    .limit(100)
  if (perfil.rol === 'vendedor' || (isAdmin(perfil.rol) && sucursalId)) {
    if (!sucursalId) return { data: [], error: 'Tienda no seleccionada.' }
    query = query.eq('sucursal_id', sucursalId)
  }
  const { data, error } = await query
  if (error) return { data: [], error: 'No se pudo cargar la bandeja de devoluciones.' }
  const devolucionIds = (data ?? []).map((row: any) => row.id)
  const { data: notas, error: notasError } = devolucionIds.length
    ? await supabase.from('ra_sunat_nota_credito_outbox')
      .select('devolucion_id,status,serie,correlativo,attempt_count,next_attempt_at,last_attempt_at,error_code,error_message')
      .in('devolucion_id', devolucionIds)
    : { data: [], error: null }
  if (notasError) return { data: [], error: 'No se pudo cargar el estado fiscal de las notas de crédito.' }
  const notaPorDevolucion = new Map((notas ?? []).map((nota: any) => [nota.devolucion_id, nota]))
  return {
    data: (data ?? []).map((row: any) => ({
      id: row.id, estado: row.estado, motivo: row.motivo, created_at: row.created_at, sucursal_id: row.sucursal_id,
      venta_numero: row.ra_ventas?.numero_completo ?? null, recepcion_recibido: row.recepcion_recibido,
      condicion_declarada: row.condicion_declarada, recepcion_observacion: row.recepcion_observacion,
      reingreso_aprobado: row.reingreso_aprobado, rechazo_motivo: row.rechazo_motivo,
      nota_credito: notaPorDevolucion.get(row.id) ?? null,
    })), error: null,
  }
}

export type LiquidarDevolucionState = {
  status: 'liquidated' | 'error'
  devolucionId?: string
  message: string
  fiscal: 'not_required' | 'accepted' | 'submitted' | 'pending_review'
}

function returnErrorMessage(message?: string): string {
  if (message?.includes('RA_FORBIDDEN')) return 'No tienes permiso para realizar esta acción.'
  if (message?.includes('RA_NOT_FOUND')) return 'La devolución no está disponible para tu empresa o sucursal.'
  if (message?.includes('RA_RETURN_QUANTITY_EXCEEDED')) return 'La cantidad solicitada supera lo que queda disponible para devolver.'
  if (message?.includes('RA_RETURN_STATE_INVALID')) return 'La devolución cambió de estado y esta acción ya no corresponde.'
  if (message?.includes('RA_RETURN_RECEIPT_APPROVAL_REQUIRED')) return 'Primero debe registrarse la recepción física y aprobarse documentalmente.'
  if (message?.includes('RA_RETURN_OVERRIDE_MOTIVE_REQUIRED')) return 'Debes indicar el motivo para forzar el reingreso de una pieza dañada o incompleta.'
  if (message?.includes('RA_RETURN_RECEIPT_ALREADY_RECORDED')) return 'La recepción ya fue registrada para esta devolución.'
  if (message?.includes('RA_CASHBOX_NOT_OPEN')) return 'La devolución requiere una caja abierta en la sucursal emisora.'
  if (message?.includes('RA_RETURN_FISCAL_RECONCILIATION_REQUIRED')) return 'El comprobante original todavía no fue aceptado o rechazado por SUNAT; no se puede liquidar.'
  if (message?.includes('RA_CREDIT_NOTE_SERIES_NOT_CONFIGURED')) return 'No hay serie de nota de crédito configurada para la sucursal.'
  if (message?.includes('RA_CREDIT_NOTE_SERIES_INVALID')) return 'La serie de nota de crédito debe tener cuatro caracteres, por ejemplo FC01 o BC01. Corrige la configuración antes de liquidar.'
  if (message?.includes('RA_RETURN_REFERENCE_REQUIRED')) return 'Falta la referencia del reembolso digital.'
  if (message?.includes('RA_IDEMPOTENCY_CONFLICT')) return 'La operación ya fue usada con datos diferentes.'
  return 'No se pudo liquidar la devolución; no se confirmaron efectos parciales.'
}

function isAdmin(rol?: string | null) {
  return rol === 'administrador' || rol === 'superadmin'
}

function revalidarPostventa(devolucionId?: string) {
  revalidatePath('/tablet/devoluciones')
  revalidatePath('/panel/devoluciones')
  if (devolucionId) revalidatePath(`/panel/devoluciones/${devolucionId}`)
}

export async function solicitarDevolucion(input: unknown): Promise<PostventaActionState> {
  const parsed = SolicitudInputSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', message: 'Revisa los ítems y el motivo de la solicitud.' }
  const { supabase, user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id || perfil.rol !== 'vendedor') return { status: 'error', message: 'Solo el vendedor de la sucursal puede solicitar una devolución.' }
  const { data, error } = await supabase.rpc('ra_solicitar_devolucion_v1', {
    p_operation_id: crypto.randomUUID(),
    p_venta_id: parsed.data.ventaId,
    p_items: parsed.data.items.map((item) => ({ ventaItemId: item.ventaItemId, cantidad: item.cantidad })),
    p_motivo: parsed.data.motivo,
  } as never)
  if (error || !data) return { status: 'error', message: returnErrorMessage(error?.message) }
  const result = data as { devolucionId?: string }
  revalidarPostventa(result.devolucionId)
  return { status: 'success', devolucionId: result.devolucionId, message: 'Solicitud creada. Registra la recepción cuando la pieza llegue al mostrador.' }
}

export async function registrarRecepcionDevolucion(input: unknown): Promise<PostventaActionState> {
  const parsed = RecepcionInputSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', message: parsed.error.issues[0]?.message ?? 'Datos de recepción inválidos.' }
  const { supabase, user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id || perfil.rol !== 'vendedor') return { status: 'error', message: 'Solo el vendedor de la sucursal puede registrar la recepción física.' }
  const { data, error } = await supabase.rpc('ra_registrar_recepcion_devolucion_v1', {
    p_operation_id: crypto.randomUUID(), p_devolucion_id: parsed.data.devolucionId,
    p_recibido: parsed.data.recibido, p_condicion_declarada: parsed.data.condicionDeclarada,
    p_observacion: parsed.data.observacion?.trim() || null,
  } as never)
  if (error || !data) return { status: 'error', message: returnErrorMessage(error?.message) }
  revalidarPostventa(parsed.data.devolucionId)
  return { status: 'success', devolucionId: parsed.data.devolucionId, message: parsed.data.recibido ? 'Recepción registrada; queda pendiente de revisión administrativa.' : 'Se registró que la pieza no fue recibida.' }
}

export async function aprobarDevolucion(input: unknown): Promise<PostventaActionState> {
  const parsed = AprobacionInputSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', message: 'Datos de aprobación inválidos.' }
  const { supabase, user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id || !isAdmin(perfil.rol)) return { status: 'error', message: 'Solo un administrador puede aprobar devoluciones.' }
  const { data, error } = await supabase.rpc('ra_aprobar_devolucion_v1', {
    p_operation_id: crypto.randomUUID(), p_devolucion_id: parsed.data.devolucionId,
    p_reingreso_aprobado: parsed.data.reingresoAprobado, p_reingreso_override_motivo: parsed.data.overrideMotivo?.trim() || null,
  } as never)
  if (error || !data) return { status: 'error', message: returnErrorMessage(error?.message) }
  revalidarPostventa(parsed.data.devolucionId)
  return { status: 'success', devolucionId: parsed.data.devolucionId, message: 'Devolución aprobada y lista para liquidar.' }
}

export async function rechazarDevolucion(input: unknown): Promise<PostventaActionState> {
  const parsed = RechazoInputSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', message: 'Indica el motivo del rechazo.' }
  const { supabase, user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id || !isAdmin(perfil.rol)) return { status: 'error', message: 'Solo un administrador puede rechazar devoluciones.' }
  const { data, error } = await supabase.rpc('ra_rechazar_devolucion_v1', {
    p_operation_id: crypto.randomUUID(), p_devolucion_id: parsed.data.devolucionId, p_motivo: parsed.data.motivo,
  } as never)
  if (error || !data) return { status: 'error', message: returnErrorMessage(error?.message) }
  revalidarPostventa(parsed.data.devolucionId)
  return { status: 'success', devolucionId: parsed.data.devolucionId, message: 'Devolución rechazada.' }
}

export async function liquidarDevolucionYEmitirNotaCredito(input: unknown): Promise<LiquidarDevolucionState> {
  const parsed = LiquidacionInputSchema.safeParse(input)
  if (!parsed.success) return { status: 'error', message: 'Datos de devolución inválidos.', fiscal: 'not_required' }
  const { supabase, user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id) {
    return { status: 'error', message: 'No autenticado.', fiscal: 'not_required' }
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
  if (!user || !perfil?.empresa_id || !['administrador', 'superadmin'].includes(perfil.rol)) {
    return { status: 'error', message: 'Solo un administrador autorizado puede reenviar la nota de crédito.', fiscal: 'not_required' }
  }
  const response = await supabase.from('ra_devoluciones').select('id, sucursal_id')
    .eq('id', devolucionId).eq('empresa_id', perfil.empresa_id).maybeSingle()
  const devolucion = response.data as unknown as { id: string; sucursal_id: string } | null
  const { error } = response
  if (error || !devolucion || (sucursalId && devolucion.sucursal_id !== sucursalId)) {
    return { status: 'error', message: 'Devolución no disponible para tu empresa o sucursal.', fiscal: 'not_required' }
  }
  const { data: nota, error: notaError } = await supabase
    .from('ra_sunat_nota_credito_outbox')
    .select('status')
    .eq('devolucion_id', devolucionId)
    .maybeSingle()
  const notaFiscal = nota as unknown as { status: string } | null
  if (notaError || !notaFiscal) return { status: 'error', message: 'No hay una nota de crédito fiscal pendiente para esta devolución.', fiscal: 'not_required' }
  if (!['pending', 'retry'].includes(notaFiscal.status)) {
    const estado = notaFiscal.status === 'submitted'
      ? 'El resultado fiscal es incierto; requiere conciliación manual, no reenvío.'
      : `La nota de crédito está en estado ${notaFiscal.status}; no admite reintento manual.`
    return { status: 'error', message: estado, fiscal: 'not_required' }
  }
  try {
    const fiscal = await processSunatNotaCreditoOutboxForDevolucion(devolucionId, true)
    revalidarPostventa(devolucionId)
    revalidatePath('/tablet/ventas')
    if (fiscal.outcome === 'accepted') return { status: 'liquidated', devolucionId, message: 'Nota de crédito aceptada.', fiscal: 'accepted' }
    if (fiscal.outcome === 'submitted') return { status: 'liquidated', devolucionId, message: 'Nota de crédito enviada y pendiente de confirmación.', fiscal: 'submitted' }
    return { status: 'liquidated', devolucionId, message: 'La nota de crédito continúa pendiente para revisión.', fiscal: 'pending_review' }
  } catch (cause) {
    console.error('[nota-credito-manual] reintento falló', cause instanceof Error ? cause.message : 'unknown')
    return { status: 'liquidated', devolucionId, message: 'La devolución sigue válida; no se pudo emitir la nota de crédito ahora.', fiscal: 'pending_review' }
  }
}
