import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getArticulos } from './actions'
import { ArticulosView } from './components/ArticulosView'

export default async function ArticulosPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const { data: articulos } = await getArticulos()

  return <ArticulosView initialArticulos={articulos ?? []} />
}
