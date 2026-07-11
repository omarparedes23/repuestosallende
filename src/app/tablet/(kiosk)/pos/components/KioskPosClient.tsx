'use client'

import { useState } from 'react'
import { ShoppingBag, X } from 'lucide-react'
import { usePosStore } from '@/app/tablet/stores/posStore'
import { calcularTotalesVenta } from '@/lib/calc/totales'
import { simboloMoneda } from '@/lib/calc/moneda'
import { ProductGrid } from './ProductGrid'
import { KioskCart } from './KioskCart'
import type { Categoria } from '@/lib/types/database'

type Props = {
  categorias: Categoria[]
}

export function KioskPosClient({ categorias }: Props) {
  const tipoComprobante = usePosStore((s) => s.tipoComprobante)
  const items = usePosStore((s) => s.items)
  const [showCartMobile, setShowCartMobile] = useState(false)

  const cantidadItems = items.reduce((sum, item) => sum + item.cantidad, 0)
  // Previsualización siempre en soles — la moneda de cobro se elige en PaymentSheet.
  const totales = calcularTotalesVenta(items, tipoComprobante, 'PEN')
  const simbolo = simboloMoneda('PEN')

  return (
    <div className="flex flex-col h-full relative">
      {/* 62/38 split — cart column collapses on mobile, product grid takes full width */}
      <div className="flex flex-1 overflow-hidden">
        {/* Product grid */}
        <div className="flex flex-col w-full md:w-[62%] md:border-r" style={{ borderColor: '#002D62' }}>
          <ProductGrid categorias={categorias} />
        </div>

        {/* Cart — hidden on mobile, 38% on tablet/desktop */}
        <div
          className="hidden md:flex flex-col shrink-0"
          style={{ width: '38%', backgroundColor: '#001A3D' }}
        >
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

      {/* Floating cart button — mobile only */}
      <button
        onClick={() => setShowCartMobile(true)}
        aria-label="Ver carrito"
        className="md:hidden absolute bottom-4 right-4 z-30 flex items-center gap-2 pl-4 pr-5 py-3 rounded-full shadow-lg"
        style={{ backgroundColor: '#FFD700', color: '#002D62' }}
      >
        <span className="relative flex items-center justify-center">
          <ShoppingBag size={20} />
          {cantidadItems > 0 && (
            <span
              className="absolute -top-2 -right-2 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold"
              style={{ backgroundColor: '#002D62', color: '#FFD700' }}
            >
              {cantidadItems}
            </span>
          )}
        </span>
        {cantidadItems > 0 && (
          <span className="text-sm font-bold">{simbolo} {totales.total.toFixed(2)}</span>
        )}
      </button>

      {/* Mobile cart bottom sheet */}
      {showCartMobile && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowCartMobile(false) }}
        >
          <div
            className="flex flex-col rounded-t-2xl overflow-hidden"
            style={{ backgroundColor: '#001A3D', maxHeight: '85vh' }}
          >
            <div
              className="flex items-center justify-between px-4 py-3 border-b shrink-0"
              style={{ borderColor: '#002D62' }}
            >
              <span className="font-semibold text-sm tracking-wide uppercase" style={{ color: '#FFD700' }}>
                Carrito
              </span>
              <button
                onClick={() => setShowCartMobile(false)}
                aria-label="Cerrar carrito"
                className="p-1.5 rounded-lg"
                style={{ backgroundColor: '#002D62' }}
              >
                <X size={18} style={{ color: '#FFFFFF' }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              <KioskCart />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
