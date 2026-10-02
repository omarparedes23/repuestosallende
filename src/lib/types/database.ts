// Domain types layered on top of the generated Supabase schema.
// database.generated.ts is produced by `npm run db:types` and must never be edited by hand.
// Postgres enums already arrive typed from the generator; the aliases below only name them.
// Columns still stored as text/char (moneda, outbox status, ...) are narrowed by ColumnOverrides.
import { Constants, type Database as GeneratedDatabase, type Json } from './database.generated'

export type { Json }

type PublicEnums = GeneratedDatabase['public']['Enums']

// ── Postgres enums ─────────────────────────────────────────
export type RaRol = PublicEnums['ra_rol']
export type RaEstadoPagoCompra = PublicEnums['ra_estado_pago_compra']
export type RaEstadoGuia = PublicEnums['ra_estado_guia']
export type RaTipoCliente = PublicEnums['ra_tipo_cliente']
export type RaTipoDocumento = PublicEnums['ra_tipo_documento']
export type RaEstadoCaja = PublicEnums['ra_estado_caja']
export type RaTipoMovimiento = PublicEnums['ra_tipo_movimiento']
export type RaMetodoPago = PublicEnums['ra_metodo_pago']
export type RaTipoComprobante = PublicEnums['ra_tipo_comprobante']
export type RaEstadoVenta = PublicEnums['ra_estado_venta']
export type RaTipoKardex = PublicEnums['ra_tipo_kardex']
export type RaMotivoKardex = PublicEnums['ra_motivo_kardex']
export type RaCcTipoMovimiento = PublicEnums['ra_cc_tipo_movimiento']
export type RaEstadoOrdenCompra = PublicEnums['ra_estado_orden_compra']
export type RaEstadoCompra = PublicEnums['ra_estado_compra']
export type RaCxpTipoMovimiento = PublicEnums['ra_cxp_tipo_movimiento']
export type RaEstadoDevolucion = PublicEnums['ra_estado_devolucion']

// Runtime value lists come from the generator too, so they cannot drift from the database.
export const RA_TIPOS_DOCUMENTO = Constants.public.Enums.ra_tipo_documento
export const RA_METODOS_PAGO = Constants.public.Enums.ra_metodo_pago
export const RA_TIPOS_COMPROBANTE = Constants.public.Enums.ra_tipo_comprobante
export const RA_ESTADOS_VENTA = Constants.public.Enums.ra_estado_venta

export function esValorDe<T extends string>(valores: readonly T[], value: string): value is T {
  return (valores as readonly string[]).includes(value)
}

// ── Columns stored as text/char + CHECK (not Postgres enums) ─
export type RaMoneda = 'PEN' | 'USD'

export type RaEstadoOutboxSunat =
  | 'pending' | 'processing' | 'retry' | 'submitted' | 'accepted' | 'rejected' | 'dead_letter'

export type RaEstadoRevisionLiquidacion = 'pendiente_revision' | 'validada' | 'observada'

// ── Column narrowing over the generated schema ─────────────
// Keeps nullability/optionality from the generated type and swaps only the value type.
type Narrow<T, P> = {
  [K in keyof T]: K extends keyof P ? P[K] | Extract<T[K], null> : T[K]
}

type ColumnOverrides = {
  ra_compras: { moneda: RaMoneda }
  ra_ventas: { moneda: RaMoneda }
  ra_cuenta_corriente_movimientos: { moneda_cobro: RaMoneda }
  ra_sunat_nota_credito_outbox: { status: RaEstadoOutboxSunat }
  ra_liquidaciones: { estado_revision: RaEstadoRevisionLiquidacion }
}

type ArgOverrides = {
  ra_avanzar_estado_guia: { p_nuevo_estado: RaEstadoGuia }
  ra_revisar_liquidacion_v1: { p_decision: Exclude<RaEstadoRevisionLiquidacion, 'pendiente_revision'> }
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
  ra_registrar_cobro_v2: 'p_tipo_cambio_cobro' | 'p_referencia'
  ra_registrar_pago_proveedor_v2: 'p_referencia'
  ra_crear_guia: 'p_notas'
  ra_cerrar_caja_v1: 'p_notas'
  ra_abrir_caja_v1: 'p_notas'
  ra_registrar_movimiento_caja_v1: 'p_notas'
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

