import { getSessionFast } from '@/lib/session'
import { getBandejaDevoluciones } from './actions'
import { DevolucionesBandeja } from '@/components/postventa/DevolucionesBandeja'

export default async function DevolucionesTabletPage() {
  const [{ data, error }, { perfil }] = await Promise.all([getBandejaDevoluciones(), getSessionFast()])
  if (perfil?.rol !== 'vendedor') return <p className="p-6 text-sm" style={{ color: '#6B7280' }}>La recepción operativa está disponible para vendedores de sucursal.</p>
  return <div className="h-full overflow-y-auto"><header className="px-4 py-4" style={{ background: '#002D62' }}><h1 className="font-bold" style={{ color: '#FFF' }}>Recepción de devoluciones</h1><p className="text-xs" style={{ color: '#8BA7CC' }}>Registra la condición física; la aprobación es documental.</p></header>{error ? <p className="p-4 text-sm text-red-700">{error}</p> : <DevolucionesBandeja devoluciones={data} modo="vendedor" />}</div>
}
