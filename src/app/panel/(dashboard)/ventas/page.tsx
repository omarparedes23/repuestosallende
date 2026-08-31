import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getOpcionesReporte, getVentasReporte, type ReporteFiltros } from '../reportes/actions'
import { ReporteFiltrosView } from '../reportes/components/ReporteFiltros'
import { PaginacionReporte } from '../reportes/components/PaginacionReporte'
import { VentasReportView } from './components/VentasReportView'

function filtroDesde(params: Record<string, string | string[] | undefined>): ReporteFiltros {
  const tomar = (clave: string) => typeof params[clave] === 'string' ? params[clave] : undefined
  const paginaRaw = Number(tomar('pagina') ?? '1')
  return { desde: tomar('desde'), hasta: tomar('hasta'), sucursalId: tomar('sucursalId'), clienteId: tomar('clienteId'), tipoComprobante: tomar('tipoComprobante'), estado: tomar('estado'), pagina: Number.isInteger(paginaRaw) && paginaRaw > 0 ? paginaRaw : 1 }
}

export default async function VentasPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const filtros = filtroDesde(await searchParams)
  const [{ sucursales, clientes }, { data: ventas, totales, totalFilas, error }] = await Promise.all([getOpcionesReporte(), getVentasReporte(filtros)])

  return <div className="p-8 max-w-[1500px] mx-auto space-y-6">
    <div><h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Ventas</h1><p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Historial comercial por comprobante. Los cobros posteriores se muestran sin duplicar el total vendido.</p></div>
    <ReporteFiltrosView modo="ventas" filtros={filtros} sucursales={sucursales} clientes={clientes} />
    {error ? <p className="rounded-xl border p-4 text-sm" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C' }}>{error}</p> : <><VentasReportView ventas={ventas} totales={totales} /><PaginacionReporte ruta="/panel/ventas" filtros={filtros} totalFilas={totalFilas} /></>}
  </div>
}
