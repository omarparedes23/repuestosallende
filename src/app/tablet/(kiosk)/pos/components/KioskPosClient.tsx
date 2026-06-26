'use client'

import { usePosStore } from '@/app/tablet/stores/posStore'
import { ProductGrid } from './ProductGrid'
import { KioskCart } from './KioskCart'
import type { Categoria } from '@/lib/types/database'
import type { RaTipoCliente } from '@/lib/types/database'

type Props = {
  categorias: Categoria[]
}

const TIPO_LABELS: Record<RaTipoCliente, string> = {
  minorista: 'Minorista',
  mayorista: 'Mayorista',
}

export function KioskPosClient({ categorias }: Props) {
  const tipoVenta = usePosStore((s) => s.tipoVenta)
  const setTipoVenta = usePosStore((s) => s.setTipoVenta)

  return (
    <div className="flex flex-col h-full">
      {/* Tipo venta toggle */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: '#001A3D', backgroundColor: '#002D62' }}
      >
        <span className="text-sm font-semibold" style={{ color: '#93B4D4' }}>
          Tipo de venta:
        </span>
        <div className="flex rounded-xl overflow-hidden border-2" style={{ borderColor: '#002D62' }}>
          {(['minorista', 'mayorista'] as RaTipoCliente[]).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setTipoVenta(tipo)}
              className="px-4 py-1.5 text-sm font-semibold transition-colors"
              style={{
                backgroundColor: tipoVenta === tipo ? '#002D62' : '#FFFFFF',
                color: tipoVenta === tipo ? '#FFD700' : '#002D62',
              }}
            >
              {TIPO_LABELS[tipo]}
            </button>
          ))}
        </div>
      </div>

      {/* 62/38 split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Product grid — 62% */}
        <div className="flex flex-col border-r" style={{ width: '62%', borderColor: '#002D62' }}>
          <ProductGrid categorias={categorias} />
        </div>

        {/* Cart — 38% */}
        <div className="flex flex-col" style={{ width: '38%', backgroundColor: '#001A3D' }}>
          <div
            className="px-4 py-3 border-b font-semibold text-sm tracking-wide uppercase"
            style={{ borderColor: '#002D62', color: '#FFD700' }}
          >
            Carrito
          </div>
          <div className="flex-1 overflow-hidden">
            <KioskCart />
          </div>
        </div>
      </div>
    </div>
  )
}
