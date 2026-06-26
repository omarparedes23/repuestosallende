'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { RaCompraUpdate } from '@/lib/types/database'

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

  const { data } = await supabase
    .from('ra_productos')
    .select(`
      id,
      catalogo_id,
      precio_compra,
      ra_catalogo_repuestos ( nombre, codigo_oem )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .limit(20)

  const filtered = (data ?? []).filter((row: any) => {
    const nombre = row.ra_catalogo_repuestos?.nombre ?? ''
    const codigo = row.ra_catalogo_repuestos?.codigo_oem ?? ''
    const term = q.toLowerCase()
    return nombre.toLowerCase().includes(term) || codigo.toLowerCase().includes(term)
  })

  return filtered.map((row: any) => ({
    catalogo_id: row.catalogo_id,
    nombre: row.ra_catalogo_repuestos?.nombre ?? '',
    codigo_oem: row.ra_catalogo_repuestos?.codigo_oem ?? null,
    precio_compra: row.precio_compra,
  }))
}

export async function registrarCompra(
  proveedorId: string,
  nroDocumento: string | null,
  notas: string | null,
  items: ItemCompra[]
): Promise<{ id: string | null; error: string | null }> {
  if (items.length === 0) return { id: null, error: 'Debes agregar al menos un artículo.' }

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
  })

  if (error) {
    console.error('[registrarCompra] RPC error:', error)
    return { id: null, error: 'Error al registrar la compra.' }
  }

  revalidatePath('/panel/compras')
  return { id: data as string, error: null }
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
