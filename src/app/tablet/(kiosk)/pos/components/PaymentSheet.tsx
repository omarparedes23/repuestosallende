'use client'

import { FormDialog } from '@/app/tablet/components/shared/FormDialog'
import { MonedaSelector } from './MonedaSelector'
import { AlertBox } from './payment/AlertBox'
import { ClientePicker } from './payment/ClientePicker'
import { ComprobanteSection } from './payment/ComprobanteSection'
import { PagosEditor } from './payment/PagosEditor'
import { ProductosPanel } from './payment/ProductosPanel'
import { ResumenTotales, VueltoBox } from './payment/ResumenTotales'
import { VencimientoCredito } from './payment/VencimientoCredito'
import { VentaExitosa } from './payment/VentaExitosa'
import { usePaymentSheet } from './payment/usePaymentSheet'

type Props = {
  onClose: () => void
}

export function PaymentSheet({ onClose }: Props) {
  const s = usePaymentSheet(onClose)
  const { totales, simbolo, clienteSelector } = s

  if (s.success && totales) {
    return (
      <VentaExitosa
        total={totales.total}
        simbolo={simbolo}
        tipoComprobante={s.tipoComprobante}
        avisoCredito={s.avisoCredito}
        ticketData={s.ticketData}
        showPrint={s.showPrint}
        isPrinting={s.isPrinting}
        error={s.error}
        onImprimir={s.handleImprimir}
        onImprimirBoletaFactura={s.handleImprimirBoletaFactura}
        onCerrar={s.handleCerrarConAviso}
        onCerrarPrint={s.handleCerrarPrint}
      />
    )
  }

  return (
    <FormDialog title="Procesar cobro" onClose={onClose} size="xl">
      <div className="flex flex-col md:flex-row">
        {/* Columna izquierda: cliente, comprobante, pago */}
        <div className="flex-1 p-5 space-y-5 md:border-r" style={{ borderColor: '#E5E7EB' }}>
          <div className="space-y-2">
            <p className="text-sm font-semibold" style={{ color: '#374151' }}>
              Moneda
            </p>
            <MonedaSelector
              moneda={s.moneda}
              setMoneda={s.setMoneda}
              tipoCambio={s.tipoCambio}
              setTipoCambio={s.setTipoCambio}
            />
            {s.itemsSinDolar.length > 0 && (
              <AlertBox tone="warning">
                Estos productos no tienen precio en dólares — quitalos del carrito o cobrá en soles:{' '}
                {s.itemsSinDolar.map((i) => i.nombre).join(', ')}
              </AlertBox>
            )}
          </div>

          <ClientePicker
            cliente={s.cliente}
            query={clienteSelector.query}
            results={clienteSelector.results}
            isSearching={clienteSelector.isSearching}
            showSearch={clienteSelector.showSearch}
            onQueryChange={clienteSelector.setQuery}
            onOpenSearch={clienteSelector.abrir}
            onCloseSearch={clienteSelector.cerrar}
            onSelect={(c) => {
              s.setCliente(c)
              clienteSelector.cerrar()
            }}
            onRemove={() => {
              s.setCliente(null)
              clienteSelector.cerrar()
            }}
          />

          <ComprobanteSection
            tipoComprobante={s.tipoComprobante}
            numeroPlaca={s.numeroPlaca}
            onTipoChange={s.setTipoComprobante}
            onPlacaChange={s.setNumeroPlaca}
          />

          {totales && <ResumenTotales totales={totales} simbolo={simbolo} />}

          <PagosEditor
            lineas={s.lineas}
            onAdd={s.addLinea}
            onRemove={s.removeLinea}
            onUpdate={s.updateLinea}
          />

          {s.conCredito && (
            <VencimientoCredito
              fechaVencimiento={s.fechaVencimiento}
              minFecha={s.hoy}
              creditoInvalido={s.creditoInvalido}
              limiteExcedido={s.limiteExcedido}
              onChange={s.setFechaVencimiento}
            />
          )}

          {totales && s.vuelto > 0 && <VueltoBox vuelto={s.vuelto} simbolo={simbolo} />}

          {s.error && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
              role="alert"
            >
              {s.error}
            </div>
          )}

          {s.tipoCambioInvalido && (
            <div
              className="rounded-xl px-4 py-3 text-sm font-medium"
              style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}
              role="alert"
            >
              Ingresá un tipo de cambio válido (mayor a 0) para continuar.
            </div>
          )}

          <button
            onClick={s.handleConfirm}
            disabled={!s.puedeCobrar}
            className="w-full py-5 rounded-xl text-lg font-bold transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#002D62', color: '#FFD700' }}
          >
            {s.isPending
              ? 'Procesando...'
              : totales
                ? `COBRAR ${simbolo} ${totales.total.toFixed(2)}`
                : 'COBRAR'}
          </button>
        </div>

        <ProductosPanel
          items={s.items}
          moneda={s.moneda}
          simbolo={simbolo}
          preciosEditados={s.preciosEditados}
          onCantidadChange={s.updateCantidad}
          onPrecioChange={s.updatePrecioEditado}
        />
      </div>
    </FormDialog>
  )
}
