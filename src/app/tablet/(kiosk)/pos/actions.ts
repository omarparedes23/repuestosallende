'use server'

import { after } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { Decimal } from 'decimal.js'
import { getSession, getSessionFast } from '@/lib/session'
import { calcularTotalesVenta } from '@/lib/calc/totales'
import { simboloMoneda } from '@/lib/calc/moneda'
import { emitirComprobante } from '@/lib/facturacion/ose'
import { VentaInputSchema } from './actions.schema'
import type { CartItem } from '@/app/tablet/stores/posStore'
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

export async function procesarVenta(
  input: unknown
): Promise<ActionResponse<VentaResult>> {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }
  if (!sucursalId) return { data: null, error: 'Tienda no seleccionada' }
  if (perfil.rol === 'lectura') return { data: null, error: 'Sin permisos para registrar ventas' }

  const parsed = VentaInputSchema.safeParse(input)
  if (!parsed.success) {
    return { data: null, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { tipoComprobante, clienteId, items, pagos, moneda, tipoCambio, fechaVencimiento } = parsed.data
  const productoIds = items.map((i) => i.productoId)
  const necesitaSunat = tipoComprobante === 'boleta' || tipoComprobante === 'factura'
  const tieneLineaCredito = pagos.some((p) => p.metodoPago === 'credito')

  const [cajaRes, prodRes, empresaRes, sucursalRes, clienteCreditoRes] = await Promise.all([
    supabase
      .from('ra_cajas')
      .select('id')
      .eq('sucursal_id', sucursalId)
      .eq('empresa_id', perfil.empresa_id)
      .eq('estado', 'abierta')
      .maybeSingle(),
    supabase
      .from('ra_productos')
      .select(
        `id, catalogo_id, precio_venta, precio_venta_dolar, stock_actual,
         ra_catalogo_repuestos!inner ( id, nombre, codigo_oem, activo )`
      )
      .in('id', productoIds)
      .eq('empresa_id', perfil.empresa_id)
      .eq('activo', true),
    supabase
      .from('ra_empresas' as never)
      .select('ruc, razon_social, direccion, telefono, serie_boleta, serie_factura, serie_ticket')
      .eq('id', perfil.empresa_id)
      .single(),
    supabase
      .from('ra_sucursales')
      .select('nombre, direccion')
      .eq('id', sucursalId)
      .single(),
    tieneLineaCredito && clienteId
      ? supabase.from('ra_clientes').select('tiene_credito').eq('id', clienteId).single()
      : Promise.resolve({ data: null, error: null }),
  ])

  const caja = cajaRes.data
  if (!caja) return { data: null, error: 'No tienes una caja abierta' }

  if (tieneLineaCredito) {
    if (!clienteId) {
      return { data: null, error: 'Selecciona un cliente con crédito habilitado para vender a crédito' }
    }
    if (!fechaVencimiento) {
      return { data: null, error: 'La venta a crédito requiere fecha de vencimiento' }
    }
    const clienteCredito: any = clienteCreditoRes.data
    if (!clienteCredito || !clienteCredito.tiene_credito) {
      return { data: null, error: 'El cliente seleccionado no tiene crédito habilitado' }
    }
  }

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
    // Defensa en profundidad: el cliente ya debió bloquear esto, pero el server nunca confía en el cliente
    if (moneda === 'USD' && prod.precio_venta_dolar == null) {
      return {
        data: null,
        error: `"${prod.ra_catalogo_repuestos.nombre}" no tiene precio en dólares cargado. Cargalo en el panel admin.`,
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
      precioDolar: prod.precio_venta_dolar ?? null,
      cantidad: item.cantidad,
      descuento: item.descuento,
    }
  })

  const totales = calcularTotalesVenta(
    cartItems,
    tipoComprobante as RaTipoComprobante,
    moneda as RaMoneda
  )

  const simbolo = simboloMoneda(moneda as RaMoneda)
  const totalPagado = pagos.reduce((acc, p) => acc.plus(p.monto), new Decimal(0))
  if (totalPagado.lt(new Decimal(totales.total).minus('0.01'))) {
    return {
      data: null,
      error: `Pagado (${simbolo} ${totalPagado.toFixed(2)}) no cubre el total (${simbolo} ${totales.total.toFixed(2)})`,
    }
  }

  // Determinar serie y correlativo para todo comprobante (ticket incluido)
  let serie: string | null = null
  let correlativo: number | null = null

  if (empresa) {
    if (tipoComprobante === 'ticket') {
      serie = empresa.serie_ticket ?? 'T001'
    } else if (tipoComprobante === 'factura') {
      serie = empresa.serie_factura ?? 'F001'
    } else {
      serie = empresa.serie_boleta ?? 'B001'
    }
    const { data: corrData } = await supabase
      .rpc('ra_siguiente_correlativo', { p_empresa_id: perfil.empresa_id, p_serie: serie })
    correlativo = corrData as number
  }

  const { data: venta, error: ventaError } = await supabase
    .from('ra_ventas')
    .insert({
      empresa_id: perfil.empresa_id,
      sucursal_id: sucursalId,
      caja_id: caja.id,
      cliente_id: clienteId ?? null,
      usuario_id: user.id,
      tipo_comprobante: tipoComprobante,
      subtotal: totales.subtotal,
      igv: totales.igv,
      total: totales.total,
      estado: necesitaSunat ? 'pendiente' : 'completada',
      moneda,
      tipo_cambio: moneda === 'USD' ? tipoCambio : null,
      ...(serie && correlativo ? { serie, correlativo } : {}),
    } as never)
    .select('id, total, tipo_comprobante, moneda, serie, correlativo, numero_completo')
    .single()

  if (ventaError || !venta) return { data: null, error: 'Error al registrar la venta' }

  const concepto = `Venta ${venta.id.slice(0, 8).toUpperCase()}`
  // El pago 'credito' no entra a caja como ingreso — se contabiliza aparte
  // en el ledger de cuenta corriente (ver rpc ra_registrar_cargo_credito).
  const pagosCaja = pagos.filter((p) => p.metodoPago !== 'credito')

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
    ...(pagosCaja.length > 0
      ? [
          supabase.from('ra_movimientos_caja').insert(
            pagosCaja.map((p) => ({
              caja_id: caja.id,
              tipo: 'ingreso' as const,
              concepto,
              monto: new Decimal(p.monto).toDecimalPlaces(2).toNumber(),
              metodo_pago: p.metodoPago,
              referencia_id: venta.id,
            }))
          ),
        ]
      : []),
  ])

  // procesarVenta no es transaccional (los inserts de arriba y este RPC son
  // llamadas sueltas, sin BEGIN/COMMIT único) — si el RPC falla acá, la venta
  // ya quedó creada. Deuda técnica conocida, diferida fuera de esta v1.
  // El aviso al cajero (avisoCredito) es la mitigación mínima: no resuelve la
  // atomicidad, pero evita que el fallo pase 100% desapercibido.
  let avisoCredito: string | null = null
  if (tieneLineaCredito) {
    const { error: cargoError } = await supabase.rpc('ra_registrar_cargo_credito', {
      p_venta_id: venta.id,
      p_fecha_vencimiento: fechaVencimiento,
    })
    if (cargoError) {
      console.error(`[cuentas-corrientes] Error registrando cargo para venta ${venta.id}:`, cargoError)
      avisoCredito = 'La venta se registró, pero hubo un error guardando el crédito en cuenta corriente. Avisá al administrador con el número de venta.'
    }
  }

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
          sucursal_id: sucursalId,
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
        moneda: moneda as RaMoneda,
        tipoCambio: moneda === 'USD' ? (tipoCambio ?? undefined) : undefined,
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
      moneda: venta.moneda as RaMoneda,
      serie: venta.serie,
      correlativo: venta.correlativo,
      numero_completo: venta.numero_completo,
      empresa: {
        razon_social: empresa?.razon_social ?? null,
        ruc: empresa?.ruc ?? null,
        direccion: empresa?.direccion ?? null,
        telefono: empresa?.telefono ?? null,
      },
      sucursal: {
        nombre: sucursalRes?.data?.nombre ?? 'Principal',
        direccion: sucursalRes?.data?.direccion ?? null,
      },
      avisoCredito,
    },
    error: null,
  }
}
