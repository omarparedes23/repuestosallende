import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Sidebar } from './components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, perfil, sucursalId } = await getSession()

  if (!user || !perfil) redirect('/panel/login')

  if (!['administrador', 'superadmin'].includes(perfil.rol)) {
    redirect('/panel/login')
  }

  const { data: sucursal, error } = sucursalId && perfil.empresa_id
    ? await supabase
      .from('ra_sucursales')
      .select('nombre, direccion')
      .eq('id', sucursalId)
      .eq('empresa_id', perfil.empresa_id)
      .eq('activo', true)
      .maybeSingle()
    : { data: null, error: null }
  if (error) throw new Error(error.message)

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
