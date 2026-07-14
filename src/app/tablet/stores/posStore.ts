import { create } from 'zustand'
import type { RaTipoCliente, RaTipoComprobante, RaMetodoPago } from '@/lib/types/database'

export type CartItem = {
  productoId: string
  catalogoId: string
  nombre: string
  codigoOem: string | null
  imagenUrl: string | null
  stockActual: number
  precioMinorista: number
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
  cliente: ClienteSnapshot | null
  tipoComprobante: RaTipoComprobante
  items: CartItem[]
  pagos: PagoInput[]

  setCajaId: (id: string | null) => void
  setCliente: (cliente: ClienteSnapshot | null) => void
  setTipoComprobante: (tipo: RaTipoComprobante) => void
  setPagos: (pagos: PagoInput[]) => void

  addItem: (item: Omit<CartItem, 'cantidad' | 'descuento'>) => void
  removeItem: (productoId: string) => void
  updateCantidad: (productoId: string, cantidad: number) => void
  updateDescuento: (productoId: string, descuento: number) => void
  clearCart: () => void

  getSubtotal: () => number
  getTotal: () => number
  getItemCount: () => number

  resetPosState: () => void
}

export const usePosStore = create<PosState>()((set, get) => ({
  cajaId: null,
  cliente: null,
  tipoComprobante: 'ticket',
  items: [],
  pagos: [],

  setCajaId: (id) => set({ cajaId: id }),
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

  getSubtotal: () => {
    const { items } = get()
    return items.reduce((sum, item) => {
      return sum + item.precioMinorista * item.cantidad - item.descuento
    }, 0)
  },

  getTotal: () => {
    const { tipoComprobante } = get()
    const subtotal = get().getSubtotal()
    const igv = tipoComprobante !== 'ticket' ? subtotal * 0.18 : 0
    return subtotal + igv
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
