import { beforeEach, describe, expect, it } from 'vitest'
import { usePosStore, type CartItem } from './posStore'

function itemFixture(
  overrides: Partial<Omit<CartItem, 'cantidad' | 'descuento'>> = {}
) {
  return {
    productoId: 'p1',
    catalogoId: 'c1',
    nombre: 'Filtro de aceite',
    codigoOem: null,
    imagenUrl: null,
    stockActual: 10,
    moneda: 'PEN' as const,
    precioMinorista: 50,
    precioDolar: 12,
    ...overrides,
  }
}

beforeEach(() => {
  usePosStore.setState({
    cajaId: null,
    cliente: null,
    tipoComprobante: 'ticket',
    items: [],
    pagos: [],
  })
})

describe('posStore — totales por moneda', () => {
  it('getSubtotal en PEN excluye ítems sin precio en soles (no los cuenta como 0)', () => {
    const s = usePosStore.getState()
    s.addItem(itemFixture({ productoId: 'a', precioMinorista: 50, precioDolar: null }))
    s.addItem(itemFixture({ productoId: 'b', precioMinorista: null, precioDolar: 12 }))
    expect(usePosStore.getState().getSubtotal('PEN')).toBe(50)
    expect(usePosStore.getState().getSubtotal()).toBe(50)
  })

  it('getSubtotal en USD usa precioDolar y excluye ítems sin precio en dólares', () => {
    const s = usePosStore.getState()
    s.addItem(itemFixture({ productoId: 'a', precioMinorista: 50, precioDolar: null }))
    s.addItem(itemFixture({ productoId: 'b', precioMinorista: null, precioDolar: 12 }))
    expect(usePosStore.getState().getSubtotal('USD')).toBe(12)
  })

  it('getTotal no suma IGV encima: lo desglosa de precios con IGV incluido', () => {
    usePosStore.getState().addItem(itemFixture({ precioMinorista: 100 }))
    expect(usePosStore.getState().getTotal('PEN')).toBe(100)
    usePosStore.getState().setTipoComprobante('boleta')
    // precio con IGV incluido: el total no cambia, solo se desglosa
    expect(usePosStore.getState().getTotal('PEN')).toBe(100)
    expect(usePosStore.getState().getSubtotal('PEN')).toBe(84.75)
    expect(usePosStore.getState().getIgv('PEN')).toBe(15.25)
  })
})

describe('posStore — carrito', () => {
  it('addItem agrega un ítem nuevo con cantidad 1', () => {
    usePosStore.getState().addItem(itemFixture())
    expect(usePosStore.getState().items).toHaveLength(1)
    expect(usePosStore.getState().items[0].cantidad).toBe(1)
  })

  it('addItem repetido incrementa cantidad en vez de duplicar', () => {
    usePosStore.getState().addItem(itemFixture())
    usePosStore.getState().addItem(itemFixture())
    expect(usePosStore.getState().items).toHaveLength(1)
    expect(usePosStore.getState().items[0].cantidad).toBe(2)
  })

  it('clearCart vacía el carrito', () => {
    usePosStore.getState().addItem(itemFixture())
    usePosStore.getState().clearCart()
    expect(usePosStore.getState().items).toHaveLength(0)
  })

  it('resetPosState vuelve tipoComprobante a ticket', () => {
    usePosStore.getState().setTipoComprobante('factura')
    usePosStore.getState().resetPosState()
    expect(usePosStore.getState().tipoComprobante).toBe('ticket')
  })
})
