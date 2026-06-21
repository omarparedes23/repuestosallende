'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import type { RaMetodoPago } from '@/lib/types/database'

export async function abrirCaja(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const montoStr = formData.get('monto_inicial') as string
  const montoInicial = parseFloat(montoStr)

  if (isNaN(montoInicial) || montoInicial < 0) {
    return 'Ingresa un monto inicial válido.'
  }

  const { supabase: supabaseRaw, user, perfil } = await getSession()
  const supabase = supabaseRaw as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'
  if (!['administrador', 'vendedor'].includes(perfil.rol)) {
    return 'Sin permisos para abrir caja.'
  }

  const { data: existente } = await supabase
    .from('ra_cajas')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('empresa_id', perfil.empresa_id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (existente) return 'Ya tienes una caja abierta.'

  const { error } = await supabase.from('ra_cajas').insert({
    empresa_id: perfil.empresa_id,
    usuario_id: user.id,
    estado: 'abierta',
    monto_inicial: montoInicial,
  })

  if (error) return 'Error al abrir la caja. Intenta de nuevo.'

  revalidatePath('/tablet', 'layout')
  return null
}

export async function cerrarCaja(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const montoFinalStr = formData.get('monto_final') as string
  const montoFinal = montoFinalStr ? parseFloat(montoFinalStr) : null

  const { supabase: supabaseRaw, user, perfil } = await getSession()
  const supabase = supabaseRaw as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'

  const { data: caja } = await supabase
    .from('ra_cajas')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('empresa_id', perfil.empresa_id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!caja) return 'No hay una caja abierta para cerrar.'

  const { error } = await supabase
    .from('ra_cajas')
    .update({
      estado: 'cerrada',
      fecha_cierre: new Date().toISOString(),
      monto_final: montoFinal ?? null,
    })
    .eq('id', caja.id)

  if (error) return 'Error al cerrar la caja. Intenta de nuevo.'

  // El kiosk layout detectará que no hay caja y mostrará AbrirCajaScreen
  redirect('/tablet/pos')
}

export async function registrarMovimiento(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const tipo = formData.get('tipo') as 'ingreso' | 'egreso'
  const concepto = (formData.get('concepto') as string)?.trim()
  const montoStr = formData.get('monto') as string
  const metodoPago = (formData.get('metodo_pago') as RaMetodoPago) ?? 'efectivo'

  const monto = parseFloat(montoStr)
  if (isNaN(monto) || monto <= 0) return 'Ingresa un monto válido (mayor a cero).'
  if (!concepto) return 'El concepto es obligatorio.'
  if (!['ingreso', 'egreso'].includes(tipo)) return 'Tipo de movimiento inválido.'

  const { supabase: supabaseRaw, user, perfil } = await getSession()
  const supabase = supabaseRaw as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'

  const { data: caja } = await supabase
    .from('ra_cajas')
    .select('id')
    .eq('usuario_id', user.id)
    .eq('empresa_id', perfil.empresa_id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!caja) return 'No hay una caja abierta.'

  const { error } = await supabase.from('ra_movimientos_caja').insert({
    caja_id: caja.id,
    tipo,
    concepto,
    monto,
    metodo_pago: metodoPago,
  })

  if (error) return 'Error al registrar el movimiento.'

  revalidatePath('/tablet/caja')
  return null
}
