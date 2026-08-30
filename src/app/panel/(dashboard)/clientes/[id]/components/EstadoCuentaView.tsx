'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Wallet, AlertTriangle } from 'lucide-react'
import { RegistrarCobroForm } from './RegistrarCobroForm'
import type { RaCliente } from '@/lib/types/database'
import type { MovimientoConVenta } from '../../actions'
import type { SucursalCobro } from '../../../tesoreria/actions'

type Props = {
  cliente: RaCliente
  movimientos: MovimientoConVenta[]
  sucursales: SucursalCobro[]
  sucursalInicialId: string | null
}

type VentaCredito = {
  ventaId: string
  numeroCompleto: string | null
  moneda: string
  fecha: string
  fechaVencimiento: string | null
  montoCargo: number
  saldoPendiente: number
  abonos: MovimientoConVenta[]
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

export function EstadoCuentaView({ cliente, movimientos, sucursales, sucursalInicialId }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cobroTarget, setCobroTarget] = useState<VentaCredito | null>(null)

  const ventasCredito = useMemo<VentaCredito[]>(() => {
    const cargos = movimientos.filter((m) => m.tipo === 'cargo')
    return cargos.map((cargo) => {
      const abonos = movimientos.filter((m) => m.tipo === 'abono' && m.venta_id === cargo.venta_id)
      const totalAbonado = abonos.reduce((acc, a) => acc + a.monto, 0)
      return {
        ventaId: cargo.venta_id,
        numeroCompleto: cargo.ra_ventas?.numero_completo ?? null,
        moneda: cargo.ra_ventas?.moneda ?? 'PEN',
        fecha: cargo.fecha,
        fechaVencimiento: cargo.fecha_vencimiento,
        montoCargo: cargo.monto,
        saldoPendiente: Math.max(0, cargo.monto - totalAbonado),
        abonos,
      }
    })
  }, [movimientos])

  if (ventasCredito.length === 0) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Wallet size={32} style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            Este cliente no tiene ventas a crédito
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
              {['Venta', 'Fecha', 'Vencimiento', 'Monto', 'Saldo pendiente', ''].map((h) => (
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
            {ventasCredito.map((v, i) => {
              const simbolo = SIMBOLO[v.moneda] ?? 'S/'
              const vencida = v.saldoPendiente > 0 && estaVencida(v.fechaVencimiento)
              const expanded = expandedId === v.ventaId
              return (
                <Fragment key={v.ventaId}>
                  <tr
                    className="border-t"
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    }}
                  >
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: '#111827' }}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : v.ventaId)}
                        className="flex items-center gap-1 font-semibold"
                        style={{ color: '#002D62' }}
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {v.numeroCompleto ?? v.ventaId.slice(0, 8).toUpperCase()}
                      </button>
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {new Date(v.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      {v.fechaVencimiento ? (
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: vencida ? '#FEF2F2' : '#F0FDF4',
                            color: vencida ? '#DC2626' : '#059669',
                          }}
                        >
                          {vencida && <AlertTriangle size={12} />}
                          {new Date(v.fechaVencimiento).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {simbolo} {v.montoCargo.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: v.saldoPendiente > 0 ? '#DC2626' : '#059669' }}>
                      {simbolo} {v.saldoPendiente.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {v.saldoPendiente > 0 && (
                        <button
                          onClick={() => setCobroTarget(v)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
                        >
                          Cobrar
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                      <td colSpan={6} className="px-5 py-4">
                        {v.abonos.length === 0 ? (
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>Sin abonos registrados</p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                              Abonos
                            </p>
                            {v.abonos.map((a) => (
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
          sucursales={sucursales}
          sucursalInicialId={sucursalInicialId}
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
