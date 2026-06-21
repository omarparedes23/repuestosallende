import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { AbrirCajaScreen } from './caja/components/AbrirCajaScreen'
import { TabBar } from '@/app/tablet/components/shared/TabBar'
import { SessionHydrator } from './SessionHydrator'

export default async function KioskLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, perfil } = await getSession()

  if (!user || !perfil?.empresa_id) {
    redirect('/tablet/login')
  }

  const { data: caja } = await supabase
    .from('ra_cajas')
    .select('id')
    .eq('empresa_id', perfil.empresa_id)
    .eq('usuario_id', user.id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!caja) {
    return <AbrirCajaScreen empresaId={perfil.empresa_id} />
  }

  return (
    <div className="flex flex-col h-screen">
      <SessionHydrator cajaId={caja.id} />
      <main className="flex-1 overflow-hidden">{children}</main>
      <TabBar />
    </div>
  )
}
