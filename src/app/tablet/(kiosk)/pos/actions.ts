'use server'

import { z } from 'zod'
import { getSession, getSessionFast } from '@/lib/session'
import { VentaInputSchema } from './actions.schema'
import type { RaMoneda, RaTipoComprobante } from '@/lib/types/database'

export type ProductoBuscado = {
  productoId: string
  catalogoId: string
  nombre: string
  codigoOem: string | null
  imagenUrl: string | null
  precioMinorista: number
  precioDolar: number | null
  stockActual: number
}

export type ActionResponse<T> = {
  data: T | null
  error: string | null
}

export type VentaResult = {
  id: string
  operationId: string
  replayed: boolean
  total: number
  tipoComprobante: RaTipoComprobante
  moneda: RaMoneda
  serie: string | null
  correlativo: number | null
  numero_completo: string | null
  empresa: {
    razon_social: string | null
    ruc: string | null
    direccion: string | null
    telefono: string | null
  }
  sucursal: {
    nombre: string
    direccion: string | null
  }
  avisoCredito: string | null
}

const PAGE_SIZE = 40

export type BuscarProductosResult = {
  productos: ProductoBuscado[]
  hasMore: boolean
}

export async function buscarProductos(
  query: string,
  marcaRepuestoId?: string,
  offset = 0
): Promise<ActionResponse<BuscarProductosResult>> {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSessionFast()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }
  if (!sucursalId) return { data: null, error: 'Tienda no seleccionada' }

  // Querying from ra_catalogo_repuestos allows ilike on nombre/codigo_oem directly
  let q = supabase
    .from('ra_catalogo_repuestos')
    .select(
      `id, nombre, codigo_oem, imagen_url,
       ra_productos!inner ( id, precio_venta, precio_venta_dolar, stock_actual, empresa_id, sucursal_id, activo )`
    )
    .eq('activo', true)
    .eq('ra_productos.empresa_id', perfil.empresa_id)
    .eq('ra_productos.sucursal_id', sucursalId)
    .eq('ra_productos.activo', true)
    .gt('ra_productos.stock_actual', 0)
    .order('stock_actual', { referencedTable: 'ra_productos', ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (query.trim()) {
    q = q.or(`nombre.ilike.%${query.trim()}%,codigo_oem.ilike.%${query.trim()}%`)
  }

  if (marcaRepuestoId) {
    q = q.eq('marca_repuesto_id', marcaRepuestoId)
  }

  const { data, error } = await q

  if (error) return { data: null, error: 'Error buscando productos' }

  const filas = data ?? []
  const productos: ProductoBuscado[] = filas.flatMap((row: any) => {
    const prods: any[] = Array.isArray(row.ra_productos) ? row.ra_productos : [row.ra_productos]
    return prods.map((p) => ({
      productoId: p.id,
      catalogoId: row.id,
      nombre: row.nombre,
      codigoOem: row.codigo_oem,
      imagenUrl: row.imagen_url,
      precioMinorista: p.precio_venta ?? 0,
      precioDolar: p.precio_venta_dolar ?? null,
      stockActual: p.stock_actual,
    }))
  })

  return { data: { productos, hasMore: filas.length === PAGE_SIZE }, error: null }
}

const VENTA_ERROR_MESSAGES: Record<string, string> = {
  RA_UNAUTHENTICATED: 'No autenticado',
  RA_FORBIDDEN: 'Sin permisos para registrar ventas',
  RA_BRANCH_INVALID: 'La tienda seleccionada no está autorizada',
  RA_CASHBOX_NOT_OPEN: 'No tienes una caja abierta',
  RA_INVALID_INPUT: 'Los datos de la venta no son válidos',
  RA_IDEMPOTENCY_CONFLICT: 'La operación ya fue utilizada con una venta diferente',
  RA_CUSTOMER_INVALID: 'El cliente no es válido para esta venta',
  RA_CUSTOMER_CREDIT_DISABLED: 'El cliente seleccionado no tiene crédito habilitado',
  RA_PRODUCT_INVALID: 'Uno o más repuestos no están disponibles',
  RA_PRICE_MISSING: 'Uno o más repuestos no tienen precio en la moneda seleccionada',
  RA_DISCOUNT_INVALID: 'El descuento solicitado no es válido',
  RA_PAYMENT_INSUFFICIENT: 'El pago no cubre el total de la venta',
  RA_STOCK_INSUFFICIENT: 'Stock insuficiente para completar la venta',
}

function ventaErrorMessage(message?: string): string {
  const code = Object.keys(VENTA_ERROR_MESSAGES).find((candidate) => message?.includes(candidate))
  return code ? VENTA_ERROR_MESSAGES[code] : 'No se pudo confirmar la venta. Conservamos el intento para consultar su resultado.'
}

type RpcVentaResult = {
  status: 'confirmed'
  replayed: boolean
  operationId: string
  sale: {
    id: string
    total: number
    tipoComprobante: RaTipoComprobante
    moneda: RaMoneda
    serie: string | null
    correlativo: number | null
    numeroCompleto: string | null
  }
  empresa: { razonSocial: string | null; ruc: string | null; direccion: string | null; telefono: string | null }
  sucursal: { nombre: string; direccion: string | null }
  warnings: { creditLimitExceeded: boolean }
}

function mapRpcVentaResult(result: RpcVentaResult): VentaResult {
  return {
    id: result.sale.id,
    operationId: result.operationId,
    replayed: result.replayed,
    total: result.sale.total,
    tipoComprobante: result.sale.tipoComprobante,
    moneda: result.sale.moneda,
    serie: result.sale.serie,
    correlativo: result.sale.correlativo,
    numero_completo: result.sale.numeroCompleto,
    empresa: {
      razon_social: result.empresa.razonSocial,
      ruc: result.empresa.ruc,
      direccion: result.empresa.direccion,
      telefono: result.empresa.telefono,
    },
    sucursal: result.sucursal,
    avisoCredito: result.warnings.creditLimitExceeded
      ? 'La venta fue confirmada y el cliente excedió su límite de crédito.'
      : null,
  }
}

export async function consultarResultadoVenta(operationId: string): Promise<ActionResponse<VentaResult>> {
  const parsed = z.string().uuid().safeParse(operationId)
  if (!parsed.success) return { data: null, error: 'Identificador de operación inválido' }
  const { supabase: rawSupabase, user } = await getSession()
  if (!user) return { data: null, error: 'No autenticado' }
  const { data, error } = await rawSupabase.rpc('ra_obtener_resultado_venta', {
    p_operation_id: operationId,
  } as never)
  if (error) return { data: null, error: ventaErrorMessage(error.message) }
  if (!data || (data as { status?: string }).status === 'not_found') return { data: null, error: null }
  return { data: mapRpcVentaResult(data as unknown as RpcVentaResult), error: null }
}

export async function procesarVenta(input: unknown): Promise<ActionResponse<VentaResult>> {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }
  if (!sucursalId) return { data: null, error: 'Tienda no seleccionada' }
  if (perfil.rol === 'lectura') return { data: null, error: 'Sin permisos para registrar ventas' }

  const parsed = VentaInputSchema.safeParse(input)
  if (!parsed.success) return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  const value = parsed.data
  const { data, error } = await rawSupabase.rpc('ra_confirmar_venta', {
    p_operation_id: value.operationId,
    p_sucursal_id: sucursalId,
    p_tipo_comprobante: value.tipoComprobante,
    p_cliente_id: value.clienteId ?? null,
    p_items: value.items.map(({ productoId, cantidad, descuento }) => ({ productoId, cantidad, descuento })),
    p_pagos: value.pagos,
    p_moneda: value.moneda,
    p_tipo_cambio: value.tipoCambio,
    p_fecha_vencimiento: value.fechaVencimiento ?? null,
  } as never)
  if (error || !data) return { data: null, error: ventaErrorMessage(error?.message) }

  const result = data as RpcVentaResult
  return { data: mapRpcVentaResult(result), error: null }
}
