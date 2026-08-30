'use client'

import { useState, useMemo, useActionState } from 'react'
import Link from 'next/link'
import { ArrowLeft, User, Receipt, Printer, Send } from 'lucide-react'
import {
  enviarVentaAOseSunat,
  initialEnvioSunatManualState,
  type VentaDetalle as VentaDetalleType,
} from '../../actions'
import type { RaTipoComprobante } from '@/lib/types/database'
import { simboloMoneda } from '@/lib/calc/moneda'
import { calcularVuelto } from '@/lib/calc/vuelto'
import { TicketPrintPortal } from '@/app/tablet/components/ticket/TicketPrintPortal'
import type { TicketReceiptData } from '@/app/tablet/components/ticket/TicketReceipt'

type Props = {
  venta: VentaDetalleType
  puedeEnviarSunat: boolean
}

const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
}

const COMPROBANTE_LABELS: Record<string, string> = {
  ticket: 'Ticket',
  boleta: 'Boleta',
  factura: 'Factura',
}

const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  completada: { label: 'Completada', bg: '#F0FDF4', text: '#059669' },
  pendiente: { label: 'Pendiente', bg: '#FFFBEB', text: '#D97706' },
  anulada: { label: 'Anulada', bg: '#FEF2F2', text: '#DC2626' },
  error_sunat: { label: 'Error SUNAT', bg: '#FEF2F2', text: '#DC2626' },
}

