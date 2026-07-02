import { createPublicClient } from '@/lib/supabase/public'
import type { MarcaAuto } from '@/lib/types/database'
import { HomePageClient } from './HomePageClient'
import type { ModeloConMarca } from './home/Especialidades'

// Sin metadata propia: hereda el title/description/keywords/openGraph de
// layout.tsx, que ya prioriza "Repuestos Sprinter Mercedes Benz" — antes esta
// página lo sobreescribía con un título genérico sin la palabra "Sprinter".

/**
 * Datos públicos de la landing: marcas activas y modelos activos
 * (con su marca relacionada vía join por la FK definida en la BD).
 *
 * Se ejecuta en build (SSG / ISR) usando el cliente público sin cookies,
 * igual que el catálogo.
 */
async function fetchDatosHome() {
  const supabase = createPublicClient()
  const [marcasRes, modelosRes] = await Promise.all([
    supabase
      .from('ra_marcas_auto')
      .select('id, nombre, activo')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('ra_modelos_auto')
      .select('*, marca:ra_marcas_auto(id, nombre)')
      .eq('activo', true)
      .order('nombre'),
  ])

  return {
    marcas: (marcasRes.data ?? []) as MarcaAuto[],
    modelos: (modelosRes.data ?? []) as ModeloConMarca[],
  }
}

export default async function Page() {
  const { marcas, modelos } = await fetchDatosHome()
  return <HomePageClient marcas={marcas} modelos={modelos} />
}
