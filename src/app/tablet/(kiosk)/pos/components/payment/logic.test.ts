import { describe, expect, it } from 'vitest'
import { Decimal } from 'decimal.js'
import type { CartItem, ClienteSnapshot } from '@/app/tablet/stores/posStore'
import { calcularTotalesVenta } from '@/lib/calc/totales'
import {
  actualizarLinea,
  actualizarPrecioEditado,
  aplicarPreciosEditados,
  construirPayloadVenta,
  construirTicketData,
  crearLineaVacia,
  esCreditoInvalido,
  esIntentoConservado,
  hayPagoSinReferencia,
  bloqueoDeCobro,
  limiteCreditoExcedido,
  lineasParaTotal,
  montoNumerico,
  pagoCubreTotal,
  pagosValidos,
  precioDeLista,
  tieneCredito,
  tipoCambioEsInvalido,
  totalPagadoDeLineas,
  vueltoDeLineas,
  type LineaPago,
} from './logic'

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productoId: 'p1',
    catalogoId: 'c1',
    nombre: 'Filtro',
    codigoOem: null,
    cantidad: 2,
    moneda: 'PEN',
    precioMinorista: 10,
    precioDolar: 3,
    descuento: 0,
    stockActual: 10,
    ...overrides,
  } as CartItem
}

function cliente(overrides: Partial<ClienteSnapshot> = {}): ClienteSnapshot {
  return {
    id: 'cli1',
    nombre: 'Juan',
    tipo_documento: 'DNI',
    nro_documento: '123',
    tipo_cliente: 'minorista',
    tiene_credito: true,
    limite_credito: 100,
    saldo_deudor: 0,
    ...overrides,
  } as ClienteSnapshot
}

const linea = (metodoPago: LineaPago['metodoPago'], monto: string, referencia = ''): LineaPago => ({
  metodoPago,
  monto,
  referencia,
})

describe('montoNumerico', () => {
  it('parsea decimales, vacío e inválido', () => {
    expect(montoNumerico('12.5')).toBe(12.5)
    expect(montoNumerico('')).toBe(0)
    expect(montoNumerico('abc')).toBe(0)
  })
  it('conserva negativos (no se filtran aquí)', () => {
    expect(montoNumerico('-5')).toBe(-5)
  })
})

describe('lineas', () => {
  it('lineasParaTotal crea una línea efectivo con 2 decimales', () => {
    expect(lineasParaTotal(23.6)).toEqual([{ metodoPago: 'efectivo', monto: '23.60', referencia: '' }])
  })
  it('crearLineaVacia es efectivo sin monto', () => {
    expect(crearLineaVacia()).toEqual({ metodoPago: 'efectivo', monto: '', referencia: '' })
  })
  it('actualizarLinea solo cambia el índice indicado', () => {
    const base = [linea('efectivo', '1'), linea('yape', '2')]
    const res = actualizarLinea(base, 1, 'monto', '5')
    expect(res[0]).toBe(base[0])
    expect(res[1].monto).toBe('5')
  })
})

describe('precios', () => {
  it('precioDeLista según moneda', () => {
    expect(precioDeLista(item(), 'PEN')).toBe(10)
    expect(precioDeLista(item(), 'USD')).toBe(3)
    expect(precioDeLista(item({ precioDolar: null }), 'USD')).toBeNull()
  })
  it('precioDeLista no convierte un null en 0', () => {
    expect(precioDeLista(item({ precioMinorista: null }), 'PEN')).toBeNull()
  })
  it('aplicarPreciosEditados convierte el precio editado en descuento por línea', () => {
    const res = aplicarPreciosEditados([item()], 'PEN', { p1: 8 })
    expect(res[0].descuento).toBe(4)
  })
  it('un precio editado mayor a la lista no genera descuento negativo', () => {
    expect(aplicarPreciosEditados([item()], 'PEN', { p1: 15 })[0].descuento).toBe(0)
  })
  it('sin edición o sin precio de lista devuelve el mismo ítem', () => {
    const a = item()
    const b = item({ productoId: 'p2', precioDolar: null })
    const res = aplicarPreciosEditados([a, b], 'USD', { p2: 1 })
    expect(res[0]).toBe(a)
    expect(res[1]).toBe(b)
  })
  it('descuento por precio editado produce el total esperado con calcularTotalesVenta', () => {
    const res = aplicarPreciosEditados([item()], 'PEN', { p1: 8 })
    expect(calcularTotalesVenta(res, 'ticket', 'PEN').total).toBe(16)
  })
  it('actualizarPrecioEditado: agrega, quita con vacío, ignora inválidos y negativos', () => {
    const prev = { p1: 5 }
    expect(actualizarPrecioEditado(prev, 'p2', '3.5')).toEqual({ p1: 5, p2: 3.5 })
    expect(actualizarPrecioEditado(prev, 'p1', '')).toEqual({})
    expect(actualizarPrecioEditado(prev, 'p1', 'abc')).toBe(prev)
    expect(actualizarPrecioEditado(prev, 'p1', '-1')).toBe(prev)
    expect(actualizarPrecioEditado(prev, 'p1', '0')).toEqual({ p1: 0 })
  })
})

