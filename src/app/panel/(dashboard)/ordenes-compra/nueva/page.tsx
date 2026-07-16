import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { NuevaOrdenCompraForm } from './components/NuevaOrdenCompraForm'

export default async function NuevaOrdenCompraPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  return <NuevaOrdenCompraForm />
}
