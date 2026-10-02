import { AlertBox } from './AlertBox'

type Props = {
  fechaVencimiento: string
  minFecha: string
  creditoInvalido: boolean
  limiteExcedido: boolean
  onChange: (fecha: string) => void
}

/** Fecha de vencimiento y avisos de una venta a crédito. */
export function VencimientoCredito({
  fechaVencimiento,
  minFecha,
  creditoInvalido,
  limiteExcedido,
  onChange,
}: Props) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold" style={{ color: '#374151' }}>
        Fecha de vencimiento
      </p>
      <input
        type="date"
        min={minFecha}
        value={fechaVencimiento}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
        style={{ borderColor: '#D1D5DB' }}
      />
      {creditoInvalido && (
        <AlertBox tone="danger">
          Selecciona un cliente con crédito habilitado para vender a crédito.
        </AlertBox>
      )}
      {limiteExcedido && (
        <AlertBox tone="warning">
          Esta venta hará que el saldo del cliente supere su límite de crédito.
        </AlertBox>
      )}
    </div>
  )
}
