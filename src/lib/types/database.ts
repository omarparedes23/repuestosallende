export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type RaRol = 'superadmin' | 'administrador' | 'vendedor' | 'lectura'

// ── Enums: migration 003 (Tablet POS) ──────────────────────
export type RaTipoCliente    = 'mayorista' | 'minorista'
export type RaTipoDocumento  = 'DNI' | 'RUC' | 'CE' | 'PASAPORTE'
export type RaEstadoCaja     = 'abierta' | 'cerrada'
export type RaTipoMovimiento = 'ingreso' | 'egreso'
export type RaMetodoPago     = 'efectivo' | 'yape' | 'tarjeta' | 'transferencia' | 'credito'
export type RaTipoComprobante = 'ticket' | 'boleta' | 'factura'
export type RaEstadoVenta    = 'pendiente' | 'completada' | 'anulada' | 'error_sunat'
export type RaTipoKardex     = 'entrada' | 'salida' | 'ajuste'
export type RaMotivoKardex   = 'venta' | 'compra' | 'ajuste_manual' | 'devolucion' | 'merma'

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
        }
      }
      ra_perfiles: {
        Row: {
          id: string
          empresa_id: string | null
          nombre: string
          rol: RaRol
          activo: boolean
        }
        Insert: {
          id: string
          empresa_id?: string | null
          nombre: string
          rol?: RaRol
          activo?: boolean
        }
        Update: {
          id?: string
          empresa_id?: string | null
          nombre?: string
          rol?: RaRol
          activo?: boolean
        }
      }
      ra_productos: {
        Row: {
          id: string
          empresa_id: string
          catalogo_id: string
          codigo_interno: string | null
          precio_venta: number | null
          precio_mayorista: number | null
          precio_compra: number | null
          stock_actual: number
          stock_minimo: number
          activo: boolean
        }
        Insert: {
          id?: string
          empresa_id: string
          catalogo_id: string
          codigo_interno?: string | null
          precio_venta?: number | null
          precio_mayorista?: number | null
          precio_compra?: number | null
          stock_actual?: number
          stock_minimo?: number
          activo?: boolean
        }
        Update: {
          id?: string
          empresa_id?: string
          catalogo_id?: string
          codigo_interno?: string | null
          precio_venta?: number | null
          precio_mayorista?: number | null
          precio_compra?: number | null
          stock_actual?: number
          stock_minimo?: number
          activo?: boolean
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
          usuario_id: string
          estado: RaEstadoCaja
          monto_inicial: number
          monto_final: number | null
          fecha_apertura: string
          fecha_cierre: string | null
          notas: string | null
        }
        Insert: {
          id?: string
          empresa_id: string
          usuario_id: string
          estado?: RaEstadoCaja
          monto_inicial?: number
          monto_final?: number | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          notas?: string | null
        }
        Update: {
          id?: string
          empresa_id?: string
          usuario_id?: string
          estado?: RaEstadoCaja
          monto_inicial?: number
          monto_final?: number | null
          fecha_apertura?: string
          fecha_cierre?: string | null
          notas?: string | null
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
          created_at?: string
        }
      }
      ra_ventas: {
        Row: {
          id: string
          empresa_id: string
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
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
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ra_empresa_id: {
        Args: Record<PropertyKey, never>
        Returns: string
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

// ── Tipos derivados: migration 003 (Tablet POS) ─────────────
export type RaCliente         = Tables<'ra_clientes'>
export type RaCaja            = Tables<'ra_cajas'>
export type RaMovimientoCaja  = Tables<'ra_movimientos_caja'>
export type RaVenta           = Tables<'ra_ventas'>
export type RaVentaItem       = Tables<'ra_venta_items'>
export type RaVentaPago       = Tables<'ra_venta_pagos'>
export type RaKardex          = Tables<'ra_kardex'>

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
