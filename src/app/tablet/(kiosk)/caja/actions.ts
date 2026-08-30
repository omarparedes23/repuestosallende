'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function rpcError(message: string | null | undefined, fallback: string): string {
  if (!message) return fallback
  if (message.includes('RA_UNAUTHENTICATED')) return 'No autenticado.'
  if (message.includes('RA_FORBIDDEN')) return 'Sin permisos.'
  if (message.includes('RA_IDEMPOTENCY_CONFLICT')) return 'El identificador de operación ya fue usado con otros datos.'
  if (message.includes('RA_NOT_FOUND')) return 'La caja no existe o no pertenece a la tienda.'
  return message
}

export async function abrirCaja(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const montoStr = formData.get('monto_inicial') as string
  const montoInicial = parseFloat(montoStr)
  const operationId = String(formData.get('operation_id') ?? '')

  if (isNaN(montoInicial) || montoInicial < 0) {
    return 'Ingresa un monto inicial válido.'
  }
  if (!UUID.test(operationId)) return 'Identificador de operación inválido.'

  const { supabase: supabaseRaw, user, perfil, sucursalId } = await getSession()
  const supabase = supabaseRaw as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'
  if (!sucursalId) return 'Tienda no seleccionada. Vuelve al inicio.'
  // Only admins and superadmins can open/close caja
  if (!['administrador', 'superadmin'].includes(perfil.rol)) {
    return 'Solo el administrador puede abrir la caja.'
  }

  const { error } = await supabase.rpc('ra_abrir_caja_v1', {
    p_operation_id: operationId,
    p_sucursal_id: sucursalId,
    p_monto_inicial: montoInicial,
    p_notas: null,
  })

  if (error) return rpcError(error.message, 'Error al abrir la caja. Intenta de nuevo.')

  revalidatePath('/tablet', 'layout')
  return null
}

export async function cerrarCaja(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const montoFinalStr = formData.get('monto_final') as string
  const montoFinal = montoFinalStr ? parseFloat(montoFinalStr) : null
  const operationId = String(formData.get('operation_id') ?? '')

  const { supabase: supabaseRaw, user, perfil, sucursalId } = await getSession()
  const supabase = supabaseRaw as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'
  if (!sucursalId) return 'Tienda no seleccionada. Vuelve al inicio.'
  if (!['administrador', 'superadmin'].includes(perfil.rol)) {
    return 'Solo el administrador puede cerrar la caja.'
  }
  if (!UUID.test(operationId)) return 'Identificador de operación inválido.'
  if (montoFinal === null || !Number.isFinite(montoFinal) || montoFinal < 0) return 'Ingresa un efectivo contado válido.'

  const { data: caja } = await supabase.from('ra_cajas').select('id').eq('sucursal_id', sucursalId).eq('empresa_id', perfil.empresa_id).eq('estado', 'abierta').maybeSingle()
  if (!caja || !UUID.test(caja.id)) return 'No hay una caja abierta para cerrar.'

  const { error } = await supabase.rpc('ra_cerrar_caja_v1', {
    p_operation_id: operationId,
    p_caja_id: caja.id,
    p_efectivo_contado: montoFinal,
    p_notas: null,
  })

  if (error) return rpcError(error.message, 'Error al cerrar la caja. Intenta de nuevo.')

  redirect('/tablet/pos')
}

export async function registrarMovimiento(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const tipo = formData.get('tipo') as 'ingreso' | 'egreso'
  const concepto = (formData.get('concepto') as string)?.trim()
  const montoStr = formData.get('monto') as string
  const operationId = String(formData.get('operation_id') ?? '')

  const monto = parseFloat(montoStr)
  if (isNaN(monto) || monto <= 0) return 'Ingresa un monto válido (mayor a cero).'
  if (!concepto) return 'El concepto es obligatorio.'
  if (!['ingreso', 'egreso'].includes(tipo)) return 'Tipo de movimiento inválido.'
  if (!UUID.test(operationId)) return 'Identificador de operación inválido.'

  const { supabase: supabaseRaw, user, perfil, sucursalId } = await getSession()
  const supabase = supabaseRaw as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'
  if (!sucursalId) return 'Tienda no seleccionada. Vuelve al inicio.'

  const { error } = await supabase.rpc('ra_registrar_movimiento_caja_v1', {
    p_operation_id: operationId,
    p_sucursal_id: sucursalId,
    p_tipo: tipo,
    p_concepto: concepto,
    p_monto: monto,
    p_notas: null,
  })

  if (error) return rpcError(error.message, 'Error al registrar el movimiento.')

  revalidatePath('/tablet/caja')
  return null
}
