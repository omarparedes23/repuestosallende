'use client'

import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Wallet } from 'lucide-react'
import { RegistrarPagoProveedorForm } from './RegistrarPagoProveedorForm'
import type { RaProveedor } from '@/lib/types/database'
import type { MovimientoConCompra } from '../../actions'

type Props = {
  proveedor: RaProveedor
  movimientos: MovimientoConCompra[]
}

type CompraConCargo = {
  compraId: string
  nroDocumento: string | null
  moneda: string
  fecha: string
  montoCargo: number
  saldoPendiente: number
  abonos: MovimientoConCompra[]
}

const SIMBOLO: Record<string, string> = { PEN: 'S/', USD: '$' }

const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

export function EstadoCuentaProveedorView({ movimientos }: Props) {
  const router = useRouter()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pagoTarget, setPagoTarget] = useState<CompraConCargo | null>(null)

  const comprasConCargo = useMemo<CompraConCargo[]>(() => {
    const cargos = movimientos.filter((m) => m.tipo === 'cargo')
    return cargos.map((cargo) => {
      const abonos = movimientos.filter((m) => m.tipo === 'abono' && m.compra_id === cargo.compra_id)
      const totalAbonado = abonos.reduce((acc, a) => acc + a.monto, 0)
      return {
        compraId: cargo.compra_id,
        nroDocumento: cargo.ra_compras?.nro_documento ?? null,
        moneda: cargo.ra_compras?.moneda ?? 'PEN',
        fecha: cargo.fecha,
        montoCargo: cargo.monto,
        saldoPendiente: Math.max(0, cargo.monto - totalAbonado),
        abonos,
      }
    })
  }, [movimientos])

  if (comprasConCargo.length === 0) {
    return (
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Wallet size={32} style={{ color: '#D1D5DB' }} />
          <p className="text-sm" style={{ color: '#9CA3AF' }}>
            Este proveedor no tiene compras con deuda registrada
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
              {['Compra', 'Fecha', 'Monto', 'Saldo pendiente', ''].map((h) => (
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
            {comprasConCargo.map((c, i) => {
              const simbolo = SIMBOLO[c.moneda] ?? 'S/'
              const expanded = expandedId === c.compraId
              return (
                <Fragment key={c.compraId}>
                  <tr
                    className="border-t"
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    }}
                  >
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: '#111827' }}>
                      <button
                        onClick={() => setExpandedId(expanded ? null : c.compraId)}
                        className="flex items-center gap-1 font-semibold"
                        style={{ color: '#002D62' }}
                      >
                        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {c.nroDocumento ?? c.compraId.slice(0, 8).toUpperCase()}
                      </button>
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {new Date(c.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {simbolo} {c.montoCargo.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: c.saldoPendiente > 0 ? '#DC2626' : '#059669' }}>
                      {simbolo} {c.saldoPendiente.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {c.saldoPendiente > 0 && (
                        <button
                          onClick={() => setPagoTarget(c)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
                        >
                          Pagar
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr style={{ backgroundColor: '#F9FAFB' }}>
                      <td colSpan={5} className="px-5 py-4">
                        {c.abonos.length === 0 ? (
                          <p className="text-xs" style={{ color: '#9CA3AF' }}>Sin pagos registrados</p>
                        ) : (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
                              Pagos
                            </p>
                            {c.abonos.map((a) => (
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

      {pagoTarget && (
        <RegistrarPagoProveedorForm
          compraId={pagoTarget.compraId}
          nroDocumento={pagoTarget.nroDocumento}
          moneda={pagoTarget.moneda}
          saldoPendiente={pagoTarget.saldoPendiente}
          onClose={() => setPagoTarget(null)}
          onSaved={() => {
            setPagoTarget(null)
            router.refresh()
          }}
        />
      )}
    </>
  )
}
