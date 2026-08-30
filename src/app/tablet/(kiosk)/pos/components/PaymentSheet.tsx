'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { Plus, Minus, Trash2, CheckCircle, Search, UserCheck, UserX, X, AlertTriangle } from 'lucide-react'
import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { usePosStore, type CartItem } from '@/app/tablet/stores/posStore'
import { consultarResultadoVenta, procesarVenta, type VentaResult } from '../actions'
import { buscarClientes } from '../../clientes/actions'
import type { ClienteResumen } from '../../clientes/actions'
import { getVentaDetalle } from '../../ventas/actions'
import type { VentaDetalle as VentaDetalleType } from '../../ventas/actions'
import { calcularTotalesVenta } from '@/lib/calc/totales'
import type { RaMetodoPago, RaMoneda, RaTipoComprobante } from '@/lib/types/database'
import { simboloMoneda } from '@/lib/calc/moneda'
import { MonedaSelector } from './MonedaSelector'
import type { TicketReceiptData } from '@/app/tablet/components/ticket/TicketReceipt'
import { TicketPrintPortal } from '@/app/tablet/components/ticket/TicketPrintPortal'
import { Decimal } from 'decimal.js'
import {
  clearPendingSale,
  loadPendingSale,
  markPendingSaleUnknown,
  savePendingSale,
  type PendingSaleAttemptV1,
} from '@/lib/ventas/pendingSale'

const METODOS: { value: RaMetodoPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'yape', label: 'Yape' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'credito', label: 'Crédito' },
]

const COMPROBANTES: { value: RaTipoComprobante; label: string }[] = [
  { value: 'ticket', label: 'Ticket' },
  { value: 'boleta', label: 'Boleta' },
  { value: 'factura', label: 'Factura' },
]

const METODOS_CON_REFERENCIA = new Set<RaMetodoPago>(['yape', 'tarjeta', 'transferencia'])

type Props = {
  onClose: () => void
}

type LineaPago = {
  metodoPago: RaMetodoPago
  monto: string
  referencia: string
}

// Precio de lista del ítem en la moneda dada — la referencia que nunca se edita.
function precioDeLista(item: CartItem, moneda: RaMoneda): number | null {
  return moneda === 'USD' ? item.precioDolar : item.precioMinorista
}

