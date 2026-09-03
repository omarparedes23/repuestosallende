import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emitirComprobante, type OseComprobanteInput } from './ose'

function inputBase(overrides: Partial<OseComprobanteInput> = {}): OseComprobanteInput {
  return {
    tipo: 'BOLETA',
    serie: 'B001',
    correlativo: 1,
    rucEmisor: '20123456789',
    razonSocial: 'Repuestos Allende SAC',
    fechaEmision: '2026-07-11',
    cliente: { nombre: 'Consumidor Final', tipoDocumento: null, nroDocumento: null },
    items: [{ descripcion: 'Filtro', cantidad: 1, valorUnitario: 10, subtotalBase: 10 }],
    subtotal: 10,
    igv: 1.8,
    total: 11.8,
    moneda: 'PEN',
    ...overrides,
  }
}

describe('emitirComprobante — payload moneda/tipoCambio', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    process.env.OSE_SUNAT_URL = 'https://ose.test'
    process.env.OSE_SUNAT_API_KEY = 'test-key'
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estado: 'EMITIDA', id: 'abc', sunatHash: 'hash' }),
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('USD incluye tipoCambio en el payload', async () => {
    await emitirComprobante(inputBase({ moneda: 'USD', tipoCambio: 3.75 }))

    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.moneda).toBe('USD')
    expect(body.tipoCambio).toBe(3.75)
  })

  it('PEN omite tipoCambio del payload', async () => {
    await emitirComprobante(inputBase({ moneda: 'PEN' }))

    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.moneda).toBe('PEN')
    expect(body.tipoCambio).toBeUndefined()
  })

  it('envía la clave idempotente estable', async () => {
    await emitirComprobante(inputBase(), 'venta-uuid')
    const [, options] = fetchMock.mock.calls[0]
    expect(options.headers['Idempotency-Key']).toBe('venta-uuid')
  })

  it('envía referencia y motivo SUNAT al emitir una nota de crédito', async () => {
    await emitirComprobante(inputBase({
      tipo: 'NOTA_CREDITO', serie: 'BC001', correlativo: 1,
      notaCredito: {
        comprobanteReferenciadoId: 'B001-00000001', tipoDocReferenciado: '03',
        motivoCodigo: '07', motivoDescripcion: 'Devolución por ítem',
      },
    }), 'devolucion-uuid')
    const [, options] = fetchMock.mock.calls[0]
    const body = JSON.parse(options.body)
    expect(body.tipo).toBe('NOTA_CREDITO')
    expect(body.notaCredito).toEqual(expect.objectContaining({
      comprobanteReferenciadoId: 'B001-00000001', tipoDocReferenciado: '03', motivoCodigo: '07',
    }))
    expect(options.headers['Idempotency-Key']).toBe('devolucion-uuid')
  })

  it('clasifica RESULTADO_INCIERTO sin habilitar reintento', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ estado: 'RESULTADO_INCIERTO' }) })
    await expect(emitirComprobante(inputBase(), 'venta-uuid')).resolves.toMatchObject({ kind: 'uncertain', exito: false })
  })

  it('clasifica ERROR_REINTENTABLE como temporal', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ estado: 'ERROR_REINTENTABLE' }) })
    await expect(emitirComprobante(inputBase(), 'venta-uuid')).resolves.toMatchObject({ kind: 'temporary_error', exito: false })
  })

  it('persiste el detalle ProblemDetail de un rechazo fiscal', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ detail: 'Validación fallida', code: 'SUNAT_400', errors: { notaCredito: 'Comprobante referenciado no existe' } }),
    })
    await expect(emitirComprobante(inputBase(), 'devolucion-uuid')).resolves.toMatchObject({
      kind: 'rejected', http_status: 400, error_code: 'SUNAT_400',
      error: 'Validación fallida — notaCredito: Comprobante referenciado no existe',
      response_payload: expect.objectContaining({ errors: { notaCredito: 'Comprobante referenciado no existe' } }),
    })
  })
})