export function VentaDetalle({ venta, puedeEnviarSunat }: Props) {
  const [showPrint, setShowPrint] = useState(false)
  const [envioState, enviarFormAction, enviando] = useActionState(
    enviarVentaAOseSunat,
    initialEnvioSunatManualState
  )
  const estadoCfg = ESTADO_CONFIG[venta.estado] ?? ESTADO_CONFIG.pendiente
  const fecha = new Date(venta.created_at)

  const vuelto = useMemo(
    () => calcularVuelto(venta.pagos.map((p) => ({ monto: p.monto })), venta.total),
    [venta.pagos, venta.total]
  )

  const handleReimprimir = () => setShowPrint(true)
  const handleCerrarPrint = () => setShowPrint(false)

  const idVenta = venta.numero_completo ?? `#${venta.id.slice(0, 8).toUpperCase()}`
  const esTicket = venta.tipo_comprobante === 'ticket'
  const esBoletaFactura = venta.tipo_comprobante === 'boleta' || venta.tipo_comprobante === 'factura'
  const puedeReimprimir = (esTicket || esBoletaFactura) && (venta.estado === 'completada' || venta.estado === 'pendiente')
  const esAnulada = venta.estado === 'anulada'
  const esErrorSunat = venta.estado === 'error_sunat'
  const puedeEnviarManual = puedeEnviarSunat && esBoletaFactura && venta.estado === 'pendiente' && !venta.sunat_hash

  const ticketData: TicketReceiptData | null = puedeReimprimir
    ? {
        width: 80,
        tipoComprobante: venta.tipo_comprobante as RaTipoComprobante,
        empresa: {
          razonSocial: venta.empresa.razon_social ?? venta.empresa.nombre,
          ruc: venta.empresa.ruc ?? '',
          direccion: venta.empresa.direccion ?? '',
          telefono: venta.empresa.telefono ?? '',
        },
        sucursal: {
          nombre: venta.sucursal.nombre,
          direccion: venta.sucursal.direccion ?? '',
        },
        numeroCompleto: idVenta,
        serie: venta.serie,
        correlativo: venta.correlativo,
        fecha,
        moneda: venta.moneda,
        simbolo: simboloMoneda(venta.moneda),
        tipoCambio: venta.tipo_cambio,
        items: venta.items.map((i) => ({
          nombre: i.nombre_producto,
          cantidad: i.cantidad,
          precioUnitario: i.precio_unitario,
          descuento: i.descuento,
          subtotal: i.subtotal,
        })),
        subtotal: venta.subtotal,
        igv: venta.igv,
        total: venta.total,
        pagos: venta.pagos.map((p) => ({
          metodoPago: p.metodo_pago,
          monto: p.monto,
          referencia: p.referencia,
        })),
        vuelto,
        cliente:
          venta.cliente_nombre && venta.cliente_nombre !== 'Consumidor Final'
            ? {
                nombre: venta.cliente_nombre,
                tipoDocumento: venta.cliente_tipo_documento ?? '',
                nroDocumento: venta.cliente_nro_documento ?? '',
              }
            : undefined,
        sunatHash: venta.sunat_hash ?? null,
      }
    : null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Print overlay */}
      {showPrint && ticketData && (
        <TicketPrintPortal data={ticketData} onClose={handleCerrarPrint} />
      )}

      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b"
        style={{ borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
      >
        <Link
          href="/tablet/ventas"
          className="flex items-center justify-center w-9 h-9 rounded-xl"
          style={{ backgroundColor: '#F3F4F6' }}
        >
          <ArrowLeft size={18} style={{ color: '#374151' }} />
        </Link>
        <div className="flex-1">
          <h2 className="text-base font-bold" style={{ color: '#002D62' }}>
            {idVenta}
          </h2>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {fecha.toLocaleDateString('es-PE')}{' '}
            {fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <span
          className="px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: estadoCfg.bg, color: estadoCfg.text }}
        >
          {estadoCfg.label}
        </span>
      </div>

      {/* Meta */}
      <div className="px-4 py-3 border-b space-y-2" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5" style={{ color: '#6B7280' }}>
            <Receipt size={14} />
            {COMPROBANTE_LABELS[venta.tipo_comprobante] ?? venta.tipo_comprobante}
          </span>
          {venta.cliente_nombre && (
            <span className="flex items-center gap-1.5" style={{ color: '#6B7280' }}>
              <User size={14} />
              {venta.cliente_nombre}
            </span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="px-4 pt-4">
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>
          Productos ({venta.items.length})
        </h3>
        <div className="space-y-2">
          {venta.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between py-2 border-b"
              style={{ borderColor: '#F3F4F6' }}
            >
              <div className="flex-1 min-w-0 pr-4">
                <p className="text-sm font-semibold leading-snug" style={{ color: '#111827' }}>
                  {item.nombre_producto}
                </p>
                {item.codigo_oem && (
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>
                    {item.codigo_oem}
                  </p>
                )}
                <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                  {item.cantidad} × {simboloMoneda(venta.moneda)} {item.precio_unitario.toFixed(2)}
                  {item.descuento > 0 &&
                    ` − ${simboloMoneda(venta.moneda)} ${item.descuento.toFixed(2)}`}
                </p>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: '#002D62' }}>
                {simboloMoneda(venta.moneda)} {item.subtotal.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-2xl p-4 space-y-2" style={{ backgroundColor: '#F0F4FF' }}>
          <div className="flex justify-between text-sm" style={{ color: '#6B7280' }}>
            <span>Subtotal</span>
            <span>
              {simboloMoneda(venta.moneda)} {venta.subtotal.toFixed(2)}
            </span>
          </div>
          {venta.igv > 0 && (
            <div className="flex justify-between text-sm" style={{ color: '#6B7280' }}>
              <span>IGV (18%)</span>
              <span>
                {simboloMoneda(venta.moneda)} {venta.igv.toFixed(2)}
              </span>
            </div>
          )}
          <div
            className="flex justify-between text-lg font-bold border-t pt-2"
            style={{ borderColor: '#C7D2FE', color: '#002D62' }}
          >
            <span>Total</span>
            <span>
              {simboloMoneda(venta.moneda)} {venta.total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Pagos */}
      <div className="px-4 pt-2 pb-6">
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#374151' }}>
          Pagos recibidos
        </h3>
        <div className="space-y-2">
          {venta.pagos.map((pago) => (
            <div
              key={pago.id}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ backgroundColor: '#F9FAFB', border: '1px solid #E5E7EB' }}
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold" style={{ color: '#374151' }}>
                  {METODO_LABELS[pago.metodo_pago] ?? pago.metodo_pago}
                </span>
                {pago.referencia && (
                  <span className="text-xs" style={{ color: '#9CA3AF' }}>
                    ref: {pago.referencia}
                  </span>
                )}
              </div>
              <span className="text-sm font-bold" style={{ color: '#059669' }}>
                {simboloMoneda(venta.moneda)} {pago.monto.toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Vuelto recomputado */}
        {vuelto > 0 && (
          <div className="mt-3 rounded-2xl p-4" style={{ backgroundColor: '#F0FDF4' }}>
            <div className="flex justify-between text-lg font-bold" style={{ color: '#059669' }}>
              <span>Vuelto</span>
              <span>
                {simboloMoneda(venta.moneda)} {vuelto.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Botones de acción */}
        {!esAnulada && (
          <div className="mt-4 space-y-2">
            {puedeReimprimir && (
              <button
                onClick={handleReimprimir}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
                style={{ backgroundColor: '#002D62', color: '#FFD700' }}
              >
                <Printer size={16} />
                {esTicket ? 'Reimprimir ticket' : 'Imprimir / Reimprimir'}
              </button>
            )}
            {puedeEnviarManual && (
              <form
                action={enviarFormAction}
                onSubmit={(event) => {
                  if (!window.confirm(`¿Enviar ${idVenta} a OSE/SUNAT ahora?`)) event.preventDefault()
                }}
              >
                <input type="hidden" name="venta_id" value={venta.id} />
                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ backgroundColor: '#059669', color: '#FFFFFF' }}
                >
                  <Send size={16} />
                  {enviando ? 'Enviando a OSE/SUNAT...' : 'Enviar a OSE/SUNAT'}
                </button>
              </form>
            )}
            {envioState.message && (
              <p
                className="text-sm text-center"
                style={{
                  color: envioState.tone === 'success' ? '#059669' : envioState.tone === 'error' ? '#DC2626' : '#D97706',
                }}
              >
                {envioState.message}
              </p>
            )}
            {puedeReimprimir && esBoletaFactura && !venta.sunat_hash && (
              <p className="text-sm text-center" style={{ color: '#D97706' }}>
                El comprobante se imprime sin QR hasta que SUNAT confirme la emisión.
              </p>
            )}
            {esErrorSunat && (
              <p className="text-sm text-center" style={{ color: '#DC2626' }}>
                No hay documento legal disponible para esta venta.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
