// Domain types layered on top of the generated Supabase schema.
// database.generated.ts is produced by `npm run db:types` and must never be edited by hand.
// Status columns are stored as text + CHECK constraints in Postgres, so the generator
// types them as string; ColumnOverrides narrows them to the domain unions below.
import type { Database as GeneratedDatabase, Json } from './database.generated'

export type { Json }

export type RaRol = 'superadmin' | 'administrador' | 'vendedor' | 'lectura'

// ── Enums: migrations 008–009 (Panel back-office) ──────────
export type RaEstadoPagoCompra = 'pendiente' | 'parcial' | 'pagado'
export type RaEstadoGuia       = 'borrador' | 'emitida' | 'en_transito' | 'recibida'

// ── Enums: migration 003 (Tablet POS) ──────────────────────
export type RaTipoCliente    = 'mayorista' | 'minorista'
export type RaTipoDocumento  = 'DNI' | 'RUC' | 'CE' | 'PASAPORTE'
export type RaEstadoCaja     = 'abierta' | 'cerrada'
export type RaTipoMovimiento = 'ingreso' | 'egreso'
export type RaMetodoPago     = 'efectivo' | 'yape' | 'tarjeta' | 'transferencia' | 'credito'
export type RaTipoComprobante = 'ticket' | 'boleta' | 'factura'
export type RaEstadoVenta    = 'pendiente' | 'completada' | 'anulada' | 'error_sunat'
export type RaTipoKardex     = 'entrada' | 'salida' | 'ajuste'
export type RaMotivoKardex   = 'venta' | 'compra' | 'ajuste_manual' | 'devolucion' | 'merma' | 'traslado'

// ── Enums: migration 030 (Facturación multimoneda) ─────────
export type RaMoneda = 'PEN' | 'USD'

// ── Enums: migration 032 (Cuentas corrientes / cobranzas) ──
export type RaCcTipoMovimiento = 'cargo' | 'abono'

// ── Enums: migration 033 (Órdenes de compra) ────────────────
export type RaEstadoOrdenCompra = 'borrador' | 'confirmada' | 'recibida' | 'anulada'

// ── Enums: migration 034 (Compras v2) ───────────────────────
export type RaEstadoCompra = 'confirmada' | 'anulada'

// ── Enums: migration 035 (Cuentas por pagar) ────────────────
export type RaCxpTipoMovimiento = 'cargo' | 'abono'

// ── Migrations 055–065 (Devoluciones y notas de crédito) ───────────────
export type RaEstadoDevolucion = 'solicitada' | 'recibida' | 'aprobada' | 'liquidada' | 'rechazada'


// ── Column narrowing over the generated schema ─────────────
// Keeps nullability/optionality from the generated type and swaps only the value type.
type Narrow<T, P> = {
  [K in keyof T]: K extends keyof P ? P[K] | Extract<T[K], null> : T[K]
}

type ColumnOverrides = {
  ra_perfiles: { rol: RaRol }
  ra_compras: { estado_pago: RaEstadoPagoCompra; moneda: RaMoneda; estado: RaEstadoCompra }
  ra_guias_remision: { estado: RaEstadoGuia }
  ra_clientes: { tipo_cliente: RaTipoCliente; tipo_documento: RaTipoDocumento }
  ra_cajas: { estado: RaEstadoCaja }
  ra_movimientos_caja: { tipo: RaTipoMovimiento; metodo_pago: RaMetodoPago }
  ra_ventas: {
    tipo_venta: RaTipoCliente
    tipo_comprobante: RaTipoComprobante
    estado: RaEstadoVenta
    moneda: RaMoneda
  }
  ra_venta_pagos: { metodo_pago: RaMetodoPago }
  ra_kardex: { tipo: RaTipoKardex; motivo: RaMotivoKardex }
  ra_cuenta_corriente_movimientos: {
    tipo: RaCcTipoMovimiento
    moneda_cobro: RaMoneda
    metodo_pago: RaMetodoPago
  }
  ra_ordenes_compra: { estado: RaEstadoOrdenCompra }
  ra_cuentas_por_pagar_movimientos: { tipo: RaCxpTipoMovimiento; metodo_pago: RaMetodoPago }
  ra_auditoria_estado_pago_compras: {
    estado_anterior: RaEstadoPagoCompra
    estado_nuevo: RaEstadoPagoCompra
  }
  ra_devoluciones: { estado: RaEstadoDevolucion }
  ra_sunat_nota_credito_outbox: { tipo_referenciado: RaTipoComprobante }
}

