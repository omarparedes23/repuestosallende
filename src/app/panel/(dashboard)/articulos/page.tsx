import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getArticulos, getModelosAuto } from './actions'
import { ArticulosView } from './components/ArticulosView'

export default async function ArticulosPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const [{ data: articulos }, modelos] = await Promise.all([
    getArticulos(),
    getModelosAuto(),
  ])

  return <ArticulosView initialArticulos={articulos ?? []} modelos={modelos} />
}
