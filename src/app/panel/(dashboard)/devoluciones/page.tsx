import { redirect } from 'next/navigation'
import { getSessionFast } from '@/lib/session'
import { getBandejaDevoluciones } from '@/app/tablet/(kiosk)/devoluciones/actions'
import { DevolucionesBandeja } from '@/components/postventa/DevolucionesBandeja'

export default async function DevolucionesPanelPage() {
  const [{ data, error }, { perfil }] = await Promise.all([getBandejaDevoluciones(), getSessionFast()])
  if (!perfil || !['administrador', 'superadmin'].includes(perfil.rol)) redirect('/panel')
  return <main className="mx-auto max-w-3xl p-4 md:p-6"><h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Devoluciones postventa</h1><p className="mt-1 text-sm" style={{ color: '#6B7280' }}>Revisión documental, decisión de reingreso y liquidación. La recepción física la registra el vendedor.</p>{error ? <p className="mt-4 rounded-xl p-4 text-sm text-red-700" style={{ background: '#FEF2F2' }}>{error}</p> : <DevolucionesBandeja devoluciones={data} modo="admin" />}</main>
}
