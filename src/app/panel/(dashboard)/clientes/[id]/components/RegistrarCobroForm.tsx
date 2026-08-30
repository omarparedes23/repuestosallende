'use client'

import { useState, useTransition } from 'react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { registrarCobro } from '../../actions'
import type { RaMetodoPago, RaMoneda } from '@/lib/types/database'

const METODOS: { value: RaMetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
]

const SIMBOLO: Record<string, string> = { PEN: 'S/', USD: '$' }

type Props = {
  ventaId: string
  numeroCompleto: string | null
  moneda: string
  saldoPendiente: number
  onClose: () => void
  onSaved: () => void
}

export function RegistrarCobroForm({ ventaId, numeroCompleto, moneda, saldoPendiente, onClose, onSaved }: Props) {
  const [operationId] = useState(() => crypto.randomUUID())
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [monto, setMonto] = useState(saldoPendiente.toFixed(2))
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [metodoPago, setMetodoPago] = useState<RaMetodoPago>('efectivo')
  const [referencia, setReferencia] = useState('')

  const simbolo = SIMBOLO[moneda] ?? 'S/'
  const montoNumero = parseFloat(monto) || 0
  const montoInvalido = montoNumero <= 0 || montoNumero > saldoPendiente

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await registrarCobro(
        operationId,
        ventaId,
        montoNumero,
        fecha,
        metodoPago,
        moneda as RaMoneda,
        referencia.trim() || null
      )
      if (result.error) {
        setError(result.error)
        return
      }
      onSaved()
    })
  }

  return (
    <FormDialog title={`Registrar cobro — ${numeroCompleto ?? ventaId.slice(0, 8).toUpperCase()}`} onClose={onClose} size="md">
      <div className="p-5 space-y-4">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: '#F0F4FF' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>
            Saldo pendiente
          </p>
          <p className="text-lg font-bold" style={{ color: '#002D62' }}>
            {simbolo} {saldoPendiente.toFixed(2)}
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
            Monto a cobrar
          </label>
          <input
            type="number"
            min="0.01"
            max={saldoPendiente}
            step="0.01"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="w-full rounded-xl border-2 px-4 py-3 text-sm font-bold outline-none focus:border-[#002D62]"
            style={{ borderColor: montoInvalido ? '#DC2626' : '#D1D5DB' }}
          />
          {montoInvalido && (
            <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
              El monto debe ser mayor a 0 y no puede superar el saldo pendiente.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Fecha</label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Método de pago</label>
            <select
              value={metodoPago}
              onChange={(e) => setMetodoPago(e.target.value as RaMetodoPago)}
              className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62] bg-white"
              style={{ borderColor: '#D1D5DB' }}
            >
              {METODOS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-semibold" style={{ color: '#374151' }}>Referencia</label>
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Nro. operación, voucher, etc. (opcional)"
            className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
            style={{ borderColor: '#D1D5DB' }}
          />
        </div>

        {error && (
          <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{error}</p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || montoInvalido}
            className="flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            {isPending ? 'Registrando...' : 'Registrar cobro'}
          </button>
        </div>
      </div>
    </FormDialog>
  )
}
