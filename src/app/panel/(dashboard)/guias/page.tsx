import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { getGuias } from './actions'
import { GuiasView } from './components/GuiasView'

export default async function GuiasPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const { data: guias } = await getGuias()

  return <GuiasView initialGuias={guias ?? []} />
}
