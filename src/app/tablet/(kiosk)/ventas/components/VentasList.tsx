'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, User } from 'lucide-react'
import type { VentaResumen } from '../actions'

type Props = {
  ventas: VentaResumen[]
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  completada: { label: 'Completada', bg: '#F0FDF4', text: '#059669' },
  pendiente: { label: 'Pendiente', bg: '#FFFBEB', text: '#D97706' },
  anulada: { label: 'Anulada', bg: '#FEF2F2', text: '#DC2626' },
}

const COMPROBANTE_LABELS: Record<string, string> = {
  ticket: 'Ticket',
  boleta: 'Boleta',
  factura: 'Factura',
}

export function VentasList({ ventas }: Props) {
  const [filtro, setFiltro] = useState<string | null>(null)

  const ventasFiltradas = filtro ? ventas.filter((v) => v.estado === filtro) : ventas

  const totalesDelDia = ventas.reduce(
    (acc, v) => ({
      total: acc.total + (v.estado !== 'anulada' ? v.total : 0),
      count: acc.count + (v.estado !== 'anulada' ? 1 : 0),
    }),
    { total: 0, count: 0 }
  )

  return (
    <div className="flex flex-col h-full">
      {/* Resumen del día */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: '#E5E7EB', backgroundColor: '#002D62' }}
      >
        <div>
          <p className="text-xs font-semibold" style={{ color: '#8BA7CC' }}>
            Ventas del día
          </p>
          <p className="text-lg font-bold" style={{ color: '#FFFFFF' }}>
            {totalesDelDia.count} ventas
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold" style={{ color: '#8BA7CC' }}>
            Total recaudado
          </p>
          <p className="text-lg font-bold" style={{ color: '#FFD700' }}>
            S/. {totalesDelDia.total.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div
        className="flex gap-2 px-4 py-2 border-b overflow-x-auto"
        style={{ borderColor: '#E5E7EB' }}
      >
        {[null, 'completada', 'pendiente', 'anulada'].map((estado) => {
          const cfg = estado ? ESTADO_CONFIG[estado] : null
          const label = cfg?.label ?? 'Todas'
          const isActive = filtro === estado
          return (
            <button
              key={estado ?? 'all'}
              onClick={() => setFiltro(estado)}
              className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
              style={{
                backgroundColor: isActive ? '#002D62' : '#F3F4F6',
                color: isActive ? '#FFD700' : '#374151',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {ventasFiltradas.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              Sin ventas{filtro ? ` con estado "${ESTADO_CONFIG[filtro]?.label}"` : ' hoy'}.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
            {ventasFiltradas.map((venta) => {
              const estadoCfg = ESTADO_CONFIG[venta.estado] ?? ESTADO_CONFIG.pendiente
              const hora = new Date(venta.created_at).toLocaleTimeString('es-PE', {
                hour: '2-digit',
                minute: '2-digit',
              })
              return (
                <Link
                  key={venta.id}
                  href={`/tablet/ventas/${venta.id}`}
                  className="flex items-center gap-3 px-4 py-4 active:bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold" style={{ color: '#002D62' }}>
                        #{venta.id.slice(0, 8).toUpperCase()}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: estadoCfg.bg, color: estadoCfg.text }}
                      >
                        {estadoCfg.label}
                      </span>
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        {COMPROBANTE_LABELS[venta.tipo_comprobante]}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs" style={{ color: '#6B7280' }}>
                      <span>{hora}</span>
                      <span>{venta.items_count} ítem{venta.items_count !== 1 ? 's' : ''}</span>
                      {venta.cliente_nombre && (
                        <span className="flex items-center gap-1">
                          <User size={11} />
                          {venta.cliente_nombre}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold" style={{ color: '#111827' }}>
                      S/. {venta.total.toFixed(2)}
                    </span>
                    <ChevronRight size={16} style={{ color: '#9CA3AF' }} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
