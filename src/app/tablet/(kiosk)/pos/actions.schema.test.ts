import { describe, expect, it } from 'vitest'
import { VentaInputSchema } from './actions.schema'

function inputBase(overrides: Record<string, unknown> = {}) {
  return {
    operationId: '11111111-1111-4111-8111-111111111111',
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
  it('exige un operationId UUID', () => {
    expect(VentaInputSchema.safeParse(inputBase({ operationId: 'no-uuid' })).success).toBe(false)
  })
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

  it('yape con referencia pasa el schema', () => {
    const result = VentaInputSchema.safeParse(
      inputBase({
        pagos: [{ metodoPago: 'yape', monto: 200, referencia: '987654321' }],
      })
    )
    expect(result.success).toBe(true)
  })

  it('transferencia con referencia pasa el schema', () => {
    const result = VentaInputSchema.safeParse(
      inputBase({
        pagos: [{ metodoPago: 'transferencia', monto: 150, referencia: 'OP-001' }],
      })
    )
    expect(result.success).toBe(true)
  })

  it('tarjeta exige voucher u operación, sin almacenar el número de tarjeta', () => {
    expect(
      VentaInputSchema.safeParse(
        inputBase({ pagos: [{ metodoPago: 'tarjeta', monto: 150 }] })
      ).success
    ).toBe(false)

    expect(
      VentaInputSchema.safeParse(
        inputBase({ pagos: [{ metodoPago: 'tarjeta', monto: 150, referencia: 'VCH-000123' }] })
      ).success
    ).toBe(true)
  })

  it('efectivo sin referencia pasa el schema (referencia opcional)', () => {
    const result = VentaInputSchema.safeParse(
      inputBase({
        pagos: [{ metodoPago: 'efectivo', monto: 100 }],
      })
    )
    expect(result.success).toBe(true)
  })
})