export function PaymentSheet({ onClose }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [avisoCredito, setAvisoCredito] = useState<string | null>(null)
  const [ventaResultState, setVentaResultState] = useState<VentaResult | null>(null)
  const [ventaDetalleState, setVentaDetalleState] = useState<VentaDetalleType | null>(null)
  const [operationId, setOperationId] = useState(() => crypto.randomUUID())
  const [isPrinting, setIsPrinting] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [lineas, setLineas] = useState<LineaPago[]>([{ metodoPago: 'efectivo', monto: '', referencia: '' }])
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [clienteQuery, setClienteQuery] = useState('')
  const [clienteResults, setClienteResults] = useState<ClienteResumen[]>([])
  const [isSearchingCliente, setIsSearchingCliente] = useState(false)
  const [showClienteSearch, setShowClienteSearch] = useState(false)
  // Moneda es una decisión exclusiva de este modal — vive y muere con él.
  // Local en vez de global: al cerrar sin confirmar, no queda ningún estado
  // "pegado" que otra pantalla (carrito, botón flotante) pueda leer por error.
  const [moneda, setMonedaState] = useState<RaMoneda>('PEN')
  const [tipoCambio, setTipoCambio] = useState<number | null>(null)
  // Precio unitario editado por línea, en la moneda actualmente seleccionada
  // (productoId -> precio editado). El precio de lista (CartItem.precioMinorista/
  // precioDolar) nunca se toca — esto es un valor aparte, igual que FastERP
  // separa precioVenta (editable) de precioLista (intacto).
  const [preciosEditados, setPreciosEditados] = useState<Record<string, number>>({})

  // Una edición hecha en una moneda no tiene traducción a la otra (no hay
  // conversión automática) — al cambiar de moneda, se descartan las ediciones.
  const setMoneda = (m: RaMoneda) => {
    setMonedaState(m)
    setPreciosEditados({})
  }

  const tipoComprobante = usePosStore((s) => s.tipoComprobante)
  const setTipoComprobante = usePosStore((s) => s.setTipoComprobante)
  const items = usePosStore((s) => s.items)
  const updateCantidad = usePosStore((s) => s.updateCantidad)
  const resetPosState = usePosStore((s) => s.resetPosState)
  const userId = usePosStore((s) => s.userId)
  const empresaId = usePosStore((s) => s.empresaId)

  useEffect(() => {
    if (!userId || !empresaId) return
    const pending = loadPendingSale(userId, empresaId)
    if (!pending) return
    void Promise.resolve().then(() => setOperationId(pending.operationId))
    void consultarResultadoVenta(pending.operationId).then((result) => {
      if (!result.data) return
      setVentaResultState(result.data)
      setAvisoCredito(result.data.avisoCredito)
      setSuccess(true)
      clearPendingSale(userId, empresaId)
    })
  }, [userId, empresaId])
  const cliente = usePosStore((s) => s.cliente)
  const setCliente = usePosStore((s) => s.setCliente)
  const simbolo = simboloMoneda(moneda)
  const tipoCambioInvalido = moneda === 'USD' && (!tipoCambio || tipoCambio <= 0)

  // Productos sin precio en dólares: si el cajero elige USD con esto en el carrito,
  // se bloquea el cobro en vez de dejar que el cálculo explote.
  const itemsSinDolar = useMemo(
    () => (moneda === 'USD' ? items.filter((i) => i.precioDolar == null) : []),
    [items, moneda]
  )

  // El precio editado se traduce a un descuento por línea (precioLista - precioEditado) * cantidad
  // — mismo patrón que FastERP: el precio final es lo que edita el cajero, el descuento es derivado.
  const itemsConDescuento = useMemo(
    () =>
      items.map((item) => {
        const lista = precioDeLista(item, moneda)
        const editado = preciosEditados[item.productoId]
        if (lista == null || editado == null) return item
        const descuentoUnit = Math.max(0, lista - editado)
        return { ...item, descuento: descuentoUnit * item.cantidad }
      }),
    [items, moneda, preciosEditados]
  )

  const totales = useMemo(
    () =>
      itemsSinDolar.length === 0
        ? calcularTotalesVenta(itemsConDescuento, tipoComprobante, moneda)
        : null,
    [itemsConDescuento, tipoComprobante, moneda, itemsSinDolar]
  )

  // Resync first linea cuando cambia el total (comprobante, moneda o precios editados cambian el monto a cobrar)
  useEffect(() => {
    if (!totales) return
    setLineas([{ metodoPago: 'efectivo', monto: totales.total.toFixed(2), referencia: '' }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totales?.total])

  useEffect(() => {
    if (!clienteQuery.trim()) {
      setClienteResults([])
      return
    }
    const timer = setTimeout(async () => {
      setIsSearchingCliente(true)
      const { data } = await buscarClientes(clienteQuery)
      setClienteResults(data ?? [])
      setIsSearchingCliente(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [clienteQuery])

  const totalPagado = lineas.reduce((acc, l) => {
    const n = parseFloat(l.monto) || 0
    return acc.plus(n)
  }, new Decimal(0))
  const vuelto = totales ? totalPagado.minus(totales.total) : new Decimal(0)

  const tieneLineaCredito = lineas.some((l) => l.metodoPago === 'credito')
  const creditoInvalido = tieneLineaCredito && (!cliente || cliente.tiene_credito === false)
  const hoy = useMemo(() => new Date().toISOString().split('T')[0], [])
  const montoLineaCredito = lineas
    .filter((l) => l.metodoPago === 'credito')
    .reduce((acc, l) => acc + (parseFloat(l.monto) || 0), 0)
  const limiteExcedido =
    tieneLineaCredito &&
    !!cliente &&
    cliente.tiene_credito &&
    montoLineaCredito > 0 &&
    cliente.saldo_deudor + montoLineaCredito > cliente.limite_credito

  const addLinea = () =>
    setLineas((prev) => [...prev, { metodoPago: 'efectivo', monto: '', referencia: '' }])

  const removeLinea = (idx: number) =>
    setLineas((prev) => prev.filter((_, i) => i !== idx))

  const updateLinea = (idx: number, field: keyof LineaPago, value: string) =>
    setLineas((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    )

  const updatePrecioEditado = (productoId: string, value: string) =>
    setPreciosEditados((prev) => {
      if (value === '') {
        const { [productoId]: _omit, ...rest } = prev
        return rest
      }
      const n = parseFloat(value)
      if (isNaN(n) || n < 0) return prev
      return { ...prev, [productoId]: n }
    })

  const handleConfirm = () => {
    if (!totales) return
    setError(null)
    const pagoSinReferencia = lineas.some(
      (linea) =>
        METODOS_CON_REFERENCIA.has(linea.metodoPago) &&
        (parseFloat(linea.monto) || 0) > 0 &&
        !linea.referencia.trim()
    )
    if (pagoSinReferencia) {
      setError('Registra el número de operación o voucher de cada pago digital.')
      return
    }
    startTransition(async () => {
      const pagosValidos = lineas
        .map((l) => ({
          metodoPago: l.metodoPago,
          monto: parseFloat(l.monto) || 0,
          referencia: l.referencia.trim() || undefined,
        }))
        .filter((p) => p.monto > 0)

      const payload = {
        operationId,
        tipoComprobante,
        clienteId: cliente?.id ?? null,
        items: itemsConDescuento.map((i) => ({
          productoId: i.productoId,
          catalogoId: i.catalogoId,
          cantidad: i.cantidad,
          descuento: i.descuento,
        })),
        pagos: pagosValidos,
        moneda,
        tipoCambio: moneda === 'USD' ? tipoCambio : null,
        fechaVencimiento: tieneLineaCredito ? fechaVencimiento || null : null,
      }
      const attempt: PendingSaleAttemptV1<typeof payload> | null = userId && empresaId
        ? { version: 1, operationId, userId, empresaId, createdAt: new Date().toISOString(), payload, state: 'sending' }
        : null
      if (attempt) savePendingSale(attempt)
      const result = await procesarVenta(payload)

      if (result.error) {
        if (attempt && result.error.includes('Conservamos el intento')) {
          markPendingSaleUnknown(attempt)
        } else if (userId && empresaId) {
          clearPendingSale(userId, empresaId)
          setOperationId(crypto.randomUUID())
        }
        setError(result.error)
        return
      }

      if (userId && empresaId) clearPendingSale(userId, empresaId)

      setSuccess(true)
      const aviso = result.data?.avisoCredito ?? null
      setAvisoCredito(aviso)
      if (result.data) {
        setVentaResultState(result.data)
      }
    })
  }

  const handleCerrarConAviso = () => {
    resetPosState()
    onClose()
  }

  const handleImprimir = () => {
    setShowPrint(true)
  }

  const handleImprimirBoletaFactura = async () => {
    if (!ventaResultState) return
    setIsPrinting(true)
    try {
      const { data } = await getVentaDetalle(ventaResultState.id)
      if (data) setVentaDetalleState(data)
    } finally {
      setIsPrinting(false)
    }
    setShowPrint(true)
  }

  const handleCerrarPrint = () => {
    setShowPrint(false)
  }

  if (success && totales) {
    const ticketData: TicketReceiptData | null = ventaResultState
      ? {
          width: 80,
          tipoComprobante,
          empresa: {
            razonSocial: ventaResultState.empresa.razon_social ?? ventaResultState.empresa.ruc ?? '',
            ruc: ventaResultState.empresa.ruc ?? '',
            direccion: ventaResultState.empresa.direccion ?? '',
            telefono: ventaResultState.empresa.telefono ?? '',
          },
          sucursal: {
            nombre: ventaResultState.sucursal.nombre,
            direccion: ventaResultState.sucursal.direccion ?? '',
          },
          numeroCompleto: ventaResultState.numero_completo ?? '',
          serie: ventaResultState.serie,
          correlativo: ventaResultState.correlativo,
          fecha: new Date(),
          moneda: ventaResultState.moneda,
          simbolo,
          tipoCambio,
          items: totales.items.map((i) => ({
            nombre: i.nombre,
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            descuento: i.descuento,
            subtotal: i.subtotal,
          })),
          subtotal: totales.subtotal,
          igv: totales.igv,
          total: totales.total,
          pagos: lineas
            .filter((l) => (parseFloat(l.monto) || 0) > 0)
            .map((l) => ({
              metodoPago: l.metodoPago,
              monto: parseFloat(l.monto) || 0,
              referencia: l.referencia.trim() || null,
            })),
          vuelto: vuelto.toNumber(),
          cliente: cliente
            ? {
                nombre: cliente.nombre,
                tipoDocumento: cliente.tipo_documento ?? '',
                nroDocumento: cliente.nro_documento ?? '',
              }
            : undefined,
          sunatHash: ventaDetalleState?.sunat_hash ?? null,
        }
      : null

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      >
        {showPrint && ticketData ? (
          <TicketPrintPortal data={ticketData} onClose={handleCerrarPrint} />
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
              Total: {simbolo} {totales.total.toFixed(2)}
            </p>
            {avisoCredito ? (
              <>
                <div
                  className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                  role="alert"
                >
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>{avisoCredito}</span>
                </div>
                <button
                  onClick={handleCerrarConAviso}
                  className="px-6 py-3 rounded-xl text-sm font-bold"
                  style={{ backgroundColor: '#002D62', color: '#FFD700' }}
                >
                  Entendido, cerrar
                </button>
              </>
            ) : (
              <>
                {tipoComprobante === 'ticket' ? (
                  <div className="flex gap-3">
                    <button
                      onClick={handleImprimir}
                      className="px-6 py-3 rounded-xl text-sm font-bold"
                      style={{ backgroundColor: '#002D62', color: '#FFD700' }}
                    >
                      Imprimir
                    </button>
                    <button
                      onClick={handleCerrarConAviso}
                      className="px-6 py-3 rounded-xl text-sm font-bold border-2"
                      style={{ borderColor: '#002D62', color: '#002D62' }}
                    >
                      Cerrar
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-3">
                      <button
                        onClick={handleImprimirBoletaFactura}
                        disabled={isPrinting}
                        className="px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-60"
                        style={{ backgroundColor: '#002D62', color: '#FFD700' }}
                      >
                        {isPrinting ? 'Cargando...' : 'Imprimir'}
                      </button>
                      <button
                        onClick={handleCerrarConAviso}
                        className="px-6 py-3 rounded-xl text-sm font-bold border-2"
                        style={{ borderColor: '#002D62', color: '#002D62' }}
                      >
                        Cerrar
                      </button>
                    </div>
                    <p className="text-sm text-center" style={{ color: '#6B7280', maxWidth: 280 }}>
                      El documento legal se emite vía SUNAT. Si el QR aún no aparece, vuelve a imprimir desde el detalle de la venta.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <FormDialog title="Procesar cobro" onClose={onClose} size="xl">
      <div className="flex flex-col md:flex-row">
        {/* Columna izquierda: cliente, comprobante, pago */}
        <div className="flex-1 p-5 space-y-5 md:border-r" style={{ borderColor: '#E5E7EB' }}>
          {/* Moneda */}
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: '#374151' }}>
              Moneda
            </p>
            <MonedaSelector
              moneda={moneda}
              setMoneda={setMoneda}
              tipoCambio={tipoCambio}
              setTipoCambio={setTipoCambio}
            />
            {itemsSinDolar.length > 0 && (
              <div
                className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                role="alert"
              >
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <span>
                  Estos productos no tienen precio en dólares — quitalos del carrito o cobrá en soles:{' '}
                  {itemsSinDolar.map((i) => i.nombre).join(', ')}
                </span>
              </div>
            )}
          </div>

          {/* Cliente */}
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: '#374151' }}>
              Cliente <span style={{ color: '#9CA3AF', fontWeight: 400 }}>(opcional)</span>
            </p>

            {cliente ? (
              <div
                className="flex items-center justify-between rounded-xl px-4 py-3"
                style={{ backgroundColor: '#F0F4FF', border: '2px solid #002D62' }}
              >
                <div className="flex items-center gap-3">
                  <UserCheck size={18} style={{ color: '#002D62' }} />
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#002D62' }}>
                      {cliente.nombre}
                    </p>
                    {cliente.nro_documento && (
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        {cliente.tipo_documento} {cliente.nro_documento}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => { setCliente(null); setShowClienteSearch(false); setClienteQuery('') }}
                  className="p-1 rounded-lg"
                  style={{ color: '#6B7280' }}
                  aria-label="Quitar cliente"
                >
                  <UserX size={18} />
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {!showClienteSearch ? (
                  <button
                    onClick={() => setShowClienteSearch(true)}
                    className="flex items-center gap-2 w-full rounded-xl border-2 border-dashed px-4 py-3 text-sm font-medium"
                    style={{ borderColor: '#D1D5DB', color: '#6B7280' }}
                  >
                    <Search size={16} />
                    Buscar cliente...
                  </button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type="text"
                        placeholder="Nombre o documento..."
                        value={clienteQuery}
                        onChange={(e) => setClienteQuery(e.target.value)}
                        className="flex-1 rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
                        style={{ borderColor: '#D1D5DB' }}
                      />
                      <button
                        onClick={() => { setShowClienteSearch(false); setClienteQuery(''); setClienteResults([]) }}
                        className="px-3 rounded-xl text-sm"
                        style={{ backgroundColor: '#F3F4F6', color: '#374151' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {isSearchingCliente && (
                      <p className="text-xs px-1" style={{ color: '#9CA3AF' }}>Buscando...</p>
                    )}
                    {clienteResults.length > 0 && (
                      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                        {clienteResults.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setCliente({
                                id: c.id,
                                nombre: c.nombre,
                                tipo_documento: c.tipo_documento ?? null,
                                nro_documento: c.nro_documento ?? null,
                                tipo_cliente: c.tipo_cliente,
                                tiene_credito: c.tiene_credito,
                                limite_credito: c.limite_credito,
                                saldo_deudor: c.saldo_deudor,
                              })
                              setShowClienteSearch(false)
                              setClienteQuery('')
                              setClienteResults([])
                            }}
                            className="flex items-center justify-between w-full px-4 py-3 text-left text-sm border-b last:border-b-0 hover:bg-gray-50"
                            style={{ borderColor: '#F3F4F6' }}
                          >
                            <span className="font-medium" style={{ color: '#111827' }}>{c.nombre}</span>
                            {c.nro_documento && (
                              <span className="text-xs" style={{ color: '#9CA3AF' }}>
                                {c.tipo_documento} {c.nro_documento}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                    {!isSearchingCliente && clienteQuery.trim() && clienteResults.length === 0 && (
                      <p className="text-xs px-1" style={{ color: '#9CA3AF' }}>Sin resultados</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tipo de comprobante */}
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: '#374151' }}>
              Tipo de comprobante
            </p>
            <div className="flex gap-2">
              {COMPROBANTES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTipoComprobante(value)}
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

          {/* Resumen */}
          {totales && (
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
          )}

          {/* Métodos de pago */}
          <div className="space-y-3">
            <p className="text-sm font-semibold" style={{ color: '#374151' }}>
              Métodos de pago
            </p>
            {lineas.map((linea, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex gap-2 items-center">
                  <select
                    value={linea.metodoPago}
                    onChange={(e) => updateLinea(idx, 'metodoPago', e.target.value)}
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
                    onChange={(e) => updateLinea(idx, 'monto', e.target.value)}
                    placeholder="0.00"
                    className="w-32 rounded-xl border-2 px-3 py-3 text-sm font-bold outline-none"
                    style={{ borderColor: '#D1D5DB' }}
                  />
                  {lineas.length > 1 && (
                    <button
                      onClick={() => removeLinea(idx)}
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
                      onChange={(e) => updateLinea(idx, 'referencia', e.target.value)}
                      placeholder={linea.metodoPago === 'tarjeta' ? 'Voucher del POS, no número de tarjeta' : 'N.º de operación'}
                      className="w-full rounded-xl border-2 px-3 py-2 text-sm outline-none"
                      style={{ borderColor: '#D1D5DB' }}
                    />
                  </div>
                )}
              </div>
            ))}
            <button
              onClick={addLinea}
              className="flex items-center gap-2 text-sm font-semibold"
              style={{ color: '#002D62' }}
            >
              <Plus size={16} />
              Agregar otro método
            </button>
          </div>

          {/* Vencimiento (solo ventas a crédito) */}
          {tieneLineaCredito && (
            <div className="space-y-2">
              <p className="text-sm font-semibold" style={{ color: '#374151' }}>
                Fecha de vencimiento
              </p>
              <input
                type="date"
                min={hoy}
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                className="w-full rounded-xl border-2 px-4 py-3 text-sm outline-none focus:border-[#002D62]"
                style={{ borderColor: '#D1D5DB' }}
              />
              {creditoInvalido && (
                <div
                  className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
                  role="alert"
                >
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>Selecciona un cliente con crédito habilitado para vender a crédito.</span>
                </div>
              )}
              {limiteExcedido && (
                <div
                  className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium"
                  style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
                  role="alert"
                >
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <span>Esta venta hará que el saldo del cliente supere su límite de crédito.</span>
                </div>
              )}
            </div>
          )}

          {/* Vuelto */}
          {totales && vuelto.gt(0) && (
            <div className="rounded-2xl p-4" style={{ backgroundColor: '#F0FDF4' }}>
              <div className="flex justify-between text-lg font-bold" style={{ color: '#059669' }}>
                <span>Vuelto</span>
                <span>{simbolo} {vuelto.toDecimalPlaces(2).toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
              role="alert"
            >
              {error}
            </div>
          )}

          {tipoCambioInvalido && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
              role="alert"
            >
              Ingresá un tipo de cambio válido (mayor a 0) para continuar.
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleConfirm}
            disabled={
              isPending ||
              !totales ||
              tipoCambioInvalido ||
              creditoInvalido ||
              (tieneLineaCredito && !fechaVencimiento) ||
              totalPagado.lt((totales?.total ?? 0) - 0.01)
            }
            className="w-full py-5 rounded-xl text-lg font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            {isPending ? 'Procesando...' : totales ? `COBRAR ${simbolo} ${totales.total.toFixed(2)}` : 'COBRAR'}
          </button>
        </div>

        {/* Columna derecha: productos, cantidad y precio editables */}
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
                      onClick={() => updateCantidad(item.productoId, item.cantidad - 1)}
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
                      onClick={() => updateCantidad(item.productoId, item.cantidad + 1)}
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
                        <span
                          className="text-xs line-through"
                          style={{ color: '#9CA3AF' }}
                        >
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
                          onChange={(e) => updatePrecioEditado(item.productoId, e.target.value)}
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
      </div>
    </FormDialog>
  )
}
