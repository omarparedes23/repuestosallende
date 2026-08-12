'use server'

import { getSessionFast } from '@/lib/session'
import type { RaMoneda } from '@/lib/types/database'

export type VentaResumen = {
  id: string
  created_at: string
  tipo_comprobante: string
  tipo_venta: string
  subtotal: number
  igv: number
  total: number
  estado: string
  moneda: RaMoneda
  tipo_cambio: number | null
  cliente_nombre: string | null
  items_count: number
}

export type VentaDetalle = {
  id: string
  created_at: string
  tipo_comprobante: string
  tipo_venta: string
  subtotal: number
  igv: number
  total: number
  estado: string
  moneda: RaMoneda
  tipo_cambio: number | null
  serie: string | null
  correlativo: number | null
  numero_completo: string | null
  sunat_hash: string | null
  pdf_url: string | null
  cliente_nombre: string | null
  cliente_tipo_documento: string | null
  cliente_nro_documento: string | null
  empresa: {
    nombre: string
    razon_social: string | null
    ruc: string | null
    direccion: string | null
    telefono: string | null
  }
  sucursal: {
    nombre: string
    direccion: string | null
  }
  items: {
    id: string
    nombre_producto: string
    codigo_oem: string | null
    cantidad: number
    precio_unitario: number
    descuento: number
    subtotal: number
  }[]
  pagos: {
    id: string
    metodo_pago: string
    monto: number
    referencia: string | null
  }[]
}

export async function getVentasDelDia(): Promise<{
  data: VentaResumen[]
  error: string | null
}> {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSessionFast()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return { data: [], error: 'No autenticado' }
  if (!sucursalId) return { data: [], error: 'Tienda no seleccionada' }

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('ra_ventas')
    .select(`
      id, created_at, tipo_comprobante, tipo_venta, subtotal, igv, total, estado, moneda, tipo_cambio,
      ra_clientes ( nombre ),
      ra_venta_items ( id )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .eq('sucursal_id', sucursalId)
    .gte('created_at', hoy.toISOString())
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: 'Error cargando ventas' }

  const ventas: VentaResumen[] = (data ?? []).map((v: any) => ({
    id: v.id,
    created_at: v.created_at,
    tipo_comprobante: v.tipo_comprobante,
    tipo_venta: v.tipo_venta,
    subtotal: v.subtotal,
    igv: v.igv,
    total: v.total,
    estado: v.estado,
    moneda: v.moneda,
    tipo_cambio: v.tipo_cambio,
    cliente_nombre: v.ra_clientes?.nombre ?? null,
    items_count: Array.isArray(v.ra_venta_items) ? v.ra_venta_items.length : 0,
  }))

  return { data: ventas, error: null }
}

export async function getVentaDetalle(id: string): Promise<{
  data: VentaDetalle | null
  error: string | null
}> {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSessionFast()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }
  if (!sucursalId) return { data: null, error: 'Tienda no seleccionada' }

  const { data, error } = await supabase
    .from('ra_ventas')
    .select(`
      id, created_at, tipo_comprobante, tipo_venta, subtotal, igv, total, estado, moneda, tipo_cambio,
      serie, correlativo, numero_completo, sunat_hash, pdf_url, sucursal_id,
      ra_clientes ( nombre, tipo_documento, nro_documento ),
      ra_sucursales ( nombre, direccion ),
      ra_empresas ( nombre, razon_social, ruc, direccion, telefono ),
      ra_venta_items ( id, nombre_producto, codigo_oem, cantidad, precio_unitario, descuento, subtotal ),
      ra_venta_pagos ( id, metodo_pago, monto, referencia )
    `)
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)
    .eq('sucursal_id', sucursalId)
    .single()

  if (error || !data) return { data: null, error: 'Venta no encontrada' }

  const detalle: VentaDetalle = {
    id: data.id,
    created_at: data.created_at,
    tipo_comprobante: data.tipo_comprobante,
    tipo_venta: data.tipo_venta,
    subtotal: data.subtotal,
    igv: data.igv,
    total: data.total,
    estado: data.estado,
    moneda: data.moneda,
    tipo_cambio: data.tipo_cambio,
    serie: data.serie,
    correlativo: data.correlativo,
    numero_completo: data.numero_completo,
    sunat_hash: data.sunat_hash,
    pdf_url: data.pdf_url,
    cliente_nombre: (data.ra_clientes as any)?.nombre ?? null,
    cliente_tipo_documento: (data.ra_clientes as any)?.tipo_documento ?? null,
    cliente_nro_documento: (data.ra_clientes as any)?.nro_documento ?? null,
    empresa: {
      nombre: (data.ra_empresas as any)?.nombre ?? '',
      razon_social: (data.ra_empresas as any)?.razon_social ?? null,
      ruc: (data.ra_empresas as any)?.ruc ?? null,
      direccion: (data.ra_empresas as any)?.direccion ?? null,
      telefono: (data.ra_empresas as any)?.telefono ?? null,
    },
    sucursal: {
      nombre: (data.ra_sucursales as any)?.nombre ?? 'Principal',
      direccion: (data.ra_sucursales as any)?.direccion ?? null,
    },
    items: Array.isArray(data.ra_venta_items)
      ? data.ra_venta_items.map((i: any) => ({
          id: i.id,
          nombre_producto: i.nombre_producto,
          codigo_oem: i.codigo_oem,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          descuento: i.descuento,
          subtotal: i.subtotal,
        }))
      : [],
    pagos: Array.isArray(data.ra_venta_pagos)
      ? data.ra_venta_pagos.map((p: any) => ({
          id: p.id,
          metodo_pago: p.metodo_pago,
          monto: p.monto,
          referencia: p.referencia,
        }))
      : [],
  }

  return { data: detalle, error: null }
}
