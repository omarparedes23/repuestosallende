import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Sidebar } from './components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()

  if (!user || !perfil) redirect('/panel/login')

  if (!['administrador', 'superadmin'].includes(perfil.rol)) {
    redirect('/panel/login')
  }

  // Los tipos manuales aún no incluyen ra_sucursales.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = rawSupabase as any
  const { data: sucursal } = sucursalId
    ? await supabase
      .from('ra_sucursales')
      .select('nombre, direccion')
      .eq('id', sucursalId)
      .eq('empresa_id', perfil.empresa_id)
      .eq('activo', true)
      .maybeSingle()
    : { data: null }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
      <Sidebar
        nombreUsuario={perfil.nombre}
        sucursalNombre={sucursal?.nombre ?? null}
        sucursalDireccion={sucursal?.direccion ?? null}
      />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
