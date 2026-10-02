import { Minus, Plus } from 'lucide-react'
import type { CartItem } from '@/app/tablet/stores/posStore'
import type { RaMoneda } from '@/lib/types/database'
import { precioDeLista } from './logic'

type Props = {
  items: CartItem[]
  moneda: RaMoneda
  simbolo: string
  preciosEditados: Record<string, number>
  onCantidadChange: (productoId: string, cantidad: number) => void
  onPrecioChange: (productoId: string, value: string) => void
}

/** Columna derecha: productos con cantidad y precio editables. */
export function ProductosPanel({
  items,
  moneda,
  simbolo,
  preciosEditados,
  onCantidadChange,
  onPrecioChange,
}: Props) {
  return (
    <div className="w-full md:w-[26rem] shrink-0 p-5 space-y-3" style={{ backgroundColor: '#F9FAFB' }}>
      <p className="text-sm font-semibold" style={{ color: '#374151' }}>
        Productos
      </p>
      {items.map((item) => {
        const lista = precioDeLista(item, moneda)
        const editado = preciosEditados[item.productoId]

        return (
          <div
            key={item.productoId}
            className="rounded-xl border p-3 space-y-2"
            style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}
          >
            <p className="text-sm font-semibold leading-tight" style={{ color: '#111827' }}>
              {item.nombre}
            </p>

            <div className="flex items-center justify-between gap-2">
              {/* Cantidad: mismo stepper que el carrito, clamp a stockActual */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onCantidadChange(item.productoId, item.cantidad - 1)}
                  disabled={item.cantidad <= 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border disabled:opacity-40"
                  style={{ borderColor: '#D1D5DB', color: '#374151' }}
                  aria-label={`Reducir cantidad de ${item.nombre}`}
                >
                  <Minus size={12} />
                </button>
                <span className="w-6 text-center text-sm font-bold" style={{ color: '#111827' }}>
                  {item.cantidad}
                </span>
                <button
                  onClick={() => onCantidadChange(item.productoId, item.cantidad + 1)}
                  disabled={item.cantidad >= item.stockActual}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border disabled:opacity-40"
                  style={{ borderColor: '#D1D5DB', color: '#374151' }}
                  aria-label={`Aumentar cantidad de ${item.nombre}`}
                >
                  <Plus size={12} />
                </button>
              </div>

              {lista == null ? (
                <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
                  Sin precio en {simbolo}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  {editado != null && editado < lista && (
                    <span className="text-xs line-through" style={{ color: '#9CA3AF' }}>
                      {simbolo} {lista.toFixed(2)}
                    </span>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>{simbolo}</span>
                    <input
                      type="number"
                      min="0"
                      max={lista}
                      step="0.01"
                      value={editado ?? lista}
                      onChange={(e) => onPrecioChange(item.productoId, e.target.value)}
                      aria-label={`Precio unitario de ${item.nombre}`}
                      className="w-20 rounded-lg border-2 px-2 py-1 text-sm font-bold outline-none"
                      style={{
                        borderColor: editado != null && editado < lista ? '#059669' : '#D1D5DB',
                        color: editado != null && editado < lista ? '#059669' : '#111827',
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {lista != null && (
              <p className="text-xs font-semibold" style={{ color: '#6B7280' }}>
                Subtotal: {simbolo} {((editado ?? lista) * item.cantidad).toFixed(2)}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
