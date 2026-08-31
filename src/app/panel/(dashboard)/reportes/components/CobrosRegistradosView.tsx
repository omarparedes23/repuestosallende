import type { CobroRegistrado } from '../actions'
import { ResumenMonedas } from './ResumenMonedas'

const METODO: Record<string, string> = { efectivo: 'Efectivo', yape: 'Yape', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }

export function CobrosRegistradosView({ cobros, totales }: { cobros: CobroRegistrado[]; totales: Record<string, number> }) {
  return <>
    <ResumenMonedas titulo="Cobros posteriores registrados (por moneda)" totales={totales} />
    <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: '#E5E7EB' }}>
      <table className="w-full min-w-[900px] text-sm">
        <thead><tr style={{ backgroundColor: '#F9FAFB' }}>{['Fecha', 'Comprobante', 'Cliente', 'Sucursal que recibe', 'Método / referencia', 'Monto', 'Registrado por'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7280' }}>{h}</th>)}</tr></thead>
        <tbody>{cobros.map((cobro, index) => <tr key={cobro.id} className="border-t" style={{ borderColor: '#F3F4F6', backgroundColor: index % 2 ? '#F9FAFB' : '#FFFFFF' }}>
          <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#6B7280' }}>{new Date(`${cobro.fecha}T12:00:00`).toLocaleDateString('es-PE')}</td>
          <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: '#002D62' }}>{cobro.numeroCompleto ?? 'Venta histórica'}</td>
          <td className="px-4 py-3" style={{ color: '#374151' }}>{cobro.clienteNombre}</td>
          <td className="px-4 py-3" style={{ color: '#374151' }}>{cobro.sucursalNombre}</td>
          <td className="px-4 py-3"><div>{cobro.metodoPago ? (METODO[cobro.metodoPago] ?? cobro.metodoPago) : '—'}</div>{cobro.referencia && <div className="text-xs" style={{ color: '#6B7280' }}>{cobro.referencia}</div>}</td>
          <td className="px-4 py-3 font-bold" style={{ color: '#059669' }}>{cobro.moneda === 'USD' ? '$' : 'S/'} {cobro.monto.toFixed(2)}</td>
          <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>{cobro.usuarioNombre ?? 'Histórico'}{cobro.cajaId ? ' · Caja vinculada' : ''}</td>
        </tr>)}</tbody>
      </table>
      {cobros.length === 0 && <p className="p-10 text-center text-sm" style={{ color: '#9CA3AF' }}>No hay cobros registrados para los filtros elegidos.</p>}
    </div>
    <p className="text-xs" style={{ color: '#6B7280' }}>Cada fila es un abono CxC. Los movimientos de caja vinculados a cobros en efectivo no se vuelven a sumar.</p>
  </>
}
