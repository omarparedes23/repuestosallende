import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { Sidebar } from './components/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, perfil } = await getSession()

  if (!user || !perfil) redirect('/panel/login')

  if (!['administrador', 'superadmin'].includes(perfil.rol)) {
    redirect('/panel/login')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
      <Sidebar nombreUsuario={perfil.nombre} />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0">
        {children}
      </main>
    </div>
  )
}