describe('pagos', () => {
  it('pagos divididos suman exactamente el total (0.1 + 0.2)', () => {
    const total = totalPagadoDeLineas([linea('efectivo', '0.1'), linea('yape', '0.2')])
    expect(total.equals(new Decimal('0.3'))).toBe(true)
    expect(total.toNumber()).toBe(0.3)
  })
  it('split de efectivo + yape + tarjeta cubre el total', () => {
    const lineas = [linea('efectivo', '50.50'), linea('yape', '30.25'), linea('tarjeta', '19.25')]
    const pagado = totalPagadoDeLineas(lineas)
    expect(pagado.toNumber()).toBe(100)
    expect(pagoCubreTotal(pagado, 100)).toBe(true)
  })
  it('totalPagadoDeLineas vacío es 0 y los inválidos cuentan 0', () => {
    expect(totalPagadoDeLineas([]).toNumber()).toBe(0)
    expect(totalPagadoDeLineas([linea('efectivo', 'x')]).toNumber()).toBe(0)
  })
  it('un monto negativo resta del total pagado', () => {
    expect(totalPagadoDeLineas([linea('efectivo', '10'), linea('yape', '-4')]).toNumber()).toBe(6)
  })
  it('pagoCubreTotal tolera 1 centavo de diferencia pero no más', () => {
    expect(pagoCubreTotal(new Decimal('99.99'), 100)).toBe(true)
    expect(pagoCubreTotal(new Decimal('99.98'), 100)).toBe(false)
    expect(pagoCubreTotal(new Decimal(0), 10)).toBe(false)
  })
  it('vuelto con sobrepago en efectivo', () => {
    expect(vueltoDeLineas([linea('efectivo', '100')], 76.5)).toBe(23.5)
  })
  it('vuelto es 0 si paga exacto, de menos o sin líneas', () => {
    expect(vueltoDeLineas([linea('efectivo', '50')], 50)).toBe(0)
    expect(vueltoDeLineas([linea('efectivo', '40')], 50)).toBe(0)
    expect(vueltoDeLineas([], 50)).toBe(0)
  })
  it('vuelto sin error de coma flotante (0.1 + 0.2 - 0.3)', () => {
    expect(vueltoDeLineas([linea('efectivo', '0.1'), linea('efectivo', '0.2')], 0.3)).toBe(0)
    expect(vueltoDeLineas([linea('efectivo', '10.10'), linea('yape', '0.20')], 10)).toBe(0.3)
  })
  it('vuelto redondea a 2 decimales', () => {
    expect(vueltoDeLineas([linea('efectivo', '10.126')], 10)).toBe(0.13)
  })
  it('pagosValidos descarta montos <= 0 e inválidos y recorta la referencia', () => {
    const res = pagosValidos([
      linea('efectivo', '0'),
      linea('efectivo', '-3'),
      linea('efectivo', ''),
      linea('yape', '5', '  OP-1  '),
      linea('efectivo', '2'),
    ])
    expect(res).toEqual([
      { metodoPago: 'yape', monto: 5, referencia: 'OP-1' },
      { metodoPago: 'efectivo', monto: 2, referencia: undefined },
    ])
  })
  it('hayPagoSinReferencia exige referencia en pagos digitales con monto', () => {
    expect(hayPagoSinReferencia([linea('yape', '5')])).toBe(true)
    expect(hayPagoSinReferencia([linea('tarjeta', '5', '   ')])).toBe(true)
    expect(hayPagoSinReferencia([linea('transferencia', '5', 'X')])).toBe(false)
    expect(hayPagoSinReferencia([linea('yape', '0')])).toBe(false)
    expect(hayPagoSinReferencia([linea('efectivo', '5'), linea('credito', '5')])).toBe(false)
  })
})

