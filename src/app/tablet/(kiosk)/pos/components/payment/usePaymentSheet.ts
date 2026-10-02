import { useEffect, useMemo, useState, useTransition } from 'react'
import { usePosStore } from '@/app/tablet/stores/posStore'
import { calcularTotalesVenta } from '@/lib/calc/totales'
import { simboloMoneda } from '@/lib/calc/moneda'
import type { RaMoneda } from '@/lib/types/database'
import {
  clearPendingSale,
  loadPendingSale,
  markPendingSaleUnknown,
  savePendingSale,
  type PendingSaleAttemptV1,
} from '@/lib/ventas/pendingSale'
import { consultarResultadoVenta, procesarVenta, type VentaResult } from '../../actions'
import { getVentaDetalle, type VentaDetalle } from '../../../ventas/actions'
import { useClienteSelector } from './useClienteSelector'
import {
  MENSAJE_SIN_REFERENCIA,
  actualizarLinea,
  actualizarPrecioEditado,
  aplicarPreciosEditados,
  construirPayloadVenta,
  construirTicketData,
  crearLineaVacia,
  esCreditoInvalido,
  esIntentoConservado,
  hayPagoSinReferencia,
  itemsSinPrecioDolar,
  limiteCreditoExcedido,
  lineasParaTotal,
  pagoCubreTotal,
  tieneCredito,
  tipoCambioEsInvalido,
  totalPagadoDeLineas,
  vueltoDeLineas,
  type LineaPago,
  type VentaPayload,
} from './logic'

