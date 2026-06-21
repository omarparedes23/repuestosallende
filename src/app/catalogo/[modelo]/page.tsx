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

  const [{ data: modelo }, { data: repuestos }, { data: categorias }] = await Promise.all([
    supabase
      .from('ra_modelos_auto')
      .select('*')
      .eq('slug', slug)
      .eq('activo', true)
      .single(),
    supabase
      .from('ra_catalogo_repuestos')
      .select('*, categoria:ra_categorias(id, nombre, slug, orden)')
      .eq('activo', true)
      .order('nombre'),
    supabase
      .from('ra_categorias')
      .select('id, nombre, slug, orden')
      .eq('activo', true)
      .order('orden'),
  ])

  if (!modelo) notFound()

  return (
    <CatalogoPageClient
      modelo={modelo}
      repuestos={repuestos ?? []}
      categorias={categorias ?? []}
    />
  )
}
