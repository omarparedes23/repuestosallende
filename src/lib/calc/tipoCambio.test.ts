import { describe, expect, it } from 'vitest'
import {
  antiguedadTipoCambio,
  debePrellenarTipoCambio,
  esTipoCambioVigente,
  fechaLocalISO,
  formatearFechaTipoCambio,
} from './tipoCambio'

describe('antiguedadTipoCambio', () => {
  it('es 0 el mismo día', () => {
    expect(antiguedadTipoCambio('2026-09-28', '2026-09-28')).toBe(0)
  })
  it('cruza fin de mes', () => {
    expect(antiguedadTipoCambio('2026-09-29', '2026-10-02')).toBe(3)
  })
  it('cruza fin de año', () => {
    expect(antiguedadTipoCambio('2026-12-31', '2027-01-02')).toBe(2)
  })
  it('respeta años bisiestos', () => {
    expect(antiguedadTipoCambio('2028-02-28', '2028-03-01')).toBe(2)
    expect(antiguedadTipoCambio('2027-02-28', '2027-03-01')).toBe(1)
  })
  it('devuelve NaN con fechas inválidas', () => {
    expect(antiguedadTipoCambio('nope', '2026-10-02')).toBeNaN()
  })
})

describe('esTipoCambioVigente', () => {
  it('3 días todavía es vigente', () => {
    expect(esTipoCambioVigente('2026-09-29', '2026-10-02')).toBe(true)
  })
  it('4 días es desactualizado', () => {
    expect(esTipoCambioVigente('2026-09-28', '2026-10-02')).toBe(false)
  })
  it('fecha inválida no es vigente', () => {
    expect(esTipoCambioVigente('', '2026-10-02')).toBe(false)
  })
})

describe('fechaLocalISO / formatearFechaTipoCambio', () => {
  it('usa el calendario local con ceros a la izquierda', () => {
    expect(fechaLocalISO(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
  it('formatea DD/MM/YYYY', () => {
    expect(formatearFechaTipoCambio('2026-09-28')).toBe('28/09/2026')
  })
})

describe('debePrellenarTipoCambio', () => {
  const tasa = { venta: 3.75 }
  it('prellena en USD sin valor y con tasa', () => {
    expect(debePrellenarTipoCambio('USD', null, tasa)).toBe(true)
  })
  it('no prellena en PEN', () => {
    expect(debePrellenarTipoCambio('PEN', null, tasa)).toBe(false)
  })
  it('no pisa lo que escribió el cajero', () => {
    expect(debePrellenarTipoCambio('USD', 3.8, tasa)).toBe(false)
  })
  it('no prellena sin tasa o con tasa no positiva', () => {
    expect(debePrellenarTipoCambio('USD', null, null)).toBe(false)
    expect(debePrellenarTipoCambio('USD', null, { venta: 0 })).toBe(false)
  })
})
