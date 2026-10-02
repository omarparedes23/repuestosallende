import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ClientesView } from './components/ClientesView'

export default async function ClientesPage() {
  const { supabase, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const { data: clientes, error } = await supabase
    .from('ra_clientes')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('nombre')

  if (error) throw new Error(error.message)

  return <ClientesView initialClientes={clientes ?? []} />
}
