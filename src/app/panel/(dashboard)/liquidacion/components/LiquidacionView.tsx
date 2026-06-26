'use client'

import { useState, useTransition } from 'react'
import { DollarSign, CheckCircle, AlertTriangle } from 'lucide-react'
import { cerrarConLiquidacion } from '../actions'
import type { CajaActiva } from '../actions'

type MetodoPago = 'efectivo' | 'yape' | 'tarjeta' | 'transferencia' | 'credito'

const METODOS: { key: MetodoPago; label: string; emoji: string }[] = [
  { key: 'efectivo',      label: 'Efectivo',      emoji: '💵' },
  { key: 'yape',         label: 'Yape',           emoji: '📱' },
  { key: 'tarjeta',      label: 'Tarjeta',        emoji: '💳' },
  { key: 'transferencia', label: 'Transferencia',  emoji: '🏦' },
  { key: 'credito',      label: 'Crédito',        emoji: '📋' },
]

type Props = { caja: CajaActiva | null }

export function LiquidacionView({ caja }: Props) {
  const [isPending, startTransition] = useTransition()
  const [confirmando, setConfirmando] = useState(false)
  const [exito, setExito] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notas, setNotas] = useState('')

  const [conteo, setConteo] = useState<Record<MetodoPago, number>>({
    efectivo: 0,
    yape: 0,
    tarjeta: 0,
    transferencia: 0,
    credito: 0,
  })

  if (!caja) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Liquidación de caja</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Cierre y conteo de la caja activa</p>
        </div>
        <div className="rounded-2xl border flex flex-col items-center justify-center py-20 gap-3" style={{ borderColor: '#E5E7EB' }}>
          <CheckCircle size={40} style={{ color: '#D1D5DB' }} />
          <p className="font-semibold" style={{ color: '#374151' }}>No hay caja abierta</p>
          <p className="text-sm" style={{ color: '#9CA3AF' }}>Abre una caja desde el tablet para comenzar a vender</p>
        </div>
      </div>
    )
  }

  if (exito) {
    return (
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Liquidación de caja</h1>
        </div>
        <div className="rounded-2xl border flex flex-col items-center justify-center py-20 gap-4" style={{ borderColor: '#E5E7EB' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
            <CheckCircle size={32} style={{ color: '#059669' }} />
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: '#059669' }}>¡Caja cerrada correctamente!</p>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>La liquidación fue registrada y la caja fue cerrada.</p>
          </div>
        </div>
      </div>
    )
  }

  function updateConteo(key: MetodoPago, val: string) {
    setConteo((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }))
  }

  function handleCerrar() {
    if (!caja) return
    if (!confirmando) { setConfirmando(true); return }

    setError(null)
    startTransition(async () => {
      const result = await cerrarConLiquidacion(
        caja.id,
        conteo,
        caja.totales,
        notas.trim() || null
      )
      if (result) {
        setError(result)
        setConfirmando(false)
      } else {
        setExito(true)
      }
    })
  }

  const totalSistema = Object.values(caja.totales).reduce((a, b) => a + b, 0)
  const totalConteo = Object.values(conteo).reduce((a, b) => a + b, 0)
  const diferencia = totalConteo - totalSistema

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Liquidación de caja</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
          {caja.sucursal_nombre} — abierta el{' '}
          {new Date(caja.fecha_apertura).toLocaleDateString('es-PE', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Monto inicial */}
      <div
        className="rounded-2xl p-4 flex items-center gap-3"
        style={{ backgroundColor: '#F0F4FF' }}
      >
        <DollarSign size={20} style={{ color: '#002D62' }} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>Monto inicial</p>
          <p className="text-lg font-bold" style={{ color: '#002D62' }}>
            S/ {caja.monto_inicial.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Tabla de conteo */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Método
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Sistema
              </th>
              <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Conteo real
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody>
            {METODOS.map((m, i) => {
              const sis = caja.totales[m.key]
              const cnt = conteo[m.key]
              const diff = cnt - sis
              return (
                <tr
                  key={m.key}
                  className="border-t"
                  style={{
                    borderColor: '#F3F4F6',
                    backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                  }}
                >
                  <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                    <span className="mr-2">{m.emoji}</span>
                    {m.label}
                  </td>
                  <td className="px-5 py-4 text-right font-mono" style={{ color: '#374151' }}>
                    S/ {sis.toFixed(2)}
                  </td>
                  <td className="px-5 py-4 flex justify-center">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cnt}
                      onChange={(e) => updateConteo(m.key, e.target.value)}
                      className="w-32 rounded-xl border-2 px-3 py-2 text-sm text-right font-mono outline-none focus:border-[#002D62]"
                      style={{ borderColor: '#D1D5DB' }}
                    />
                  </td>
                  <td className="px-5 py-4 text-right font-mono font-semibold">
                    <span style={{ color: diff === 0 ? '#059669' : diff > 0 ? '#2563EB' : '#DC2626' }}>
                      {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#F9FAFB', borderTop: '2px solid #E5E7EB' }}>
              <td className="px-5 py-4 font-bold" style={{ color: '#002D62' }}>Total</td>
              <td className="px-5 py-4 text-right font-bold font-mono" style={{ color: '#002D62' }}>
                S/ {totalSistema.toFixed(2)}
              </td>
              <td className="px-5 py-4 text-center font-bold font-mono" style={{ color: '#002D62' }}>
                S/ {totalConteo.toFixed(2)}
              </td>
              <td className="px-5 py-4 text-right font-bold font-mono">
                <span style={{ color: diferencia === 0 ? '#059669' : diferencia > 0 ? '#2563EB' : '#DC2626' }}>
                  {diferencia > 0 ? '+' : ''}{diferencia.toFixed(2)}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Diferencia alert */}
      {diferencia !== 0 && (
        <div
          className="rounded-xl p-4 flex items-start gap-3"
          style={{ backgroundColor: diferencia < 0 ? '#FEF2F2' : '#EFF6FF' }}
        >
          <AlertTriangle size={18} style={{ color: diferencia < 0 ? '#DC2626' : '#2563EB', flexShrink: 0, marginTop: 1 }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: diferencia < 0 ? '#DC2626' : '#2563EB' }}>
              {diferencia < 0 ? `Faltante de S/ ${Math.abs(diferencia).toFixed(2)}` : `Sobrante de S/ ${diferencia.toFixed(2)}`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {diferencia < 0
                ? 'El conteo real es menor al sistema. Verifica los pagos registrados.'
                : 'El conteo real es mayor al sistema. Puede haber ingresos sin registrar.'}
            </p>
          </div>
        </div>
      )}

      {/* Notas */}
      <div className="space-y-1">
        <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Observaciones del cierre</label>
        <textarea
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={3}
          placeholder="Diferencias encontradas, incidencias, etc..."
          className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none resize-none focus:border-[#002D62]"
          style={{ borderColor: '#D1D5DB' }}
        />
      </div>

      {error && (
        <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
      )}

      {/* Botón de cierre */}
      {confirmando ? (
        <div className="rounded-2xl border-2 p-5 space-y-3" style={{ borderColor: '#DC2626' }}>
          <p className="text-sm font-semibold text-center" style={{ color: '#DC2626' }}>
            ¿Confirmas el cierre de caja? Esta acción no se puede deshacer.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirmando(false)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
              style={{ borderColor: '#D1D5DB', color: '#374151' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleCerrar}
              disabled={isPending}
              className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
            >
              {isPending ? 'Cerrando...' : 'Sí, cerrar caja'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleCerrar}
          className="w-full py-4 rounded-2xl text-sm font-bold"
          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
        >
          Cerrar caja y guardar liquidación
        </button>
      )}
    </div>
  )
}
