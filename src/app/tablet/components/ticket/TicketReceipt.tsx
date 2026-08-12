'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { RaMoneda, RaTipoComprobante } from '@/lib/types/database'
import { armarQrSunat } from '@/lib/calc/qrSunat'

const METODO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  yape: 'Yape',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
}

export type TicketReceiptData = {
  width: 58 | 80
  tipoComprobante: RaTipoComprobante
  empresa: { razonSocial: string; ruc: string; direccion: string; telefono: string }
  sucursal: { nombre: string; direccion: string }
  numeroCompleto: string
  serie: string | null
  correlativo: number | null
  fecha: Date
  moneda: RaMoneda
  simbolo: string
  tipoCambio: number | null
  items: { nombre: string; cantidad: number; precioUnitario: number; descuento: number; subtotal: number }[]
  subtotal: number
  igv: number
  total: number
  pagos: { metodoPago: string; monto: number; referencia: string | null }[]
  vuelto: number
  cliente?: { nombre: string; tipoDocumento: string; nroDocumento: string }
  sunatHash?: string | null
}

const COMPROBANTE_TITULO: Record<string, string> = {
  ticket: 'TICKET',
  boleta: 'BOLETA DE VENTA',
  factura: 'FACTURA',
}

function truncar(nombre: string, width: 58 | 80): string {
  const max = width === 58 ? 32 : 42
  return nombre.length > max ? nombre.slice(0, max) + '\u2026' : nombre
}

function fmtFecha(fecha: Date): string {
  const d = fecha.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const h = fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  return `${d} ${h}`
}

function QrSunat({ value, size }: { value: string; size: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    QRCode.toDataURL(value, {
      width: size,
      margin: 0,
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (!cancelado) setDataUrl(url)
      })
      .catch((err) => {
        console.error('[QR] error generando QR SUNAT:', err)
      })
    return () => {
      cancelado = true
    }
  }, [value, size])

  if (!dataUrl) return null
  return <img src={dataUrl} alt="QR SUNAT" width={size} height={size} style={{ display: 'block', margin: '4px auto' }} />
}

