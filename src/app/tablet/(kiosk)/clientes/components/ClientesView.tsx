'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Search, Loader2, Plus, Pencil, User } from 'lucide-react'
import { buscarClientes, type ClienteResumen } from '../actions'
import { ClienteFormSheet } from './ClienteFormSheet'

type Props = {
  initialClientes: ClienteResumen[]
}

const TIPO_LABELS: Record<string, string> = {
  minorista: 'Minorista',
  mayorista: 'Mayorista',
}

export function ClientesView({ initialClientes }: Props) {
  const [query, setQuery] = useState('')
  const [clientes, setClientes] = useState<ClienteResumen[]>(initialClientes)
  const [isPending, startTransition] = useTransition()
  const [formCliente, setFormCliente] = useState<ClienteResumen | null | undefined>(undefined)
  // undefined = sheet closed, null = new client, ClienteResumen = edit mode

  const fetchClientes = useCallback((q: string) => {
    startTransition(async () => {
      const result = await buscarClientes(q)
      if (result.data) setClientes(result.data)
    })
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => fetchClientes(query), 300)
    return () => clearTimeout(timer)
  }, [query, fetchClientes])

  const handleClose = () => {
    setFormCliente(undefined)
    fetchClientes(query) // Refresh list after save
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Search + add */}
        <div
          className="flex items-center gap-3 p-3 border-b"
          style={{ borderColor: '#E5E7EB' }}
        >
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: '#9CA3AF' }}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o documento..."
              className="w-full pl-9 pr-4 py-3 rounded-xl border-2 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }}
            />
            {isPending && (
              <Loader2
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
                style={{ color: '#9CA3AF' }}
              />
            )}
          </div>
          <button
            onClick={() => setFormCliente(null)}
            className="flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-semibold shrink-0"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            <Plus size={16} />
            Nuevo
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {clientes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <User size={32} style={{ color: '#D1D5DB' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                {query ? `Sin resultados para "${query}"` : 'No hay clientes registrados.'}
              </p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F3F4F6' }}>
              {clientes.map((cliente) => (
                <div
                  key={cliente.id}
                  className="flex items-center gap-3 px-4 py-4"
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold"
                    style={{ backgroundColor: '#F0F4FF', color: '#002D62' }}
                  >
                    {cliente.nombre.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#111827' }}>
                      {cliente.nombre}
                    </p>
                    <div className="flex items-center gap-2 text-xs" style={{ color: '#6B7280' }}>
                      <span
                        className="px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            cliente.tipo_cliente === 'mayorista' ? '#FFF7ED' : '#F0F4FF',
                          color:
                            cliente.tipo_cliente === 'mayorista' ? '#C2410C' : '#1D4ED8',
                        }}
                      >
                        {TIPO_LABELS[cliente.tipo_cliente]}
                      </span>
                      {cliente.nro_documento && (
                        <span>
                          {cliente.tipo_documento} {cliente.nro_documento}
                        </span>
                      )}
                      {cliente.telefono && <span>{cliente.telefono}</span>}
                    </div>
                  </div>

                  <button
                    onClick={() => setFormCliente(cliente)}
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: '#F3F4F6' }}
                    aria-label={`Editar ${cliente.nombre}`}
                  >
                    <Pencil size={16} style={{ color: '#374151' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {formCliente !== undefined && (
        <ClienteFormSheet
          cliente={formCliente}
          onClose={handleClose}
        />
      )}
    </>
  )
}
