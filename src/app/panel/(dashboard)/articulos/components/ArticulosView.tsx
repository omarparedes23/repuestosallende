'use client'

import { useEffect, useState } from 'react'
import { Search, Pencil, AlertTriangle, Package } from 'lucide-react'
import { ArticuloEditForm } from './ArticuloEditForm'
import type { ArticuloRow, ModeloOption } from '../actions'

type Props = { initialArticulos: ArticuloRow[]; modelos: ModeloOption[] }

export function ArticulosView({ initialArticulos, modelos }: Props) {
  const [articulos, setArticulos] = useState(initialArticulos)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ArticuloRow | null>(null)

  useEffect(() => {
    setArticulos(initialArticulos)
  }, [initialArticulos])

  const filtered = query.trim()
    ? articulos.filter(
        (a) =>
          a.nombre.toLowerCase().includes(query.toLowerCase()) ||
          (a.codigo_oem ?? '').toLowerCase().includes(query.toLowerCase()) ||
          (a.categoria ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : articulos

  const stockBajoCount = articulos.filter((a) => a.stock_actual < a.stock_minimo).length

  function handleEdit(a: ArticuloRow) {
    setEditing(a)
    setFormOpen(true)
  }

  function handleClose() {
    setFormOpen(false)
  }

  return (
    <>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Artículos</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              {filtered.length} artículo{filtered.length !== 1 ? 's' : ''}
              {stockBajoCount > 0 && (
                <span
                  className="ml-3 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                >
                  <AlertTriangle size={11} />
                  {stockBajoCount} bajo stock
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, código OEM o categoría..."
            className="w-full rounded-xl border-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Package size={32} style={{ color: '#D1D5DB' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                {query ? 'Sin resultados para tu búsqueda' : 'No hay artículos registrados'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  {['Nombre', 'Código OEM', 'Categoría', 'Stock', 'P. Venta S/', 'P. Venta USD', 'P. Compra', 'Acciones'].map((h) => (
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
                {filtered.map((a, i) => {
                  const stockBajo = a.stock_actual < a.stock_minimo
                  return (
                    <tr
                      key={a.id}
                      className="border-t"
                      style={{
                        borderColor: '#F3F4F6',
                        backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                      }}
                    >
                      <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                        {a.nombre}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs" style={{ color: '#6B7280' }}>
                        {a.codigo_oem ?? '—'}
                      </td>
                      <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                        {a.categoria ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: stockBajo ? '#FEF2F2' : '#F0FDF4',
                            color: stockBajo ? '#DC2626' : '#059669',
                          }}
                        >
                          {stockBajo && <AlertTriangle size={10} />}
                          {a.stock_actual} / {a.stock_minimo}
                        </span>
                      </td>
                      <td className="px-5 py-4" style={{ color: '#374151' }}>
                        {a.precio_venta != null ? `S/ ${a.precio_venta.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-4" style={{ color: '#374151' }}>
                        {a.precio_venta_dolar != null ? `USD ${a.precio_venta_dolar.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-4" style={{ color: '#374151' }}>
                        {a.precio_compra != null ? `S/ ${a.precio_compra.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleEdit(a)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          title="Editar precios y stock mínimo"
                        >
                          <Pencil size={15} style={{ color: '#6B7280' }} />
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

      <ArticuloEditForm
        open={formOpen}
        onClose={handleClose}
        articulo={editing}
        modelos={modelos}
      />
    </>
  )
}
