'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { RaProveedorInsert, RaProveedorUpdate, RaMetodoPago } from '@/lib/types/database'

// Espejo de MovimientoConVenta (`clientes/actions.ts`), adaptado a cuentas por
// pagar: cliente_id -> proveedor_id, venta_id -> compra_id,
// ra_cuenta_corriente_movimientos -> ra_cuentas_por_pagar_movimientos. A
// diferencia del ledger de clientes, este NO tiene fecha_vencimiento ni
// moneda_cobro/tipo_cambio_cobro (no hay concepto de vencimiento de crédito
// para proveedores en v1 — ver sdd/panel-compras/design).
export type MovimientoConCompra = {
  id: string
  empresa_id: string
  proveedor_id: string
  compra_id: string
  tipo: 'cargo' | 'abono'
  monto: number
  fecha: string
  metodo_pago: RaMetodoPago | null
  referencia: string | null
  usuario_id: string
  created_at: string
  ra_compras: { id: string; nro_documento: string | null; moneda: string; total: number; created_at: string } | null
  usuario_nombre: string | null
}

export async function getProveedores() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_proveedores')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('nombre')

  return { data, error: error?.message ?? null }
}

export async function upsertProveedor(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const id = formData.get('id') as string | null
  const nombre = (formData.get('nombre') as string)?.trim()
  const ruc = (formData.get('ruc') as string)?.trim() || null
  const telefono = (formData.get('telefono') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const direccion = (formData.get('direccion') as string)?.trim() || null
  const contacto = (formData.get('contacto') as string)?.trim() || null
  const notas = (formData.get('notas') as string)?.trim() || null

  if (!nombre) return 'El nombre del proveedor es obligatorio.'

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  if (id) {
    const payload: RaProveedorUpdate = { nombre, ruc, telefono, email, direccion, contacto, notas }
    const { error } = await supabase
      .from('ra_proveedores')
      .update(payload)
      .eq('id', id)
      .eq('empresa_id', perfil.empresa_id)
    if (error) {
      if (error.code === '23505') return 'Ya existe un proveedor con ese RUC.'
      return 'Error al actualizar el proveedor.'
    }
  } else {
    const payload: RaProveedorInsert = {
      empresa_id: perfil.empresa_id,
      nombre, ruc, telefono, email, direccion, contacto, notas,
    }
    const { error } = await supabase.from('ra_proveedores').insert(payload)
    if (error) {
      if (error.code === '23505') return 'Ya existe un proveedor con ese RUC.'
      return 'Error al crear el proveedor.'
    }
  }

  revalidatePath('/panel/proveedores')
  return null
}

export async function getEstadoCuentaProveedor(proveedorId: string): Promise<{
  data: MovimientoConCompra[] | null
  error: string | null
}> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data: movimientos, error } = await supabase
    .from('ra_cuentas_por_pagar_movimientos')
    .select(
      `id, empresa_id, proveedor_id, compra_id, tipo, monto, fecha,
       metodo_pago, referencia, usuario_id, created_at,
       ra_compras ( id, nro_documento, moneda, total, created_at )`
    )
    .eq('proveedor_id', proveedorId)
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })

  if (error) return { data: null, error: 'Error al obtener el estado de cuenta' }

  const filas = movimientos ?? []
  const usuarioIds = [...new Set(filas.map((m: any) => m.usuario_id))]
  const { data: perfiles } = usuarioIds.length
    ? await supabase.from('ra_perfiles').select('id, nombre').in('id', usuarioIds)
    : { data: [] }
  const nombrePorUsuario: Record<string, string> = Object.fromEntries(
    (perfiles ?? []).map((p: any) => [p.id, p.nombre])
  )

  const data: MovimientoConCompra[] = filas.map((m: any) => ({
    ...m,
    usuario_nombre: nombrePorUsuario[m.usuario_id] ?? null,
  }))

  return { data, error: null }
}

export async function registrarPagoProveedor(
  compraId: string,
  monto: number,
  fecha: string,
  metodoPago: RaMetodoPago,
  referencia: string | null
): Promise<{ error: string | null }> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { error: 'No autenticado' }
  if (!['administrador', 'superadmin'].includes(perfil.rol)) return { error: 'Sin permisos.' }

  const { error } = await supabase.rpc('ra_registrar_pago_proveedor', {
    p_compra_id: compraId,
    p_monto: monto,
    p_fecha: fecha,
    p_metodo_pago: metodoPago,
    p_referencia: referencia,
  })

  if (error) return { error: error.message ?? 'Error al registrar el pago' }

  revalidatePath('/panel/proveedores')
  return { error: null }
}

export async function toggleActivoProveedor(id: string, activo: boolean): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase
    .from('ra_proveedores')
    .update({ activo: !activo })
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) return 'Error al actualizar el proveedor.'
  revalidatePath('/panel/proveedores')
  return null
}