describe('crédito', () => {
  it('tieneCredito detecta línea de crédito', () => {
    expect(tieneCredito([linea('efectivo', '1')])).toBe(false)
    expect(tieneCredito([linea('efectivo', '1'), linea('credito', '1')])).toBe(true)
  })
  it('venta a crédito exige cliente con crédito habilitado', () => {
    const lineas = [linea('credito', '50')]
    expect(esCreditoInvalido(lineas, null)).toBe(true)
    expect(esCreditoInvalido(lineas, cliente({ tiene_credito: false }))).toBe(true)
    expect(esCreditoInvalido(lineas, cliente())).toBe(false)
  })
  it('sin línea de crédito nunca es inválido', () => {
    expect(esCreditoInvalido([linea('efectivo', '50')], null)).toBe(false)
  })
  it('limiteCreditoExcedido considera saldo deudor + monto a crédito', () => {
    const c = cliente({ saldo_deudor: 60, limite_credito: 100 })
    expect(limiteCreditoExcedido([linea('credito', '40')], c)).toBe(false)
    expect(limiteCreditoExcedido([linea('credito', '40.01')], c)).toBe(true)
  })
  it('limiteCreditoExcedido suma varias líneas de crédito y exige monto > 0', () => {
    const c = cliente({ saldo_deudor: 90, limite_credito: 100 })
    expect(limiteCreditoExcedido([linea('credito', '6'), linea('credito', '6')], c)).toBe(true)
    expect(limiteCreditoExcedido([linea('credito', '0')], cliente({ saldo_deudor: 200 }))).toBe(false)
  })
  it('limiteCreditoExcedido es false sin cliente, sin crédito o sin línea', () => {
    expect(limiteCreditoExcedido([linea('credito', '500')], null)).toBe(false)
    expect(limiteCreditoExcedido([linea('credito', '500')], cliente({ tiene_credito: false }))).toBe(false)
    expect(limiteCreditoExcedido([linea('efectivo', '500')], cliente())).toBe(false)
  })
})

describe('moneda', () => {
  it('tipoCambioEsInvalido solo aplica en USD', () => {
    expect(tipoCambioEsInvalido('PEN', null)).toBe(false)
    expect(tipoCambioEsInvalido('USD', null)).toBe(true)
    expect(tipoCambioEsInvalido('USD', 0)).toBe(true)
    expect(tipoCambioEsInvalido('USD', -3)).toBe(true)
    expect(tipoCambioEsInvalido('USD', 3.7)).toBe(false)
  })
})

describe('esIntentoConservado', () => {
  it('detecta la marca de resultado incierto', () => {
    expect(esIntentoConservado('Error de red. Conservamos el intento para reintentar')).toBe(true)
    expect(esIntentoConservado('Stock insuficiente')).toBe(false)
  })
})

describe('construirPayloadVenta', () => {
  const base = {
    operationId: 'op-1',
    tipoComprobante: 'ticket' as const,
    cliente: null,
    itemsConDescuento: [item({ descuento: 1 })],
    lineas: [linea('efectivo', '20')],
    moneda: 'PEN' as const,
    tipoCambio: 3.7,
    fechaVencimiento: '2026-12-01',
    numeroPlaca: ' abc-123 ',
  }
  it('arma el payload en PEN: sin tipo de cambio, vencimiento ni placa', () => {
    expect(construirPayloadVenta(base)).toEqual({
      operationId: 'op-1',
      tipoComprobante: 'ticket',
      clienteId: null,
      items: [{ productoId: 'p1', catalogoId: 'c1', cantidad: 2, descuento: 1 }],
      pagos: [{ metodoPago: 'efectivo', monto: 20, referencia: undefined }],
      moneda: 'PEN',
      tipoCambio: null,
      fechaVencimiento: null,
      numeroPlaca: null,
    })
  })
  it('en USD envía el tipo de cambio', () => {
    expect(construirPayloadVenta({ ...base, moneda: 'USD' }).tipoCambio).toBe(3.7)
  })
  it('placa solo en factura y recortada', () => {
    expect(construirPayloadVenta({ ...base, tipoComprobante: 'factura' }).numeroPlaca).toBe('abc-123')
    expect(construirPayloadVenta({ ...base, tipoComprobante: 'factura', numeroPlaca: '  ' }).numeroPlaca).toBeNull()
  })
  it('vencimiento solo con línea de crédito; vacío = null', () => {
    const conCredito = { ...base, lineas: [linea('credito', '20')], cliente: cliente() }
    expect(construirPayloadVenta(conCredito).fechaVencimiento).toBe('2026-12-01')
    expect(construirPayloadVenta(conCredito).clienteId).toBe('cli1')
    expect(construirPayloadVenta({ ...conCredito, fechaVencimiento: '' }).fechaVencimiento).toBeNull()
  })
})

