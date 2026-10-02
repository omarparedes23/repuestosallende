import { describe, expect, it } from 'vitest'
import {
  itemsConPrecio,
  itemsSinPrecio,
  monedaDePrevisualizacion,
  notaSinPrecio,
  precioParaMoneda,
  precioPrincipal,
  simboloPrecio,
} from './precios'

const pen = { precioMinorista: 10, precioDolar: null }
const usd = { precioMinorista: null, precioDolar: 3 }
const ambos = { precioMinorista: 10, precioDolar: 3 }
const ninguno = { precioMinorista: null, precioDolar: null }

describe('precios por moneda', () => {
  it('precioParaMoneda devuelve el precio de la moneda o null (nunca 0)', () => {
    expect(precioParaMoneda(pen, 'PEN')).toBe(10)
    expect(precioParaMoneda(pen, 'USD')).toBeNull()
    expect(precioParaMoneda(usd, 'USD')).toBe(3)
    expect(precioParaMoneda(usd, 'PEN')).toBeNull()
  })

  it('itemsSinPrecio / itemsConPrecio particionan por moneda', () => {
    const items = [pen, usd, ambos, ninguno]
    expect(itemsSinPrecio(items, 'PEN')).toEqual([usd, ninguno])
    expect(itemsSinPrecio(items, 'USD')).toEqual([pen, ninguno])
    expect(itemsConPrecio(items, 'PEN')).toEqual([pen, ambos])
    expect(itemsConPrecio(items, 'USD')).toEqual([usd, ambos])
  })

  it('simboloPrecio', () => {
    expect(simboloPrecio('USD')).toBe('US$')
    expect(simboloPrecio('PEN')).toBe('S/.')
  })

  it('precioPrincipal usa la moneda propia y cae a la otra', () => {
    expect(precioPrincipal({ ...usd, moneda: 'USD' })).toEqual({ moneda: 'USD', monto: 3 })
    expect(precioPrincipal({ ...ambos, moneda: 'PEN' })).toEqual({ moneda: 'PEN', monto: 10 })
    expect(precioPrincipal({ ...pen, moneda: 'USD' })).toEqual({ moneda: 'PEN', monto: 10 })
    expect(precioPrincipal({ ...ninguno, moneda: 'PEN' })).toBeNull()
  })

  it('notaSinPrecio', () => {
    expect(notaSinPrecio(usd, 'PEN')).toBe('Solo en USD')
    expect(notaSinPrecio(pen, 'USD')).toBe('Solo en soles')
    expect(notaSinPrecio(ninguno, 'PEN')).toBe('Sin precio')
  })

  it('monedaDePrevisualizacion', () => {
    expect(monedaDePrevisualizacion([])).toBe('PEN')
    expect(monedaDePrevisualizacion([pen, ambos])).toBe('PEN')
    expect(monedaDePrevisualizacion([usd, ambos])).toBe('USD')
    expect(monedaDePrevisualizacion([pen, usd])).toBe('PEN')
  })
})
