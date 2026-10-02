import { Decimal } from 'decimal.js'
import type { CartItem } from '@/app/tablet/stores/posStore'
import { itemsConPrecio, precioParaMoneda } from './precios'
import type { RaMoneda, RaTipoComprobante } from '@/lib/types/database'

/** Tasa de IGV. Los precios de catálogo ya la incluyen (IB_IncIGV = 1). */
export const IGV_TASA = 0.18

const FACTOR_IGV = new Decimal(1).plus(IGV_TASA)
const REDONDEO = Decimal.ROUND_HALF_UP

export type ItemCalculado = {
  productoId: string
  catalogoId: string
  nombre: string
  codigoOem: string | null
  cantidad: number
  /** Precio de lista (con IGV). */
  precioUnitario: number
  /** Descuento en monto (con IGV). */
  descuento: number
  /** Importe de la línea que paga el cliente (con IGV): round2(precio * cantidad - descuento). */
  subtotal: number
  /** Valor de la línea sin IGV (= subtotal en ticket). */
  base: number
}

export type TotalesVenta = {
  /** Base imponible (sin IGV); en ticket es igual al total. */
  subtotal: number
  igv: number
  /** Lo que paga el cliente (con IGV). */
  total: number
  items: ItemCalculado[]
}

export function calcularTotalesVenta(
  items: CartItem[],
  tipoComprobante: RaTipoComprobante,
  moneda: RaMoneda
): TotalesVenta {
  const conIgv = tipoComprobante !== 'ticket'
  let brutoAcc = new Decimal(0)
  let baseAcc = new Decimal(0)

  const itemsCalc: ItemCalculado[] = items.map((item) => {
    const precioLista = precioParaMoneda(item, moneda)
    if (precioLista == null) {
      throw new Error(
        `El repuesto "${item.nombre}" no tiene precio en ${moneda === 'USD' ? 'dólares' : 'soles'}`
      )
    }

    const precio = new Decimal(precioLista)
    const descuento = new Decimal(item.descuento)
    const bruto = precio.mul(item.cantidad).minus(descuento).toDecimalPlaces(2, REDONDEO)
    const base = conIgv ? bruto.div(FACTOR_IGV).toDecimalPlaces(2, REDONDEO) : bruto
    brutoAcc = brutoAcc.plus(bruto)
    baseAcc = baseAcc.plus(base)

    return {
      productoId: item.productoId,
      catalogoId: item.catalogoId,
      nombre: item.nombre,
      codigoOem: item.codigoOem,
      cantidad: item.cantidad,
      precioUnitario: precio.toDecimalPlaces(2, REDONDEO).toNumber(),
      descuento: descuento.toDecimalPlaces(2, REDONDEO).toNumber(),
      subtotal: bruto.toNumber(),
      base: base.toNumber(),
    }
  })

  // Precios con IGV incluido: total = Σ bruto; subtotal = Σ base; igv = total - subtotal.
  const total = brutoAcc.toDecimalPlaces(2, REDONDEO)
  const subtotal = conIgv ? baseAcc : total
  const igv = total.minus(subtotal)

  return {
    subtotal: subtotal.toNumber(),
    igv: igv.toNumber(),
    total: total.toNumber(),
    items: itemsCalc,
  }
}


/**
 * Totales de previsualización: excluye los ítems sin precio en la moneda dada
 * (no lanza). Para cobrar usar `calcularTotalesVenta`, que sí exige todos los precios.
 */
export function calcularTotalesParciales(
  items: CartItem[],
  tipoComprobante: RaTipoComprobante,
  moneda: RaMoneda
): TotalesVenta {
  return calcularTotalesVenta(itemsConPrecio(items, moneda), tipoComprobante, moneda)
}
