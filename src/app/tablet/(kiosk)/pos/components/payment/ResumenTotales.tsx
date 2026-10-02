import type { TotalesVenta } from '@/lib/calc/totales'

type Props = {
  totales: TotalesVenta
  simbolo: string
}

export function ResumenTotales({ totales, simbolo }: Props) {
  return (
    <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: '#F0F4FF' }}>
      <div className="flex justify-between text-sm" style={{ color: '#6B7280' }}>
        <span>Subtotal</span>
        <span>{simbolo} {totales.subtotal.toFixed(2)}</span>
      </div>
      {totales.igv > 0 && (
        <div className="flex justify-between text-sm" style={{ color: '#6B7280' }}>
          <span>IGV (18%)</span>
          <span>{simbolo} {totales.igv.toFixed(2)}</span>
        </div>
      )}
      <div
        className="flex justify-between text-xl font-bold pt-1 border-t"
        style={{ borderColor: '#C7D2FE', color: '#002D62' }}
      >
        <span>Total</span>
        <span>{simbolo} {totales.total.toFixed(2)}</span>
      </div>
    </div>
  )
}

export function VueltoBox({ vuelto, simbolo }: { vuelto: number; simbolo: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: '#F0FDF4' }}>
      <div className="flex justify-between text-lg font-bold" style={{ color: '#059669' }}>
        <span>Vuelto</span>
        <span>{simbolo} {vuelto.toFixed(2)}</span>
      </div>
    </div>
  )
}
