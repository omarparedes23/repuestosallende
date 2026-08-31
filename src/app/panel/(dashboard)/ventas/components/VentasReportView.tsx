import type { VentaReporte } from '../../reportes/actions'
import { ResumenMonedas } from '../../reportes/components/ResumenMonedas'

const simbolo = (moneda: string) => moneda === 'USD' ? '$' : 'S/'

export function VentasReportView({ ventas, totales }: { ventas: VentaReporte[]; totales: Record<string, number> }) {
  return <>
    <ResumenMonedas titulo="Total comercial de ventas (por moneda)" totales={totales} />
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: '#E5E7EB' }}>
      <table className="w-full min-w-[1100px] text-sm">
        <thead><tr style={{ backgroundColor: '#F9FAFB' }}>{['Fecha', 'Sucursal de venta', 'Comprobante', 'Cliente', 'Total', 'Al emitir', 'Crédito / saldo', 'Cobrado después', 'Estados'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>{h}</th>)}</tr></thead>
        <tbody>{ventas.map((venta, index) => <tr key={venta.id} className="border-t" style={{ borderColor: '#F3F4F6', backgroundColor: index % 2 ? '#F9FAFB' : '#FFFFFF' }}>
          <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7280' }}>{new Date(venta.createdAt).toLocaleDateString('es-PE')}</td>
          <td className="px-4 py-3" style={{ color: '#374151' }}>{venta.sucursalNombre}</td>
          <td className="px-4 py-3 font-mono text-xs"><span style={{ color: '#002D62' }} className="font-semibold">{venta.numeroCompleto ?? venta.id.slice(0, 8).toUpperCase()}</span><div className="capitalize mt-0.5" style={{ color: '#6B7280' }}>{venta.tipoComprobante}</div></td>
          <td className="px-4 py-3" style={{ color: '#374151' }}>{venta.clienteNombre}</td>
          <td className="px-4 py-3 font-bold">{simbolo(venta.moneda)} {venta.total.toFixed(2)}</td>
          <td className="px-4 py-3" style={{ color: '#059669' }}>{simbolo(venta.moneda)} {venta.cobradoAlEmitir.toFixed(2)}</td>
          <td className="px-4 py-3"><div>{simbolo(venta.moneda)} {venta.creditoOriginal.toFixed(2)}</div>{venta.creditoOriginal > 0 && <div className="text-xs" style={{ color: venta.saldoCredito > 0 ? '#DC2626' : '#059669' }}>Saldo: {simbolo(venta.moneda)} {venta.saldoCredito.toFixed(2)}</div>}</td>
          <td className="px-4 py-3" style={{ color: '#059669' }}>{simbolo(venta.moneda)} {venta.cobradoPosteriormente.toFixed(2)}</td>
          <td className="px-4 py-3"><span className="block capitalize">{venta.estado.replace('_', ' ')}</span><span className="block text-xs" style={{ color: '#6B7280' }}>SUNAT: {venta.sunatEstado ?? (venta.tipoComprobante === 'ticket' ? 'No aplica' : 'Pendiente')}</span></td>
        </tr>)}</tbody>
      </table>
      {ventas.length === 0 && <p className="p-10 text-center text-sm" style={{ color: '#9CA3AF' }}>No hay ventas para los filtros elegidos.</p>}
    </div>
    <p className="text-xs" style={{ color: '#6B7280' }}>Máximo {ventas.length} resultados recientes. Los abonos posteriores explican el crédito; no se suman de nuevo al total comercial.</p>
  </>
}