describe('construirTicketData', () => {
  it('mapea venta, totales, pagos y cliente', () => {
    const totales = calcularTotalesVenta([item()], 'boleta', 'PEN')
    const fecha = new Date('2026-01-01T00:00:00Z')
    const data = construirTicketData({
      venta: {
        id: 'v1',
        operationId: 'op',
        replayed: false,
        total: totales.total,
        tipoComprobante: 'boleta',
        moneda: 'PEN',
        serie: 'B001',
        correlativo: 7,
        numero_completo: 'B001-7',
        empresa: { razon_social: null, ruc: '2060', direccion: null, telefono: null },
        sucursal: { nombre: 'Central', direccion: null },
        avisoCredito: null,
      },
      tipoComprobante: 'boleta',
      simbolo: 'S/.',
      tipoCambio: null,
      totales,
      lineas: [linea('efectivo', '30'), linea('yape', '0'), linea('yape', '1', ' R ')],
      vuelto: 7.4,
      cliente: cliente({ nro_documento: null }),
      sunatHash: null,
      fecha,
    })
    expect(data.empresa).toEqual({ razonSocial: '2060', ruc: '2060', direccion: '', telefono: '' })
    expect(data.total).toBe(23.6)
    expect(data.pagos).toEqual([
      { metodoPago: 'efectivo', monto: 30, referencia: null },
      { metodoPago: 'yape', monto: 1, referencia: 'R' },
    ])
    expect(data.cliente).toEqual({ nombre: 'Juan', tipoDocumento: 'DNI', nroDocumento: '' })
    expect(data.fecha).toBe(fecha)
    expect(data.vuelto).toBe(7.4)
  })
})

describe('bloqueoDeCobro', () => {
  const ambos = item({ productoId: 'ambos' })
  const soloSoles = item({ productoId: 'soles', precioDolar: null })
  const soloDolares = item({ productoId: 'dolares', precioMinorista: null })
  const ninguno = item({ productoId: 'nada', precioMinorista: null, precioDolar: null })

  it('sin bloqueo cuando todos tienen precio en la moneda', () => {
    expect(bloqueoDeCobro([ambos, soloSoles], 'PEN')).toEqual({ tipo: 'ninguno' })
    expect(bloqueoDeCobro([ambos, soloDolares], 'USD')).toEqual({ tipo: 'ninguno' })
    expect(bloqueoDeCobro([], 'PEN')).toEqual({ tipo: 'ninguno' })
  })

  it('falta precio y todos existen en la otra moneda: ofrece cambiar', () => {
    const r = bloqueoDeCobro([soloDolares, ambos], 'PEN')
    expect(r).toEqual({
      tipo: 'falta_precio',
      items: [soloDolares],
      puedeCambiarA: 'USD',
      mezcla: false,
    })
    const r2 = bloqueoDeCobro([soloSoles, ambos], 'USD')
    expect(r2).toMatchObject({ tipo: 'falta_precio', puedeCambiarA: 'PEN', mezcla: false })
  })

  it('carrito mezcla soles-only con dólares-only: no se puede cambiar y hay mezcla', () => {
    const r = bloqueoDeCobro([soloSoles, soloDolares], 'PEN')
    expect(r).toEqual({
      tipo: 'falta_precio',
      items: [soloDolares],
      puedeCambiarA: null,
      mezcla: true,
    })
    expect(bloqueoDeCobro([soloSoles, soloDolares], 'USD')).toMatchObject({
      items: [soloSoles],
      puedeCambiarA: null,
      mezcla: true,
    })
  })

  it('ítem sin ningún precio: bloquea sin ofrecer cambio ni hablar de mezcla', () => {
    expect(bloqueoDeCobro([ambos, ninguno], 'PEN')).toEqual({
      tipo: 'falta_precio',
      items: [ninguno],
      puedeCambiarA: null,
      mezcla: false,
    })
  })
})
