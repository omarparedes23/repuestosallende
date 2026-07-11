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
})
