'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { buscarProductos, type ProductoBuscado } from '../actions'
import { usePosStore } from '@/app/tablet/stores/posStore'
import { ProductCard } from './ProductCard'

export type MarcaOption = { id: string; nombre: string }

type Props = {
  marcas: MarcaOption[]
}

export function ProductGrid({ marcas }: Props) {
  const [query, setQuery] = useState('')
  const [selectedMarca, setSelectedMarca] = useState<string | undefined>()
  const [productos, setProductos] = useState<ProductoBuscado[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  const addItem = usePosStore((s) => s.addItem)

  // Reemplaza la lista (nueva busqueda/filtro): siempre arranca desde offset 0.
  const fetchProductos = useCallback(
    (q: string, marcaId?: string) => {
      startTransition(async () => {
        const result = await buscarProductos(q, marcaId, 0)
        if (result.data) {
          setProductos(result.data.productos)
          setHasMore(result.data.hasMore)
        }
      })
    },
    []
  )

  // Cargar mas: pide la siguiente pagina y la agrega al final, no reemplaza.
  const handleCargarMas = useCallback(() => {
    setIsLoadingMore(true)
    buscarProductos(query, selectedMarca, productos.length)
      .then((result) => {
        if (result.data) {
          setProductos((prev) => [...prev, ...result.data!.productos])
          setHasMore(result.data.hasMore)
        }
      })
      .finally(() => setIsLoadingMore(false))
  }, [query, selectedMarca, productos.length])

  // Initial load
  useEffect(() => {
    fetchProductos('', undefined)
  }, [fetchProductos])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProductos(query, selectedMarca)
    }, 300)
    return () => clearTimeout(timer)
  }, [query, selectedMarca, fetchProductos])

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
        precioDolar: producto.precioDolar,
      })
    },
    [addItem]
  )

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 border-b" style={{ borderColor: '#002D62', backgroundColor: '#002D62' }}>
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: '#93B4D4' }}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o código OEM..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border-2 text-sm outline-none transition-colors"
            style={{ borderColor: '#001A3D', backgroundColor: '#001A3D', color: '#FFFFFF' }}
          />
          {isPending && (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
              style={{ color: '#93B4D4' }}
            />
          )}
        </div>
      </div>

      {/* Marca bar */}
      <div
        className="flex gap-2 px-3 py-2 overflow-x-auto border-b"
        style={{ borderColor: '#002D62', backgroundColor: '#001A3D' }}
      >
        <button
          onClick={() => setSelectedMarca(undefined)}
          className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
          style={{
            backgroundColor: !selectedMarca ? '#FFD700' : '#002D62',
            color: !selectedMarca ? '#002D62' : '#93B4D4',
          }}
        >
          Todos
        </button>
        {marcas.map((marca) => (
          <button
            key={marca.id}
            onClick={() => setSelectedMarca(marca.id === selectedMarca ? undefined : marca.id)}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
            style={{
              backgroundColor: selectedMarca === marca.id ? '#FFD700' : '#002D62',
              color: selectedMarca === marca.id ? '#002D62' : '#93B4D4',
            }}
          >
            {marca.nombre}
          </button>
        ))}
      </div>

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-3" style={{ backgroundColor: '#F1F5F9' }}>
        {productos.length === 0 && !isPending ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <p className="text-sm font-medium" style={{ color: '#9CA3AF' }}>
              {query ? `Sin resultados para "${query}"` : 'No hay productos disponibles'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {productos.map((prod) => (
                <ProductCard
                  key={prod.productoId}
                  producto={prod}
                  onAdd={handleAddItem}
                />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center py-4">
                <button
                  onClick={handleCargarMas}
                  disabled={isLoadingMore}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
                  style={{ backgroundColor: '#002D62', color: '#FFFFFF' }}
                >
                  {isLoadingMore ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Cargando...
                    </span>
                  ) : (
                    'Cargar más'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
