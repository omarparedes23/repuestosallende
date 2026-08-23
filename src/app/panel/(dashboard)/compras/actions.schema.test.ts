import { describe, expect, it } from 'vitest'
import { CompraInputSchema } from './actions.schema'

function inputBase(overrides: Record<string, unknown> = {}) {
  return {
    operationId: '11111111-1111-4111-8111-111111111111',
    proveedorId: '22222222-2222-4222-8222-222222222222',
    nroDocumento: 'F001-000123',
    tipoDocumento: 'FACTURA',
    notas: 'Compra de prueba',
    items: [
      {
        catalogoId: '33333333-3333-4333-8333-333333333333',
        cantidad: 5,
        precioUnitario: 50,
      },
    ],
    ordenCompraId: null,
    moneda: 'PEN',
    tipoCambio: null,
    abonoInicial: null,
    ...overrides,
  }
}

describe('CompraInputSchema', () => {
  describe('operationId', () => {
    it('acepta un UUID válido', () => {
      const res = CompraInputSchema.safeParse(inputBase())
      expect(res.success).toBe(true)
    })

    it('rechaza operationId no UUID o faltante', () => {
      expect(CompraInputSchema.safeParse(inputBase({ operationId: 'no-uuid' })).success).toBe(false)
      const sinOp = { ...inputBase() }
      delete (sinOp as Record<string, unknown>).operationId
      expect(CompraInputSchema.safeParse(sinOp).success).toBe(false)
    })
  })

  describe('proveedorId', () => {
    it('acepta un UUID válido', () => {
      const res = CompraInputSchema.safeParse(inputBase())
      expect(res.success).toBe(true)
    })

    it('rechaza proveedorId inválido o ausente', () => {
      expect(CompraInputSchema.safeParse(inputBase({ proveedorId: 'invalido' })).success).toBe(false)
      const sinProv = { ...inputBase() }
      delete (sinProv as Record<string, unknown>).proveedorId
      expect(CompraInputSchema.safeParse(sinProv).success).toBe(false)
    })
  })

  describe('documento', () => {
    it('acepta exactamente los tipos soportados por la RPC', () => {
      for (const tipoDocumento of ['FACTURA', 'BOLETA', 'OTROS']) {
        expect(CompraInputSchema.safeParse(inputBase({ tipoDocumento })).success).toBe(true)
      }
    })

    it('rechaza tipos fuera del dominio PostgreSQL', () => {
      for (const tipoDocumento of ['GUIA', 'NOTA_CREDITO', 'OTRO']) {
        expect(CompraInputSchema.safeParse(inputBase({ tipoDocumento })).success).toBe(false)
      }
    })

    it('acepta números de hasta 60 caracteres y rechaza 61', () => {
      expect(CompraInputSchema.safeParse(inputBase({ nroDocumento: 'A'.repeat(60) })).success).toBe(true)
      expect(CompraInputSchema.safeParse(inputBase({ nroDocumento: 'A'.repeat(61) })).success).toBe(false)
    })
  })

  describe('items', () => {
    it('rechaza lista vacía de items', () => {
      expect(CompraInputSchema.safeParse(inputBase({ items: [] })).success).toBe(false)
    })

    it('rechaza cantidad <= 0', () => {
      expect(
        CompraInputSchema.safeParse(
          inputBase({
            items: [{ catalogoId: '33333333-3333-4333-8333-333333333333', cantidad: 0, precioUnitario: 10 }],
          })
        ).success
      ).toBe(false)
      expect(
        CompraInputSchema.safeParse(
          inputBase({
            items: [{ catalogoId: '33333333-3333-4333-8333-333333333333', cantidad: -2, precioUnitario: 10 }],
          })
        ).success
      ).toBe(false)
    })

    it('rechaza precioUnitario negativo', () => {
      expect(
        CompraInputSchema.safeParse(
          inputBase({
            items: [{ catalogoId: '33333333-3333-4333-8333-333333333333', cantidad: 1, precioUnitario: -5 }],
          })
        ).success
      ).toBe(false)
    })

    it('rechaza catalogoId que no sea UUID', () => {
      expect(
        CompraInputSchema.safeParse(
          inputBase({
            items: [{ catalogoId: 'no-uuid', cantidad: 1, precioUnitario: 10 }],
          })
        ).success
      ).toBe(false)
    })

    it('acepta hasta 200 items y rechaza más de 200', () => {
      const items200 = Array.from({ length: 200 }, (_, i) => ({
        catalogoId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        cantidad: 1,
        precioUnitario: 10,
      }))
      expect(CompraInputSchema.safeParse(inputBase({ items: items200 })).success).toBe(true)

      const items201 = Array.from({ length: 201 }, (_, i) => ({
        catalogoId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        cantidad: 1,
        precioUnitario: 10,
      }))
      expect(CompraInputSchema.safeParse(inputBase({ items: items201 })).success).toBe(false)
    })
  })

  describe('moneda y tipoCambio', () => {
    it('PEN sin tipoCambio (null) pasa', () => {
      const res = CompraInputSchema.safeParse(inputBase({ moneda: 'PEN', tipoCambio: null }))
      expect(res.success).toBe(true)
    })

    it('PEN con tipoCambio falla', () => {
      const res = CompraInputSchema.safeParse(inputBase({ moneda: 'PEN', tipoCambio: 3.75 }))
      expect(res.success).toBe(false)
    })

    it('USD con tipoCambio > 0 pasa', () => {
      const res = CompraInputSchema.safeParse(inputBase({ moneda: 'USD', tipoCambio: 3.75 }))
      expect(res.success).toBe(true)
    })

    it('USD sin tipoCambio (null) falla', () => {
      const res = CompraInputSchema.safeParse(inputBase({ moneda: 'USD', tipoCambio: null }))
      expect(res.success).toBe(false)
    })

    it('moneda default es PEN si se omite (con tipoCambio null)', () => {
      const sinMoneda = { ...inputBase() }
      delete (sinMoneda as Record<string, unknown>).moneda
      const res = CompraInputSchema.safeParse({ ...sinMoneda, tipoCambio: null })
      expect(res.success).toBe(true)
      if (res.success) {
        expect(res.data.moneda).toBe('PEN')
      }
    })
  })

  describe('abonoInicial', () => {
    it('abonoInicial null u omitido pasa', () => {
      const res = CompraInputSchema.safeParse(inputBase({ abonoInicial: null }))
      expect(res.success).toBe(true)
    })

    it('abono contado válido pasa', () => {
      const res = CompraInputSchema.safeParse(
        inputBase({
          abonoInicial: {
            metodoPago: 'efectivo',
            monto: 150.5,
            referencia: 'REC-001',
          },
        })
      )
      expect(res.success).toBe(true)
    })

    it('rechaza abono con método crédito', () => {
      const res = CompraInputSchema.safeParse(
        inputBase({
          abonoInicial: {
            metodoPago: 'credito',
            monto: 100,
          },
        })
      )
      expect(res.success).toBe(false)
    })

    it('rechaza abono con monto <= 0', () => {
      const res = CompraInputSchema.safeParse(
        inputBase({
          abonoInicial: {
            metodoPago: 'efectivo',
            monto: 0,
          },
        })
      )
      expect(res.success).toBe(false)
    })

    it('rechaza referencia mayor a 120 caracteres', () => {
      const res = CompraInputSchema.safeParse(
        inputBase({
          abonoInicial: {
            metodoPago: 'transferencia',
            monto: 100,
            referencia: 'A'.repeat(121),
          },
        })
      )
      expect(res.success).toBe(false)
    })
  })

  describe('rechazo de campos autoritativos y estructura estricta', () => {
    it('rechaza empresa_id / empresaId inyectado desde el cliente', () => {
      expect(CompraInputSchema.safeParse(inputBase({ empresa_id: '11111111-1111-4111-8111-111111111111' })).success).toBe(false)
      expect(CompraInputSchema.safeParse(inputBase({ empresaId: '11111111-1111-4111-8111-111111111111' })).success).toBe(false)
    })

    it('rechaza usuario_id / usuarioId inyectado desde el cliente', () => {
      expect(CompraInputSchema.safeParse(inputBase({ usuario_id: '11111111-1111-4111-8111-111111111111' })).success).toBe(false)
      expect(CompraInputSchema.safeParse(inputBase({ usuarioId: '11111111-1111-4111-8111-111111111111' })).success).toBe(false)
    })

    it('rechaza estado_pago / estadoPago inyectado desde el cliente', () => {
      expect(CompraInputSchema.safeParse(inputBase({ estado_pago: 'pagado' })).success).toBe(false)
      expect(CompraInputSchema.safeParse(inputBase({ estadoPago: 'pagado' })).success).toBe(false)
    })

    it('rechaza totales calculados desde el cliente (total, subtotal, igv)', () => {
      expect(CompraInputSchema.safeParse(inputBase({ total: 500 })).success).toBe(false)
      expect(CompraInputSchema.safeParse(inputBase({ subtotal: 400 })).success).toBe(false)
      expect(CompraInputSchema.safeParse(inputBase({ igv: 72 })).success).toBe(false)
    })

    it('rechaza campos desconocidos en items', () => {
      expect(
        CompraInputSchema.safeParse(
          inputBase({
            items: [
              {
                catalogoId: '33333333-3333-4333-8333-333333333333',
                cantidad: 1,
                precioUnitario: 10,
                subtotal: 10,
              },
            ],
          })
        ).success
      ).toBe(false)
    })
  })
})
