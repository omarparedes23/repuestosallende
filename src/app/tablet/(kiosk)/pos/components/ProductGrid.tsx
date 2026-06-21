'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { buscarProductos, type ProductoBuscado } from '../actions'
import { usePosStore } from '@/app/tablet/stores/posStore'
import { ProductCard } from './ProductCard'
import type { Categoria } from '@/lib/types/database'

type Props = {
  categorias: Categoria[]
}

export function ProductGrid({ categorias }: Props) {
  const [query, setQuery] = useState('')
  const [selectedCat, setSelectedCat] = useState<string | undefined>()
  const [productos, setProductos] = useState<ProductoBuscado[]>([])
  const [isPending, startTransition] = useTransition()

  const tipoVenta = usePosStore((s) => s.tipoVenta)
  const addItem = usePosStore((s) => s.addItem)

  const fetchProductos = useCallback(
    (q: string, catId?: string) => {
      startTransition(async () => {
        const result = await buscarProductos(q, catId)
        if (result.data) setProductos(result.data)
      })
    },
    []
  )

  // Initial load
  useEffect(() => {
    fetchProductos('', undefined)
  }, [fetchProductos])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductos(query, selectedCat)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, selectedCat, fetchProductos])

  const handleAddItem = useCallback(
    (producto: ProductoBuscado) => {
      addItem({
        productoId: producto.productoId,
        catalogoId: producto.catalogoId,
        nombre: producto.nombre,
        codigoOem: producto.codigoOem,
        imagenUrl: producto.imagenUrl,
        stockActual: producto.stockActual,
        precioMinorista: producto.precioMinorista,
        precioMayorista: producto.precioMayorista,
      })
    },
    [addItem]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b" style={{ borderColor: '#E5E7EB' }}>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: '#9CA3AF' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o código OEM..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 text-sm outline-none transition-colors focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB', backgroundColor: '#F9FAFB' }}
          />
          {isPending && (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
              style={{ color: '#9CA3AF' }}
            />
          )}
        </div>
      </div>

      {/* Category bar */}
      <div
        className="flex gap-2 px-3 py-2 overflow-x-auto border-b"
        style={{ borderColor: '#E5E7EB' }}
      >
        <button
          onClick={() => setSelectedCat(undefined)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{
            backgroundColor: !selectedCat ? '#002D62' : '#F3F4F6',
            color: !selectedCat ? '#FFD700' : '#374151',
          }}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCat(cat.id === selectedCat ? undefined : cat.id)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              backgroundColor: selectedCat === cat.id ? '#002D62' : '#F3F4F6',
              color: selectedCat === cat.id ? '#FFD700' : '#374151',
            }}
          >
            {cat.nombre}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3">
        {productos.length === 0 && !isPending ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
              {query ? `Sin resultados para "${query}"` : 'No hay productos disponibles'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {productos.map((prod) => (
              <ProductCard
                key={prod.productoId}
                producto={prod}
                tipoVenta={tipoVenta}
                onAdd={handleAddItem}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