export function TicketReceipt({ data }: { data: TicketReceiptData }) {
  const { width, empresa, sucursal, numeroCompleto, fecha, moneda, simbolo, tipoCambio } = data
  const mostrarIgv = data.igv > 0

  return (
    <div
      className="ticket-print-area"
      style={{
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 1.35,
        color: '#000',
        backgroundColor: '#fff',
        padding: '4mm 3mm',
        maxWidth: `${width}mm`,
        margin: '0 auto',
      }}
    >
      {/* ═══ Empresa ═══ */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{empresa.razonSocial}</div>
        <div>RUC {empresa.ruc}</div>
        <div style={{ fontSize: 11, color: '#444' }}>{empresa.direccion}</div>
        <div style={{ fontSize: 11, color: '#444' }}>Telf: {empresa.telefono}</div>
      </div>

      {/* ═══ Sucursal ═══ */}
      <div style={{ textAlign: 'center', marginBottom: 4, fontSize: 11 }}>
        {sucursal.nombre}{sucursal.direccion ? ` \u2014 ${sucursal.direccion}` : ''}
      </div>

      {/* ═══ Título del comprobante ═══ */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 14,
          margin: '2px 0',
        }}
      >
        {COMPROBANTE_TITULO[data.tipoComprobante] ?? data.tipoComprobante}
      </div>

      {/* ═══ Separador ═══ */}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* ═══ Fecha / N° Comprobante ═══ */}
      <div style={{ marginBottom: 4 }}>
        <div>{fmtFecha(fecha)}</div>
        <div style={{ fontWeight: 700 }}>{numeroCompleto}</div>
        {tipoCambio && <div style={{ fontSize: 10 }}>T.C. {simboloMonedaLocal('PEN')} {tipoCambio.toFixed(2)}</div>}
      </div>

      {/* ═══ Cliente receptor (siempre en boleta/factura; solo reprint en ticket) ═══ */}
      {data.cliente && (data.tipoComprobante !== 'ticket' || data.cliente.nombre !== 'Consumidor Final') && (
        <div style={{ marginBottom: 4 }}>
          <div>Cliente: {data.cliente.nombre}</div>
          {data.cliente.nroDocumento && (
            <div>
              {data.cliente.tipoDocumento}: {data.cliente.nroDocumento}
            </div>
          )}
        </div>
      )}

      {/* ═══ Separador ═══ */}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* ═══ Items ═══ */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #000', fontSize: 10 }}>
            <th style={{ textAlign: 'left', paddingBottom: 2 }}>Producto</th>
            <th style={{ textAlign: 'center', paddingBottom: 2, width: 30 }}>Cant</th>
            <th style={{ textAlign: 'right', paddingBottom: 2, width: 60 }}>P.Unit</th>
            <th style={{ textAlign: 'right', paddingBottom: 2, width: 58 }}>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, idx) => (
            <tr
              key={idx}
              style={{
                borderBottom: '1px dotted #ccc',
                fontSize: 11,
              }}
            >
              <td style={{ padding: '2px 0' }}>
                <div>{truncar(item.nombre, width)}</div>
                {item.descuento > 0 && (
                  <div style={{ fontSize: 9, color: '#555' }}>
                    Desc: {simbolo} {item.descuento.toFixed(2)}
                  </div>
                )}
              </td>
              <td style={{ textAlign: 'center', padding: '2px 0' }}>{item.cantidad}</td>
              <td style={{ textAlign: 'right', padding: '2px 0' }}>
                {simbolo} {item.precioUnitario.toFixed(2)}
              </td>
              <td style={{ textAlign: 'right', padding: '2px 0', fontWeight: 600 }}>
                {simbolo} {item.subtotal.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ═══ Separador ═══ */}
      <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />

      {/* ═══ Totales ═══ */}
      <div style={{ textAlign: 'right', marginBottom: 4 }}>
        <div style={{ fontSize: 11 }}>
          Subtotal: {simbolo} {data.subtotal.toFixed(2)}
        </div>
        {mostrarIgv && (
          <div style={{ fontSize: 11 }}>
            IGV (18%): {simbolo} {data.igv.toFixed(2)}
          </div>
        )}
        <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>
          TOTAL: {simbolo} {data.total.toFixed(2)}
        </div>
      </div>

      {/* ═══ Pagos ═══ */}
      <div style={{ borderTop: '1px solid #000', paddingTop: 4, marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>Pagos:</div>
        {data.pagos.map((p, idx) => (
          <div key={idx} style={{ fontSize: 11 }}>
            {METODO_LABELS[p.metodoPago] ?? p.metodoPago}
            {p.referencia ? ` ref: ${p.referencia}` : ''}
            {' \u2014 '}
            {simbolo} {p.monto.toFixed(2)}
          </div>
        ))}
      </div>

      {/* ═══ Vuelto ═══ */}
      {data.vuelto > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontWeight: 700,
            fontSize: 13,
            margin: '4px 0',
            padding: '4px 0',
            borderTop: '1px solid #000',
            borderBottom: '1px solid #000',
          }}
        >
          Vuelto: {simbolo} {data.vuelto.toFixed(2)}
        </div>
      )}

      {/* ═══ QR SUNAT (boleta/factura con hash y serie/correlativo) ═══ */}
      {data.tipoComprobante !== 'ticket' && data.sunatHash && data.serie && data.correlativo && (
        <>
          <div style={{ borderTop: '1px solid #000', paddingTop: 4 }}>
            <QrSunat
              size={width === 58 ? 90 : 120}
              value={armarQrSunat({
                rucEmisor: empresa.ruc,
                tipoComprobante: data.tipoComprobante,
                serie: data.serie,
                correlativo: data.correlativo,
                igv: data.igv,
                monto: data.total,
                fecha: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`,
                tipoDocumento: data.cliente?.tipoDocumento ?? null,
                nroDocumento: data.cliente?.nroDocumento ?? null,
                hash: data.sunatHash,
              })}
            />
          </div>
          <div style={{ textAlign: 'center', fontSize: 9, color: '#444', marginBottom: 4 }}>
            Representación impresa de la {COMPROBANTE_TITULO[data.tipoComprobante].toLowerCase()} electrónica.
          </div>
        </>
      )}

      {/* ═══ Footer ═══ */}
      <div style={{ textAlign: 'center', fontSize: 10, marginTop: 6, color: '#555' }}>
        <div>Gracias por su compra</div>
        <div>{empresa.razonSocial}</div>
      </div>
    </div>
  )
}

function simboloMonedaLocal(moneda: RaMoneda): string {
  return moneda === 'USD' ? '$' : 'S/.'
}
