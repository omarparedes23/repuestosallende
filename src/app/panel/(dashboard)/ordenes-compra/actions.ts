'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'

export type OrdenCompraRow = {
  id: string
  referencia: string | null
  fecha: string
  estado: 'borrador' | 'confirmada' | 'recibida' | 'anulada'
  notas: string | null
  proveedor_nombre: string
  sucursal_id: string
  total_estimado: number
}

export type ItemOrdenCompra = {
  catalogo_id: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
}

export async function getOrdenesCompra() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_ordenes_compra')
    .select(`
      id,
      referencia,
      fecha,
      estado,
      notas,
      sucursal_id,
      ra_proveedores ( nombre ),
      ra_orden_compra_items ( subtotal )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    referencia: row.referencia,
    fecha: row.fecha,
    estado: row.estado,
    notas: row.notas,
    sucursal_id: row.sucursal_id,
    proveedor_nombre: row.ra_proveedores?.nombre ?? '—',
    total_estimado: (row.ra_orden_compra_items ?? []).reduce(
      (acc: number, i: any) => acc + Number(i.subtotal),
      0
    ),
  }))

  return { data: mapped as OrdenCompraRow[], error: error?.message ?? null }
}

// NOTA: buscarProveedores/buscarProductosParaCompra se duplican aquí en vez de
// reexportarse desde `compras/actions.ts` a propósito: ese módulo está siendo
// modificado en paralelo por otro agente (Phase 5), y este módulo (Phase 4) no
// debe depender de su forma final. Mismo patrón exacto que el original.
export async function buscarProveedores(q: string) {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return []

  const { data } = await supabase
    .from('ra_proveedores')
    .select('id, nombre')
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .ilike('nombre', `%${q}%`)
    .limit(10)

  return data ?? []
}

export async function buscarProductosParaCompra(q: string) {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return []

  // El filtro de texto va en la consulta SQL (contra la tabla embebida
  // ra_catalogo_repuestos, vía `!inner` para forzar el join y poder
  // filtrar por sus columnas) — NO se puede traer un `.limit(20)` de
  // ra_productos sin filtrar primero y recién ahí buscar el texto: con
  // decenas de miles de productos, esos 20 arbitrarios casi nunca
  // contienen el término buscado (bug real detectado en QA manual).
  const { data } = await supabase
    .from('ra_productos')
    .select(`
      id,
      catalogo_id,
      precio_compra,
      ra_catalogo_repuestos!inner ( nombre, codigo_oem )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .or(`nombre.ilike.%${q}%,codigo_oem.ilike.%${q}%`, { foreignTable: 'ra_catalogo_repuestos' })
    .limit(20)

  return (data ?? []).map((row: any) => ({
    catalogo_id: row.catalogo_id,
    nombre: row.ra_catalogo_repuestos?.nombre ?? '',
    codigo_oem: row.ra_catalogo_repuestos?.codigo_oem ?? null,
    precio_compra: row.precio_compra,
  }))
}

export async function crearOrdenCompra(
  proveedorId: string,
  referencia: string | null,
  notas: string | null,
  items: ItemOrdenCompra[]
): Promise<{ id: string | null; error: string | null }> {
  if (items.length === 0) return { id: null, error: 'Debes agregar al menos un artículo.' }

  const { supabase: raw, user, perfil, sucursalId: resolvedSucursalId } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id || !user) return { id: null, error: 'No autenticado.' }

  let sucursalId = resolvedSucursalId
  if (!sucursalId) {
    const { data: suc } = await supabase
      .from('ra_sucursales')
      .select('id')
      .eq('empresa_id', perfil.empresa_id)
      .eq('activo', true)
      .order('created_at')
      .limit(1)
      .single()
    sucursalId = suc?.id ?? null
  }
  if (!sucursalId) return { id: null, error: 'No hay sucursal configurada.' }

  // Sin RPC de creación (estado inicial siempre 'borrador'): INSERT directo,
  // mismo patrón simple que el resto del panel admin — la tabla tiene policy
  // "mutate" restringida a administrador/superadmin.
  const { data: oc, error: ocError } = await supabase
    .from('ra_ordenes_compra')
    .insert({
      empresa_id: perfil.empresa_id,
      sucursal_id: sucursalId,
      proveedor_id: proveedorId,
      usuario_id: user.id,
      referencia: referencia || null,
      notas: notas || null,
    })
    .select('id')
    .single()

  if (ocError || !oc) {
    console.error('[crearOrdenCompra] insert error:', ocError)
    return { id: null, error: 'Error al crear la orden de compra.' }
  }

  const itemsPayload = items.map((i) => ({
    orden_compra_id: oc.id,
    catalogo_id: i.catalogo_id,
    nombre_producto: i.nombre_producto,
    cantidad: i.cantidad,
    precio_unitario: i.precio_unitario,
    subtotal: i.cantidad * i.precio_unitario,
  }))

  const { error: itemsError } = await supabase
    .from('ra_orden_compra_items')
    .insert(itemsPayload)

  if (itemsError) {
    console.error('[crearOrdenCompra] items insert error:', itemsError)
    return { id: null, error: 'Error al registrar los artículos de la orden.' }
  }

  revalidatePath('/panel/ordenes-compra')
  return { id: oc.id as string, error: null }
}

export async function confirmarOrdenCompra(id: string): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase.rpc('ra_confirmar_orden_compra', { p_orden_compra_id: id })
  if (error) {
    console.error('[confirmarOrdenCompra] RPC error:', error)
    return 'Error al confirmar la orden de compra.'
  }

  revalidatePath('/panel/ordenes-compra')
  return null
}

export async function anularOrdenCompra(id: string): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase.rpc('ra_anular_orden_compra', { p_orden_compra_id: id })
  if (error) {
    console.error('[anularOrdenCompra] RPC error:', error)
    return 'Error al anular la orden de compra.'
  }

  revalidatePath('/panel/ordenes-compra')
  return null
}
