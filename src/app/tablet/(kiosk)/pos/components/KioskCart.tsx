'use client'

import { useState } from 'react'
import { Trash2, Plus, Minus, ShoppingBag } from 'lucide-react'
import { usePosStore } from '@/app/tablet/stores/posStore'
import { calcularTotalesVenta } from '@/lib/calc/totales'
import { PaymentSheet } from './PaymentSheet'

export function KioskCart() {
  const [showPayment, setShowPayment] = useState(false)
  const items = usePosStore((s) => s.items)
  const tipoVenta = usePosStore((s) => s.tipoVenta)
  const tipoComprobante = usePosStore((s) => s.tipoComprobante)
  const removeItem = usePosStore((s) => s.removeItem)
  const updateCantidad = usePosStore((s) => s.updateCantidad)

  const totales = calcularTotalesVenta(items, tipoVenta, tipoComprobante)

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-6">
        <div
          className="flex items-center justify-center w-20 h-20 rounded-3xl"
          style={{ backgroundColor: '#002D62' }}
        >
          <ShoppingBag size={36} style={{ color: '#4B7AB8' }} />
        </div>
        <p className="text-sm font-medium text-center" style={{ color: '#4B7AB8' }}>
          El carrito está vacío.
          <br />
          Agrega repuestos desde la izquierda.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Items list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {items.map((item) => {
            const precio =
              tipoVenta === 'mayorista' ? item.precioMayorista : item.precioMinorista
            const subtotalItem = precio * item.cantidad - item.descuento

            return (
              <div
                key={item.productoId}
                className="flex gap-2 p-2 rounded-xl border"
                style={{ borderColor: '#002D62', backgroundColor: '#002D62' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight truncate" style={{ color: '#FFFFFF' }}>
                    {item.nombre}
                  </p>
                  {item.codigoOem && (
                    <p className="text-xs" style={{ color: '#93B4D4' }}>
                      {item.codigoOem}
                    </p>
                  )}
                  <p className="text-sm font-bold mt-1" style={{ color: '#FFD700' }}>
                    S/. {subtotalItem.toFixed(2)}
                  </p>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => removeItem(item.productoId)}
                    className="p-1 rounded-lg transition-colors"
                    style={{ color: '#F87171' }}
                    aria-label="Eliminar"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateCantidad(item.productoId, item.cantidad - 1)}
                      disabled={item.cantidad <= 1}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border disabled:opacity-40"
                      style={{ borderColor: '#4B7AB8', color: '#FFFFFF' }}
                      aria-label="Reducir cantidad"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-sm font-bold" style={{ color: '#FFFFFF' }}>
                      {item.cantidad}
                    </span>
                    <button
                      onClick={() => updateCantidad(item.productoId, item.cantidad + 1)}
                      disabled={item.cantidad >= item.stockActual}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border disabled:opacity-40"
                      style={{ borderColor: '#4B7AB8', color: '#FFFFFF' }}
                      aria-label="Aumentar cantidad"
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <p className="text-xs" style={{ color: '#93B4D4' }}>
                    S/. {precio.toFixed(2)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Totales + CTA */}
        <div
          className="border-t p-4 space-y-3"
          style={{ borderColor: '#002D62', backgroundColor: '#001A3D' }}
        >
          <div className="space-y-1">
            <div className="flex justify-between text-sm" style={{ color: '#93B4D4' }}>
              <span>Subtotal</span>
              <span>S/. {totales.subtotal.toFixed(2)}</span>
            </div>
            {totales.igv > 0 && (
              <div className="flex justify-between text-sm" style={{ color: '#93B4D4' }}>
                <span>IGV (18%)</span>
                <span>S/. {totales.igv.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t" style={{ color: '#FFFFFF', borderColor: '#002D62' }}>
              <span>Total</span>
              <span style={{ color: '#FFD700' }}>S/. {totales.total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowPayment(true)}
            className="w-full py-4 rounded-xl text-base font-bold transition-opacity"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            COBRAR S/. {totales.total.toFixed(2)}
          </button>
        </div>
      </div>

      {showPayment && (
        <PaymentSheet totales={totales} onClose={() => setShowPayment(false)} />
      )}
    </>
  )
}