/** Estado, cálculos derivados y handlers del modal de cobro. */
export function usePaymentSheet(onClose: () => void) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [avisoCredito, setAvisoCredito] = useState<string | null>(null)
  const [ventaResult, setVentaResult] = useState<VentaResult | null>(null)
  const [ventaDetalle, setVentaDetalle] = useState<VentaDetalle | null>(null)
  const [operationId, setOperationId] = useState(() => crypto.randomUUID())
  const [isPrinting, setIsPrinting] = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [lineas, setLineas] = useState<LineaPago[]>([crearLineaVacia()])
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [numeroPlaca, setNumeroPlaca] = useState('')
  // Moneda es una decisión exclusiva de este modal — vive y muere con él.
  // Local en vez de global: al cerrar sin confirmar, no queda ningún estado
  // "pegado" que otra pantalla (carrito, botón flotante) pueda leer por error.
  const [moneda, setMonedaState] = useState<RaMoneda>('PEN')
  const [tipoCambio, setTipoCambio] = useState<number | null>(null)
  // Precio unitario editado por línea (productoId -> precio), en la moneda actual.
  // El precio de lista nunca se toca — esto es un valor aparte.
  const [preciosEditados, setPreciosEditados] = useState<Record<string, number>>({})
  const [totalSincronizado, setTotalSincronizado] = useState<number | undefined>(undefined)

  const tipoComprobante = usePosStore((s) => s.tipoComprobante)
  const setTipoComprobante = usePosStore((s) => s.setTipoComprobante)
  const items = usePosStore((s) => s.items)
  const updateCantidad = usePosStore((s) => s.updateCantidad)
  const resetPosState = usePosStore((s) => s.resetPosState)
  const userId = usePosStore((s) => s.userId)
  const empresaId = usePosStore((s) => s.empresaId)
  const cliente = usePosStore((s) => s.cliente)
  const setCliente = usePosStore((s) => s.setCliente)

  const clienteSelector = useClienteSelector(setError)

  // Una edición hecha en una moneda no tiene traducción a la otra (no hay
  // conversión automática) — al cambiar de moneda, se descartan las ediciones.
  const setMoneda = (m: RaMoneda) => {
    setMonedaState(m)
    setPreciosEditados({})
  }

  // Recupera un intento de venta pendiente (mismo operationId) y consulta su resultado.
  useEffect(() => {
    if (!userId || !empresaId) return
    const pending = loadPendingSale(userId, empresaId)
    if (!pending) return
    void Promise.resolve().then(() => setOperationId(pending.operationId))
    void consultarResultadoVenta(pending.operationId).then((result) => {
      if (!result.data) return
      setVentaResult(result.data)
      setAvisoCredito(result.data.avisoCredito)
      setSuccess(true)
      clearPendingSale(userId, empresaId)
    })
  }, [userId, empresaId])

  const simbolo = simboloMoneda(moneda)
  const tipoCambioInvalido = tipoCambioEsInvalido(moneda, tipoCambio)

  // Productos sin precio en dólares: si el cajero elige USD con esto en el carrito,
  // se bloquea el cobro en vez de dejar que el cálculo explote.
  const itemsSinDolar = useMemo(() => itemsSinPrecioDolar(items, moneda), [items, moneda])

  const itemsConDescuento = useMemo(
    () => aplicarPreciosEditados(items, moneda, preciosEditados),
    [items, moneda, preciosEditados]
  )

  const totales = useMemo(
    () =>
      itemsSinDolar.length === 0
        ? calcularTotalesVenta(itemsConDescuento, tipoComprobante, moneda)
        : null,
    [itemsConDescuento, tipoComprobante, moneda, itemsSinDolar]
  )

  // Resync de las líneas cuando cambia el total (comprobante, moneda o precios
  // editados cambian el monto a cobrar). Ajuste durante el render, sin efecto.
  const totalActual = totales?.total
  if (totalActual !== totalSincronizado) {
    setTotalSincronizado(totalActual)
    if (totales) setLineas(lineasParaTotal(totales.total))
  }

  const totalPagado = totalPagadoDeLineas(lineas)
  const vuelto = totales ? vueltoDeLineas(lineas, totales.total) : 0
  const conCredito = tieneCredito(lineas)
  const creditoInvalido = esCreditoInvalido(lineas, cliente)
  const limiteExcedido = limiteCreditoExcedido(lineas, cliente)
  const hoy = useMemo(() => new Date().toISOString().split('T')[0], [])

  const puedeCobrar =
    !isPending &&
    !!totales &&
    !tipoCambioInvalido &&
    !creditoInvalido &&
    !(conCredito && !fechaVencimiento) &&
    pagoCubreTotal(totalPagado, totales?.total ?? 0)

  const addLinea = () => setLineas((prev) => [...prev, crearLineaVacia()])
  const removeLinea = (idx: number) => setLineas((prev) => prev.filter((_, i) => i !== idx))
  const updateLinea = (idx: number, field: keyof LineaPago, value: string) =>
    setLineas((prev) => actualizarLinea(prev, idx, field, value))
  const updatePrecioEditado = (productoId: string, value: string) =>
    setPreciosEditados((prev) => actualizarPrecioEditado(prev, productoId, value))

  const handleConfirm = () => {
    if (!totales) return
    setError(null)
    if (hayPagoSinReferencia(lineas)) {
      setError(MENSAJE_SIN_REFERENCIA)
      return
    }
    startTransition(async () => {
      const payload = construirPayloadVenta({
        operationId,
        tipoComprobante,
        cliente,
        itemsConDescuento,
        lineas,
        moneda,
        tipoCambio,
        fechaVencimiento,
        numeroPlaca,
      })
      const attempt: PendingSaleAttemptV1<VentaPayload> | null =
        userId && empresaId
          ? {
              version: 1,
              operationId,
              userId,
              empresaId,
              createdAt: new Date().toISOString(),
              payload,
              state: 'sending',
            }
          : null
      if (attempt) savePendingSale(attempt)
      const result = await procesarVenta(payload)

      if (result.error) {
        if (attempt && esIntentoConservado(result.error)) {
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
      setAvisoCredito(result.data?.avisoCredito ?? null)
      if (result.data) setVentaResult(result.data)
    })
  }

  const handleCerrarConAviso = () => {
    resetPosState()
    onClose()
  }

  const handleImprimir = () => setShowPrint(true)

  const handleImprimirBoletaFactura = async () => {
    if (!ventaResult) return
    setIsPrinting(true)
    try {
      const { data, error: detalleError } = await getVentaDetalle(ventaResult.id)
      if (detalleError) {
        // Sin el detalle no hay hash SUNAT: se avisa y el cajero reintenta.
        setError(detalleError)
        return
      }
      if (data) setVentaDetalle(data)
    } finally {
      setIsPrinting(false)
    }
    setError(null)
    setShowPrint(true)
  }

  const handleCerrarPrint = () => setShowPrint(false)

  const ticketData =
    success && ventaResult && totales
      ? construirTicketData({
          venta: ventaResult,
          tipoComprobante,
          simbolo,
          tipoCambio,
          totales,
          lineas,
          vuelto,
          cliente,
          sunatHash: ventaDetalle?.sunat_hash ?? null,
          fecha: new Date(),
        })
      : null

  return {
    // estado de la venta
    isPending,
    error,
    success,
    avisoCredito,
    isPrinting,
    showPrint,
    ticketData,
    // moneda y precios
    moneda,
    setMoneda,
    tipoCambio,
    setTipoCambio,
    simbolo,
    tipoCambioInvalido,
    itemsSinDolar,
    items,
    preciosEditados,
    updatePrecioEditado,
    updateCantidad,
    totales,
    // comprobante
    tipoComprobante,
    setTipoComprobante,
    numeroPlaca,
    setNumeroPlaca,
    // cliente
    cliente,
    setCliente,
    clienteSelector,
    // pagos
    lineas,
    addLinea,
    removeLinea,
    updateLinea,
    vuelto,
    conCredito,
    creditoInvalido,
    limiteExcedido,
    fechaVencimiento,
    setFechaVencimiento,
    hoy,
    puedeCobrar,
    // acciones
    handleConfirm,
    handleCerrarConAviso,
    handleImprimir,
    handleImprimirBoletaFactura,
    handleCerrarPrint,
  }
}

export type PaymentSheetState = ReturnType<typeof usePaymentSheet>
