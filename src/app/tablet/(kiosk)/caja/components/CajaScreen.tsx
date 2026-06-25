'use client'

import { useState, useActionState } from 'react'
import { LogOut, TrendingUp, TrendingDown, Plus, X } from 'lucide-react'
import { cerrarCaja, registrarMovimiento } from '../actions'
import type { RaCaja, RaMovimientoCaja, RaRol } from '@/lib/types/database'

type Props = {
  caja: RaCaja
  movimientos: RaMovimientoCaja[]
  rol: RaRol
}

const TIPO_COLORS = {
  ingreso: { bg: '#F0FDF4', text: '#059669', icon: TrendingUp },
  egreso: { bg: '#FEF2F2', text: '#DC2626', icon: TrendingDown },
}

const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
}

export function CajaScreen({ caja, movimientos, rol }: Props) {
  const [mostrarCierre, setMostrarCierre] = useState(false)
  const [mostrarMovimiento, setMostrarMovimiento] = useState(false)

  const [errorCierre, formCierre, pendingCierre] = useActionState(cerrarCaja, null)
  const [errorMovimiento, formMovimiento, pendingMovimiento] = useActionState(
    registrarMovimiento,
    null
  )

  const esAdmin = rol === 'administrador' || rol === 'superadmin'

  const totalIngresos = movimientos
    .filter((m) => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + m.monto, 0)
  const totalEgresos = movimientos
    .filter((m) => m.tipo === 'egreso')
    .reduce((sum, m) => sum + m.monto, 0)
  const saldoActual = caja.monto_inicial + totalIngresos - totalEgresos

  const fechaApertura = new Date(caja.fecha_apertura)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
        <h2 className="text-lg font-bold" style={{ color: '#002D62' }}>
          Caja del día
        </h2>
        <p className="text-sm" style={{ color: '#6B7280' }}>
          Apertura: {fechaApertura.toLocaleDateString('es-PE')} a las{' '}
          {fechaApertura.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-3 p-4">
        {[
          { label: 'Monto inicial', value: caja.monto_inicial, color: '#6B7280' },
          { label: 'Total ingresos', value: totalIngresos, color: '#059669' },
          { label: 'Total egresos', value: totalEgresos, color: '#DC2626' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 border" style={{ borderColor: '#E5E7EB' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>
              {label}
            </p>
            <p className="text-xl font-bold" style={{ color }}>
              S/. {value.toFixed(2)}
            </p>
          </div>
        ))}
      </div>

      <div className="px-4 pb-2">
        <div
          className="flex items-center justify-between rounded-2xl px-4 py-3"
          style={{ backgroundColor: '#002D62' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#8BA7CC' }}>
            Saldo actual (estimado)
          </span>
          <span className="text-xl font-bold" style={{ color: '#FFD700' }}>
            S/. {saldoActual.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Movimientos */}
      <div className="flex-1 px-4 pt-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={{ color: '#374151' }}>
            Movimientos ({movimientos.length})
          </h3>
          {esAdmin && (
            <button
              onClick={() => {
                setMostrarMovimiento(!mostrarMovimiento)
                setMostrarCierre(false)
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
            >
              {mostrarMovimiento ? <X size={14} /> : <Plus size={14} />}
              {mostrarMovimiento ? 'Cancelar' : 'Registrar'}
            </button>
          )}
        </div>

        {/* Formulario nuevo movimiento — solo admins */}
        {esAdmin && mostrarMovimiento && (
          <form
            action={formMovimiento}
            className="mb-4 p-4 rounded-2xl border-2 space-y-3"
            style={{ borderColor: '#002D62' }}
          >
            <p className="text-sm font-bold" style={{ color: '#002D62' }}>
              Nuevo movimiento
            </p>
            <div className="grid grid-cols-2 gap-2">
              <select
                name="tipo"
                defaultValue="ingreso"
                className="rounded-xl border-2 px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: '#D1D5DB' }}
              >
                <option value="ingreso">Ingreso</option>
                <option value="egreso">Egreso</option>
              </select>
              <select
                name="metodo_pago"
                defaultValue="efectivo"
                className="rounded-xl border-2 px-3 py-2.5 text-sm outline-none"
                style={{ borderColor: '#D1D5DB' }}
              >
                {Object.entries(METODO_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <input
              name="concepto"
              placeholder="Concepto (ej: Pago proveedor)"
              required
              className="w-full rounded-xl border-2 px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: '#D1D5DB' }}
            />
            <input
              name="monto"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Monto (S/.)"
              required
              className="w-full rounded-xl border-2 px-3 py-2.5 text-sm font-bold outline-none"
              style={{ borderColor: '#D1D5DB' }}
            />
            {errorMovimiento && (
              <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
                {errorMovimiento}
              </p>
            )}
            <button
              type="submit"
              disabled={pendingMovimiento}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ backgroundColor: '#002D62', color: '#FFD700' }}
            >
              {pendingMovimiento ? 'Registrando...' : 'Registrar movimiento'}
            </button>
          </form>
        )}

        {movimientos.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: '#9CA3AF' }}>
            Sin movimientos registrados hoy.
          </p>
        ) : (
          <div className="space-y-2 pb-4">
            {movimientos.map((m) => {
              const cfg = TIPO_COLORS[m.tipo as keyof typeof TIPO_COLORS]
              const Icon = cfg.icon
              const hora = new Date(m.created_at).toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: cfg.bg }}
                >
                  <Icon size={18} style={{ color: cfg.text, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                      {m.concepto}
                    </p>
                    <p className="text-xs" style={{ color: '#6B7280' }}>
                      {METODO_LABELS[m.metodo_pago] ?? m.metodo_pago} · {hora}
                    </p>
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color: cfg.text }}>
                    {m.tipo === 'egreso' ? '-' : '+'}S/. {m.monto.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cerrar caja — solo admins */}
      {esAdmin && (
        <div className="p-4 border-t space-y-3" style={{ borderColor: '#E5E7EB' }}>
          {!mostrarCierre ? (
            <button
              onClick={() => {
                setMostrarCierre(true)
                setMostrarMovimiento(false)
              }}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-base font-bold border-2"
              style={{ borderColor: '#DC2626', color: '#DC2626' }}
            >
              <LogOut size={18} />
              Cerrar caja
            </button>
          ) : (
            <form action={formCierre} className="space-y-3">
              <p className="text-sm font-semibold" style={{ color: '#374151' }}>
                Confirmar cierre — ingresa el efectivo contado
              </p>
              <input
                name="monto_final"
                type="number"
                min="0"
                step="0.01"
                placeholder={`Efectivo en caja (S/. ${saldoActual.toFixed(2)} estimado)`}
                className="w-full rounded-xl border-2 px-4 py-3 text-base font-bold outline-none"
                style={{ borderColor: '#D1D5DB' }}
              />
              {errorCierre && (
                <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
                  {errorCierre}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMostrarCierre(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
                  style={{ borderColor: '#D1D5DB', color: '#374151' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={pendingCierre}
                  className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
                >
                  {pendingCierre ? 'Cerrando...' : 'Confirmar cierre'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
