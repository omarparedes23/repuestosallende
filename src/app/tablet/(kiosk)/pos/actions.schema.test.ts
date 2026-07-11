import { describe, expect, it } from 'vitest'
import { VentaInputSchema } from './actions.schema'

function inputBase(overrides: Record<string, unknown> = {}) {
  return {
    tipoComprobante: 'ticket',
    clienteId: null,
    items: [{ productoId: 'p1', catalogoId: 'c1', cantidad: 1, descuento: 0 }],
    pagos: [{ metodoPago: 'efectivo', monto: 10 }],
    moneda: 'PEN',
    tipoCambio: null,
    ...overrides,
  }
}

describe('VentaInputSchema — moneda/tipoCambio', () => {
  it('USD sin tipoCambio falla', () => {
    const result = VentaInputSchema.safeParse(
      inputBase({ moneda: 'USD', tipoCambio: null })
    )
    expect(result.success).toBe(false)
  })

  it('PEN con tipoCambio falla', () => {
    const result = VentaInputSchema.safeParse(
      inputBase({ moneda: 'PEN', tipoCambio: 3.75 })
    )
    expect(result.success).toBe(false)
  })

  it('USD con tipoCambio > 0 pasa', () => {
    const result = VentaInputSchema.safeParse(
      inputBase({ moneda: 'USD', tipoCambio: 3.75 })
    )
    expect(result.success).toBe(true)
  })

  it('PEN sin tipoCambio pasa', () => {
    const result = VentaInputSchema.safeParse(
      inputBase({ moneda: 'PEN', tipoCambio: null })
    )
    expect(result.success).toBe(true)
  })

  it('moneda por defecto es PEN si se omite (tipoCambio explícito en null)', () => {
    const { moneda, ...rest } = inputBase()
    const result = VentaInputSchema.safeParse({ ...rest, tipoCambio: null })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.moneda).toBe('PEN')
    }
  })

  it('no exige tipoVenta (se eliminó el concepto minorista/mayorista)', () => {
    const result = VentaInputSchema.safeParse(inputBase())
    expect(result.success).toBe(true)
  })
})
