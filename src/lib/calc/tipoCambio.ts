/** Días máximos que un T.C. puede tener antes de considerarse desactualizado. */
export const TIPO_CAMBIO_MAX_ANTIGUEDAD_DIAS = 3

const MS_POR_DIA = 86_400_000

/** Fecha de calendario local como 'YYYY-MM-DD' (sin pasar por UTC). */
export function fechaLocalISO(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function diaOrdinal(fecha: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!m) return Number.NaN
  // Date.UTC solo para aritmética de calendario: no hay conversión de zona.
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / MS_POR_DIA)
}

/** Días de calendario entre `fecha` y `hoy` (ambas 'YYYY-MM-DD'). NaN si alguna es inválida. */
export function antiguedadTipoCambio(fecha: string, hoy: string): number {
  return diaOrdinal(hoy) - diaOrdinal(fecha)
}

/** Vigente = no más antiguo que 3 días. Fecha inválida => no vigente. */
export function esTipoCambioVigente(fecha: string, hoy: string): boolean {
  const dias = antiguedadTipoCambio(fecha, hoy)
  return Number.isFinite(dias) && dias <= TIPO_CAMBIO_MAX_ANTIGUEDAD_DIAS
}

/** 'YYYY-MM-DD' -> 'DD/MM/YYYY'. */
export function formatearFechaTipoCambio(fecha: string): string {
  const [y, m, d] = fecha.split('-')
  return `${d}/${m}/${y}`
}

/** Prellenar solo si se vende en USD, el cajero no escribió nada y hay un T.C. válido. */
export function debePrellenarTipoCambio(
  moneda: 'PEN' | 'USD',
  tipoCambio: number | null,
  tasa: { venta: number } | null
): boolean {
  return moneda === 'USD' && tipoCambio == null && !!tasa && tasa.venta > 0
}
