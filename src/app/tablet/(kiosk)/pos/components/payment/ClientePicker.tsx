import { Search, UserCheck, UserX, X } from 'lucide-react'
import type { ClienteSnapshot } from '@/app/tablet/stores/posStore'
import type { ClienteResumen } from '../../../clientes/actions'

type Props = {
  cliente: ClienteSnapshot | null
  query: string
  results: ClienteResumen[]
  isSearching: boolean
  showSearch: boolean
  onQueryChange: (value: string) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  onSelect: (cliente: ClienteSnapshot) => void
  onRemove: () => void
}

export function ClientePicker({
  cliente,
  query,
  results,
  isSearching,
  showSearch,
  onQueryChange,
  onOpenSearch,
  onCloseSearch,
  onSelect,
  onRemove,
}: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold" style={{ color: '#374151' }}>
        Cliente <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional)</span>
      </p>

      {cliente ? (
        <div
          className="flex items-center justify-between rounded-xl px-4 py-3"
          style={{ backgroundColor: '#F0F4FF', border: '2px solid #002D62' }}
        >
          <div className="flex items-center gap-3">
            <UserCheck size={18} style={{ color: '#002D62' }} />
            <div>
              <p className="text-sm font-bold" style={{ color: '#002D62' }}>
                {cliente.nombre}
              </p>
              {cliente.nro_documento && (
                <p className="text-xs" style={{ color: '#6B7280' }}>
                  {cliente.tipo_documento} {cliente.nro_documento}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onRemove}
            className="p-1 rounded-lg"
            style={{ color: '#6B7280' }}
            aria-label="Quitar cliente"
          >
            <UserX size={18} />
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {!showSearch ? (
            <button
              onClick={onOpenSearch}
              className="flex items-center gap-2 w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium"
              style={{ borderColor: '#D1D5DB', color: '#6B7280' }}
            >
              <Search size={16} />
              Buscar cliente...
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre o documento..."
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  className="flex-1 rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
                  style={{ borderColor: '#D1D5DB' }}
                />
                <button
                  onClick={onCloseSearch}
                  className="px-3 rounded-xl text-sm"
                  style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                >
                  <X size={16} />
                </button>
              </div>
              {isSearching && (
                <p className="text-xs px-1" style={{ color: '#9CA3AF' }}>Buscando...</p>
              )}
              {results.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                  {results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() =>
                        onSelect({
                          id: c.id,
                          nombre: c.nombre,
                          tipo_documento: c.tipo_documento ?? null,
                          nro_documento: c.nro_documento ?? null,
                          tipo_cliente: c.tipo_cliente,
                          tiene_credito: c.tiene_credito,
                          limite_credito: c.limite_credito,
                          saldo_deudor: c.saldo_deudor,
                        })
                      }
                      className="flex items-center justify-between w-full px-4 py-3 text-left text-sm border-b last:border-b-0 hover:bg-gray-50"
                      style={{ borderColor: '#F3F4F6' }}
                    >
                      <span className="font-medium" style={{ color: '#111827' }}>{c.nombre}</span>
                      {c.nro_documento && (
                        <span className="text-xs" style={{ color: '#9CA3AF' }}>
                          {c.tipo_documento} {c.nro_documento}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {!isSearching && query.trim() && results.length === 0 && (
                <p className="text-xs px-1" style={{ color: '#9CA3AF' }}>Sin resultados</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