type ArgOverrides = {
  ra_avanzar_estado_guia: { p_nuevo_estado: RaEstadoGuia }
  ra_confirmar_venta: { p_tipo_comprobante: RaTipoComprobante }
  ra_registrar_cobro_v2: { p_metodo_pago: RaMetodoPago }
  ra_registrar_pago_proveedor_v2: { p_metodo_pago: RaMetodoPago }
}

type NarrowTable<T, P> = T extends { Row: infer R; Insert: infer I; Update: infer U }
  ? Omit<T, 'Row' | 'Insert' | 'Update'> & { Row: Narrow<R, P>; Insert: Narrow<I, P>; Update: Narrow<U, P> }
  : T

// The generator types every RPC argument as non-null, but Postgres accepts NULL for any
// parameter. These are the arguments the RPCs explicitly treat NULL as "not provided".
type NullableArgs = {
  ra_confirmar_compra: 'p_nro_documento' | 'p_notas' | 'p_orden_compra_id' | 'p_tipo_cambio'
  ra_confirmar_venta: 'p_cliente_id' | 'p_tipo_cambio' | 'p_fecha_vencimiento' | 'p_numero_placa'
  ra_crear_guia: 'p_notas'
  ra_registrar_recepcion_devolucion_v1: 'p_observacion'
  ra_aprobar_devolucion_v1: 'p_reingreso_override_motivo'
}

type WithNull<T, K> = { [P in keyof T]: P extends K ? T[P] | null : T[P] }

type Get<T, K, Fallback> = K extends keyof T ? T[K] : Fallback

// Distributes over overloaded functions (unions of Args/Returns shapes).
type NarrowFunction<F, P, NullableKeys> = F extends { Args: infer A }
  ? Omit<F, 'Args'> & { Args: WithNull<Narrow<A, P>, NullableKeys> }
  : F

type GeneratedPublic = GeneratedDatabase['public']

export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedPublic, 'Tables' | 'Functions'> & {
    Tables: {
      [N in keyof GeneratedPublic['Tables']]: N extends keyof ColumnOverrides
        ? NarrowTable<GeneratedPublic['Tables'][N], ColumnOverrides[N]>
        : GeneratedPublic['Tables'][N]
    }
    Functions: {
      [N in keyof GeneratedPublic['Functions']]: N extends keyof ArgOverrides | keyof NullableArgs
        ? NarrowFunction<
            GeneratedPublic['Functions'][N],
            Get<ArgOverrides, N, Record<never, never>>,
            Get<NullableArgs, N, never>
          >
        : GeneratedPublic['Functions'][N]
    }
  }
}

// Helpers de tipo para uso en server actions y queries
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Tipos derivados listos para usar
export type MarcaAuto        = Tables<'ra_marcas_auto'>
export type ModeloAuto       = Tables<'ra_modelos_auto'>
export type Categoria        = Tables<'ra_categorias'>
export type CatalogoRepuesto = Tables<'ra_catalogo_repuestos'>
export type Compatibilidad   = Tables<'ra_compatibilidades'>
export type Empresa          = Tables<'ra_empresas'>
export type Perfil           = Tables<'ra_perfiles'>
export type Producto         = Tables<'ra_productos'>

// ── Tipos derivados: migration 006 (Sucursales) ─────────────
export type RaSucursal = Tables<'ra_sucursales'>
export type RaSucursalInsert = TablesInsert<'ra_sucursales'>

