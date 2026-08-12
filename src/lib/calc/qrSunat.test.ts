import { describe, expect, it } from 'vitest'
import { armarQrSunat } from './qrSunat'

describe('armarQrSunat', () => {
  it('arma el payload oficial RUC|tipo|serie|numero|igv|monto|fecha|tipoDoc|numDoc|hash', () => {
    const qr = armarQrSunat({
      rucEmisor: '20610105280',
      tipoComprobante: 'factura',
      serie: 'F001',
      correlativo: 2,
      igv: 145.26,
      monto: 952.26,
      fecha: '2026-08-12',
      tipoDocumento: 'RUC',
      nroDocumento: '20101066992',
      hash: 'abcd1234',
    })
    expect(qr).toBe('20610105280|01|F001|2|145.26|952.26|2026-08-12|6|20101066992|abcd1234')
  })

  it('boleta usa tipo 03 y cliente DNI', () => {
    const qr = armarQrSunat({
      rucEmisor: '20610105280',
      tipoComprobante: 'boleta',
      serie: 'B001',
      correlativo: 5,
      igv: 9.0,
      monto: 59.0,
      fecha: '2026-08-12',
      tipoDocumento: 'DNI',
      nroDocumento: '12345678',
      hash: 'xyz',
    })
    expect(qr).toBe('20610105280|03|B001|5|9.00|59.00|2026-08-12|1|12345678|xyz')
  })

  it('sin documento receptor queda vacío en su posición', () => {
    const qr = armarQrSunat({
      rucEmisor: '20610105280',
      tipoComprobante: 'boleta',
      serie: 'B001',
      correlativo: 1,
      igv: 3.05,
      monto: 20.0,
      fecha: '2026-08-12',
      tipoDocumento: null,
      nroDocumento: null,
      hash: 'hash',
    })
    expect(qr).toBe('20610105280|03|B001|1|3.05|20.00|2026-08-12|1||hash')
  })
})
