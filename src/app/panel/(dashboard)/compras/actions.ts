'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getSession, getSessionFast } from '@/lib/session'
import { CompraInputSchema } from './actions.schema'

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
  nombre_producto?: string
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

export type ActionResponse<T> = {
  data: T | null
  error: string | null
}

export type CompraResult = {
  id: string
  operationId: string
  replayed: boolean
  total: number
  totalPen: number
  estadoPago: string
}

const COMPRA_ERROR_MESSAGES: Record<string, string> = {
  RA_UNAUTHENTICATED: 'No autenticado',
  RA_FORBIDDEN: 'Sin permisos para registrar compras',
  RA_BRANCH_INVALID: 'La sucursal seleccionada no es válida o no está autorizada',
  RA_PROVIDER_INVALID: 'El proveedor no es válido para esta compra',
  RA_PRODUCT_INVALID: 'Uno o más productos no son válidos para esta compra',
  RA_ITEMS_INVALID: 'Los artículos de la compra no son válidos',
  RA_CURRENCY_INVALID: 'La moneda o el tipo de cambio no son válidos',
  RA_ORDER_INVALID: 'La orden de compra no es válida o excede la cantidad pendiente',
  RA_INVOICE_INVALID: 'El tipo o número de comprobante no es válido',
  RA_INVOICE_DUPLICATE: 'El número de comprobante ya está registrado para este proveedor',
  RA_IDEMPOTENCY_CONFLICT: 'La operación ya fue confirmada con datos diferentes',
  RA_PAYMENT_EXCEEDS_TOTAL: 'El abono inicial supera el total de la compra',
  RA_PAYMENT_METHOD_INVALID: 'El método de pago del abono inicial no es válido',
  RA_PAYMENT_AMOUNT_INVALID: 'El monto del abono inicial no es válido',
  RA_PAYMENT_REFERENCE_TOO_LONG: 'La referencia de pago excede el límite permitido',
  RA_AMOUNT_OVERFLOW: 'El importe total o saldo supera el límite permitido',
  RA_ESTADO_PAGO_INCONSISTENTE: 'Inconsistencia en el estado de pago',
}

function compraErrorMessage(message?: string): string {
  const code = Object.keys(COMPRA_ERROR_MESSAGES).find((candidate) => message?.includes(candidate))
  return code
    ? COMPRA_ERROR_MESSAGES[code]
    : 'No se pudo confirmar la compra. Conservamos el intento para consultar su resultado.'
}

type RpcCompraResult = {
  status: 'confirmed'
  replayed: boolean
  operationId?: string
  compra: {
    id: string
    total: number
    total_pen?: number
    estado_pago: string
  }
}

function mapRpcCompraResult(raw: unknown, fallbackOperationId: string): CompraResult {
  const result = raw as RpcCompraResult
  const compra = result.compra
  return {
    id: compra.id,
    operationId: result.operationId ?? fallbackOperationId,
    replayed: Boolean(result.replayed),
    total: Number(compra.total),
    totalPen: Number(compra.total_pen ?? compra.total),
    estadoPago: compra.estado_pago ?? 'pendiente',
  }
}

type CompraQueryResult = {
  id: string
  nro_documento: string | null
  fecha_compra: string
  total: number
  estado_pago: 'pendiente' | 'parcial' | 'pagado'
  notas: string | null
  sucursal_id: string
  ra_proveedores: { nombre: string } | null
}

