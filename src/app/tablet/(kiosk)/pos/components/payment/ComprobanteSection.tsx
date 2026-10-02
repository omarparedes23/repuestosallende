import type { RaTipoComprobante } from '@/lib/types/database'

const COMPROBANTES: { value: RaTipoComprobante; label: string }[] = [
  { value: 'ticket', label: 'Ticket' },
  { value: 'boleta', label: 'Boleta' },
  { value: 'factura', label: 'Factura' },
]

type Props = {
  tipoComprobante: RaTipoComprobante
  numeroPlaca: string
  onTipoChange: (tipo: RaTipoComprobante) => void
  onPlacaChange: (placa: string) => void
}

/** Selector de tipo de comprobante y placa del vehículo (solo factura). */
export function ComprobanteSection({
  tipoComprobante,
  numeroPlaca,
  onTipoChange,
  onPlacaChange,
}: Props) {
  return (
    <>
      <div className="space-y-2">
        <p className="text-sm font-semibold" style={{ color: '#374151' }}>
          Tipo de comprobante
        </p>
        <div className="flex gap-2">
          {COMPROBANTES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onTipoChange(value)}
              className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors"
              style={{
                borderColor: tipoComprobante === value ? '#002D62' : '#D1D5DB',
                backgroundColor: tipoComprobante === value ? '#002D62' : '#FFFFFF',
                color: tipoComprobante === value ? '#FFD700' : '#374151',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Placa del vehículo (opcional, solo factura — gasto deducible Art. 37 Renta) */}
      {tipoComprobante === 'factura' && (
        <div className="space-y-2">
          <p className="text-sm font-semibold" style={{ color: '#374151' }}>
            Placa del vehículo (opcional)
          </p>
          <input
            type="text"
            value={numeroPlaca}
            onChange={(e) => onPlacaChange(e.target.value.toUpperCase())}
            placeholder="ABC-123"
            maxLength={10}
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>
      )}
    </>
  )
}
