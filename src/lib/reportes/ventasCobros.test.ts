import { describe, expect, it } from 'vitest'
import { agruparPorMoneda, calcularResumenCredito } from './ventasCobros'

describe('reportes ventas y cobros', () => {
  it('separa monedas sin consolidarlas', () => {
    expect(agruparPorMoneda([
      { moneda: 'PEN', monto: 100 },
      { moneda: 'USD', monto: 20 },
      { moneda: 'PEN', monto: 5 },
    ])).toEqual({ PEN: 105, USD: 20 })
  })

  it('no suma los abonos posteriores sobre el total de venta', () => {
    expect(calcularResumenCredito([
      { metodo_pago: 'efectivo', monto: 40 },
      { metodo_pago: 'credito', monto: 60 },
    ], 60)).toEqual({
      cobradoAlEmitir: 40,
      creditoOriginal: 60,
      cobradoPosteriormente: 60,
      saldoCredito: 0,
    })
  })
})
