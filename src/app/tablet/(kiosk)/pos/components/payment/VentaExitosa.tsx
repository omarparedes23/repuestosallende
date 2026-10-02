import { CheckCircle } from 'lucide-react'
import type { RaTipoComprobante } from '@/lib/types/database'
import type { TicketReceiptData } from '@/app/tablet/components/ticket/TicketReceipt'
import { TicketPrintPortal } from '@/app/tablet/components/ticket/TicketPrintPortal'
import { AlertBox } from './AlertBox'

type Props = {
  total: number
  simbolo: string
  tipoComprobante: RaTipoComprobante
  avisoCredito: string | null
  ticketData: TicketReceiptData | null
  showPrint: boolean
  isPrinting: boolean
  error: string | null
  onImprimir: () => void
  onImprimirBoletaFactura: () => void
  onCerrar: () => void
  onCerrarPrint: () => void
}

const PRIMARY = { backgroundColor: '#002D62', color: '#FFD700' }
const OUTLINE = { borderColor: '#002D62', color: '#002D62' }

/** Pantalla de venta registrada: aviso de crédito, impresión (portal) y cierre. */
export function VentaExitosa({
  total,
  simbolo,
  tipoComprobante,
  avisoCredito,
  ticketData,
  showPrint,
  isPrinting,
  error,
  onImprimir,
  onImprimirBoletaFactura,
  onCerrar,
  onCerrarPrint,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      {showPrint && ticketData ? (
        <TicketPrintPortal data={ticketData} onClose={onCerrarPrint} />
      ) : (
        <div
          className="flex flex-col items-center gap-4 p-10 rounded-3xl"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <CheckCircle size={64} style={{ color: '#059669' }} />
          <h2 className="text-2xl font-bold" style={{ color: '#111827' }}>
            Venta registrada
          </h2>
          <p className="text-lg font-semibold" style={{ color: '#002D62' }}>
            Total: {simbolo} {total.toFixed(2)}
          </p>
          {error && <AlertBox tone="danger">{error}</AlertBox>}
          {avisoCredito ? (
            <>
              <AlertBox tone="warning">{avisoCredito}</AlertBox>
              <button
                onClick={onCerrar}
                className="px-6 py-3 rounded-xl text-sm font-bold"
                style={PRIMARY}
              >
                Entendido, cerrar
              </button>
            </>
          ) : tipoComprobante === 'ticket' ? (
            <div className="flex gap-3">
              <button
                onClick={onImprimir}
                className="px-6 py-3 rounded-xl text-sm font-bold"
                style={PRIMARY}
              >
                Imprimir
              </button>
              <button
                onClick={onCerrar}
                className="px-6 py-3 rounded-xl text-sm font-bold border-2"
                style={OUTLINE}
              >
                Cerrar
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="flex gap-3">
                <button
                  onClick={onImprimirBoletaFactura}
                  disabled={isPrinting}
                  className="px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-60"
                  style={PRIMARY}
                >
                  {isPrinting ? 'Cargando...' : 'Imprimir'}
                </button>
                <button
                  onClick={onCerrar}
                  className="px-6 py-3 rounded-xl text-sm font-bold border-2"
                  style={OUTLINE}
                >
                  Cerrar
                </button>
              </div>
              <p className="text-sm text-center" style={{ color: '#6B7280', maxWidth: 280 }}>
                El documento legal se emite vía SUNAT. Si el QR aún no aparece, vuelve a imprimir desde el detalle de la venta.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
