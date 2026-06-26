import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ProveedoresView } from './components/ProveedoresView'

export default async function ProveedoresPage() {
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { data: proveedores } = await supabase
    .from('ra_proveedores')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('nombre')

  return <ProveedoresView initialProveedores={proveedores ?? []} />
}
