import { Decimal } from 'decimal.js'
import type { CartItem } from '@/app/tablet/stores/posStore'
import type { RaMoneda, RaTipoComprobante } from '@/lib/types/database'

export type ItemCalculado = {
  productoId: string
  catalogoId: string
  nombre: string
  codigoOem: string | null
  cantidad: number
  precioUnitario: number
  descuento: number
  subtotal: number
}

export type TotalesVenta = {
  subtotal: number
  igv: number
  total: number
  items: ItemCalculado[]
}

export function calcularTotalesVenta(
  items: CartItem[],
  tipoComprobante: RaTipoComprobante,
  moneda: RaMoneda
): TotalesVenta {
  let subtotalAcc = new Decimal(0)

  const itemsCalc: ItemCalculado[] = items.map((item) => {
    if (moneda === 'USD' && item.precioDolar == null) {
      throw new Error(
        `El repuesto "${item.nombre}" no tiene precio en dólares cargado`
      )
    }

    const precio = new Decimal(moneda === 'USD' ? item.precioDolar! : item.precioMinorista)
    const cantidad = new Decimal(item.cantidad)
    const descuento = new Decimal(item.descuento)
    const subtotalItem = precio.mul(cantidad).minus(descuento).toDecimalPlaces(2)
    subtotalAcc = subtotalAcc.plus(subtotalItem)

    return {
      productoId: item.productoId,
      catalogoId: item.catalogoId,
      nombre: item.nombre,
      codigoOem: item.codigoOem,
      cantidad: item.cantidad,
      precioUnitario: precio.toDecimalPlaces(2).toNumber(),
      descuento: descuento.toDecimalPlaces(2).toNumber(),
      subtotal: subtotalItem.toNumber(),
    }
  })

  const subtotal = subtotalAcc.toDecimalPlaces(2)
  const igv =
    tipoComprobante !== 'ticket'
      ? subtotal.mul('0.18').toDecimalPlaces(2)
      : new Decimal(0)
  const total = subtotal.plus(igv).toDecimalPlaces(2)

  return {
    subtotal: subtotal.toNumber(),
    igv: igv.toNumber(),
    total: total.toNumber(),
    items: itemsCalc,
  }
}
