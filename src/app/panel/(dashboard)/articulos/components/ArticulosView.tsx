'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Search, Pencil, AlertTriangle, Package, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { ArticuloEditForm } from './ArticuloEditForm'
import { buscarArticulos } from '../actions'
import type { ArticuloRow, MarcaOption, ModeloOption } from '../actions'
import { FILAS_POR_PAGINA } from '../constants'

type Props = {
  initialArticulos: ArticuloRow[]
  initialTotal: number
  modelos: ModeloOption[]
  marcas: MarcaOption[]
  marcasAuto: MarcaOption[]
  stockBajoCount: number
}

export function ArticulosView({ initialArticulos, initialTotal, modelos, marcas, marcasAuto, stockBajoCount }: Props) {
  const [articulos, setArticulos] = useState(initialArticulos)
  const [total, setTotal] = useState(initialTotal)
  const [query, setQuery] = useState('')
  const [marcaId, setMarcaId] = useState('')
  const [marcaAutoId, setMarcaAutoId] = useState('')
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ArticuloRow | null>(null)

  const refetch = useCallback(async (q: string, p: number, m: string, ma: string) => {
    setLoading(true)
    const res = await buscarArticulos(q, p, m || null, ma || null)
    setArticulos(res.data)
    setTotal(res.total)
    setLoading(false)
  }, [])

  // Evita refetch en el primer render — ya tenemos los datos del servidor.
  const montado = useRef(false)
  useEffect(() => {
    if (!montado.current) {
      montado.current = true
      return
    }
    const timer = setTimeout(() => refetch(query, pagina, marcaId, marcaAutoId), 350)
    return () => clearTimeout(timer)
  }, [query, pagina, marcaId, marcaAutoId, refetch])

  useEffect(() => {
    setPagina(1)
  }, [query, marcaId, marcaAutoId])

  const totalPaginas = Math.max(1, Math.ceil(total / FILAS_POR_PAGINA))

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
              {total} artículo{total !== 1 ? 's' : ''}
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
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, código OEM o código alterno..."
              className="w-full rounded-xl border-2 pl-10 pr-9 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
            {loading && (
              <Loader2
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin"
                style={{ color: '#9CA3AF' }}
              />
            )}
          </div>
          <select
            value={marcaId}
            onChange={(e) => setMarcaId(e.target.value)}
            className="rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}
          >
            <option value="">Marca de repuesto</option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
          <select
            value={marcaAutoId}
            onChange={(e) => setMarcaAutoId(e.target.value)}
            className="rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}
          >
            <option value="">Marca de vehículo</option>
            {marcasAuto.map((m) => (
              <option key={m.id} value={m.id}>{m.nombre}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
          {articulos.length === 0 ? (
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
                {articulos.map((a, i) => {
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

        {/* Paginación */}
        {total > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs" style={{ color: '#9CA3AF' }}>
              Página {pagina} de {totalPaginas} — mostrando {articulos.length} de {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="p-2 rounded-lg border-2 disabled:opacity-40 transition-colors hover:bg-gray-50"
                style={{ borderColor: '#D1D5DB' }}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} style={{ color: '#374151' }} />
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="p-2 rounded-lg border-2 disabled:opacity-40 transition-colors hover:bg-gray-50"
                style={{ borderColor: '#D1D5DB' }}
                aria-label="Página siguiente"
              >
                <ChevronRight size={16} style={{ color: '#374151' }} />
              </button>
            </div>
          </div>
        )}
      </div>

      <ArticuloEditForm
        open={formOpen}
        onClose={handleClose}
        onSaved={() => refetch(query, pagina, marcaId, marcaAutoId)}
        articulo={editing}
        modelos={modelos}
      />
    </>
  )
}
