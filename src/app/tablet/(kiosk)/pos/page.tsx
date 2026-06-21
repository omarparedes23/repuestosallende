import { createClient } from '@/lib/supabase/server'
import { KioskPosClient } from './components/KioskPosClient'

export default async function PosPage() {
  const supabase = (await createClient()) as any

  const { data: categorias } = await supabase
    .from('ra_categorias')
    .select('id, nombre, slug, parent_id, orden, activo')
    .eq('activo', true)
    .order('orden')

  return (
    <div className="h-full">
      <KioskPosClient categorias={categorias ?? []} />
    </div>
  )
}
