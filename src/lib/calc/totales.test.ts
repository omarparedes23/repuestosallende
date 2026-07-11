import { describe, expect, it } from 'vitest'
import { calcularTotalesVenta } from './totales'
import type { CartItem } from '@/app/tablet/stores/posStore'

function itemBase(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productoId: 'p1',
    catalogoId: 'c1',
    nombre: 'Filtro de aceite',
    codigoOem: 'OEM-1',
    imagenUrl: null,
    stockActual: 10,
    precioMinorista: 50,
    precioDolar: null,
    cantidad: 2,
    descuento: 0,
    ...overrides,
  }
}

describe('calcularTotalesVenta', () => {
  it('PEN: calcula con precioMinorista (precio único)', () => {
    const items = [itemBase({ precioMinorista: 50, cantidad: 2, descuento: 5 })]
    const totales = calcularTotalesVenta(items, 'boleta', 'PEN')

    // 50 * 2 - 5 = 95 subtotal, igv 18% = 17.10, total 112.10
    expect(totales.subtotal).toBe(95)
    expect(totales.igv).toBe(17.1)
    expect(totales.total).toBe(112.1)
  })

  it('PEN ticket: no lleva IGV', () => {
    const items = [itemBase({ precioMinorista: 40, cantidad: 3, descuento: 0 })]
    const totales = calcularTotalesVenta(items, 'ticket', 'PEN')

    expect(totales.subtotal).toBe(120)
    expect(totales.igv).toBe(0)
    expect(totales.total).toBe(120)
  })

  it('USD: lee precioDolar, ignora precioMinorista', () => {
    const items = [
      itemBase({ precioMinorista: 999, precioDolar: 10, cantidad: 2, descuento: 0 }),
    ]
    const totales = calcularTotalesVenta(items, 'boleta', 'USD')

    // 10 * 2 = 20 subtotal, igv 18% = 3.60, total 23.60
    expect(totales.subtotal).toBe(20)
    expect(totales.igv).toBe(3.6)
    expect(totales.total).toBe(23.6)
  })

  it('USD sin precioDolar: lanza error en vez de calcular con null', () => {
    const items = [itemBase({ precioDolar: null })]

    expect(() => calcularTotalesVenta(items, 'boleta', 'USD')).toThrow()
  })
})
