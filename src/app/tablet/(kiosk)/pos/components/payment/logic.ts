import { Decimal } from 'decimal.js'
import type { CartItem, ClienteSnapshot } from '@/app/tablet/stores/posStore'
import type { RaMetodoPago, RaMoneda, RaTipoComprobante } from '@/lib/types/database'
import type { TicketReceiptData } from '@/app/tablet/components/ticket/TicketReceipt'
import type { TotalesVenta } from '@/lib/calc/totales'
import { calcularVuelto } from '@/lib/calc/vuelto'
import { itemsSinPrecio, precioParaMoneda } from '@/lib/calc/precios'
import type { VentaResult } from '../../actions'

export type LineaPago = {
  metodoPago: RaMetodoPago
  monto: string
  referencia: string
}

export const METODOS_CON_REFERENCIA = new Set<RaMetodoPago>(['yape', 'tarjeta', 'transferencia'])

export const MENSAJE_SIN_REFERENCIA = 'Registra el número de operación o voucher de cada pago digital.'

/** Marca que `procesarVenta` agrega cuando el resultado de la venta es incierto. */
const MARCA_INTENTO_CONSERVADO = 'Conservamos el intento'

export function esIntentoConservado(error: string): boolean {
  return error.includes(MARCA_INTENTO_CONSERVADO)
}

/** Monto tipeado -> número. Vacío o inválido = 0 (los negativos se conservan). */
export function montoNumerico(monto: string): number {
  return parseFloat(monto) || 0
}

export function crearLineaVacia(): LineaPago {
  return { metodoPago: 'efectivo', monto: '', referencia: '' }
}

/** Una sola línea en efectivo por el total a cobrar. */
export function lineasParaTotal(total: number): LineaPago[] {
  return [{ metodoPago: 'efectivo', monto: total.toFixed(2), referencia: '' }]
}

/** Precio de lista del ítem en la moneda dada — la referencia que nunca se edita. */
export function precioDeLista(item: CartItem, moneda: RaMoneda): number | null {
  return precioParaMoneda(item, moneda)
}

export type BloqueoDeCobro =
  | { tipo: 'ninguno' }
  | {
      tipo: 'falta_precio'
      /** Productos sin precio en la moneda de venta elegida. */
      items: CartItem[]
      /** Moneda a la que se puede cambiar para cobrar todo el carrito, o null. */
      puedeCambiarA: RaMoneda | null
      /** El carrito mezcla productos solo en soles con productos solo en dólares. */
      mezcla: boolean
    }

/**
 * Decide si el cobro está bloqueado por falta de precio en la moneda elegida.
 * Sin conversión entre monedas: solo se puede cambiar de moneda si TODOS los
 * ítems tienen precio en la otra.
 */
export function bloqueoDeCobro(items: CartItem[], moneda: RaMoneda): BloqueoDeCobro {
  const faltantes = itemsSinPrecio(items, moneda)
  if (faltantes.length === 0) return { tipo: 'ninguno' }
  const otra: RaMoneda = moneda === 'USD' ? 'PEN' : 'USD'
  const puedeCambiarA = itemsSinPrecio(items, otra).length === 0 ? otra : null
  const soloSoles = items.some((i) => i.precioMinorista != null && i.precioDolar == null)
  const soloDolares = items.some((i) => i.precioDolar != null && i.precioMinorista == null)
  return {
    tipo: 'falta_precio',
    items: faltantes,
    puedeCambiarA,
    mezcla: puedeCambiarA == null && soloSoles && soloDolares,
  }
}

export const MENSAJE_CARRITO_MIXTO =
  'El carrito mezcla productos en soles y en dólares. Aún no se puede cobrar en una sola venta: separa los productos en dos ventas.'

/** El precio editado se traduce a un descuento por línea: (lista - editado) * cantidad. */
export function aplicarPreciosEditados(
  items: CartItem[],
  moneda: RaMoneda,
  preciosEditados: Record<string, number>
): CartItem[] {
  return items.map((item) => {
    const lista = precioDeLista(item, moneda)
    const editado = preciosEditados[item.productoId]
    if (lista == null || editado == null) return item
    const descuentoUnit = Math.max(0, lista - editado)
    return { ...item, descuento: descuentoUnit * item.cantidad }
  })
}

/** Reducer del precio editado: '' lo quita; inválido o negativo se ignora. */
export function actualizarPrecioEditado(
  prev: Record<string, number>,
  productoId: string,
  value: string
): Record<string, number> {
  if (value === '') {
    return Object.fromEntries(Object.entries(prev).filter(([id]) => id !== productoId))
  }
  const n = parseFloat(value)
  if (isNaN(n) || n < 0) return prev
  return { ...prev, [productoId]: n }
}

export function actualizarLinea(
  lineas: LineaPago[],
  idx: number,
  field: keyof LineaPago,
  value: string
): LineaPago[] {
  return lineas.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
}

export function totalPagadoDeLineas(lineas: LineaPago[]): Decimal {
  return lineas.reduce((acc, l) => acc.plus(montoNumerico(l.monto)), new Decimal(0))
}

/** Vuelto = pagado - total, solo si hay sobrepago (reutiliza lib/calc/vuelto). */
export function vueltoDeLineas(lineas: LineaPago[], total: number): number {
  return calcularVuelto(
    lineas.map((l) => ({ monto: montoNumerico(l.monto) })),
    total
  )
}

