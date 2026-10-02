'use client'

import { formatearFechaTipoCambio } from '@/lib/calc/tipoCambio'
import type { RaMoneda } from '@/lib/types/database'

const MONEDA_LABELS: Record<RaMoneda, string> = {
  PEN: 'Soles',
  USD: 'Dólares',
}

type Props = {
  moneda: RaMoneda
  setMoneda: (moneda: RaMoneda) => void
  tipoCambio: number | null
  setTipoCambio: (tipoCambio: number | null) => void
  /** Fecha del T.C. de referencia (si se pudo consultar) y si está vigente. */
  tipoCambioInfo?: { fecha: string; vigente: boolean } | null
}

export function MonedaSelector({ moneda, setMoneda, tipoCambio, setTipoCambio, tipoCambioInfo }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-xl overflow-hidden border-2" style={{ borderColor: '#D1D5DB' }}>
        {(['PEN', 'USD'] as RaMoneda[]).map((m) => (
          <button
            key={m}
            onClick={() => setMoneda(m)}
            className="px-4 py-2 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: moneda === m ? '#002D62' : '#FFFFFF',
              color: moneda === m ? '#FFD700' : '#374151',
            }}
          >
            {MONEDA_LABELS[m]}
          </button>
        ))}
      </div>

      {moneda === 'USD' && (
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold" style={{ color: '#374151' }}>
            T.C.
          </span>
          <input
            type="number"
            min="0"
            step="0.001"
            value={tipoCambio ?? ''}
            onChange={(e) =>
              setTipoCambio(e.target.value ? parseFloat(e.target.value) : null)
            }
            placeholder="3.750"
            aria-label="Tipo de cambio"
            className="w-20 rounded-lg border-2 px-2 py-1.5 text-sm font-bold outline-none"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>
      )}

      {moneda === 'USD' && tipoCambioInfo && (
        <p
          className="w-full text-xs"
          style={{ color: tipoCambioInfo.vigente ? '#374151' : '#92400E' }}
        >
          {tipoCambioInfo.vigente
            ? `T.C. venta del ${formatearFechaTipoCambio(tipoCambioInfo.fecha)}`
            : `T.C. desactualizado: último del ${formatearFechaTipoCambio(tipoCambioInfo.fecha)}. Verifica antes de cobrar.`}
        </p>
      )}
    </div>
  )
}
