'use client'

import Link from 'next/link'
import { ArrowLeft, User, Receipt } from 'lucide-react'
import type { VentaDetalle as VentaDetalleType } from '../../actions'

type Props = {
  venta: VentaDetalleType
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
}

export function VentaDetalle({ venta }: Props) {
  const estadoCfg = ESTADO_CONFIG[venta.estado] ?? ESTADO_CONFIG.pendiente
  const fecha = new Date(venta.created_at)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
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
            #{venta.id.slice(0, 8).toUpperCase()}
          </h2>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            {fecha.toLocaleDateString('es-PE')} {fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
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
                  {item.cantidad} × S/. {item.precio_unitario.toFixed(2)}
                  {item.descuento > 0 && ` − S/. ${item.descuento.toFixed(2)}`}
                </p>
              </div>
              <span className="text-sm font-bold shrink-0" style={{ color: '#002D62' }}>
                S/. {item.subtotal.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Totales */}
      <div className="px-4 pt-4 pb-2">
        <div
          className="rounded-2xl p-4 space-y-2"
          style={{ backgroundColor: '#F0F4FF' }}
        >
          <div className="flex justify-between text-sm" style={{ color: '#6B7280' }}>
            <span>Subtotal</span>
            <span>S/. {venta.subtotal.toFixed(2)}</span>
          </div>
          {venta.igv > 0 && (
            <div className="flex justify-between text-sm" style={{ color: '#6B7280' }}>
              <span>IGV (18%)</span>
              <span>S/. {venta.igv.toFixed(2)}</span>
            </div>
          )}
          <div
            className="flex justify-between text-lg font-bold border-t pt-2"
            style={{ borderColor: '#C7D2FE', color: '#002D62' }}
          >
            <span>Total</span>
            <span>S/. {venta.total.toFixed(2)}</span>
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
              <span className="text-sm font-semibold" style={{ color: '#374151' }}>
                {METODO_LABELS[pago.metodo_pago] ?? pago.metodo_pago}
              </span>
              {pago.referencia && (
                <span className="text-xs" style={{ color: '#9CA3AF' }}>
                  {pago.referencia}
                </span>
              )}
              <span className="text-sm font-bold" style={{ color: '#059669' }}>
                S/. {pago.monto.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
