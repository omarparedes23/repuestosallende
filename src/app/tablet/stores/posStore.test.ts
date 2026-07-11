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