/** Tolerancia de 1 centavo: el pago cubre el total si pagado >= total - 0.01. */
export function pagoCubreTotal(totalPagado: Decimal, total: number): boolean {
  return !totalPagado.lt(total - 0.01)
}

export function hayPagoSinReferencia(lineas: LineaPago[]): boolean {
  return lineas.some(
    (l) =>
      METODOS_CON_REFERENCIA.has(l.metodoPago) &&
      montoNumerico(l.monto) > 0 &&
      !l.referencia.trim()
  )
}

export function pagosValidos(lineas: LineaPago[]) {
  return lineas
    .map((l) => ({
      metodoPago: l.metodoPago,
      monto: montoNumerico(l.monto),
      referencia: l.referencia.trim() || undefined,
    }))
    .filter((p) => p.monto > 0)
}

export function tieneCredito(lineas: LineaPago[]): boolean {
  return lineas.some((l) => l.metodoPago === 'credito')
}

/** Venta a crédito sin cliente, o con un cliente sin crédito habilitado. */
export function esCreditoInvalido(lineas: LineaPago[], cliente: ClienteSnapshot | null): boolean {
  return tieneCredito(lineas) && (!cliente || cliente.tiene_credito === false)
}

export function limiteCreditoExcedido(lineas: LineaPago[], cliente: ClienteSnapshot | null): boolean {
  if (!tieneCredito(lineas) || !cliente || !cliente.tiene_credito) return false
  const montoCredito = lineas
    .filter((l) => l.metodoPago === 'credito')
    .reduce((acc, l) => acc + montoNumerico(l.monto), 0)
  return montoCredito > 0 && cliente.saldo_deudor + montoCredito > cliente.limite_credito
}

export function tipoCambioEsInvalido(moneda: RaMoneda, tipoCambio: number | null): boolean {
  return moneda === 'USD' && (!tipoCambio || tipoCambio <= 0)
}

export type VentaPayload = {
  operationId: string
  tipoComprobante: RaTipoComprobante
  clienteId: string | null
  items: { productoId: string; catalogoId: string; cantidad: number; descuento: number }[]
  pagos: ReturnType<typeof pagosValidos>
  moneda: RaMoneda
  tipoCambio: number | null
  fechaVencimiento: string | null
  numeroPlaca: string | null
}

export function construirPayloadVenta(input: {
  operationId: string
  tipoComprobante: RaTipoComprobante
  cliente: ClienteSnapshot | null
  itemsConDescuento: CartItem[]
  lineas: LineaPago[]
  moneda: RaMoneda
  tipoCambio: number | null
  fechaVencimiento: string
  numeroPlaca: string
}): VentaPayload {
  return {
    operationId: input.operationId,
    tipoComprobante: input.tipoComprobante,
    clienteId: input.cliente?.id ?? null,
    items: input.itemsConDescuento.map((i) => ({
      productoId: i.productoId,
      catalogoId: i.catalogoId,
      cantidad: i.cantidad,
      descuento: i.descuento,
    })),
    pagos: pagosValidos(input.lineas),
    moneda: input.moneda,
    tipoCambio: input.moneda === 'USD' ? input.tipoCambio : null,
    fechaVencimiento: tieneCredito(input.lineas) ? input.fechaVencimiento || null : null,
    numeroPlaca:
      input.tipoComprobante === 'factura' ? input.numeroPlaca.trim() || null : null,
  }
}

export function construirTicketData(input: {
  venta: VentaResult
  tipoComprobante: RaTipoComprobante
  simbolo: string
  tipoCambio: number | null
  totales: TotalesVenta
  lineas: LineaPago[]
  vuelto: number
  cliente: ClienteSnapshot | null
  sunatHash: string | null
  fecha: Date
}): TicketReceiptData {
  const { venta, totales, cliente } = input
  return {
    width: 80,
    tipoComprobante: input.tipoComprobante,
    empresa: {
      razonSocial: venta.empresa.razon_social ?? venta.empresa.ruc ?? '',
      ruc: venta.empresa.ruc ?? '',
      direccion: venta.empresa.direccion ?? '',
      telefono: venta.empresa.telefono ?? '',
    },
    sucursal: {
      nombre: venta.sucursal.nombre,
      direccion: venta.sucursal.direccion ?? '',
    },
    numeroCompleto: venta.numero_completo ?? '',
    serie: venta.serie,
    correlativo: venta.correlativo,
    fecha: input.fecha,
    moneda: venta.moneda,
    simbolo: input.simbolo,
    tipoCambio: input.tipoCambio,
    items: totales.items.map((i) => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      precioUnitario: i.precioUnitario,
      descuento: i.descuento,
      subtotal: i.subtotal,
    })),
    subtotal: totales.subtotal,
    igv: totales.igv,
    total: totales.total,
    pagos: input.lineas
      .filter((l) => montoNumerico(l.monto) > 0)
      .map((l) => ({
        metodoPago: l.metodoPago,
        monto: montoNumerico(l.monto),
        referencia: l.referencia.trim() || null,
      })),
    vuelto: input.vuelto,
    cliente: cliente
      ? {
          nombre: cliente.nombre,
          tipoDocumento: cliente.tipo_documento ?? '',
          nroDocumento: cliente.nro_documento ?? '',
        }
      : undefined,
    sunatHash: input.sunatHash,
  }
}
