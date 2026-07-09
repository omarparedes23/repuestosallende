import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { CatalogoPageClient } from './CatalogoPageClient'

type Props = { params: Promise<{ modelo: string }> }

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('ra_modelos_auto')
    .select('slug')
    .eq('activo', true)
  return ((data as any) ?? []).map((m: any) => ({ modelo: m.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modelo: slug } = await params
  const supabase = createPublicClient()
  const { data: modelo } = await supabase
    .from('ra_modelos_auto')
    .select('nombre, ra_marcas_auto(nombre)')
    .eq('slug', slug)
    .eq('activo', true)
    .single()
  
  if (!modelo) return {}
  
  const brand = (modelo as any).ra_marcas_auto?.nombre || "Mercedes-Benz"
  const modelName = (modelo as any).nombre
  
  return {
    title: `Repuestos ${brand} ${modelName} | Repuestos Allende`,
    description: `Repuestos de suspensión, dirección, motor y caja para ${brand} ${modelName}. Stock disponible con garantía en La Victoria, Lima. Envíos a nivel nacional.`,
  }
}

export default async function CatalogoModeloPage({ params }: Props) {
  const { modelo: slug } = await params
  const supabase = createPublicClient()

  const { data: modelo } = await supabase
    .from('ra_modelos_auto')
    .select('*, marca:ra_marcas_auto(id, nombre)')
    .eq('slug', slug)
    .eq('activo', true)
    .single()

  if (!modelo) notFound()

  // La lista de categorias/marcas para los filtros del sidebar se deriva en el
  // cliente a partir de estos mismos repuestos (no de un select aparte a
  // ra_categorias) - evita mostrar categorias en 0 (de otros modelos) y
  // duplicados por nombre (ra_categorias tiene varias filas con el mismo
  // nombre, ej. "MOTOR" x7, una por subcategoria del ERP).
  // as any: marca_repuesto_id / ra_marcas_repuesto no estan en el tipo Database
  // generado (quedo desactualizado desde la migracion 024) - mismo patron que
  // ya usa el panel admin (articulos/actions.ts) para estos mismos campos.
  const { data: repuestos } = await (supabase as any)
    .from('ra_catalogo_repuestos')
    .select('*, categoria:ra_categorias(id, nombre, slug, orden), marca_repuesto:ra_marcas_repuesto(id, nombre), ra_compatibilidades!inner(modelo_id)')
    .eq('activo', true)
    .eq('ra_compatibilidades.modelo_id', (modelo as any).id)
    .order('nombre')

  return (
    <CatalogoPageClient
      modelo={modelo}
      repuestos={repuestos ?? []}
    />
  )
}
