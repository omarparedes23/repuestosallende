import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { getCuentasPorCobrarGlobal, getSucursalesParaCobro } from './actions'
import { TesoreriaView } from './components/TesoreriaView'
import { getCobrosRegistrados, getOpcionesReporte, type ReporteFiltros } from '../reportes/actions'
import { ReporteFiltrosView } from '../reportes/components/ReporteFiltros'
import { CobrosRegistradosView } from '../reportes/components/CobrosRegistradosView'
import { PaginacionReporte } from '../reportes/components/PaginacionReporte'

function filtroDesde(params: Record<string, string | string[] | undefined>): ReporteFiltros {
  const tomar = (clave: string) => typeof params[clave] === 'string' ? params[clave] : undefined
  const paginaRaw = Number(tomar('pagina') ?? '1')
  return { desde: tomar('desde'), hasta: tomar('hasta'), sucursalId: tomar('sucursalId'), clienteId: tomar('clienteId'), metodoPago: tomar('metodoPago'), referencia: tomar('referencia'), pagina: Number.isInteger(paginaRaw) && paginaRaw > 0 ? paginaRaw : 1 }
}

export default async function TesoreriaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { perfil, sucursalId } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const params = await searchParams
  const vistaCobros = params.vista === 'cobros'
  const filtros = filtroDesde(params)

  const [pendientes, sucursalesCobro, opciones, cobros] = await Promise.all([
    vistaCobros ? Promise.resolve({ data: [] }) : getCuentasPorCobrarGlobal(),
    vistaCobros ? Promise.resolve([]) : getSucursalesParaCobro(),
    vistaCobros ? getOpcionesReporte() : Promise.resolve({ sucursales: [], clientes: [] }),
    vistaCobros ? getCobrosRegistrados(filtros) : Promise.resolve({ data: [], totales: {}, totalFilas: 0, error: null }),
  ])

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Tesorería</h1>
        <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>Cuentas por cobrar y trazabilidad de los cobros posteriores.</p>
      </div>
      <div className="flex gap-2 border-b" style={{ borderColor: '#E5E7EB' }}>
        <a href="/panel/tesoreria" className="px-4 py-2 text-sm font-semibold border-b-2" style={{ borderColor: vistaCobros ? 'transparent' : '#002D62', color: vistaCobros ? '#6B7280' : '#002D62' }}>Por cobrar</a>
        <a href="/panel/tesoreria?vista=cobros" className="px-4 py-2 text-sm font-semibold border-b-2" style={{ borderColor: vistaCobros ? '#002D62' : 'transparent', color: vistaCobros ? '#002D62' : '#6B7280' }}>Cobros registrados</a>
      </div>
      {vistaCobros ? <>
        <ReporteFiltrosView modo="cobros" filtros={filtros} sucursales={opciones.sucursales} clientes={opciones.clientes} />
        {cobros.error ? <p className="rounded-xl border p-4 text-sm" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2', color: '#B91C1C' }}>{cobros.error}</p> : <><CobrosRegistradosView cobros={cobros.data} totales={cobros.totales} /><PaginacionReporte ruta="/panel/tesoreria?vista=cobros" filtros={filtros} totalFilas={cobros.totalFilas} /></>}
      </> : <TesoreriaView movimientos={pendientes.data ?? []} sucursales={sucursalesCobro} sucursalInicialId={sucursalId} />}
    </div>
  )
}
