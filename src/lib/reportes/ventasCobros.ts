export type ImporteConMoneda = { moneda: string | null; monto: number }

export type ResumenCredito = {
  cobradoAlEmitir: number
  creditoOriginal: number
  cobradoPosteriormente: number
  saldoCredito: number
}

export function agruparPorMoneda(importes: ImporteConMoneda[]): Record<string, number> {
  return importes.reduce<Record<string, number>>((totales, importe) => {
    const moneda = importe.moneda ?? 'PEN'
    totales[moneda] = (totales[moneda] ?? 0) + Number(importe.monto ?? 0)
    return totales
  }, {})
}

/**
 * Los abonos posteriores explican el saldo de crédito, pero no vuelven a sumar
 * al total comercial de la venta. Los movimientos de caja no participan aquí:
 * un cobro efectivo ya tiene su abono CxC correspondiente.
 */
export function calcularResumenCredito(
  pagos: Array<{ metodo_pago: string | null; monto: number }>,
  abonosPosteriores: number
): ResumenCredito {
  const cobradoAlEmitir = pagos
    .filter((pago) => pago.metodo_pago !== 'credito')
    .reduce((total, pago) => total + Number(pago.monto ?? 0), 0)
  const creditoOriginal = pagos
    .filter((pago) => pago.metodo_pago === 'credito')
    .reduce((total, pago) => total + Number(pago.monto ?? 0), 0)

  return {
    cobradoAlEmitir,
    creditoOriginal,
    cobradoPosteriormente: abonosPosteriores,
    saldoCredito: Math.max(0, creditoOriginal - abonosPosteriores),
  }
}
