import type { ClienteReporte, ReporteFiltros, SucursalReporte } from '../actions'

type Props = {
  filtros: ReporteFiltros
  sucursales: SucursalReporte[]
  clientes: ClienteReporte[]
  modo: 'ventas' | 'cobros'
}

export function ReporteFiltrosView({ filtros, sucursales, clientes, modo }: Props) {
  const accion = modo === 'ventas' ? '/panel/ventas' : '/panel/tesoreria'
  return (
    <form action={accion} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3 rounded-2xl border p-4" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }}>
      {modo === 'cobros' && <input type="hidden" name="vista" value="cobros" />}
      <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
        Desde
        <input name="desde" type="date" defaultValue={filtros.desde ?? ''} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }} />
      </label>
      <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
        Hasta
        <input name="hasta" type="date" defaultValue={filtros.hasta ?? ''} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }} />
      </label>
      <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
        {modo === 'ventas' ? 'Sucursal de venta' : 'Sucursal que recibe'}
        <select name="sucursalId" defaultValue={filtros.sucursalId ?? ''} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }}>
          <option value="">Todas las sucursales</option>
          {sucursales.map((sucursal) => <option key={sucursal.id} value={sucursal.id}>{sucursal.nombre}</option>)}
        </select>
      </label>
      <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
        Cliente
        <select name="clienteId" defaultValue={filtros.clienteId ?? ''} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }}>
          <option value="">Todos los clientes</option>
          {clientes.map((cliente) => <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>)}
        </select>
      </label>
      {modo === 'ventas' && <>
        <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
          Comprobante
          <select name="tipoComprobante" defaultValue={filtros.tipoComprobante ?? ''} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }}>
            <option value="">Todos</option><option value="ticket">Ticket</option><option value="boleta">Boleta</option><option value="factura">Factura</option>
          </select>
        </label>
        <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
          Estado comercial
          <select name="estado" defaultValue={filtros.estado ?? ''} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }}>
            <option value="">Todos</option><option value="completada">Completada</option><option value="pendiente">Pendiente SUNAT</option><option value="error_sunat">Error SUNAT</option><option value="anulada">Anulada</option>
          </select>
        </label>
      </>}
      {modo === 'cobros' && <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
        Método de pago
        <select name="metodoPago" defaultValue={filtros.metodoPago ?? ''} className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }}>
          <option value="">Todos</option><option value="efectivo">Efectivo</option><option value="yape">Yape</option><option value="tarjeta">Tarjeta</option><option value="transferencia">Transferencia</option>
        </select>
      </label>}
      {modo === 'cobros' && <label className="text-xs font-semibold" style={{ color: '#6B7280' }}>
        Referencia
        <input name="referencia" defaultValue={filtros.referencia ?? ''} placeholder="Voucher u operación" className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" style={{ borderColor: '#D1D5DB' }} />
      </label>}
      <div className="flex items-end gap-2">
        <button type="submit" className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ backgroundColor: '#002D62', color: '#FFD700' }}>Filtrar</button>
        <a href={accion + (modo === 'cobros' ? '?vista=cobros' : '')} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ color: '#002D62' }}>Limpiar</a>
      </div>
    </form>
  )
}
