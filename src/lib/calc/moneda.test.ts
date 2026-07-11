import { describe, expect, it } from 'vitest'
import { simboloMoneda } from './moneda'

describe('simboloMoneda', () => {
  it('PEN devuelve el símbolo de soles', () => {
    expect(simboloMoneda('PEN')).toBe('S/.')
  })

  it('USD devuelve el símbolo de dólares', () => {
    expect(simboloMoneda('USD')).toBe('$')
  })
})
