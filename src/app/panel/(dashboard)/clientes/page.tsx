import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ClientesView } from './components/ClientesView'

export default async function ClientesPage() {
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { data: clientes } = await supabase
    .from('ra_clientes')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('nombre')

  return <ClientesView initialClientes={clientes ?? []} />
}
