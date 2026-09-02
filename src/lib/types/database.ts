export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

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

export interface Database {
  public: {
    Tables: {
      ra_marcas_auto: {
        Row: {
          id: string
          nombre: string
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          activo?: boolean
        }
      }
      ra_modelos_auto: {
        Row: {
          id: string
          marca_id: string
          nombre: string
          slug: string
          tagline: string | null
          motor: string | null
          cc: string | null
          año_desde: number | null
          año_hasta: number | null
          imagen_url: string | null
          activo: boolean
          updated_at: string | null
        }
        Insert: {
          id?: string
          marca_id: string
          nombre: string
          slug: string
          tagline?: string | null
          motor?: string | null
          cc?: string | null
          año_desde?: number | null
          año_hasta?: number | null
          imagen_url?: string | null
          activo?: boolean
          updated_at?: string | null
        }
        Update: {
          id?: string
          marca_id?: string
          nombre?: string
          slug?: string
          tagline?: string | null
          motor?: string | null
          cc?: string | null
          año_desde?: number | null
          año_hasta?: number | null
          imagen_url?: string | null
          activo?: boolean
          updated_at?: string | null
        }
      }
      ra_categorias: {
        Row: {
          id: string
          nombre: string
          slug: string
          parent_id: string | null
          orden: number
          activo: boolean
        }
        Insert: {
          id?: string
          nombre: string
          slug: string
          parent_id?: string | null
          orden?: number
          activo?: boolean
        }
        Update: {
          id?: string
          nombre?: string
          slug?: string
          parent_id?: string | null
          orden?: number
          activo?: boolean
        }
      }
      ra_catalogo_repuestos: {
        Row: {
          id: string
          categoria_id: string
          codigo_oem: string | null
          nombre: string
          descripcion: string | null
          imagen_url: string | null
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          categoria_id: string
          codigo_oem?: string | null
          nombre: string
          descripcion?: string | null
          imagen_url?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          categoria_id?: string
          codigo_oem?: string | null
          nombre?: string
          descripcion?: string | null
          imagen_url?: string | null
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ra_compatibilidades: {
        Row: {
          id: string
          catalogo_id: string
          modelo_id: string
          año_desde: number | null
          año_hasta: number | null
        }
        Insert: {
          id?: string
          catalogo_id: string
          modelo_id: string
          año_desde?: number | null
          año_hasta?: number | null
        }
        Update: {
          id?: string
          catalogo_id?: string
          modelo_id?: string
          año_desde?: number | null
          año_hasta?: number | null
        }
      }
      // ── Sucursales (migration 006) ─────────────────────────
      ra_sucursales: {
        Row: {
          id: string
          empresa_id: string
          nombre: string
          direccion: string | null
          activo: boolean
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          nombre: string
          direccion?: string | null
          activo?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          nombre?: string
          direccion?: string | null
          activo?: boolean
          created_at?: string
        }
      }
      ra_empresas: {
        Row: {
          id: string
          nombre: string
          slug: string
          logo_url: string | null
          telefono: string | null
          email: string | null
          direccion: string | null
          activo: boolean
          created_at: string
          ruc: string | null
          razon_social: string | null
          serie_boleta: string | null
          serie_factura: string | null
          serie_ticket: string | null
        }
        Insert: {
          id?: string
          nombre: string
          slug: string
          logo_url?: string | null
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          activo?: boolean
          created_at?: string
          ruc?: string | null
          razon_social?: string | null
          serie_boleta?: string | null
          serie_factura?: string | null
          serie_ticket?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          slug?: string
          logo_url?: string | null
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          activo?: boolean
          created_at?: string
          ruc?: string | null
          razon_social?: string | null
          serie_boleta?: string | null
          serie_factura?: string | null
          serie_ticket?: string | null
        }
      }
      ra_perfiles: {
        Row: {
          id: string
          empresa_id: string | null
          sucursal_id: string | null
          nombre: string
          rol: RaRol
          activo: boolean
        }
        Insert: {
          id: string
          empresa_id?: string | null
          sucursal_id?: string | null
          nombre: string
          rol?: RaRol
          activo?: boolean
        }
        Update: {
          id?: string
          empresa_id?: string | null
          sucursal_id?: string | null
          nombre?: string
          rol?: RaRol
          activo?: boolean
        }
      }
      ra_productos: {
        Row: {
          id: string
          empresa_id: string
          sucursal_id: string
          catalogo_id: string
          codigo_interno: string | null
          precio_venta: number | null
          precio_venta_dolar: number | null
          precio_compra: number | null
          stock_actual: number
          stock_minimo: number
          activo: boolean
          moneda: string
        }
        Insert: {
          id?: string
          empresa_id: string
          sucursal_id: string
          catalogo_id: string
          codigo_interno?: string | null
          precio_venta?: number | null
          precio_venta_dolar?: number | null
          precio_compra?: number | null
          stock_actual?: number
          stock_minimo?: number
          activo?: boolean
          moneda?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          sucursal_id?: string
          catalogo_id?: string
          codigo_interno?: string | null
          precio_venta?: number | null
          precio_venta_dolar?: number | null
          precio_compra?: number | null
          stock_actual?: number
          stock_minimo?: number
          activo?: boolean
          moneda?: string
        }
      }
      // ── Panel back-office tables (migrations 007–010) ──────
      ra_proveedores: {
        Row: {
          id: string
          empresa_id: string
          nombre: string
          ruc: string | null
          telefono: string | null
          email: string | null
          direccion: string | null
          contacto: string | null
          notas: string | null
          saldo_deudor: number
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          nombre: string
          ruc?: string | null
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          contacto?: string | null
          notas?: string | null
          saldo_deudor?: number
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          nombre?: string
          ruc?: string | null
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          contacto?: string | null
          notas?: string | null
          saldo_deudor?: number
          activo?: boolean
          updated_at?: string
        }
      }
      ra_compras: {
        Row: {
          id: string
          empresa_id: string
          sucursal_id: string
          proveedor_id: string | null
          usuario_id: string
          operation_id: string | null
          request_hash: string | null
          tipo_documento: string
          nro_documento: string | null
          nro_doc_norm: string | null
          fecha_compra: string
          subtotal: number
          igv: number
          total: number
          total_pen: number | null
          estado_pago: RaEstadoPagoCompra
          notas: string | null
          orden_compra_id: string | null
          moneda: RaMoneda
          tipo_cambio: number | null
          estado: RaEstadoCompra
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          sucursal_id: string
          proveedor_id?: string | null
          usuario_id: string
          operation_id?: string | null
          request_hash?: string | null
          tipo_documento?: string
          nro_documento?: string | null
          fecha_compra?: string
          subtotal?: number
          igv?: number
          total?: number
          total_pen?: number | null
          estado_pago?: RaEstadoPagoCompra
          notas?: string | null
          orden_compra_id?: string | null
          moneda?: RaMoneda
          tipo_cambio?: number | null
          estado?: RaEstadoCompra
          created_at?: string
          updated_at?: string
        }
        Update: {
          proveedor_id?: string | null
          operation_id?: string | null
          request_hash?: string | null
          tipo_documento?: string
          nro_documento?: string | null
          fecha_compra?: string
          subtotal?: number
          igv?: number
          total?: number
          total_pen?: number | null
          estado_pago?: RaEstadoPagoCompra
          notas?: string | null
          orden_compra_id?: string | null
          moneda?: RaMoneda
          tipo_cambio?: number | null
          estado?: RaEstadoCompra
          updated_at?: string
        }
      }
      ra_compra_items: {
        Row: {
          id: string
          compra_id: string
          catalogo_id: string
          nombre_producto: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          created_at: string
        }
        Insert: {
          id?: string
          compra_id: string
          catalogo_id: string
          nombre_producto: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          created_at?: string
        }
        Update: {
          cantidad?: number
          precio_unitario?: number
          subtotal?: number
        }
      }
      ra_guias_remision: {
        Row: {
          id: string
          empresa_id: string
          sucursal_origen_id: string
          sucursal_destino_id: string
          usuario_id: string
          estado: RaEstadoGuia
          serie: string | null
          correlativo: number | null
          notas: string | null
          fecha_emision: string | null
          fecha_recepcion: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          sucursal_origen_id: string
          sucursal_destino_id: string
          usuario_id: string
          estado?: RaEstadoGuia
          serie?: string | null
          correlativo?: number | null
          notas?: string | null
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          estado?: RaEstadoGuia
          serie?: string | null
          correlativo?: number | null
          notas?: string | null
          fecha_emision?: string | null
          fecha_recepcion?: string | null
          updated_at?: string
        }
      }
      ra_guia_items: {
        Row: {
          id: string
          guia_id: string
          catalogo_id: string
          nombre_producto: string
          cantidad: number
          created_at: string
        }
        Insert: {
          id?: string
          guia_id: string
          catalogo_id: string
          nombre_producto: string
          cantidad: number
          created_at?: string
        }
        Update: {
          cantidad?: number
        }
      }
      ra_liquidaciones: {
        Row: {
          id: string
          caja_id: string
          empresa_id: string
          usuario_id: string
          sistema_efectivo: number
          sistema_yape: number
          sistema_tarjeta: number
          sistema_transferencia: number
          sistema_credito: number
          conteo_efectivo: number
          conteo_yape: number
          conteo_tarjeta: number
          conteo_transferencia: number
          conteo_credito: number
          diff_efectivo: number
          diff_yape: number
          diff_tarjeta: number
          diff_transferencia: number
          diff_credito: number
          notas: string | null
          operation_id: string | null
          request_hash: string | null
          estado_revision: 'pendiente_revision' | 'validada' | 'observada'
          revisado_por: string | null
          revisado_at: string | null
          motivo_revision: string | null
          review_operation_id: string | null
          review_request_hash: string | null
          review_result_snapshot: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          caja_id: string
          empresa_id: string
          usuario_id: string
          sistema_efectivo?: number
          sistema_yape?: number
          sistema_tarjeta?: number
          sistema_transferencia?: number
          sistema_credito?: number
          conteo_efectivo?: number
          conteo_yape?: number
          conteo_tarjeta?: number
          conteo_transferencia?: number
          conteo_credito?: number
          notas?: string | null
          operation_id?: string | null
          request_hash?: string | null
          estado_revision?: 'pendiente_revision' | 'validada' | 'observada'
          revisado_por?: string | null
          revisado_at?: string | null
          motivo_revision?: string | null
          review_operation_id?: string | null
          review_request_hash?: string | null
          review_result_snapshot?: Json | null
          created_at?: string
        }
        Update: {
          conteo_efectivo?: number
          conteo_yape?: number
          conteo_tarjeta?: number
          conteo_transferencia?: number
          conteo_credito?: number
          notas?: string | null
          estado_revision?: 'pendiente_revision' | 'validada' | 'observada'
          revisado_por?: string | null
          revisado_at?: string | null
          motivo_revision?: string | null
          review_operation_id?: string | null
          review_request_hash?: string | null
          review_result_snapshot?: Json | null
        }
      }
      // ── Tablet POS tables (migration 003) ──────────────────
      ra_clientes: {
        Row: {
          id: string
          empresa_id: string
          tipo_cliente: RaTipoCliente
          tipo_documento: RaTipoDocumento | null
          nro_documento: string | null
          nombre: string
          telefono: string | null
          email: string | null
          direccion: string | null
          tiene_credito: boolean
          limite_credito: number
          saldo_deudor: number
          activo: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          tipo_cliente?: RaTipoCliente
          tipo_documento?: RaTipoDocumento | null
          nro_documento?: string | null
          nombre: string
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          tiene_credito?: boolean
          limite_credito?: number
          saldo_deudor?: number
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          tipo_cliente?: RaTipoCliente
          tipo_documento?: RaTipoDocumento | null
          nro_documento?: string | null
          nombre?: string
          telefono?: string | null
          email?: string | null
          direccion?: string | null
          tiene_credito?: boolean
          limite_credito?: number
          saldo_deudor?: number
          activo?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ra_cajas: {
        Row: {
          id: string
          empresa_id: string
          sucursal_id: string
          usuario_id: string
          estado: RaEstadoCaja
          monto_inicial: number
          monto_final: number | null
          fecha_apertura: string
          fecha_cierre: string | null
          notas: string | null
          operation_id: string | null
          request_hash: string | null
        }
        Insert: {
          id?: string
          empresa_id: string
          sucursal_id: string
          usuario_id: string
          estado?: RaEstadoCaja
          monto_inicial?: number
          monto_final?: number | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          notas?: string | null
          operation_id?: string | null
          request_hash?: string | null
        }
        Update: {
          id?: string
          empresa_id?: string
          sucursal_id?: string
          usuario_id?: string
          estado?: RaEstadoCaja
          monto_inicial?: number
          monto_final?: number | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          notas?: string | null
          operation_id?: string | null
          request_hash?: string | null
        }
      }
      ra_movimientos_caja: {
        Row: {
          id: string
          caja_id: string
          tipo: RaTipoMovimiento
          concepto: string
          monto: number
          metodo_pago: RaMetodoPago
          referencia_id: string | null
          usuario_id: string | null
          operation_id: string | null
          request_hash: string | null
          origen: 'venta' | 'cobro' | 'pago_proveedor' | 'manual' | 'ajuste' | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          caja_id: string
          tipo: RaTipoMovimiento
          concepto: string
          monto: number
          metodo_pago?: RaMetodoPago
          referencia_id?: string | null
          usuario_id?: string | null
          operation_id?: string | null
          request_hash?: string | null
          origen?: 'venta' | 'cobro' | 'pago_proveedor' | 'manual' | 'ajuste' | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          caja_id?: string
          tipo?: RaTipoMovimiento
          concepto?: string
          monto?: number
          metodo_pago?: RaMetodoPago
          referencia_id?: string | null
          usuario_id?: string | null
          operation_id?: string | null
          request_hash?: string | null
          origen?: 'venta' | 'cobro' | 'pago_proveedor' | 'manual' | 'ajuste' | null
          notas?: string | null
          created_at?: string
        }
      }
      ra_ventas: {
        Row: {
          id: string
          empresa_id: string
          sucursal_id: string
          caja_id: string | null
          cliente_id: string | null
          usuario_id: string
          tipo_venta: RaTipoCliente
          tipo_comprobante: RaTipoComprobante
          subtotal: number
          igv: number
          total: number
          estado: RaEstadoVenta
          serie: string | null
          correlativo: number | null
          numero_completo: string | null
          fecha_emision: string | null
          sunat_estado: string | null
          sunat_hash: string | null
          id_externo: string | null
          pdf_url: string | null
          xml_url: string | null
          moneda: RaMoneda
          tipo_cambio: number | null
          operation_id: string | null
          request_hash: string | null
          credit_limit_exceeded: boolean | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          sucursal_id: string
          caja_id?: string | null
          cliente_id?: string | null
          usuario_id: string
          tipo_venta?: RaTipoCliente
          tipo_comprobante?: RaTipoComprobante
          subtotal: number
          igv?: number
          total: number
          estado?: RaEstadoVenta
          serie?: string | null
          correlativo?: number | null
          fecha_emision?: string | null
          sunat_estado?: string | null
          moneda?: RaMoneda
          tipo_cambio?: number | null
          operation_id?: string | null
          request_hash?: string | null
          credit_limit_exceeded?: boolean | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          sucursal_id?: string
          caja_id?: string | null
          cliente_id?: string | null
          usuario_id?: string
          tipo_venta?: RaTipoCliente
          tipo_comprobante?: RaTipoComprobante
          subtotal?: number
          igv?: number
          total?: number
          estado?: RaEstadoVenta
          serie?: string | null
          correlativo?: number | null
          sunat_estado?: string | null
          sunat_hash?: string | null
          id_externo?: string | null
          pdf_url?: string | null
          xml_url?: string | null
          moneda?: RaMoneda
          tipo_cambio?: number | null
          operation_id?: string | null
          request_hash?: string | null
          credit_limit_exceeded?: boolean | null
          created_at?: string
          updated_at?: string
        }
      }
      ra_venta_items: {
        Row: {
          id: string
          venta_id: string
          catalogo_id: string
          cantidad: number
          precio_unitario: number
          descuento: number
          subtotal: number
          nombre_producto: string
          codigo_oem: string | null
          created_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          catalogo_id: string
          cantidad: number
          precio_unitario: number
          descuento?: number
          subtotal: number
          nombre_producto: string
          codigo_oem?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          venta_id?: string
          catalogo_id?: string
          cantidad?: number
          precio_unitario?: number
          descuento?: number
          subtotal?: number
          nombre_producto?: string
          codigo_oem?: string | null
          created_at?: string
        }
      }
      ra_venta_pagos: {
        Row: {
          id: string
          venta_id: string
          metodo_pago: RaMetodoPago
          monto: number
          referencia: string | null
          created_at: string
        }
        Insert: {
          id?: string
          venta_id: string
          metodo_pago: RaMetodoPago
          monto: number
          referencia?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          venta_id?: string
          metodo_pago?: RaMetodoPago
          monto?: number
          referencia?: string | null
          created_at?: string
        }
      }
      ra_kardex: {
        Row: {
          id: string
          empresa_id: string
          sucursal_id: string
          catalogo_id: string
          tipo: RaTipoKardex
          motivo: RaMotivoKardex
          cantidad: number
          stock_anterior: number
          stock_nuevo: number
          referencia_id: string | null
          usuario_id: string | null
          notas: string | null
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          sucursal_id: string
          catalogo_id: string
          tipo: RaTipoKardex
          motivo: RaMotivoKardex
          cantidad: number
          stock_anterior: number
          stock_nuevo: number
          referencia_id?: string | null
          usuario_id?: string | null
          notas?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          sucursal_id?: string
          catalogo_id?: string
          tipo?: RaTipoKardex
          motivo?: RaMotivoKardex
          cantidad?: number
          stock_anterior?: number
          stock_nuevo?: number
          referencia_id?: string | null
          usuario_id?: string | null
          notas?: string | null
          created_at?: string
        }
      }
      // ── Cuentas corrientes / cobranzas (migration 032) ─────
      ra_cuenta_corriente_movimientos: {
        Row: {
          id: string
          empresa_id: string
          cliente_id: string
          venta_id: string
          tipo: RaCcTipoMovimiento
          monto: number
          fecha: string
          fecha_vencimiento: string | null
          moneda_cobro: RaMoneda | null
          tipo_cambio_cobro: number | null
          metodo_pago: RaMetodoPago | null
          referencia: string | null
          usuario_id: string
          operation_id: string | null
          request_hash: string | null
          result_snapshot: Json | null
          sucursal_id: string | null
          caja_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          cliente_id: string
          venta_id: string
          tipo: RaCcTipoMovimiento
          monto: number
          fecha?: string
          fecha_vencimiento?: string | null
          moneda_cobro?: RaMoneda | null
          tipo_cambio_cobro?: number | null
          metodo_pago?: RaMetodoPago | null
          referencia?: string | null
          usuario_id: string
          operation_id?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          caja_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          cliente_id?: string
          venta_id?: string
          tipo?: RaCcTipoMovimiento
          monto?: number
          fecha?: string
          fecha_vencimiento?: string | null
          moneda_cobro?: RaMoneda | null
          tipo_cambio_cobro?: number | null
          metodo_pago?: RaMetodoPago | null
          referencia?: string | null
          usuario_id?: string
          operation_id?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          caja_id?: string | null
          created_at?: string
        }
      }
      // ── Órdenes de compra (migration 033) ──────────────────
      ra_ordenes_compra: {
        Row: {
          id: string
          empresa_id: string
          sucursal_id: string
          proveedor_id: string | null
          usuario_id: string
          referencia: string | null
          fecha: string
          estado: RaEstadoOrdenCompra
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          sucursal_id: string
          proveedor_id?: string | null
          usuario_id: string
          referencia?: string | null
          fecha?: string
          estado?: RaEstadoOrdenCompra
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          proveedor_id?: string | null
          referencia?: string | null
          fecha?: string
          estado?: RaEstadoOrdenCompra
          notas?: string | null
          updated_at?: string
        }
      }
      ra_orden_compra_items: {
        Row: {
          id: string
          orden_compra_id: string
          catalogo_id: string
          nombre_producto: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          cantidad_recibida: number
          created_at: string
        }
        Insert: {
          id?: string
          orden_compra_id: string
          catalogo_id: string
          nombre_producto: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          cantidad_recibida?: number
          created_at?: string
        }
        Update: {
          cantidad?: number
          precio_unitario?: number
          subtotal?: number
          cantidad_recibida?: number
        }
      }
      ra_cuentas_por_pagar_movimientos: {
        Row: {
          id: string
          empresa_id: string
          proveedor_id: string
          compra_id: string
          tipo: RaCxpTipoMovimiento
          monto: number
          fecha: string
          metodo_pago: RaMetodoPago | null
          referencia: string | null
          usuario_id: string
          operation_id: string | null
          request_hash: string | null
          result_snapshot: Json | null
          sucursal_id: string | null
          caja_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          proveedor_id: string
          compra_id: string
          tipo: RaCxpTipoMovimiento
          monto: number
          fecha?: string
          metodo_pago?: RaMetodoPago | null
          referencia?: string | null
          usuario_id: string
          operation_id?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          caja_id?: string | null
          created_at?: string
        }
        Update: {
          fecha?: string
          referencia?: string | null
          operation_id?: string | null
          request_hash?: string | null
          result_snapshot?: Json | null
          sucursal_id?: string | null
          caja_id?: string | null
        }
      }
      ra_auditoria_estado_pago_compras: {
        Row: {
          id: string
          empresa_id: string
          compra_id: string
          operation_id: string
          request_hash: string
          usuario_id: string | null
          actor_tipo: 'usuario' | 'migracion'
          estado_anterior: RaEstadoPagoCompra
          estado_nuevo: RaEstadoPagoCompra
          motivo: string
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          compra_id: string
          operation_id: string
          request_hash: string
          usuario_id?: string | null
          actor_tipo: 'usuario' | 'migracion'
          estado_anterior: RaEstadoPagoCompra
          estado_nuevo: RaEstadoPagoCompra
          motivo: string
          created_at?: string
        }
        Update: {
          motivo?: string
        }
      }
      ra_devoluciones: {
        Row: {
          id: string
          empresa_id: string
          venta_id: string
          sucursal_id: string
          estado: RaEstadoDevolucion
          motivo: string
          venta_created_at: string
          solicitante_id: string
          aprobador_id: string | null
          receptor_id: string | null
          liquidador_id: string | null
          approved_at: string | null
          received_at: string | null
          liquidated_at: string | null
          recepcion_operativa_por: string | null
          recepcion_operativa_at: string | null
          recepcion_recibido: boolean | null
          condicion_declarada: 'apto_reventa' | 'dañado' | 'incompleto' | 'no_recibido' | null
          recepcion_observacion: string | null
          recepcion_operation_id: string | null
          recepcion_request_hash: string | null
          aprobacion_operation_id: string | null
          aprobacion_request_hash: string | null
          rechazo_operation_id: string | null
          rechazo_request_hash: string | null
          rechazo_motivo: string | null
          reingreso_aprobado: boolean | null
          reingreso_override_motivo: string | null
          solicitud_operation_id: string
          solicitud_request_hash: string
          operation_id: string | null
          request_hash: string | null
          result_snapshot: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          venta_id: string
          sucursal_id: string
          estado?: RaEstadoDevolucion
          motivo: string
          venta_created_at: string
          solicitante_id: string
          solicitud_operation_id: string
          solicitud_request_hash: string
        }
        Update: Record<string, never>
      }
      ra_sunat_nota_credito_outbox: {
        Row: {
          id: string
          empresa_id: string
          devolucion_id: string
          venta_id: string
          document_key: string
          tipo_referenciado: RaTipoComprobante
          motivo_codigo: '06' | '07'
          motivo_descripcion: string
          serie: string
          correlativo: number
          request_payload: Json
          status: 'pending' | 'processing' | 'retry' | 'submitted' | 'accepted' | 'rejected' | 'dead_letter'
          attempt_count: number
          next_attempt_at: string
          last_attempt_at: string | null
          lease_token: string | null
          lease_expires_at: string | null
          worker_id: string | null
          external_id: string | null
          http_status: number | null
          error_code: string | null
          error_message: string | null
          response_payload: Json | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Record<string, never>
        Update: Record<string, never>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ra_empresa_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      ra_chatbot_buscar: {
        Args: { q: string }
        Returns: Array<{
          nombre: string
          codigo_oem: string | null
          codigos_alternos: string | null
          precio_venta: number | null
          precio_venta_dolar: number | null
          stock_actual: number
          modelos: string | null
        }>
      }
      ra_confirmar_orden_compra: {
        Args: { p_orden_compra_id: string }
        Returns: void
      }
      ra_recibir_guia: {
        Args: { p_guia_id: string }
        Returns: Json
      }
      ra_crear_guia: {
        Args: {
          p_sucursal_origen_id: string
          p_sucursal_destino_id: string
          p_notas: string | null
          p_items: Json
        }
        Returns: Json
      }
      ra_obtener_preview_serie_guia: {
        Args: { p_sucursal_id: string }
        Returns: Json
      }
      ra_avanzar_estado_guia: {
        Args: {
          p_guia_id: string
          p_nuevo_estado: RaEstadoGuia
        }
        Returns: Json
      }
      ra_contar_stock_bajo: {
        Args: { p_empresa_id: string; p_sucursal_id?: string | null }
        Returns: number
      }
      ra_anular_compra: {
        Args: { p_compra_id: string }
        Returns: void
      }
      ra_anular_orden_compra: {
        Args: { p_orden_compra_id: string }
        Returns: void
      }
      ra_confirmar_venta: {
        Args: {
          p_operation_id: string
          p_sucursal_id: string
          p_tipo_comprobante: RaTipoComprobante
          p_cliente_id: string | null
          p_items: Json
          p_pagos: Json
          p_moneda: string
          p_tipo_cambio: number | null
          p_fecha_vencimiento: string | null
        }
        Returns: Json
      }
      ra_obtener_resultado_venta: {
        Args: { p_operation_id: string }
        Returns: Json
      }
      ra_confirmar_compra: {
        Args: {
          p_operation_id: string
          p_sucursal_id: string
          p_proveedor_id: string
          p_nro_documento: string | null
          p_notas: string | null
          p_items: Json
          p_orden_compra_id?: string | null
          p_moneda?: string
          p_tipo_cambio?: number | null
          p_tipo_documento?: string
          p_abono_inicial?: Json | null
        }
        Returns: Json
      }
      ra_obtener_resultado_compra: {
        Args: { p_operation_id: string }
        Returns: Json
      }
      ra_recalcular_estado_pago: {
        Args: {
          p_operation_id: string
          p_compra_id: string
          p_motivo: string
        }
        Returns: Json
      }
      ra_solicitar_devolucion_v1: {
        Args: { p_operation_id: string; p_venta_id: string; p_items: Json; p_motivo: string }
        Returns: Json
      }
      ra_liquidar_devolucion_v1: {
        Args: { p_operation_id: string; p_devolucion_id: string; p_referencias?: Json }
        Returns: Json
      }
      ra_registrar_recepcion_devolucion_v1: {
        Args: { p_operation_id: string; p_devolucion_id: string; p_recibido: boolean; p_condicion_declarada: string; p_observacion?: string | null }
        Returns: Json
      }
      ra_aprobar_devolucion_v1: {
        Args: { p_operation_id: string; p_devolucion_id: string; p_reingreso_aprobado: boolean; p_reingreso_override_motivo?: string | null }
        Returns: Json
      }
      ra_rechazar_devolucion_v1: {
        Args: { p_operation_id: string; p_devolucion_id: string; p_motivo: string }
        Returns: Json
      }
      ra_abrir_caja_v1: {
        Args: {
          p_operation_id: string
          p_sucursal_id: string
          p_monto_inicial: number
          p_notas: string | null
        }
        Returns: Json
      }
      ra_registrar_movimiento_caja_v1: {
        Args: {
          p_operation_id: string
          p_sucursal_id: string
          p_tipo: string
          p_concepto: string
          p_monto: number
          p_notas: string | null
        }
        Returns: Json
      }
      ra_registrar_cobro_v2: {
        Args: {
          p_operation_id: string
          p_sucursal_id: string
          p_venta_id: string
          p_monto: number
          p_fecha: string
          p_metodo_pago: RaMetodoPago
          p_moneda_cobro: string
          p_tipo_cambio_cobro: number | null
          p_referencia: string | null
        }
        Returns: Json
      }
      ra_registrar_pago_proveedor_v2: {
        Args: {
          p_operation_id: string
          p_sucursal_id: string
          p_compra_id: string
          p_monto: number
          p_fecha: string
          p_metodo_pago: RaMetodoPago
          p_referencia: string | null
        }
        Returns: Json
      }
      ra_cerrar_caja_v1: {
        Args: {
          p_operation_id: string
          p_caja_id: string
          p_efectivo_contado: number
          p_notas: string | null
        }
        Returns: Json
      }
      ra_revisar_liquidacion_v1: {
        Args: {
          p_operation_id: string
          p_liquidacion_id: string
          p_decision: 'validada' | 'observada'
          p_motivo: string
        }
        Returns: Json
      }
    }
    Enums: {
      ra_rol: RaRol
      ra_tipo_cliente: RaTipoCliente
      ra_tipo_documento: RaTipoDocumento
      ra_estado_caja: RaEstadoCaja
      ra_tipo_movimiento: RaTipoMovimiento
      ra_metodo_pago: RaMetodoPago
      ra_tipo_comprobante: RaTipoComprobante
      ra_estado_venta: RaEstadoVenta
      ra_tipo_kardex: RaTipoKardex
      ra_motivo_kardex: RaMotivoKardex
      ra_estado_pago_compra: RaEstadoPagoCompra
      ra_estado_guia: RaEstadoGuia
      ra_moneda: RaMoneda
      ra_cc_tipo_movimiento: RaCcTipoMovimiento
      ra_estado_orden_compra: RaEstadoOrdenCompra
      ra_estado_compra: RaEstadoCompra
      ra_cxp_tipo_movimiento: RaCxpTipoMovimiento
    }
    CompositeTypes: {
      [_ in never]: never
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
