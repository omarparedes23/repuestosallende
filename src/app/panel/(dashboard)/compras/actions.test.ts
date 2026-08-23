import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  consultarResultadoCompra,
  registrarCompra,
} from './actions'
import * as sessionModule from '@/lib/session'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    operationId: '11111111-1111-4111-8111-111111111111',
    proveedorId: '22222222-2222-4222-8222-222222222222',
    nroDocumento: 'F001-000456',
    tipoDocumento: 'FACTURA',
    notas: 'Recepción prueba',
    items: [
      {
        catalogoId: '33333333-3333-4333-8333-333333333333',
        cantidad: 10,
        precioUnitario: 25.5,
      },
    ],
    ordenCompraId: '44444444-4444-4444-8444-444444444444',
    moneda: 'PEN',
    tipoCambio: null,
    abonoInicial: null,
    ...overrides,
  }
}

describe('compras actions — registrarCompra y consultarResultadoCompra', () => {
  let mockRpc: ReturnType<typeof vi.fn>
  let mockFrom: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockRpc = vi.fn()
    mockFrom = vi.fn()

    vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
      supabase: {
        rpc: mockRpc,
        from: mockFrom,
      } as never,
      user: { id: 'user-1' } as never,
      perfil: {
        id: 'user-1',
        empresa_id: 'empresa-1',
        rol: 'administrador',
        activo: true,
      } as never,
      sucursalId: 'sucursal-1',
    })
  })

  describe('Autorización y sesión', () => {
    it('retorna error si el usuario no está autenticado', async () => {
      vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
        supabase: { rpc: mockRpc } as never,
        user: null,
        perfil: null,
        sucursalId: null,
      })

      const res = await registrarCompra(validPayload())
      expect(res.data).toBeNull()
      expect(res.error).toBe('No autenticado')
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('retorna error si el rol es vendedor o lectura', async () => {
      vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
        supabase: { rpc: mockRpc } as never,
        user: { id: 'user-1' } as never,
        perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'vendedor', activo: true } as never,
        sucursalId: 'sucursal-1',
      })

      const res = await registrarCompra(validPayload())
      expect(res.data).toBeNull()
      expect(res.error).toBe('Sin permisos para registrar compras')
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('permite rol superadmin', async () => {
      vi.spyOn(sessionModule, 'getSession').mockResolvedValue({
        supabase: { rpc: mockRpc } as never,
        user: { id: 'user-1' } as never,
        perfil: { id: 'user-1', empresa_id: 'empresa-1', rol: 'superadmin', activo: true } as never,
        sucursalId: 'sucursal-1',
      })

      mockRpc.mockResolvedValue({
        data: {
          status: 'confirmed',
          replayed: false,
          compra: {
            id: 'compra-123',
            total: 255,
            total_pen: 255,
            estado_pago: 'pendiente',
          },
        },
        error: null,
      })

      const res = await registrarCompra(validPayload())
      expect(res.error).toBeNull()
      expect(res.data?.id).toBe('compra-123')
    })
  })

  describe('Validación de schema en servidor', () => {
    it('falla con datos inválidos sin llamar a RPC', async () => {
      const res = await registrarCompra({ operationId: 'no-uuid' })
      expect(res.data).toBeNull()
      expect(res.error).toBeDefined()
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('rechaza campos autoritativos inyectados desde el cliente (empresa_id, estado_pago, total)', async () => {
      const res = await registrarCompra(
        validPayload({
          empresa_id: 'empresa-inyectada',
          estado_pago: 'pagado',
          total: 10,
        })
      )
      expect(res.data).toBeNull()
      expect(res.error).toBeDefined()
      expect(mockRpc).not.toHaveBeenCalled()
    })
  })

  describe('Ejecución atómica vía ra_confirmar_compra', () => {
    it('llama exclusivamente a ra_confirmar_compra con payload transformado y retorna CompraResult', async () => {
      mockRpc.mockResolvedValue({
        data: {
          status: 'confirmed',
          replayed: false,
          compra: {
            id: 'compra-abc',
            total: 300.9,
            total_pen: 300.9,
            estado_pago: 'pendiente',
          },
        },
        error: null,
      })

      const payload = validPayload()
      const res = await registrarCompra(payload)

      expect(res.error).toBeNull()
      expect(res.data).toEqual({
        id: 'compra-abc',
        operationId: '11111111-1111-4111-8111-111111111111',
        replayed: false,
        total: 300.9,
        totalPen: 300.9,
        estadoPago: 'pendiente',
      })

      expect(mockRpc).toHaveBeenCalledTimes(1)
      expect(mockRpc).toHaveBeenCalledWith('ra_confirmar_compra', {
        p_operation_id: '11111111-1111-4111-8111-111111111111',
        p_sucursal_id: 'sucursal-1',
        p_proveedor_id: '22222222-2222-4222-8222-222222222222',
        p_nro_documento: 'F001-000456',
        p_notas: 'Recepción prueba',
        p_items: [
          {
            catalogo_id: '33333333-3333-4333-8333-333333333333',
            cantidad: 10,
            precio_unitario: 25.5,
          },
        ],
        p_orden_compra_id: '44444444-4444-4444-8444-444444444444',
        p_moneda: 'PEN',
        p_tipo_cambio: null,
        p_tipo_documento: 'FACTURA',
        p_abono_inicial: null,
      })
    })

    it('procesa correctamente replay de compra idempotente', async () => {
      mockRpc.mockResolvedValue({
        data: {
          status: 'confirmed',
          replayed: true,
          compra: {
            id: 'compra-abc',
            total: 300.9,
            total_pen: 300.9,
            estado_pago: 'pendiente',
          },
        },
        error: null,
      })

      const res = await registrarCompra(validPayload())
      expect(res.error).toBeNull()
      expect(res.data?.replayed).toBe(true)
      expect(res.data?.id).toBe('compra-abc')
    })
  })

  describe('Mapeo de errores de dominio (sin SQL crudo)', () => {
    const errorCases = [
      {
        rpcMsg: 'RA_INVOICE_DUPLICATE: factura ya registrada',
        expected: 'El número de comprobante ya está registrado para este proveedor',
      },
      {
        rpcMsg: 'RA_INVOICE_INVALID: tipo_documento fuera de dominio',
        expected: 'El tipo o número de comprobante no es válido',
      },
      {
        rpcMsg: 'RA_IDEMPOTENCY_CONFLICT: payload difiere',
        expected: 'La operación ya fue confirmada con datos diferentes',
      },
      {
        rpcMsg: 'RA_ITEMS_INVALID: cantidad/precio invalidos',
        expected: 'Los artículos de la compra no son válidos',
      },
      {
        rpcMsg: 'RA_PROVIDER_INVALID: proveedor inactivo',
        expected: 'El proveedor no es válido para esta compra',
      },
      {
        rpcMsg: 'RA_PRODUCT_INVALID: catalogo inexistente',
        expected: 'Uno o más productos no son válidos para esta compra',
      },
      {
        rpcMsg: 'RA_BRANCH_INVALID: sucursal ajena',
        expected: 'La sucursal seleccionada no es válida o no está autorizada',
      },
      {
        rpcMsg: 'RA_ORDER_INVALID: cantidad excede',
        expected: 'La orden de compra no es válida o excede la cantidad pendiente',
      },
      {
        rpcMsg: 'RA_PAYMENT_EXCEEDS_TOTAL: abono supera total',
        expected: 'El abono inicial supera el total de la compra',
      },
      {
        rpcMsg: 'RA_PAYMENT_METHOD_INVALID: credito no permitido',
        expected: 'El método de pago del abono inicial no es válido',
      },
      {
        rpcMsg: 'RA_AMOUNT_OVERFLOW: overflow en total',
        expected: 'El importe total o saldo supera el límite permitido',
      },
      {
        rpcMsg: 'duplicate key value violates unique constraint uq_compras_factura_proveedor',
        expected: 'No se pudo confirmar la compra. Conservamos el intento para consultar su resultado.',
      },
    ]

    for (const { rpcMsg, expected } of errorCases) {
      it(`mapea "${rpcMsg}" a mensaje de dominio sanitizado`, async () => {
        mockRpc.mockResolvedValue({
          data: null,
          error: { message: rpcMsg },
        })

        const res = await registrarCompra(validPayload())
        expect(res.data).toBeNull()
        expect(res.error).toBe(expected)
      })
    }
  })

  describe('consultarResultadoCompra', () => {
    it('valida que operationId sea UUID válido', async () => {
      const res = await consultarResultadoCompra('no-uuid')
      expect(res.data).toBeNull()
      expect(res.error).toBe('Identificador de operación inválido')
      expect(mockRpc).not.toHaveBeenCalled()
    })

    it('retorna null cuando el resultado es not_found (seguro reintentar)', async () => {
      mockRpc.mockResolvedValue({
        data: { status: 'not_found' },
        error: null,
      })

      const res = await consultarResultadoCompra('11111111-1111-4111-8111-111111111111')
      expect(res.error).toBeNull()
      expect(res.data).toBeNull()
      expect(mockRpc).toHaveBeenCalledWith('ra_obtener_resultado_compra', {
        p_operation_id: '11111111-1111-4111-8111-111111111111',
      })
    })

    it('retorna compra confirmada si ya fue procesada', async () => {
      mockRpc.mockResolvedValue({
        data: {
          status: 'confirmed',
          replayed: true,
          compra: {
            id: 'compra-456',
            total: 500,
            total_pen: 500,
            estado_pago: 'pagado',
          },
        },
        error: null,
      })

      const res = await consultarResultadoCompra('11111111-1111-4111-8111-111111111111')
      expect(res.error).toBeNull()
      expect(res.data).toEqual({
        id: 'compra-456',
        operationId: '11111111-1111-4111-8111-111111111111',
        replayed: true,
        total: 500,
        totalPen: 500,
        estadoPago: 'pagado',
      })
    })
  })
})
