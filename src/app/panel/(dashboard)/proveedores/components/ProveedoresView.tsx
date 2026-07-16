'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Building2 } from 'lucide-react'
import { ProveedorForm } from './ProveedorForm'
import { toggleActivoProveedor } from '../actions'
import type { RaProveedor } from '@/lib/types/database'

type Props = { initialProveedores: RaProveedor[] }

export function ProveedoresView({ initialProveedores }: Props) {
  const [proveedores, setProveedores] = useState(initialProveedores)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RaProveedor | null>(null)
  const [, startTransition] = useTransition()

  const filtered = query.trim()
    ? proveedores.filter(
        (p) =>
          p.nombre.toLowerCase().includes(query.toLowerCase()) ||
          (p.ruc ?? '').includes(query) ||
          (p.telefono ?? '').includes(query)
      )
    : proveedores

  function handleEdit(p: RaProveedor) {
    setEditing(p)
    setFormOpen(true)
  }

  function handleNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function handleToggle(p: RaProveedor) {
    startTransition(async () => {
      await toggleActivoProveedor(p.id, p.activo)
      setProveedores((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x))
      )
    })
  }

  return (
    <>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Proveedores</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              {filtered.length} proveedor{filtered.length !== 1 ? 'es' : ''}
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            <Plus size={16} />
            Nuevo proveedor
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, RUC o teléfono..."
            className="w-full rounded-xl border-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Building2 size={32} style={{ color: '#D1D5DB' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                {query ? 'Sin resultados para tu búsqueda' : 'No hay proveedores aún'}
              </p>
              {!query && (
                <button
                  onClick={handleNew}
                  className="text-sm font-semibold"
                  style={{ color: '#002D62' }}
                >
                  + Agregar el primero
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB' }}>
                  {['Nombre', 'RUC', 'Teléfono', 'Contacto', 'Saldo', 'Estado', 'Acciones'].map((h) => (
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
                {filtered.map((p, i) => (
                  <tr
                    key={p.id}
                    className="border-t"
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    }}
                  >
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {p.nombre}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {p.ruc ?? '—'}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {p.telefono ?? '—'}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {p.contacto ?? '—'}
                    </td>
                    <td className="px-5 py-4">
                      {p.saldo_deudor > 0 ? (
                        <Link
                          href={`/panel/proveedores/${p.id}`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold hover:opacity-80"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                        >
                          S/ {p.saldo_deudor.toFixed(2)}
                        </Link>
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: p.activo ? '#F0FDF4' : '#FEF2F2',
                          color: p.activo ? '#059669' : '#DC2626',
                        }}
                      >
                        {p.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(p)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          title="Editar"
                        >
                          <Pencil size={15} style={{ color: '#6B7280' }} />
                        </button>
                        <button
                          onClick={() => handleToggle(p)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          title={p.activo ? 'Desactivar' : 'Activar'}
                        >
                          {p.activo
                            ? <ToggleRight size={18} style={{ color: '#059669' }} />
                            : <ToggleLeft size={18} style={{ color: '#9CA3AF' }} />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ProveedorForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        proveedor={editing}
      />
    </>
  )
}
