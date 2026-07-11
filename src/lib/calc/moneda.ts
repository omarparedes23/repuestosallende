import type { RaMoneda } from '@/lib/types/database'

const SIMBOLOS: Record<RaMoneda, string> = {
  PEN: 'S/.',
  USD: '$',
}

/**
 * Símbolo de moneda para mostrar en UI (POS, tickets, resúmenes).
 * NO construye "monto en letras" — eso lo arma `osesunat` server-side.
 */
export function simboloMoneda(moneda: RaMoneda): string {
  return SIMBOLOS[moneda]
}
