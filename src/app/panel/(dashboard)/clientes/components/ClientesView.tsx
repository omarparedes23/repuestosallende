'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Search, Pencil, ToggleLeft, ToggleRight, Users } from 'lucide-react'
import { ClienteForm } from './ClienteForm'
import { toggleActivoCliente } from '../actions'
import type { RaCliente } from '@/lib/types/database'

type Props = { initialClientes: RaCliente[] }

export function ClientesView({ initialClientes }: Props) {
  const [clientes, setClientes] = useState(initialClientes)
  const [query, setQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<RaCliente | null>(null)
  const [, startTransition] = useTransition()

  const filtered = query.trim()
    ? clientes.filter(
        (c) =>
          c.nombre.toLowerCase().includes(query.toLowerCase()) ||
          (c.nro_documento ?? '').includes(query) ||
          (c.telefono ?? '').includes(query)
      )
    : clientes

  function handleEdit(c: RaCliente) {
    setEditing(c)
    setFormOpen(true)
  }

  function handleNew() {
    setEditing(null)
    setFormOpen(true)
  }

  function handleToggle(c: RaCliente) {
    startTransition(async () => {
      await toggleActivoCliente(c.id, c.activo)
      setClientes((prev) =>
        prev.map((x) => (x.id === c.id ? { ...x, activo: !x.activo } : x))
      )
    })
  }

  return (
    <>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Clientes</h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              {filtered.length} cliente{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            <Plus size={16} />
            Nuevo cliente
          </button>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, documento o teléfono..."
            className="w-full rounded-xl border-2 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        {/* Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users size={32} style={{ color: '#D1D5DB' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                {query ? 'Sin resultados para tu búsqueda' : 'No hay clientes aún'}
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
                  {['Nombre', 'Documento', 'Teléfono', 'Crédito', 'Saldo', 'Estado', 'Acciones'].map((h) => (
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
                {filtered.map((c, i) => (
                  <tr
                    key={c.id}
                    className="border-t"
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                    }}
                  >
                    <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                      {c.nombre}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {c.tipo_documento && c.nro_documento
                        ? `${c.tipo_documento} ${c.nro_documento}`
                        : '—'}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#6B7280' }}>
                      {c.telefono ?? '—'}
                    </td>
                    <td className="px-5 py-4" style={{ color: '#374151' }}>
                      {c.tiene_credito ? `S/ ${c.limite_credito.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-5 py-4">
                      {c.saldo_deudor > 0 || c.tiene_credito ? (
                        <Link
                          href={`/panel/clientes/${c.id}`}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold hover:opacity-80"
                          style={
                            c.saldo_deudor > 0
                              ? { backgroundColor: '#FEF2F2', color: '#DC2626' }
                              : { backgroundColor: '#F3F4F6', color: '#374151' }
                          }
                        >
                          S/ {c.saldo_deudor.toFixed(2)}
                        </Link>
                      ) : (
                        <span style={{ color: '#9CA3AF' }}>—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: c.activo ? '#F0FDF4' : '#FEF2F2',
                          color: c.activo ? '#059669' : '#DC2626',
                        }}
                      >
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(c)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          title="Editar"
                        >
                          <Pencil size={15} style={{ color: '#6B7280' }} />
                        </button>
                        <button
                          onClick={() => handleToggle(c)}
                          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                          title={c.activo ? 'Desactivar' : 'Activar'}
                        >
                          {c.activo
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

      <ClienteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        cliente={editing}
      />
    </>
  )
}
