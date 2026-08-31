'use client'

import { useState, useTransition } from 'react'
import { Search, Plus, FileText, ArrowRight, CheckCircle, Truck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { avanzarEstadoGuia, recibirGuia } from '../actions'
import type { GuiaRow } from '../actions'

const ESTADO_CONFIG: Record<string, { bg: string; color: string; label: string; icon: React.ReactNode }> = {
  borrador:    { bg: '#F3F4F6', color: '#6B7280', label: 'Borrador',    icon: <FileText size={12} /> },
  emitida:     { bg: '#EFF6FF', color: '#2563EB', label: 'Emitida',     icon: <FileText size={12} /> },
  en_transito: { bg: '#FFFBEB', color: '#D97706', label: 'En tránsito', icon: <Truck size={12} /> },
  recibida:    { bg: '#F0FDF4', color: '#059669', label: 'Recibida',    icon: <CheckCircle size={12} /> },
}

type Props = { initialGuias: GuiaRow[] }

export function GuiasView({ initialGuias }: Props) {
  const router = useRouter()
  const [guias, setGuias] = useState(initialGuias)
  const [query, setQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = query.trim()
    ? guias.filter(
        (g) =>
          g.sucursal_origen_nombre.toLowerCase().includes(query.toLowerCase()) ||
          g.sucursal_destino_nombre.toLowerCase().includes(query.toLowerCase()) ||
          (g.serie ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : guias

  function handleAvanzar(g: GuiaRow, nuevoEstado: 'emitida' | 'en_transito') {
    setError(null)
    startTransition(async () => {
      const actionError = await avanzarEstadoGuia(g.id, nuevoEstado)
      if (actionError) {
        setError(actionError)
        return
      }
      setGuias((prev) => prev.map((x) => (x.id === g.id ? { ...x, estado: nuevoEstado } : x)))
    })
  }

  function handleRecibir(g: GuiaRow) {
    setError(null)
    startTransition(async () => {
      const actionError = await recibirGuia(g.id)
      if (actionError) {
        setError(actionError)
        return
      }
      setGuias((prev) => prev.map((x) => (x.id === g.id ? { ...x, estado: 'recibida' } : x)))
    })
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Guías de remisión</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {filtered.length} guía{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => router.push('/panel/guias/nueva')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
        >
          <Plus size={16} />
          Nueva guía
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por sucursal o serie..."
          className="w-full rounded-xl border-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
          style={{ borderColor: '#D1D5DB' }}
        />
      </div>

      {error && (
        <p className="text-sm font-medium" style={{ color: '#DC2626' }} role="alert">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText size={32} style={{ color: '#D1D5DB' }} />
            <p className="text-sm" style={{ color: '#9CA3AF' }}>
              {query ? 'Sin resultados para tu búsqueda' : 'No hay guías registradas'}
            </p>
            {!query && (
              <button
                onClick={() => router.push('/panel/guias/nueva')}
                className="text-sm font-semibold"
                style={{ color: '#002D62' }}
              >
                + Crear primera guía
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                {['Serie/Correlativo', 'Origen → Destino', 'Fecha', 'Estado', 'Acciones'].map((h) => (
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
              {filtered.map((g, i) => {
                const cfg = ESTADO_CONFIG[g.estado] ?? ESTADO_CONFIG.borrador
                return (
                  <tr
                    key={g.id}
                    className="border-t cursor-pointer hover:bg-gray-50 transition-colors"
                    style={{ borderColor: '#F3F4F6', backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}
                    onClick={() => router.push(`/panel/guias/${g.id}`)}
                  >
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: '#6B7280' }}>
                      {g.serie && g.correlativo ? `${g.serie}-${g.correlativo}` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 font-medium" style={{ color: '#111827' }}>
                        <span>{g.sucursal_origen_nombre}</span>
                        <ArrowRight size={14} style={{ color: '#9CA3AF' }} />
                        <span>{g.sucursal_destino_nombre}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {new Date(g.fecha_emision).toLocaleDateString('es-PE', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: cfg.bg, color: cfg.color }}
                      >
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      {g.estado === 'borrador' && (
                        <button
                          onClick={() => handleAvanzar(g, 'emitida')}
                          disabled={isPending}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                          style={{ color: '#2563EB' }}
                        >
                          Emitir
                        </button>
                      )}
                      {g.estado === 'emitida' && (
                        <button
                          onClick={() => handleAvanzar(g, 'en_transito')}
                          disabled={isPending}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                          style={{ color: '#D97706' }}
                        >
                          Despachar
                        </button>
                      )}
                      {g.estado === 'en_transito' && (
                        <button
                          onClick={() => handleRecibir(g)}
                          disabled={isPending}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                          style={{ color: '#059669' }}
                        >
                          Recibir
                        </button>
                      )}
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
