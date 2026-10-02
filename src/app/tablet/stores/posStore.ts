import { create } from 'zustand'
import { calcularTotalesParciales } from '@/lib/calc/totales'
import type { RaMoneda, RaTipoCliente, RaTipoComprobante, RaMetodoPago } from '@/lib/types/database'

export type CartItem = {
  productoId: string
  catalogoId: string
  nombre: string
  codigoOem: string | null
  imagenUrl: string | null
  stockActual: number
  moneda: RaMoneda
  /** Precio en soles; null si el producto no tiene precio en soles. */
  precioMinorista: number | null
  /** Precio en dólares; null si el producto no tiene precio en dólares. */
  precioDolar: number | null
  cantidad: number
  descuento: number
}

export type PagoInput = {
  metodoPago: RaMetodoPago
  monto: number
  referencia?: string
}

export type ClienteSnapshot = {
  id: string
  nombre: string
  tipo_documento: string | null
  nro_documento: string | null
  tipo_cliente: RaTipoCliente
  tiene_credito: boolean
  limite_credito: number
  saldo_deudor: number
}

interface PosState {
  cajaId: string | null
  userId: string | null
  empresaId: string | null
  cliente: ClienteSnapshot | null
  tipoComprobante: RaTipoComprobante
  items: CartItem[]
  pagos: PagoInput[]

  setCajaId: (id: string | null) => void
  setSessionScope: (userId: string, empresaId: string) => void
  setCliente: (cliente: ClienteSnapshot | null) => void
  setTipoComprobante: (tipo: RaTipoComprobante) => void
  setPagos: (pagos: PagoInput[]) => void

  addItem: (item: Omit<CartItem, 'cantidad' | 'descuento'>) => void
  removeItem: (productoId: string) => void
  updateCantidad: (productoId: string, cantidad: number) => void
  updateDescuento: (productoId: string, descuento: number) => void
  clearCart: () => void

  getSubtotal: (moneda?: RaMoneda) => number
  getIgv: (moneda?: RaMoneda) => number
  getTotal: (moneda?: RaMoneda) => number
  getItemCount: () => number

  resetPosState: () => void
}

export const usePosStore = create<PosState>()((set, get) => ({
  cajaId: null,
  userId: null,
  empresaId: null,
  cliente: null,
  tipoComprobante: 'ticket',
  items: [],
  pagos: [],

  setCajaId: (id) => set({ cajaId: id }),
  setSessionScope: (userId, empresaId) => set({ userId, empresaId }),
  setCliente: (cliente) => set({ cliente }),
  setTipoComprobante: (tipo) => set({ tipoComprobante: tipo }),
  setPagos: (pagos) => set({ pagos }),

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productoId === item.productoId)
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.productoId === item.productoId
              ? { ...i, cantidad: Math.min(i.cantidad + 1, i.stockActual) }
              : i
          ),
        }
      }
      return { items: [...state.items, { ...item, cantidad: 1, descuento: 0 }] }
    }),

  removeItem: (productoId) =>
    set((state) => ({
      items: state.items.filter((i) => i.productoId !== productoId),
    })),

  updateCantidad: (productoId, cantidad) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productoId === productoId ? { ...i, cantidad: Math.max(1, cantidad) } : i
      ),
    })),

  updateDescuento: (productoId, descuento) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.productoId === productoId ? { ...i, descuento: Math.max(0, descuento) } : i
      ),
    })),

  clearCart: () => set({ items: [], pagos: [], cliente: null }),

  // Ítems sin precio en la moneda indicada se excluyen (nunca valen 0).
  // Precios con IGV incluido: misma regla que calcularTotalesVenta / ra_confirmar_venta_v1.
  // getSubtotal = base imponible (sin IGV en boleta/factura); getTotal = lo que paga el cliente.
  getSubtotal: (moneda = 'PEN') => {
    const { items, tipoComprobante } = get()
    return calcularTotalesParciales(items, tipoComprobante, moneda).subtotal
  },

  getIgv: (moneda = 'PEN') => {
    const { items, tipoComprobante } = get()
    return calcularTotalesParciales(items, tipoComprobante, moneda).igv
  },

  getTotal: (moneda = 'PEN') => {
    const { items, tipoComprobante } = get()
    return calcularTotalesParciales(items, tipoComprobante, moneda).total
  },

  getItemCount: () => get().items.reduce((sum, i) => sum + i.cantidad, 0),

  resetPosState: () =>
    set({
      items: [],
      pagos: [],
      cliente: null,
      tipoComprobante: 'ticket',
    }),
}))
