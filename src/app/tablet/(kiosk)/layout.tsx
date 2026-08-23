import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { AbrirCajaScreen } from './caja/components/AbrirCajaScreen'
import { TabBar } from '@/app/tablet/components/shared/TabBar'
import { SessionHydrator } from './SessionHydrator'

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()
  const supabase = rawSupabase as any

  if (!user || !perfil?.empresa_id) {
    redirect('/tablet/login')
  }

  // Admins must pick a store before accessing the kiosk
  if (!sucursalId) {
    redirect('/tablet/sucursal')
  }

  const { data: caja } = await supabase
    .from('ra_cajas')
    .select('id')
    .eq('empresa_id', perfil.empresa_id)
    .eq('sucursal_id', sucursalId)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!caja) {
    return (
      <AbrirCajaScreen
        empresaId={perfil.empresa_id}
        sucursalId={sucursalId}
        rol={perfil.rol}
      />
    )
  }

  return (
    <div className="flex flex-col h-screen">
      <SessionHydrator cajaId={caja.id} userId={user.id} empresaId={perfil.empresa_id} />
      <main className="flex-1 overflow-hidden">{children}</main>
      <TabBar rol={perfil.rol} />
    </div>
  )
}
