'use server'

import { after } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { Decimal } from 'decimal.js'
import { getSession } from '@/lib/session'
import { calcularTotalesVenta } from '@/lib/calc/totales'
import { emitirComprobante } from '@/lib/facturacion/ose'
import type { CartItem } from '@/app/tablet/stores/posStore'
import type { RaTipoCliente, RaTipoComprobante } from '@/lib/types/database'

export type ProductoBuscado = {
  productoId: string
  catalogoId: string
  nombre: string
  codigoOem: string | null
  imagenUrl: string | null
  precioMinorista: number
  precioMayorista: number
  stockActual: number
  categoriaId: string
}

export type ActionResponse<T> = {
  data: T | null
  error: string | null
}

export type VentaResult = {
  id: string
  total: number
  tipoComprobante: RaTipoComprobante
}

const VentaInputSchema = z.object({
  tipoVenta: z.enum(['mayorista', 'minorista']),
  tipoComprobante: z.enum(['ticket', 'boleta', 'factura']),
  clienteId: z.string().min(1).nullable().optional(),
  items: z
    .array(
      z.object({
        productoId: z.string().min(1),
        catalogoId: z.string().min(1),
        cantidad: z.number().positive(),
        descuento: z.number().min(0),
      })
    )
    .min(1, { error: 'El carrito está vacío' }),
  pagos: z
    .array(
      z.object({
        metodoPago: z.enum(['efectivo', 'yape', 'tarjeta', 'transferencia', 'credito']),
        monto: z.number().positive(),
        referencia: z.string().optional(),
      })
    )
    .min(1, { error: 'Agrega al menos un método de pago' }),
})

