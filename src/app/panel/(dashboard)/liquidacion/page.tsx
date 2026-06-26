import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getCajaActiva } from './actions'
import { LiquidacionView } from './components/LiquidacionView'

export default async function LiquidacionPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const { data: caja } = await getCajaActiva()

  return <LiquidacionView caja={caja} />
}
