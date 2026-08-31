import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { buscarArticulos, getMarcasAuto, getMarcasRepuesto, getModelosAuto, getStockBajoCount, getSucursalesActivas } from './actions'
import { ArticulosView } from './components/ArticulosView'

export default async function ArticulosPage() {
  const { perfil, sucursalId } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const [{ data: articulos, total }, modelos, marcas, marcasAuto, sucursales, stockBajoCount] = await Promise.all([
    buscarArticulos('', 1, null, null, sucursalId),
    getModelosAuto(),
    getMarcasRepuesto(),
    getMarcasAuto(),
    getSucursalesActivas(),
    getStockBajoCount(sucursalId),
  ])

  return (
    <ArticulosView
      initialArticulos={articulos}
      initialTotal={total}
      modelos={modelos}
      marcas={marcas}
      marcasAuto={marcasAuto}
      sucursales={sucursales}
      sucursalInicialId={sucursalId}
      stockBajoCount={stockBajoCount}
    />
  )
}
