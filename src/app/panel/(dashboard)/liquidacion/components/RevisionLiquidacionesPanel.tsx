'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, ClipboardCheck, Eye, XCircle } from 'lucide-react'
import { revisarLiquidacion, type LiquidacionRevision } from '../actions'

type Props = { liquidaciones: LiquidacionRevision[]; errorInicial: string | null }
type Decision = 'validada' | 'observada'

const ESTADO: Record<LiquidacionRevision['estado_revision'], { label: string; color: string; bg: string }> = {
  pendiente_revision: { label: 'Pendiente', color: '#92400E', bg: '#FEF3C7' },
  validada: { label: 'Validada', color: '#065F46', bg: '#D1FAE5' },
  observada: { label: 'Observada', color: '#991B1B', bg: '#FEE2E2' },
}

export function RevisionLiquidacionesPanel({ liquidaciones, errorInicial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [seleccionada, setSeleccionada] = useState<LiquidacionRevision | null>(null)
  const [decision, setDecision] = useState<Decision>('validada')
  const [motivo, setMotivo] = useState('')
  const [operationId, setOperationId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const pendientes = liquidaciones.filter((item) => item.estado_revision === 'pendiente_revision').length

  function abrirRevision(item: LiquidacionRevision) {
    setSeleccionada(item)
    setDecision(item.diff_efectivo === 0 ? 'validada' : 'observada')
    setMotivo('')
    setOperationId(crypto.randomUUID())
    setError(null)
  }

  function confirmarRevision() {
    if (!seleccionada || !operationId) return
    setError(null)
    startTransition(async () => {
      const result = await revisarLiquidacion(operationId, seleccionada.id, decision, motivo)
      if (result) { setError(result); return }
      setSeleccionada(null)
      router.refresh()
    })
  }

  return (
    <section className="max-w-5xl mx-auto px-8 pb-8 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#002D62' }}>Revisión de liquidaciones</h2>
          <p className="text-sm" style={{ color: '#6B7280' }}>Control administrativo posterior al cierre de caja.</p>
        </div>
        <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
          {pendientes} pendiente{pendientes === 1 ? '' : 's'}
        </span>
      </div>

      {errorInicial ? <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{errorInicial}</p> : null}
      {!errorInicial && liquidaciones.length === 0 ? (
        <div className="rounded-2xl border p-8 text-center" style={{ borderColor: '#E5E7EB', color: '#6B7280' }}>
          No hay liquidaciones para revisar.
        </div>
      ) : null}

      <div className="space-y-3">
        {liquidaciones.map((item) => {
          const estado = ESTADO[item.estado_revision]
          return (
            <article key={item.id} className="rounded-2xl border p-4" style={{ borderColor: '#E5E7EB' }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold" style={{ color: '#002D62' }}>{item.sucursal_nombre}</p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>{new Date(item.created_at).toLocaleString('es-PE')}</p>
                </div>
                <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: estado.color, backgroundColor: estado.bg }}>{estado.label}</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div><p style={{ color: '#6B7280' }}>Sistema</p><b>S/ {item.sistema_efectivo.toFixed(2)}</b></div>
                <div><p style={{ color: '#6B7280' }}>Contado</p><b>S/ {item.conteo_efectivo.toFixed(2)}</b></div>
                <div><p style={{ color: '#6B7280' }}>Diferencia</p><b style={{ color: item.diff_efectivo === 0 ? '#059669' : '#DC2626' }}>{item.diff_efectivo >= 0 ? '+' : ''}{item.diff_efectivo.toFixed(2)}</b></div>
              </div>
              {item.motivo_revision ? <p className="mt-3 text-sm" style={{ color: '#374151' }}>Revisión: {item.motivo_revision}</p> : null}
              {item.estado_revision === 'pendiente_revision' ? (
                <button onClick={() => abrirRevision(item)} className="mt-4 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold" style={{ color: '#002D62', backgroundColor: '#F0F4FF' }}>
                  <ClipboardCheck size={16} /> Revisar
                </button>
              ) : null}
            </article>
          )
        })}
      </div>

      {seleccionada ? (
        <div className="rounded-2xl border-2 p-5 space-y-4" style={{ borderColor: '#002D62' }}>
          <div className="flex justify-between gap-3"><div><h3 className="font-bold" style={{ color: '#002D62' }}>Revisar liquidación</h3><p className="text-sm" style={{ color: '#6B7280' }}>{seleccionada.sucursal_nombre}</p></div><button onClick={() => setSeleccionada(null)} aria-label="Cancelar revisión"><XCircle size={22} /></button></div>
          <div className="flex gap-3">
            <button onClick={() => setDecision('validada')} className="flex-1 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: decision === 'validada' ? '#059669' : '#D1D5DB', color: '#059669' }}><CheckCircle size={16} className="inline mr-1" /> Validar</button>
            <button onClick={() => setDecision('observada')} className="flex-1 rounded-xl border px-3 py-2 text-sm font-bold" style={{ borderColor: decision === 'observada' ? '#DC2626' : '#D1D5DB', color: '#DC2626' }}><Eye size={16} className="inline mr-1" /> Observar</button>
          </div>
          <textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} maxLength={1000} rows={3} placeholder="Motivo de la revisión (obligatorio)" className="w-full rounded-xl border p-3 text-sm" style={{ borderColor: '#D1D5DB' }} />
          {error ? <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p> : null}
          <button onClick={confirmarRevision} disabled={isPending || !motivo.trim()} className="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-50" style={{ backgroundColor: '#002D62', color: '#FFD700' }}>{isPending ? 'Guardando...' : 'Guardar revisión'}</button>
        </div>
      ) : null}
    </section>
  )
}
