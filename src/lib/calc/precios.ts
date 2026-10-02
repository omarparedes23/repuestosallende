import type { RaMoneda } from '@/lib/types/database'

/** Forma mínima de un ítem con precio por moneda de venta (PEN / USD). */
export type ConPrecios = {
  precioMinorista: number | null
  precioDolar: number | null
}

/** Precio de lista del ítem en la moneda de venta dada; null si no tiene (nunca 0). */
export function precioParaMoneda(item: ConPrecios, moneda: RaMoneda): number | null {
  return moneda === 'USD' ? item.precioDolar : item.precioMinorista
}

/** Ítems que no tienen precio en la moneda de venta dada. */
export function itemsSinPrecio<T extends ConPrecios>(items: T[], moneda: RaMoneda): T[] {
  return items.filter((i) => precioParaMoneda(i, moneda) == null)
}

/** Ítems que sí tienen precio en la moneda de venta dada. */
export function itemsConPrecio<T extends ConPrecios>(items: T[], moneda: RaMoneda): T[] {
  return items.filter((i) => precioParaMoneda(i, moneda) != null)
}

/** Símbolo para mostrar precios de productos ("US$" evita confundir con otras monedas "$"). */
export function simboloPrecio(moneda: RaMoneda): string {
  return moneda === 'USD' ? 'US$' : 'S/.'
}

/**
 * Precio a mostrar en la tarjeta de producto: el de su propia moneda; si no lo tiene,
 * el de la otra. null = "Sin precio".
 */
export function precioPrincipal(
  p: ConPrecios & { moneda: RaMoneda }
): { moneda: RaMoneda; monto: number } | null {
  const propio = precioParaMoneda(p, p.moneda)
  if (propio != null) return { moneda: p.moneda, monto: propio }
  const otraMoneda: RaMoneda = p.moneda === 'USD' ? 'PEN' : 'USD'
  const otro = precioParaMoneda(p, otraMoneda)
  return otro != null ? { moneda: otraMoneda, monto: otro } : null
}

/** Nota corta para un ítem sin precio en la moneda de venta. */
export function notaSinPrecio(item: ConPrecios, moneda: RaMoneda): string {
  const otra: RaMoneda = moneda === 'USD' ? 'PEN' : 'USD'
  if (precioParaMoneda(item, otra) == null) return 'Sin precio'
  return moneda === 'PEN' ? 'Solo en USD' : 'Solo en soles'
}

/**
 * Moneda con la que el carrito se previsualiza: soles salvo que el carrito entero
 * solo se pueda vender en dólares.
 */
export function monedaDePrevisualizacion(items: ConPrecios[]): RaMoneda {
  if (items.length === 0) return 'PEN'
  if (itemsSinPrecio(items, 'PEN').length === 0) return 'PEN'
  return itemsSinPrecio(items, 'USD').length === 0 ? 'USD' : 'PEN'
}
