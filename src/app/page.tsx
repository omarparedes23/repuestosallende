import { createPublicClient } from '@/lib/supabase/public'
import { HomePageClient } from './HomePageClient'

export default async function Home() {
  const supabase = createPublicClient()
  const { data: modelos } = await supabase
    .from('ra_modelos_auto')
    .select('*')
    .eq('activo', true)
    .order('nombre')

  return <HomePageClient modelos={modelos ?? []} />
}
