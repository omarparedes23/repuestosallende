import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { NuevaCompraForm } from './components/NuevaCompraForm'

export default async function NuevaCompraPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  return <NuevaCompraForm />
}
