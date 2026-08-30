import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getCajaActiva, getLiquidacionesParaRevision } from './actions'
import { LiquidacionView } from './components/LiquidacionView'
import { RevisionLiquidacionesPanel } from './components/RevisionLiquidacionesPanel'

export default async function LiquidacionPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const [{ data: caja, error: errorCaja }, { data: liquidaciones, error: errorLiquidaciones }] = await Promise.all([
    getCajaActiva(),
    getLiquidacionesParaRevision(),
  ])

  return (
    <div className="space-y-8">
      <LiquidacionView caja={caja} mensajeVacio={errorCaja} />
      <RevisionLiquidacionesPanel liquidaciones={liquidaciones} errorInicial={errorLiquidaciones} />
    </div>
  )
}
