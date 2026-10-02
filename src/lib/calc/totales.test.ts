import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import { calcularTotalesParciales, calcularTotalesVenta } from './totales'
import type { CartItem } from '@/app/tablet/stores/posStore'

function itemBase(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productoId: 'p1',
    catalogoId: 'c1',
    nombre: 'Filtro de aceite',
    codigoOem: 'OEM-1',
    imagenUrl: null,
    stockActual: 10,
    moneda: 'PEN',
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

    // precio con IGV: 50 * 2 - 5 = 95 bruto => base 80.51, igv 14.49, total 95
    expect(totales.subtotal).toBe(80.51)
    expect(totales.igv).toBe(14.49)
    expect(totales.total).toBe(95)
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

    // 10 * 2 = 20 bruto => base 16.95, igv 3.05, total 20
    expect(totales.subtotal).toBe(16.95)
    expect(totales.igv).toBe(3.05)
    expect(totales.total).toBe(20)
  })

  it('USD sin precioDolar: lanza error en vez de calcular con null', () => {
    const items = [itemBase({ precioDolar: null })]

    expect(() => calcularTotalesVenta(items, 'boleta', 'USD')).toThrow(
      'El repuesto "Filtro de aceite" no tiene precio en dólares'
    )
  })

  it('PEN sin precioMinorista: lanza error en vez de calcular con 0', () => {
    const items = [itemBase({ moneda: 'USD', precioMinorista: null, precioDolar: 18.95 })]

    expect(() => calcularTotalesVenta(items, 'ticket', 'PEN')).toThrow(
      'El repuesto "Filtro de aceite" no tiene precio en soles'
    )
  })

  it('carrito mixto: lanza si cualquier ítem no tiene precio en la moneda', () => {
    const items = [
      itemBase({ productoId: 'a', precioMinorista: 50, precioDolar: null }),
      itemBase({ productoId: 'b', nombre: 'Bujía', precioMinorista: null, precioDolar: 5 }),
    ]

    expect(() => calcularTotalesVenta(items, 'ticket', 'PEN')).toThrow('Bujía')
    expect(() => calcularTotalesVenta(items, 'ticket', 'USD')).toThrow('Filtro de aceite')
  })

  it('calcularTotalesParciales excluye ítems sin precio y no lanza', () => {
    const items = [
      itemBase({ productoId: 'a', precioMinorista: 50, precioDolar: null, cantidad: 1 }),
      itemBase({ productoId: 'b', precioMinorista: null, precioDolar: 5, cantidad: 1 }),
    ]

    expect(calcularTotalesParciales(items, 'ticket', 'PEN').total).toBe(50)
    expect(calcularTotalesParciales(items, 'ticket', 'USD').total).toBe(5)
    expect(calcularTotalesParciales([items[1]], 'ticket', 'PEN').total).toBe(0)
  })

  it('1 ítem 18.95 USD factura => 16.06 / 2.89 / 18.95', () => {
    const t = calcularTotalesVenta(
      [itemBase({ precioDolar: 18.95, cantidad: 1 })],
      'factura',
      'USD'
    )
    expect([t.subtotal, t.igv, t.total]).toEqual([16.06, 2.89, 18.95])
    expect(t.items[0].subtotal).toBe(18.95)
    expect(t.items[0].base).toBe(16.06)
    expect(t.items[0].precioUnitario).toBe(18.95)
  })

  it('250.00 factura => 211.86 / 38.14 / 250.00', () => {
    const t = calcularTotalesVenta([itemBase({ precioMinorista: 250, cantidad: 1 })], 'factura', 'PEN')
    expect([t.subtotal, t.igv, t.total]).toEqual([211.86, 38.14, 250])
  })

  it('250.00 ticket => 250 / 0 / 250 y base = bruto', () => {
    const t = calcularTotalesVenta([itemBase({ precioMinorista: 250, cantidad: 1 })], 'ticket', 'PEN')
    expect([t.subtotal, t.igv, t.total]).toEqual([250, 0, 250])
    expect(t.items[0].base).toBe(250)
  })

  it('cantidad 3 a 18.95 boleta', () => {
    const t = calcularTotalesVenta([itemBase({ precioDolar: 18.95, cantidad: 3 })], 'boleta', 'USD')
    // bruto 56.85 => base 48.18, igv 8.67
    expect([t.subtotal, t.igv, t.total]).toEqual([48.18, 8.67, 56.85])
  })

  it('redondeo multilínea: Σ round2(bruto/1.18) distinto de round2(Σ bruto/1.18), igual cierra exacto', () => {
    // 0.10 => 0.08475 -> 0.08 ; tres líneas => Σ base 0.24 vs round2(0.30/1.18)=0.25
    const items = [0, 1, 2].map((i) =>
      itemBase({ productoId: 'p' + i, precioMinorista: 0.1, cantidad: 1 })
    )
    const t = calcularTotalesVenta(items, 'factura', 'PEN')
    expect(new Decimal(0.3).div('1.18').toDecimalPlaces(2).toNumber()).toBe(0.25)
    expect(t.subtotal).toBe(0.24)
    expect(t.total).toBe(0.3)
    expect(t.igv).toBe(0.06)
    expect(new Decimal(t.subtotal).plus(t.igv).eq(t.total)).toBe(true)
  })

  it('descuento se descuenta del importe con IGV', () => {
    const t = calcularTotalesVenta(
      [itemBase({ precioMinorista: 100, cantidad: 2, descuento: 20 })],
      'boleta',
      'PEN'
    )
    // bruto 180 => base 152.54, igv 27.46
    expect(t.items[0].subtotal).toBe(180)
    expect(t.items[0].descuento).toBe(20)
    expect([t.subtotal, t.igv, t.total]).toEqual([152.54, 27.46, 180])
  })

  it('cantidad decimal 0.5', () => {
    const t = calcularTotalesVenta([itemBase({ precioMinorista: 99.99, cantidad: 0.5 })], 'factura', 'PEN')
    // bruto round2(49.995) = 50.00 (half up) => base 42.37, igv 7.63
    expect([t.subtotal, t.igv, t.total]).toEqual([42.37, 7.63, 50])
  })

  it('total cero', () => {
    const t = calcularTotalesVenta([itemBase({ precioMinorista: 10, cantidad: 1, descuento: 10 })], 'factura', 'PEN')
    expect([t.subtotal, t.igv, t.total]).toEqual([0, 0, 0])
    const vacio = calcularTotalesVenta([], 'boleta', 'PEN')
    expect([vacio.subtotal, vacio.igv, vacio.total]).toEqual([0, 0, 0])
  })

  it('invariante: subtotal + igv === total y Σ líneas === total (carritos generados)', () => {
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let n = 0; n < 200; n++) {
      const items = Array.from({ length: 1 + Math.floor(rnd() * 6) }, (_, i) =>
        itemBase({
          productoId: 'g' + i,
          precioMinorista: Math.round(rnd() * 100000) / 100,
          cantidad: 1 + Math.floor(rnd() * 9),
          descuento: 0,
        })
      )
      for (const tipo of ['ticket', 'boleta', 'factura'] as const) {
        const t = calcularTotalesVenta(items, tipo, 'PEN')
        expect(new Decimal(t.subtotal).plus(t.igv).eq(t.total)).toBe(true)
        const suma = t.items.reduce((a, i) => a.plus(i.subtotal), new Decimal(0))
        expect(suma.eq(t.total)).toBe(true)
        if (tipo === 'ticket') expect(t.igv).toBe(0)
      }
    }
  })
})
