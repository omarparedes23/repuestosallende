'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Landmark, AlertTriangle } from 'lucide-react'
import { RegistrarCobroForm } from '../../clientes/[id]/components/RegistrarCobroForm'
import type { MovimientoConVentaYCliente } from '../actions'

type Props = {
  movimientos: MovimientoConVentaYCliente[]
}

type DeudaPendiente = {
  ventaId: string
  numeroCompleto: string | null
  moneda: string
  clienteId: string
  clienteNombre: string
  fecha: string
  fechaVencimiento: string | null
  montoCargo: number
  saldoPendiente: number
  abonos: MovimientoConVentaYCliente[]
}

const SIMBOLO: Record<string, string> = { PEN: 'S/', USD: '$' }

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

function estaVencida(fechaVencimiento: string | null): boolean {
  if (!fechaVencimiento) return false
  return new Date(fechaVencimiento) < new Date(new Date().toDateString())
}

export function TesoreriaView({ movimientos }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cobroTarget, setCobroTarget] = useState<DeudaPendiente | null>(null)

  const deudas = useMemo<DeudaPendiente[]>(() => {
    const cargos = movimientos.filter((m) => m.tipo === 'cargo')
    const pendientes = cargos
      .map((cargo) => {
        const abonos = movimientos.filter((m) => m.tipo === 'abono' && m.venta_id === cargo.venta_id)
        const totalAbonado = abonos.reduce((acc, a) => acc + a.monto, 0)
        return {
          ventaId: cargo.venta_id,
          numeroCompleto: cargo.ra_ventas?.numero_completo ?? null,
          moneda: cargo.ra_ventas?.moneda ?? 'PEN',
          clienteId: cargo.cliente_id,
          clienteNombre: cargo.ra_clientes?.nombre ?? 'Cliente desconocido',
          fecha: cargo.fecha,
          fechaVencimiento: cargo.fecha_vencimiento,
          montoCargo: cargo.monto,
          saldoPendiente: Math.max(0, cargo.monto - totalAbonado),
          abonos,
        }
      })
      .filter((d) => d.saldoPendiente > 0)

    // Vencidas primero, y dentro de cada grupo, la más próxima a vencer primero.
    return pendientes.sort((a, b) => {
      const aVencida = estaVencida(a.fechaVencimiento)
      const bVencida = estaVencida(b.fechaVencimiento)
      if (aVencida !== bVencida) return aVencida ? -1 : 1
      const aFecha = a.fechaVencimiento ?? ''
      const bFecha = b.fechaVencimiento ?? ''
      return aFecha.localeCompare(bFecha)
    })
  }, [movimientos])

  if (deudas.length === 0) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Landmark size={32} style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            No hay cuentas por cobrar pendientes
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              {['Cliente', 'Venta', 'Fecha', 'Vencimiento', 'Monto', 'Saldo pendiente', ''].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#6B7280' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {deudas.map((d, i) => {
              const simbolo = SIMBOLO[d.moneda] ?? 'S/'
              const vencida = estaVencida(d.fechaVencimiento)
              const expanded = expandedId === d.ventaId
              return (
                <Fragment key={d.ventaId}>
                  <tr
                    className="border-t"
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    }}
                  >
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {d.clienteNombre}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: '#111827' }}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : d.ventaId)}
                        className="flex items-center gap-1 font-semibold"
                        style={{ color: '#002D62' }}
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {d.numeroCompleto ?? d.ventaId.slice(0, 8).toUpperCase()}
                      </button>
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {new Date(d.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      {d.fechaVencimiento ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: vencida ? '#FEF2F2' : '#F0FDF4',
                            color: vencida ? '#DC2626' : '#059669',
                          }}
                        >
                          {vencida && <AlertTriangle size={12} />}
                          {new Date(d.fechaVencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {simbolo} {d.montoCargo.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: '#DC2626' }}>
                      {simbolo} {d.saldoPendiente.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setCobroTarget(d)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                        style={{ backgroundColor: '#002D62', color: '#FFD700' }}
                      >
                        Cobrar
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                      <td colSpan={7} className="px-5 py-4">
                        {d.abonos.length === 0 ? (
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>Sin abonos registrados</p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                              Abonos
                            </p>
                            {d.abonos.map((a) => (
                              <div key={a.id} className="flex items-center justify-between text-xs">
                                <span style={{ color: '#6B7280' }}>
                                  {new Date(a.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  {' — '}
                                  {a.usuario_nombre ?? 'Usuario desconocido'}
                                  {a.metodo_pago && ` — ${METODO_LABEL[a.metodo_pago] ?? a.metodo_pago}`}
                                  {a.referencia && ` (${a.referencia})`}
                                </span>
                                <span className="font-semibold" style={{ color: '#059669' }}>
                                  {simbolo} {a.monto.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {cobroTarget && (
        <RegistrarCobroForm
          ventaId={cobroTarget.ventaId}
          numeroCompleto={cobroTarget.numeroCompleto}
          moneda={cobroTarget.moneda}
          saldoPendiente={cobroTarget.saldoPendiente}
          onClose={() => setCobroTarget(null)}
          onSaved={() => {
            setCobroTarget(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
