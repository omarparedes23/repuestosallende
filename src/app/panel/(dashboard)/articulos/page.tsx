import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { buscarArticulos, getMarcasRepuesto, getModelosAuto, getStockBajoCount } from './actions'
import { ArticulosView } from './components/ArticulosView'

export default async function ArticulosPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const [{ data: articulos, total }, modelos, marcas, stockBajoCount] = await Promise.all([
    buscarArticulos('', 1),
    getModelosAuto(),
    getMarcasRepuesto(),
    getStockBajoCount(),
  ])

  return (
    <ArticulosView
      initialArticulos={articulos}
      initialTotal={total}
      modelos={modelos}
      marcas={marcas}
      stockBajoCount={stockBajoCount}
    />
  )
}
