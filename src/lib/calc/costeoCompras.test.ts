import { describe, expect, it } from 'vitest'
import { calcularCostoPromedioPonderado } from './costeoCompras'

describe('calcularCostoPromedioPonderado', () => {
  it('stock inicial 0 y precio_compra null: nuevo precio = precio recibido', () => {
    const nuevo = calcularCostoPromedioPonderado(0, null, 10, 25.5)

    expect(nuevo).toBe(25.5)
  })

  it('promedio ponderado normal: stock y precio previos > 0', () => {
    // (20 * 10 + 10 * 16) / (20 + 10) = (200 + 160) / 30 = 12
    const nuevo = calcularCostoPromedioPonderado(20, 10, 10, 16)

    expect(nuevo).toBe(12)
  })

  it('cantidad recibida grande vs stock chico: pondera fuerte hacia el precio nuevo', () => {
    // (2 * 5 + 98 * 20) / (2 + 98) = (10 + 1960) / 100 = 19.7
    const nuevo = calcularCostoPromedioPonderado(2, 5, 98, 20)

    expect(nuevo).toBe(19.7)
  })

  it('redondea a 2 decimales', () => {
    // (3 * 10 + 7 * 15.333) / 10 = (30 + 107.331) / 10 = 13.7331 -> 13.73
    const nuevo = calcularCostoPromedioPonderado(3, 10, 7, 15.333)

    expect(nuevo).toBe(13.73)
  })

  it('stock previo > 0 pero precio_compra null: trata precio previo como 0', () => {
    // (5 * 0 + 5 * 20) / (5 + 5) = 100 / 10 = 10
    const nuevo = calcularCostoPromedioPonderado(5, null, 5, 20)

    expect(nuevo).toBe(10)
  })
})
