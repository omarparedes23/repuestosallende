import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getOrdenesCompra } from './actions'
import { OrdenesCompraView } from './components/OrdenesCompraView'

export default async function OrdenesCompraPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const { data: ordenesCompra } = await getOrdenesCompra()

  return <OrdenesCompraView initialOrdenesCompra={ordenesCompra ?? []} />
}
