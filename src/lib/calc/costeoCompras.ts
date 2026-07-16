import { Decimal } from 'decimal.js'

/**
 * Costeo promedio ponderado: recalcula `ra_productos.precio_compra` cuando
 * se recibe una compra, ponderando el precio previo (por el stock que ya
 * había) contra el precio de la mercadería recién recibida.
 *
 * Fórmula (misma que la RPC `ra_registrar_compra` en SQL, deben mantenerse
 * matemáticamente equivalentes):
 *   nuevo = (stockActual * precioActual + cantidadRecibida * precioRecibido)
 *           / (stockActual + cantidadRecibida)
 *
 * Si stockActual + cantidadRecibida = 0 (no debería ocurrir en la práctica,
 * ya que cantidad > 0 siempre en una línea de compra) se devuelve el precio
 * recibido tal cual, evitando división por cero.
 */
export function calcularCostoPromedioPonderado(
  stockActual: number,
  precioCompraActual: number | null,
  cantidadRecibida: number,
  precioUnitarioRecibido: number
): number {
  const stock = new Decimal(stockActual)
  const precioActual = new Decimal(precioCompraActual ?? 0)
  const cantidad = new Decimal(cantidadRecibida)
  const precioRecibido = new Decimal(precioUnitarioRecibido)

  const denominador = stock.plus(cantidad)

  if (denominador.isZero()) {
    return precioRecibido.toDecimalPlaces(2).toNumber()
  }

  const numerador = stock.mul(precioActual).plus(cantidad.mul(precioRecibido))

  return numerador.dividedBy(denominador).toDecimalPlaces(2).toNumber()
}
