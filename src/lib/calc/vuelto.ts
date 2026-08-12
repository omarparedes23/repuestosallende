import { Decimal } from 'decimal.js'

/**
 * Calcula el vuelto como SUM(pagos.monto) − total.
 * Retorna 0 si no hay sobrepago o si no hay pagos.
 * Contrato: vuelto = SUM(pagos.monto) - total, solo si > 0.
 */
export function calcularVuelto(
  pagos: { monto: number }[],
  total: number
): number {
  const totalPagado = pagos.reduce(
    (acc, p) => acc.plus(p.monto),
    new Decimal(0)
  )
  const vuelto = totalPagado.minus(total)
  return vuelto.gt(0) ? vuelto.toDecimalPlaces(2).toNumber() : 0
}
