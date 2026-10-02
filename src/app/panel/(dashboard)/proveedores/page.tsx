import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ProveedoresView } from './components/ProveedoresView'

export default async function ProveedoresPage() {
  const { supabase, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')

  const { data: proveedores, error } = await supabase
    .from('ra_proveedores')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('nombre')

  if (error) throw new Error(error.message)

  return <ProveedoresView initialProveedores={proveedores ?? []} />
}
