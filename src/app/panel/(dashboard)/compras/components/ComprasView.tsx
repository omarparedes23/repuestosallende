'use client'

import { useState, useTransition } from 'react'
import { Search, Plus, ShoppingCart, Eye } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { actualizarEstadoPago } from '../actions'
import type { CompraRow } from '../actions'

const ESTADO_LABEL: Record<string, string> = {
  pendiente: 'Pendiente',
  parcial: 'Parcial',
  pagado: 'Pagado',
}

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  pendiente: { bg: '#FEF2F2', color: '#DC2626' },
  parcial:   { bg: '#FFFBEB', color: '#D97706' },
  pagado:    { bg: '#F0FDF4', color: '#059669' },
}

type Props = { initialCompras: CompraRow[] }

export function ComprasView({ initialCompras }: Props) {
  const router = useRouter()
  const [compras, setCompras] = useState(initialCompras)
  const [query, setQuery] = useState('')
  const [, startTransition] = useTransition()

  const filtered = query.trim()
    ? compras.filter(
        (c) =>
          c.proveedor_nombre.toLowerCase().includes(query.toLowerCase()) ||
          (c.nro_documento ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : compras

  function handleEstado(id: string, nuevoEstado: 'pendiente' | 'parcial' | 'pagado') {
    startTransition(async () => {
      await actualizarEstadoPago(id, nuevoEstado)
      setCompras((prev) =>
        prev.map((c) => (c.id === id ? { ...c, estado_pago: nuevoEstado } : c))
      )
    })
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Compras</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {filtered.length} compra{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/panel/compras/nueva')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
        >
          <Plus size={16} />
          Nueva compra
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por proveedor o nro. documento..."
          className="w-full rounded-xl border-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
          style={{ borderColor: '#D1D5DB' }}
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <ShoppingCart size={32} style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              {query ? 'Sin resultados para tu búsqueda' : 'No hay compras registradas'}
            </p>
            {!query && (
              <button
                onClick={() => router.push('/panel/compras/nueva')}
                className="text-sm font-semibold"
                style={{ color: '#002D62' }}
              >
                + Registrar primera compra
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                {['Proveedor', 'Nro. Documento', 'Fecha', 'Total', 'Estado pago', 'Acciones'].map((h) => (
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
              {filtered.map((c, i) => {
                const estilo = ESTADO_STYLE[c.estado_pago] ?? ESTADO_STYLE.pendiente
                return (
                  <tr
                    key={c.id}
                    className="border-t"
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    }}
                  >
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {c.proveedor_nombre}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: '#6B7280' }}>
                      {c.nro_documento ?? '—'}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {new Date(c.fecha_compra).toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      S/ {c.total.toFixed(2)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: estilo.bg, color: estilo.color }}
                      >
                        {ESTADO_LABEL[c.estado_pago]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={c.estado_pago}
                          onChange={(e) => handleEstado(c.id, e.target.value as any)}
                          className="rounded-lg border text-xs px-2 py-1.5 outline-none bg-white"
                          style={{ borderColor: '#D1D5DB', color: '#374151' }}
                        >
                          <option value="pendiente">Pendiente</option>
                          <option value="parcial">Parcial</option>
                          <option value="pagado">Pagado</option>
                        </select>
                        <button
                          onClick={() => router.push(`/panel/compras/${c.id}`)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          title="Ver detalle"
                        >
                          <Eye size={15} style={{ color: '#6B7280' }} />
                        </button>
                      </div>
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