export async function getCompras() {
  const { supabase, perfil } = await getSessionFast()
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

  const mapped = ((data ?? []) as unknown as CompraQueryResult[]).map((row) => ({
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
  const { supabase, perfil } = await getSessionFast()
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

type ProductoParaCompraQuery = {
  id: string
  catalogo_id: string
  precio_compra: number | null
  ra_catalogo_repuestos: {
    nombre: string
    codigo_oem: string | null
  } | null
}

export async function buscarProductosParaCompra(q: string) {
  const { supabase, perfil } = await getSessionFast()
  if (!perfil?.empresa_id) return []

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

  return ((data ?? []) as unknown as ProductoParaCompraQuery[]).map((row) => ({
    catalogo_id: row.catalogo_id,
    nombre: row.ra_catalogo_repuestos?.nombre ?? '',
    codigo_oem: row.ra_catalogo_repuestos?.codigo_oem ?? null,
    precio_compra: row.precio_compra,
  }))
}

type OrdenCompraQueryItem = {
  catalogo_id: string
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  cantidad_recibida: number
}

type OrdenCompraQueryResult = {
  id: string
  proveedor_id: string | null
  referencia: string | null
  estado: string
  ra_proveedores: { nombre: string } | null
  ra_orden_compra_items: OrdenCompraQueryItem[]
}

export async function getOrdenCompra(
  id: string
): Promise<{ data: OrdenCompraParaRecepcion | null; error: string | null }> {
  const { supabase, perfil } = await getSessionFast()
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
  const oc = data as unknown as OrdenCompraQueryResult
  if (!oc.proveedor_id) return { data: null, error: 'La orden de compra no tiene proveedor asociado.' }
  if (oc.estado !== 'confirmada') {
    return { data: null, error: 'Solo se pueden recibir órdenes de compra confirmadas.' }
  }

  const items: ItemOrdenCompraPendiente[] = (oc.ra_orden_compra_items ?? [])
    .map((i) => ({
      catalogo_id: i.catalogo_id,
      nombre_producto: i.nombre_producto,
      cantidad_pendiente: i.cantidad - i.cantidad_recibida,
      precio_unitario: i.precio_unitario,
    }))
    .filter((i: ItemOrdenCompraPendiente) => i.cantidad_pendiente > 0)

  return {
    data: {
      id: oc.id,
      proveedorId: oc.proveedor_id,
      proveedorNombre: oc.ra_proveedores?.nombre ?? '—',
      referencia: oc.referencia,
      items,
    },
    error: null,
  }
}

export async function consultarResultadoCompra(operationId: string): Promise<ActionResponse<CompraResult>> {
  const parsed = z.string().uuid({ message: 'Identificador de operación inválido' }).safeParse(operationId)
  if (!parsed.success) return { data: null, error: 'Identificador de operación inválido' }

  const { supabase, user } = await getSession()
  if (!user) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase.rpc('ra_obtener_resultado_compra', {
    p_operation_id: operationId,
  } as never)

  if (error) return { data: null, error: compraErrorMessage(error.message) }
  if (!data || (data as { status?: string }).status === 'not_found') {
    return { data: null, error: null }
  }

  return { data: mapRpcCompraResult(data, operationId), error: null }
}

export async function registrarCompra(input: unknown): Promise<ActionResponse<CompraResult>> {
  const { supabase, user, perfil, sucursalId: resolvedSucursalId } = await getSession()
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }
  if (perfil.rol === 'vendedor' || perfil.rol === 'lectura') {
    return { data: null, error: 'Sin permisos para registrar compras' }
  }

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
    sucursalId = (suc as { id: string } | null)?.id ?? null
  }
  if (!sucursalId) return { data: null, error: 'No hay sucursal configurada.' }

  const parsed = CompraInputSchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const value = parsed.data
  const { data, error } = await supabase.rpc('ra_confirmar_compra', {
    p_operation_id: value.operationId,
    p_sucursal_id: sucursalId,
    p_proveedor_id: value.proveedorId,
    p_nro_documento: value.nroDocumento ? value.nroDocumento.trim() : null,
    p_notas: value.notas ? value.notas.trim() : null,
    p_items: value.items.map((i) => ({
      catalogo_id: i.catalogoId,
      cantidad: i.cantidad,
      precio_unitario: i.precioUnitario,
    })),
    p_orden_compra_id: value.ordenCompraId ?? null,
    p_moneda: value.moneda,
    p_tipo_cambio: value.moneda === 'USD' ? value.tipoCambio : null,
    p_tipo_documento: value.tipoDocumento,
    p_abono_inicial: value.abonoInicial
      ? {
          metodoPago: value.abonoInicial.metodoPago,
          monto: value.abonoInicial.monto,
          referencia: value.abonoInicial.referencia ?? '',
        }
      : null,
  } as never)

  if (error || !data) {
    return { data: null, error: compraErrorMessage(error?.message) }
  }

  revalidatePath('/panel/compras')
  if (value.ordenCompraId) revalidatePath('/panel/ordenes-compra')

  return { data: mapRpcCompraResult(data, value.operationId), error: null }
}

export async function anularCompra(id: string): Promise<string | null> {
  const { supabase, perfil } = await getSession()
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase.rpc('ra_anular_compra', { p_compra_id: id } as never)
  if (error) {
    console.error('[anularCompra] RPC error:', error)
    return error.message ?? 'Error al anular la compra.'
  }

  revalidatePath('/panel/compras')
  return null
}
