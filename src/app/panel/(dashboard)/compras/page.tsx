import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getCompras } from './actions'
import { ComprasView } from './components/ComprasView'

export default async function ComprasPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const { data: compras } = await getCompras()

  return <ComprasView initialCompras={compras ?? []} />
}