// ── Tipos derivados: migration 003 (Tablet POS) ─────────────
export type RaCliente         = Tables<'ra_clientes'>
export type RaCaja            = Tables<'ra_cajas'>
export type RaMovimientoCaja  = Tables<'ra_movimientos_caja'>
export type RaVenta           = Tables<'ra_ventas'>
export type RaVentaItem       = Tables<'ra_venta_items'>
export type RaVentaPago       = Tables<'ra_venta_pagos'>
export type RaKardex          = Tables<'ra_kardex'>
export type RaDevolucion      = Tables<'ra_devoluciones'>
export type RaNotaCreditoOutbox = Tables<'ra_sunat_nota_credito_outbox'>

// ── Tipos derivados: migration 032 (Cuentas corrientes) ─────
export type RaCuentaCorrienteMovimiento = Tables<'ra_cuenta_corriente_movimientos'>
export type RaCuentaCorrienteMovimientoInsert = TablesInsert<'ra_cuenta_corriente_movimientos'>

// Insert helpers para las tablas POS
export type RaClienteInsert        = TablesInsert<'ra_clientes'>
export type RaCajaInsert           = TablesInsert<'ra_cajas'>
export type RaMovimientoCajaInsert = TablesInsert<'ra_movimientos_caja'>
export type RaVentaInsert          = TablesInsert<'ra_ventas'>
export type RaVentaItemInsert      = TablesInsert<'ra_venta_items'>
export type RaVentaPagoInsert      = TablesInsert<'ra_venta_pagos'>
export type RaKardexInsert         = TablesInsert<'ra_kardex'>

// Update helpers para las tablas POS
export type RaClienteUpdate  = TablesUpdate<'ra_clientes'>
export type RaCajaUpdate     = TablesUpdate<'ra_cajas'>
export type RaVentaUpdate    = TablesUpdate<'ra_ventas'>

// ── Tipos derivados: migrations 007–010 (Panel back-office) ──
export type RaProveedor          = Tables<'ra_proveedores'>
export type RaProveedorInsert    = TablesInsert<'ra_proveedores'>
export type RaProveedorUpdate    = TablesUpdate<'ra_proveedores'>

export type RaCompra             = Tables<'ra_compras'>
export type RaCompraInsert       = TablesInsert<'ra_compras'>
export type RaCompraUpdate       = TablesUpdate<'ra_compras'>

export type RaCompraItem         = Tables<'ra_compra_items'>
export type RaCompraItemInsert   = TablesInsert<'ra_compra_items'>

export type RaGuiaRemision       = Tables<'ra_guias_remision'>
export type RaGuiaRemisionInsert = TablesInsert<'ra_guias_remision'>
export type RaGuiaRemisionUpdate = TablesUpdate<'ra_guias_remision'>

export type RaGuiaItem           = Tables<'ra_guia_items'>
export type RaGuiaItemInsert     = TablesInsert<'ra_guia_items'>

export type RaLiquidacion        = Tables<'ra_liquidaciones'>
export type RaLiquidacionInsert  = TablesInsert<'ra_liquidaciones'>

// ── Tipos derivados: migration 033 (Órdenes de compra) ──────
export type RaOrdenCompra        = Tables<'ra_ordenes_compra'>
export type RaOrdenCompraInsert  = TablesInsert<'ra_ordenes_compra'>
export type RaOrdenCompraUpdate  = TablesUpdate<'ra_ordenes_compra'>

export type RaOrdenCompraItem       = Tables<'ra_orden_compra_items'>
export type RaOrdenCompraItemInsert = TablesInsert<'ra_orden_compra_items'>

// ── Tipos derivados: migration 035 (Cuentas por pagar) ──────
export type RaCuentaPorPagarMovimiento       = Tables<'ra_cuentas_por_pagar_movimientos'>
export type RaCuentaPorPagarMovimientoInsert = TablesInsert<'ra_cuentas_por_pagar_movimientos'>

// ── Tipos derivados: migration 043 (Auditoría estado pago) ───
export type RaAuditoriaEstadoPagoCompra       = Tables<'ra_auditoria_estado_pago_compras'>
export type RaAuditoriaEstadoPagoCompraInsert = TablesInsert<'ra_auditoria_estado_pago_compras'>

