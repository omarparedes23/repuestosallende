'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { RaCompraUpdate, RaMoneda } from '@/lib/types/database'

export type CompraRow = {
  id: string
  nro_documento: string | null
  fecha_compra: string
  total: number
  estado_pago: 'pendiente' | 'parcial' | 'pagado'
  notas: string | null
  proveedor_nombre: string
  sucursal_id: string
}

export type ItemCompra = {
  catalogo_id: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
}

export type ItemOrdenCompraPendiente = {
  catalogo_id: string
  nombre_producto: string
  cantidad_pendiente: number
  precio_unitario: number
}

export type OrdenCompraParaRecepcion = {
  id: string
  proveedorId: string
  proveedorNombre: string
  referencia: string | null
  items: ItemOrdenCompraPendiente[]
}

export async function getCompras() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_compras')
    .select(`
      id,
      nro_documento,
      fecha_compra,
      total,
      estado_pago,
      notas,
      sucursal_id,
      ra_proveedores ( nombre )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha_compra', { ascending: false })

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    nro_documento: row.nro_documento,
    fecha_compra: row.fecha_compra,
    total: row.total,
    estado_pago: row.estado_pago,
    notas: row.notas,
    sucursal_id: row.sucursal_id,
    proveedor_nombre: row.ra_proveedores?.nombre ?? '—',
  }))

  return { data: mapped as CompraRow[], error: error?.message ?? null }
}

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
  // contienen el término buscado (bug real detectado en QA manual,
  // mismo fix aplicado en ordenes-compra/actions.ts).
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

// NOTA: se consulta ra_ordenes_compra/ra_orden_compra_items directamente acá
// (en vez de reexportar una función de `ordenes-compra/actions.ts`) porque ese
// módulo lo está construyendo otro agente en paralelo (Phase 4) — no debe haber
// dependencia cruzada entre ambos mientras los dos están en construcción. Mismo
// criterio que la nota espejo que dejó ese módulo sobre buscarProveedores/
// buscarProductosParaCompra.
export async function getOrdenCompra(
  id: string
): Promise<{ data: OrdenCompraParaRecepcion | null; error: string | null }> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_ordenes_compra')
    .select(`
      id,
      proveedor_id,
      referencia,
      estado,
      ra_proveedores ( nombre ),
      ra_orden_compra_items ( catalogo_id, nombre_producto, cantidad, precio_unitario, cantidad_recibida )
    `)
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)
    .single()

  if (error || !data) return { data: null, error: 'Orden de compra no encontrada.' }
  if (!data.proveedor_id) return { data: null, error: 'La orden de compra no tiene proveedor asociado.' }
  if (data.estado !== 'confirmada') {
    return { data: null, error: 'Solo se pueden recibir órdenes de compra confirmadas.' }
  }

  const items: ItemOrdenCompraPendiente[] = (data.ra_orden_compra_items ?? [])
    .map((i: any) => ({
      catalogo_id: i.catalogo_id,
      nombre_producto: i.nombre_producto,
      cantidad_pendiente: i.cantidad - i.cantidad_recibida,
      precio_unitario: i.precio_unitario,
    }))
    .filter((i: ItemOrdenCompraPendiente) => i.cantidad_pendiente > 0)

  return {
    data: {
      id: data.id,
      proveedorId: data.proveedor_id,
      proveedorNombre: data.ra_proveedores?.nombre ?? '—',
      referencia: data.referencia,
      items,
    },
    error: null,
  }
}

export async function registrarCompra(
  proveedorId: string,
  nroDocumento: string | null,
  notas: string | null,
  items: ItemCompra[],
  ordenCompraId?: string | null,
  moneda: RaMoneda = 'PEN',
  tipoCambio?: number | null
): Promise<{ id: string | null; error: string | null }> {
  if (items.length === 0) return { id: null, error: 'Debes agregar al menos un artículo.' }
  if (moneda === 'USD' && (!tipoCambio || tipoCambio <= 0)) {
    return { id: null, error: 'Ingresa un tipo de cambio válido para una compra en dólares.' }
  }

  const { supabase: raw, perfil, sucursalId: resolvedSucursalId } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { id: null, error: 'No autenticado.' }

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

  const { data, error } = await supabase.rpc('ra_registrar_compra', {
    p_empresa_id: perfil.empresa_id,
    p_sucursal_id: sucursalId,
    p_proveedor_id: proveedorId,
    p_nro_documento: nroDocumento || null,
    p_notas: notas || null,
    p_items: items,
    p_orden_compra_id: ordenCompraId || null,
    p_moneda: moneda,
    p_tipo_cambio: moneda === 'USD' ? tipoCambio : null,
  })

  if (error) {
    console.error('[registrarCompra] RPC error:', error)
    return { id: null, error: 'Error al registrar la compra.' }
  }

  const compraId = data as string

  // Wiring del cargo a cuentas por pagar: RPC aparte a propósito — mismo
  // patrón que procesarVenta -> ra_registrar_cargo_credito (ver
  // src/app/tablet/(kiosk)/pos/actions.ts). ra_registrar_compra NO genera el
  // cargo automáticamente. Si esta segunda llamada falla, la compra ya quedó
  // registrada (stock/kardex/costeo ya aplicados) y NO se revierte — mismo
  // gap de atomicidad ya aceptado en sdd/cuentas-corrientes/design (Open
  // Questions): se loguea para diagnóstico, no se bloquea al usuario.
  if (proveedorId) {
    const { error: cargoError } = await supabase.rpc('ra_registrar_cargo_compra', {
      p_compra_id: compraId,
    })
    if (cargoError) {
      console.error(`[cuentas-por-pagar] Error registrando cargo para compra ${compraId}:`, cargoError)
    }
  }

  revalidatePath('/panel/compras')
  if (ordenCompraId) revalidatePath('/panel/ordenes-compra')
  return { id: compraId, error: null }
}

export async function anularCompra(id: string): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase.rpc('ra_anular_compra', { p_compra_id: id })
  if (error) {
    console.error('[anularCompra] RPC error:', error)
    // El mensaje de la excepción de Postgres es el motivo real (sin cargo vs.
    // stock negativo) — se devuelve tal cual en vez de un genérico.
    return error.message ?? 'Error al anular la compra.'
  }

  revalidatePath('/panel/compras')
  return null
}

export async function actualizarEstadoPago(
  id: string,
  estadoPago: 'pendiente' | 'parcial' | 'pagado'
): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const payload: RaCompraUpdate = { estado_pago: estadoPago }
  const { error } = await supabase
    .from('ra_compras')
    .update(payload)
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) return 'Error al actualizar el estado de pago.'
  revalidatePath('/panel/compras')
  return null
}
