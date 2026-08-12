import { describe, expect, it } from 'vitest'
import { calcularVuelto } from './vuelto'

describe('calcularVuelto', () => {
  it('sobrepago: retorna la diferencia positiva', () => {
    const pagos = [{ monto: 200 }, { monto: 40 }]
    const total = 127.12
    expect(calcularVuelto(pagos, total)).toBe(112.88)
  })

  it('pago exacto: retorna 0', () => {
    const pagos = [{ monto: 100 }, { monto: 27.12 }]
    const total = 127.12
    expect(calcularVuelto(pagos, total)).toBe(0)
  })

  it('sin pagos: retorna 0', () => {
    expect(calcularVuelto([], 50)).toBe(0)
  })

  it('pago menor al total: retorna 0 (no es vuelto)', () => {
    const pagos = [{ monto: 50 }]
    const total = 100
    expect(calcularVuelto(pagos, total)).toBe(0)
  })
})
