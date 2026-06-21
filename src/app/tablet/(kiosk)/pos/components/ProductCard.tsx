'use client'

import { Plus } from 'lucide-react'
import type { ProductoBuscado } from '../actions'
import type { RaTipoCliente } from '@/lib/types/database'

type Props = {
  producto: ProductoBuscado
  tipoVenta: RaTipoCliente
  onAdd: (producto: ProductoBuscado) => void
}

export function ProductCard({ producto, tipoVenta, onAdd }: Props) {
  const precio =
    tipoVenta === 'mayorista' ? producto.precioMayorista : producto.precioMinorista

  const stockBadgeColor =
    producto.stockActual <= 3 ? '#DC2626' : producto.stockActual <= 10 ? '#D97706' : '#059669'

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden border-2 transition-shadow active:scale-95"
      style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}
    >
      {producto.imagenUrl ? (
        <img
          src={producto.imagenUrl}
          alt={producto.nombre}
          className="w-full h-28 object-cover"
        />
      ) : (
        <div
          className="w-full h-28 flex items-center justify-center text-3xl font-bold"
          style={{ backgroundColor: '#F3F4F6', color: '#9CA3AF' }}
        >
          {producto.nombre.charAt(0)}
        </div>
      )}

      <div className="flex flex-col flex-1 p-3 gap-2">
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: '#111827' }}>
            {producto.nombre}
          </p>
          {producto.codigoOem && (
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {producto.codigoOem}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: `${stockBadgeColor}20`, color: stockBadgeColor }}
          >
            Stock: {producto.stockActual}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-1">
          <span className="text-lg font-bold" style={{ color: '#002D62' }}>
            S/. {precio.toFixed(2)}
          </span>
          <button
            onClick={() => onAdd(producto)}
            disabled={producto.stockActual === 0}
            className="flex items-center justify-center w-10 h-10 rounded-xl font-bold transition-colors disabled:opacity-40"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
            aria-label={`Agregar ${producto.nombre}`}
          >
            <Plus size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
