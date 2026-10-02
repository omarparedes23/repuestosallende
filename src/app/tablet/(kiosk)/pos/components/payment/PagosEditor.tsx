import { Plus, Trash2 } from 'lucide-react'
import type { RaMetodoPago } from '@/lib/types/database'
import { METODOS_CON_REFERENCIA, type LineaPago } from './logic'

const METODOS: { value: RaMetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'credito', label: 'Crédito' },
]

type Props = {
  lineas: LineaPago[]
  onAdd: () => void
  onRemove: (idx: number) => void
  onUpdate: (idx: number, field: keyof LineaPago, value: string) => void
}

export function PagosEditor({ lineas, onAdd, onRemove, onUpdate }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold" style={{ color: '#374151' }}>
        Métodos de pago
      </p>
      {lineas.map((linea, idx) => (
        <div key={idx} className="space-y-2">
          <div className="flex gap-2 items-center">
            <select
              value={linea.metodoPago}
              onChange={(e) => onUpdate(idx, 'metodoPago', e.target.value)}
              className="flex-1 rounded-xl border-2 px-3 py-3 text-sm outline-none"
              style={{ borderColor: '#D1D5DB' }}
            >
              {METODOS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={linea.monto}
              onChange={(e) => onUpdate(idx, 'monto', e.target.value)}
              placeholder="0.00"
              className="w-32 rounded-xl border-2 px-3 py-3 text-sm font-bold outline-none"
              style={{ borderColor: '#D1D5DB' }}
            />
            {lineas.length > 1 && (
              <button
                onClick={() => onRemove(idx)}
                className="p-2 rounded-xl"
                style={{ color: '#DC2626' }}
                aria-label="Eliminar línea"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {METODOS_CON_REFERENCIA.has(linea.metodoPago) && (
            <div className="space-y-1">
              <label className="block text-xs font-semibold" style={{ color: '#374151' }}>
                {linea.metodoPago === 'tarjeta' ? 'N.º de operación / voucher POS' : 'N.º de operación'}
              </label>
              <input
                type="text"
                value={linea.referencia}
                onChange={(e) => onUpdate(idx, 'referencia', e.target.value)}
                placeholder={linea.metodoPago === 'tarjeta' ? 'Voucher del POS, no número de tarjeta' : 'N.º de operación'}
                className="w-full rounded-xl border-2 px-3 py-2 text-sm outline-none"
                style={{ borderColor: '#D1D5DB' }}
              />
            </div>
          )}
        </div>
      ))}
      <button
        onClick={onAdd}
        className="flex items-center gap-2 text-sm font-semibold"
        style={{ color: '#002D62' }}
      >
        <Plus size={16} />
        Agregar otro método
      </button>
    </div>
  )
}
