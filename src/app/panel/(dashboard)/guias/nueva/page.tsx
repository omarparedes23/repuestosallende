import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getSucursales } from '../actions'
import { NuevaGuiaForm } from './components/NuevaGuiaForm'

export default async function NuevaGuiaPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const sucursales = await getSucursales()

  if (sucursales.length < 2) {
    redirect('/panel/guias')
  }

  return <NuevaGuiaForm sucursales={sucursales} />
}
