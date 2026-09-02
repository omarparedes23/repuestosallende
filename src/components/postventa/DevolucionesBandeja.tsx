'use client'

import { useState, useTransition } from 'react'
import { Check, CircleX, PackageCheck, WalletCards } from 'lucide-react'
import {
  aprobarDevolucion,
  liquidarDevolucionYEmitirNotaCredito,
  reintentarNotaCreditoDevolucion,
  rechazarDevolucion,
  registrarRecepcionDevolucion,
  type DevolucionBandeja,
} from '@/app/tablet/(kiosk)/devoluciones/actions'

type Props = { devoluciones: DevolucionBandeja[]; modo: 'vendedor' | 'admin' }

const ESTADO: Record<string, { label: string; color: string; bg: string }> = {
  solicitada: { label: 'Pendiente de recepción', color: '#B45309', bg: '#FFFBEB' },
  recibida: { label: 'Pendiente de revisión', color: '#1D4ED8', bg: '#EFF6FF' },
  aprobada: { label: 'Lista para liquidar', color: '#047857', bg: '#ECFDF5' },
  liquidada: { label: 'Liquidada', color: '#047857', bg: '#F0FDF4' },
  rechazada: { label: 'Rechazada', color: '#B91C1C', bg: '#FEF2F2' },
}

const ESTADO_FISCAL: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pendiente de envío', color: '#B45309', bg: '#FFFBEB' },
  processing: { label: 'En proceso', color: '#1D4ED8', bg: '#EFF6FF' },
  retry: { label: 'Reintento disponible', color: '#C2410C', bg: '#FFF7ED' },
  submitted: { label: 'Resultado por conciliar', color: '#7E22CE', bg: '#FAF5FF' },
  accepted: { label: 'Aceptada por SUNAT', color: '#047857', bg: '#ECFDF5' },
  rejected: { label: 'Rechazada por OSE/SUNAT', color: '#B91C1C', bg: '#FEF2F2' },
  dead_letter: { label: 'Revisión manual requerida', color: '#B91C1C', bg: '#FEF2F2' },
}

