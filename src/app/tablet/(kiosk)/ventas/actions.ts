'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import { processSunatOutboxForVenta } from '@/lib/facturacion/outbox'
import type { RaMoneda } from '@/lib/types/database'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type EnvioSunatManualState = {
  message: string | null
  tone: 'success' | 'error' | 'info'
}

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

export async function enviarVentaAOseSunat(
  _previousState: EnvioSunatManualState,
  formData: FormData
): Promise<EnvioSunatManualState> {
  const ventaId = String(formData.get('venta_id') ?? '')
  if (!UUID.test(ventaId)) {
    return { message: 'Identificador de venta inválido.', tone: 'error' }
  }

  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()
  if (!user || !perfil?.empresa_id) {
    return { message: 'No autenticado.', tone: 'error' }
  }
  if (!sucursalId) {
    return { message: 'Tienda no seleccionada. Vuelve al inicio.', tone: 'error' }
  }
  if (!['administrador', 'superadmin'].includes(perfil.rol)) {
    return { message: 'Solo el administrador puede enviar comprobantes a OSE/SUNAT.', tone: 'error' }
  }

  const { data: venta, error } = await rawSupabase
    .from('ra_ventas')
    .select('id, tipo_comprobante, estado')
    .eq('id', ventaId)
    .eq('empresa_id', perfil.empresa_id)
    .eq('sucursal_id', sucursalId)
    .maybeSingle()
  const ventaFiscal = venta as unknown as {
    tipo_comprobante: string
    estado: string
  } | null

  if (error || !ventaFiscal) {
    return { message: 'Venta no encontrada en la tienda activa.', tone: 'error' }
  }
  if (!['boleta', 'factura'].includes(ventaFiscal.tipo_comprobante) || ventaFiscal.estado !== 'pendiente') {
    return { message: 'Solo se pueden enviar boletas o facturas pendientes.', tone: 'error' }
  }

  try {
    const result = await processSunatOutboxForVenta(ventaId)
    revalidatePath('/tablet/ventas')
    revalidatePath(`/tablet/ventas/${ventaId}`)

    if (result.claimed === 0) {
      return {
        message: 'El comprobante ya está siendo procesado, fue enviado antes o aún espera su próximo reintento.',
        tone: 'info',
      }
    }
    if (result.processed === 0) {
      return { message: 'No se pudo registrar el resultado del envío. Intenta nuevamente más tarde.', tone: 'error' }
    }
    if (result.outcome === 'accepted') {
      return { message: 'Comprobante aceptado por SUNAT.', tone: 'success' }
    }
    if (result.outcome === 'submitted') {
      return { message: 'Comprobante enviado al OSE. Está pendiente de confirmación.', tone: 'info' }
    }
    if (result.outcome === 'rejected') {
      return { message: 'OSE/SUNAT rechazó el comprobante. Revisa el estado antes de corregirlo.', tone: 'error' }
    }
    return { message: 'El envío no se confirmó; quedó registrado para reintento o revisión administrativa.', tone: 'info' }
  } catch (cause) {
    console.error('[sunat-outbox-manual] Error al procesar venta', cause instanceof Error ? cause.message : 'unknown')
    return { message: 'No se pudo enviar el comprobante. No se modificó la venta comercial.', tone: 'error' }
  }
}
