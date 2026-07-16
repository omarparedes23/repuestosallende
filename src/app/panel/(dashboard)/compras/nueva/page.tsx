import { Suspense } from 'react'
import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { NuevaCompraForm } from './components/NuevaCompraForm'

export default async function NuevaCompraPage() {
  const { perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  // NuevaCompraForm usa useSearchParams (?ordenCompraId=) para precargar una
  // recepción vinculada a una OC — Next.js exige un boundary de Suspense
  // alrededor de cualquier client component que lo use.
  return (
    <Suspense fallback={null}>
      <NuevaCompraForm />
    </Suspense>
  )
}
