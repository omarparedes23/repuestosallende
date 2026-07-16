'use client'

import { useState } from 'react'
import { Search, Plus, ClipboardList, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { OrdenCompraRow } from '../actions'

const ESTADO_LABEL: Record<string, string> = {
  borrador: 'Borrador',
  confirmada: 'Confirmada',
  recibida: 'Recibida',
  anulada: 'Anulada',
}

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  borrador:   { bg: '#F3F4F6', color: '#374151' },
  confirmada: { bg: '#FFFBEB', color: '#D97706' },
  recibida:   { bg: '#F0FDF4', color: '#059669' },
  anulada:    { bg: '#FEF2F2', color: '#DC2626' },
}

type Props = { initialOrdenesCompra: OrdenCompraRow[] }

export function OrdenesCompraView({ initialOrdenesCompra }: Props) {
  const router = useRouter()
  const [ordenesCompra] = useState(initialOrdenesCompra)
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? ordenesCompra.filter(
        (oc) =>
          oc.proveedor_nombre.toLowerCase().includes(query.toLowerCase()) ||
          (oc.referencia ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : ordenesCompra

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Órdenes de compra</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {filtered.length} orden{filtered.length !== 1 ? 'es' : ''} de compra
          </p>
        </div>
        <button
          onClick={() => router.push('/panel/ordenes-compra/nueva')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
        >
          <Plus size={16} />
          Nueva orden de compra
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por proveedor o referencia..."
          className="w-full rounded-xl border-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
          style={{ borderColor: '#D1D5DB' }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ClipboardList size={32} style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              {query ? 'Sin resultados para tu búsqueda' : 'No hay órdenes de compra registradas'}
            </p>
            {!query && (
              <button
                onClick={() => router.push('/panel/ordenes-compra/nueva')}
                className="text-sm font-semibold"
                style={{ color: '#002D62' }}
              >
                + Crear primera orden de compra
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                {['Proveedor', 'Referencia', 'Fecha', 'Total estimado', 'Estado', 'Acciones'].map((h) => (
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
              {filtered.map((oc, i) => {
                const estilo = ESTADO_STYLE[oc.estado] ?? ESTADO_STYLE.borrador
                return (
                  <tr
                    key={oc.id}
                    className="border-t cursor-pointer"
                    onClick={() => router.push(`/panel/ordenes-compra/${oc.id}`)}
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    }}
                  >
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {oc.proveedor_nombre}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: '#6B7280' }}>
                      {oc.referencia ?? '—'}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {new Date(oc.fecha).toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      S/ {oc.total_estimado.toFixed(2)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: estilo.bg, color: estilo.color }}
                      >
                        {ESTADO_LABEL[oc.estado]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/panel/ordenes-compra/${oc.id}`)
                        }}
                        className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                        title="Ver detalle"
                      >
                        <Eye size={15} style={{ color: '#6B7280' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