export async function buscarProductos(
  query: string,
  categoriaId?: string
): Promise<ActionResponse<ProductoBuscado[]>> {
  const { supabase, user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  // Querying from ra_catalogo_repuestos allows ilike on nombre/codigo_oem directly
  let q = supabase
    .from('ra_catalogo_repuestos')
    .select(
      `id, nombre, codigo_oem, imagen_url, categoria_id,
       ra_productos!inner ( id, precio_venta, precio_mayorista, stock_actual, empresa_id, activo )`
    )
    .eq('activo', true)
    .eq('ra_productos.empresa_id', perfil.empresa_id)
    .eq('ra_productos.activo', true)
    .gt('ra_productos.stock_actual', 0)
    .order('nombre')
    .limit(40)

  if (query.trim()) {
    q = q.or(`nombre.ilike.%${query.trim()}%,codigo_oem.ilike.%${query.trim()}%`)
  }

  if (categoriaId) {
    q = q.eq('categoria_id', categoriaId)
  }

  const { data, error } = await q

  if (error) return { data: null, error: 'Error buscando productos' }

  const productos: ProductoBuscado[] = (data ?? []).flatMap((row: any) => {
    const prods: any[] = Array.isArray(row.ra_productos) ? row.ra_productos : [row.ra_productos]
    return prods.map((p) => ({
      productoId: p.id,
      catalogoId: row.id,
      nombre: row.nombre,
      codigoOem: row.codigo_oem,
      imagenUrl: row.imagen_url,
      precioMinorista: p.precio_venta ?? 0,
      precioMayorista: p.precio_mayorista ?? p.precio_venta ?? 0,
      stockActual: p.stock_actual,
      categoriaId: row.categoria_id,
    }))
  })

  return { data: productos, error: null }
}

export async function procesarVenta(
  input: unknown
): Promise<ActionResponse<VentaResult>> {
  const { supabase, user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }
  if (perfil.rol === 'lectura') return { data: null, error: 'Sin permisos para registrar ventas' }

  const parsed = VentaInputSchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { tipoVenta, tipoComprobante, clienteId, items, pagos } = parsed.data
  const productoIds = items.map((i) => i.productoId)
  const necesitaSunat = tipoComprobante === 'boleta' || tipoComprobante === 'factura'

  const [cajaRes, prodRes, empresaRes] = await Promise.all([
    supabase
      .from('ra_cajas')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', perfil.empresa_id)
      .eq('estado', 'abierta')
      .maybeSingle(),
    supabase
      .from('ra_productos')
      .select(
        `id, catalogo_id, precio_venta, precio_mayorista, stock_actual,
         ra_catalogo_repuestos!inner ( id, nombre, codigo_oem, activo )`
      )
      .in('id', productoIds)
      .eq('empresa_id', perfil.empresa_id)
      .eq('activo', true),
    supabase
      .from('ra_empresas' as never)
      .select('ruc, razon_social, serie_boleta, serie_factura')
      .eq('id', perfil.empresa_id)
      .single(),
  ])

  const caja = cajaRes.data
  if (!caja) return { data: null, error: 'No tienes una caja abierta' }

  const productos: any[] = prodRes.data ?? []
  if (productos.length !== productoIds.length) {
    return { data: null, error: 'Uno o más repuestos no están disponibles' }
  }

  const empresa: any = empresaRes.data
  if (necesitaSunat && !empresa?.ruc) {
    return { data: null, error: 'RUC de empresa no configurado' }
  }

  for (const item of items) {
    const prod = productos.find((p) => p.id === item.productoId)!
    if (new Decimal(prod.stock_actual).lt(item.cantidad)) {
      return {
        data: null,
        error: `Stock insuficiente para "${prod.ra_catalogo_repuestos.nombre}". Disponible: ${prod.stock_actual}`,
      }
    }
  }

  const cartItems: CartItem[] = items.map((item) => {
    const prod = productos.find((p) => p.id === item.productoId)!
    return {
      productoId: item.productoId,
      catalogoId: prod.catalogo_id,
      nombre: prod.ra_catalogo_repuestos.nombre,
      codigoOem: prod.ra_catalogo_repuestos.codigo_oem,
      imagenUrl: null,
      stockActual: prod.stock_actual,
      precioMinorista: prod.precio_venta ?? 0,
      precioMayorista: prod.precio_mayorista ?? prod.precio_venta ?? 0,
      cantidad: item.cantidad,
      descuento: item.descuento,
    }
  })

  const totales = calcularTotalesVenta(
    cartItems,
    tipoVenta as RaTipoCliente,
    tipoComprobante as RaTipoComprobante
  )

  const totalPagado = pagos.reduce((acc, p) => acc.plus(p.monto), new Decimal(0))
  if (totalPagado.lt(new Decimal(totales.total).minus('0.01'))) {
    return {
      data: null,
      error: `Pagado (S/. ${totalPagado.toFixed(2)}) no cubre el total (S/. ${totales.total.toFixed(2)})`,
    }
  }

  // Determinar serie y correlativo si aplica SUNAT
  let serie: string | null = null
  let correlativo: number | null = null

  if (necesitaSunat && empresa) {
    serie = tipoComprobante === 'factura' ? (empresa.serie_factura ?? 'F001') : (empresa.serie_boleta ?? 'B001')
    const { data: corrData } = await supabase
      .rpc('ra_siguiente_correlativo', { p_empresa_id: perfil.empresa_id, p_serie: serie })
    correlativo = corrData as number
  }

  const { data: venta, error: ventaError } = await supabase
    .from('ra_ventas')
    .insert({
      empresa_id: perfil.empresa_id,
      caja_id: caja.id,
      cliente_id: clienteId ?? null,
      usuario_id: user.id,
      tipo_venta: tipoVenta,
      tipo_comprobante: tipoComprobante,
      subtotal: totales.subtotal,
      igv: totales.igv,
      total: totales.total,
      estado: necesitaSunat ? 'pendiente' : 'completada',
      ...(serie && correlativo ? { serie, correlativo } : {}),
    } as never)
    .select('id, total, tipo_comprobante')
    .single()

  if (ventaError || !venta) return { data: null, error: 'Error al registrar la venta' }

  const concepto = `Venta ${venta.id.slice(0, 8).toUpperCase()}`

  await Promise.all([
    supabase.from('ra_venta_items').insert(
      totales.items.map((i) => ({
        venta_id: venta.id,
        catalogo_id: i.catalogoId,
        cantidad: i.cantidad,
        precio_unitario: i.precioUnitario,
        descuento: i.descuento,
        subtotal: i.subtotal,
        nombre_producto: i.nombre,
        codigo_oem: i.codigoOem,
      }))
    ),
    supabase.from('ra_venta_pagos').insert(
      pagos.map((p) => ({
        venta_id: venta.id,
        metodo_pago: p.metodoPago,
        monto: new Decimal(p.monto).toDecimalPlaces(2).toNumber(),
        referencia: p.referencia ?? null,
      }))
    ),
    supabase.from('ra_movimientos_caja').insert(
      pagos.map((p) => ({
        caja_id: caja.id,
        tipo: 'ingreso' as const,
        concepto,
        monto: new Decimal(p.monto).toDecimalPlaces(2).toNumber(),
        metodo_pago: p.metodoPago,
        referencia_id: venta.id,
      }))
    ),
  ])

  // Stock y kardex vía service role
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  await Promise.all(
    totales.items.flatMap((item) => {
      const prod = productos.find((p) => p.id === item.productoId)!
      const stockAnterior = new Decimal(prod.stock_actual)
      const stockNuevo = stockAnterior.minus(item.cantidad).toDecimalPlaces(3).toNumber()
      return [
        admin
          .from('ra_productos')
          .update({ stock_actual: stockNuevo })
          .eq('id', item.productoId),
        admin.from('ra_kardex').insert({
          empresa_id: perfil.empresa_id,
          catalogo_id: item.catalogoId,
          tipo: 'salida',
          motivo: 'venta',
          cantidad: item.cantidad,
          stock_anterior: stockAnterior.toNumber(),
          stock_nuevo: stockNuevo,
          referencia_id: venta.id,
          usuario_id: user.id,
        }),
      ]
    })
  )

  // Emisión SUNAT en background — no bloquea la respuesta al usuario
  if (necesitaSunat && serie && correlativo && empresa) {
    const ventaId = venta.id
    const empresaId = perfil.empresa_id
    const userId = user.id

    // Buscar datos del cliente si hay clienteId
    let clienteData: { nombre: string; tipoDocumento: string | null; nroDocumento: string | null } = {
      nombre: 'Consumidor Final',
      tipoDocumento: null,
      nroDocumento: null,
    }
    if (clienteId) {
      const { data: cli } = await supabase
        .from('ra_clientes')
        .select('nombre, tipo_documento, nro_documento')
        .eq('id', clienteId)
        .single()
      if (cli) {
        clienteData = {
          nombre: (cli as any).nombre,
          tipoDocumento: (cli as any).tipo_documento,
          nroDocumento: (cli as any).nro_documento,
        }
      }
    }

    const fechaEmision = new Date().toISOString().split('T')[0]
    const oseItems = totales.items.map((i) => ({
      descripcion: i.nombre,
      cantidad: i.cantidad,
      valorUnitario: i.precioUnitario,
      subtotalBase: i.subtotal,
    }))

    after(async () => {
      const result = await emitirComprobante({
        tipo: tipoComprobante === 'factura' ? 'FACTURA' : 'BOLETA',
        serie: serie!,
        correlativo: correlativo!,
        rucEmisor: empresa.ruc,
        razonSocial: empresa.razon_social ?? empresa.nombre,
        fechaEmision,
        cliente: clienteData,
        items: oseItems,
        subtotal: totales.subtotal,
        igv: totales.igv,
        total: totales.total,
      })

      const adminBg = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )

      await adminBg
        .from('ra_ventas')
        .update({
          estado: result.exito ? 'completada' : 'error_sunat',
          sunat_estado: result.exito
            ? result.sunat_aceptada ? 'aceptada' : 'pendiente'
            : 'rechazado',
          sunat_hash: result.hash ?? null,
          id_externo: result.id_externo ?? null,
          pdf_url: result.pdf_url ?? null,
          xml_url: result.xml_url ?? null,
        } as never)
        .eq('id', ventaId)

      if (!result.exito) {
        console.error(`[SUNAT] Venta ${ventaId} — error: ${result.error}`)
      } else {
        console.log(`[SUNAT] Venta ${ventaId} — ${result.sunat_aceptada ? 'ACEPTADA' : 'PENDIENTE'} — ${result.id_externo}`)
      }
    })
  }

  return {
    data: {
      id: venta.id,
      total: venta.total,
      tipoComprobante: venta.tipo_comprobante as RaTipoComprobante,
    },
    error: null,
  }
}
