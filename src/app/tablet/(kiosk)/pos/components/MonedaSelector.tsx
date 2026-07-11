'use client'

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
}

export function MonedaSelector({ moneda, setMoneda, tipoCambio, setTipoCambio }: Props) {
  return (
    <div className="flex items-center gap-2">
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
    </div>
  )
}