export function DevolucionesBandeja({ devoluciones, modo }: Props) {
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function run(action: () => Promise<{ status: string; message: string }>) {
    startTransition(async () => setMessage((await action()).message))
  }

  function recibir(id: string, recibido: boolean, condicion: 'apto_reventa' | 'dañado' | 'incompleto' | 'no_recibido') {
    const observacion = condicion === 'apto_reventa' ? null : window.prompt('Describe la condición de la pieza.')
    if (condicion !== 'apto_reventa' && !observacion?.trim()) return
    run(() => registrarRecepcionDevolucion({ devolucionId: id, recibido, condicionDeclarada: condicion, observacion }))
  }

  function aprobar(item: DevolucionBandeja, reingreso: boolean) {
    const requiereOverride = reingreso && ['dañado', 'incompleto'].includes(item.condicion_declarada ?? '')
    const overrideMotivo = requiereOverride ? window.prompt('Justifica el reingreso excepcional a stock vendible.') : null
    if (requiereOverride && !overrideMotivo?.trim()) return
    run(() => aprobarDevolucion({ devolucionId: item.id, reingresoAprobado: reingreso, overrideMotivo }))
  }

  function rechazar(id: string) {
    const motivo = window.prompt('Indica el motivo del rechazo documental.')
    if (!motivo?.trim()) return
    run(() => rechazarDevolucion({ devolucionId: id, motivo }))
  }

  function liquidar(id: string) {
    run(() => liquidarDevolucionYEmitirNotaCredito({ operationId: crypto.randomUUID(), devolucionId: id, referencias: {} }))
  }

  function reintentarNota(id: string) {
    run(() => reintentarNotaCreditoDevolucion(id))
  }

  return (
    <div className="space-y-3 p-4">
      {message && <p className="rounded-xl p-3 text-sm" style={{ background: '#EFF6FF', color: '#1D4ED8' }}>{message}</p>}
      {devoluciones.length === 0 && <p className="py-10 text-center text-sm" style={{ color: '#6B7280' }}>No hay devoluciones para revisar.</p>}
      {devoluciones.map((item) => {
        const estado = ESTADO[item.estado] ?? ESTADO.solicitada
        return <article key={item.id} className="rounded-2xl border p-4 space-y-3" style={{ borderColor: '#E5E7EB', background: '#FFF' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold" style={{ color: '#002D62' }}>{item.venta_numero ?? `Venta ${item.id.slice(0, 8)}`}</p>
              <p className="text-sm" style={{ color: '#374151' }}>{item.motivo}</p>
              <p className="mt-1 text-xs" style={{ color: '#6B7280' }}>{new Date(item.created_at).toLocaleString('es-PE')}</p>
            </div>
            <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: estado.color, background: estado.bg }}>{estado.label}</span>
          </div>
          {item.condicion_declarada && <div className="rounded-xl p-3 text-sm" style={{ background: '#F9FAFB', color: '#374151' }}>
            <b>Recepción:</b> {item.condicion_declarada.replace('_', ' ')}{item.recepcion_observacion ? ` — ${item.recepcion_observacion}` : ''}
          </div>}
          {item.rechazo_motivo && <p className="text-sm" style={{ color: '#B91C1C' }}><b>Rechazo:</b> {item.rechazo_motivo}</p>}
          {modo === 'admin' && item.nota_credito && (() => {
            const fiscal = ESTADO_FISCAL[item.nota_credito.status]
            const puedeReintentar = item.nota_credito.status === 'pending' || item.nota_credito.status === 'retry'
            return <section className="rounded-xl border p-3 space-y-2" style={{ borderColor: '#E5E7EB', background: '#F9FAFB' }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: '#374151' }}>Nota de crédito {item.nota_credito.serie}-{String(item.nota_credito.correlativo).padStart(8, '0')}</p>
                <span className="rounded-full px-2 py-1 text-xs font-semibold" style={{ color: fiscal.color, background: fiscal.bg }}>{fiscal.label}</span>
              </div>
              <p className="text-xs" style={{ color: '#6B7280' }}>Intentos: {item.nota_credito.attempt_count}{item.nota_credito.last_attempt_at ? ` · último: ${new Date(item.nota_credito.last_attempt_at).toLocaleString('es-PE')}` : ''}</p>
              {item.nota_credito.status === 'retry' && <p className="text-xs" style={{ color: '#6B7280' }}>Próximo intento programado: {new Date(item.nota_credito.next_attempt_at).toLocaleString('es-PE')}</p>}
              {item.nota_credito.status === 'submitted' && <p className="text-xs" style={{ color: '#7E22CE' }}>No se reenvía: confirma el resultado con OSE/SUNAT antes de actuar.</p>}
              {item.nota_credito.error_message && <p className="text-xs break-words" style={{ color: '#B91C1C' }}>{item.nota_credito.error_code ? `${item.nota_credito.error_code}: ` : ''}{item.nota_credito.error_message}</p>}
              {puedeReintentar && <button disabled={pending} onClick={() => reintentarNota(item.id)} className="w-full rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50" style={{ background: '#002D62', color: '#FFD700' }}>Reintentar emisión manual</button>}
            </section>
          })()}
          {modo === 'vendedor' && item.estado === 'solicitada' && <div className="grid grid-cols-2 gap-2">
            <button disabled={pending} onClick={() => recibir(item.id, true, 'apto_reventa')} className="rounded-xl px-3 py-2.5 text-sm font-bold" style={{ background: '#002D62', color: '#FFD700' }}><PackageCheck className="mr-1 inline" size={16}/>Recibida apta</button>
            <button disabled={pending} onClick={() => recibir(item.id, true, 'dañado')} className="rounded-xl px-3 py-2.5 text-sm font-bold" style={{ background: '#FEF2F2', color: '#B91C1C' }}>Recibida dañada</button>
            <button disabled={pending} onClick={() => recibir(item.id, true, 'incompleto')} className="rounded-xl px-3 py-2.5 text-sm font-bold" style={{ background: '#FFF7ED', color: '#C2410C' }}>Incompleta</button>
            <button disabled={pending} onClick={() => recibir(item.id, false, 'no_recibido')} className="rounded-xl px-3 py-2.5 text-sm font-bold" style={{ background: '#F3F4F6', color: '#374151' }}>No recibida</button>
          </div>}
          {modo === 'admin' && item.estado === 'recibida' && <div className="grid grid-cols-3 gap-2">
            <button disabled={pending} onClick={() => aprobar(item, item.condicion_declarada === 'apto_reventa')} className="rounded-xl px-2 py-2 text-xs font-bold" style={{ background: '#ECFDF5', color: '#047857' }}><Check className="mr-1 inline" size={15}/>Aprobar</button>
            <button disabled={pending} onClick={() => aprobar(item, false)} className="rounded-xl px-2 py-2 text-xs font-bold" style={{ background: '#FFF7ED', color: '#C2410C' }}>Aprobar sin stock</button>
            <button disabled={pending} onClick={() => rechazar(item.id)} className="rounded-xl px-2 py-2 text-xs font-bold" style={{ background: '#FEF2F2', color: '#B91C1C' }}><CircleX className="mr-1 inline" size={15}/>Rechazar</button>
          </div>}
          {modo === 'admin' && item.estado === 'aprobada' && <button disabled={pending} onClick={() => liquidar(item.id)} className="w-full rounded-xl px-3 py-2.5 text-sm font-bold" style={{ background: '#002D62', color: '#FFD700' }}><WalletCards className="mr-1 inline" size={16}/>Liquidar devolución</button>}
        </article>
      })}
    </div>
  )
}
