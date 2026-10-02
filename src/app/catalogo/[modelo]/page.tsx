import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { getPreciosPublicos } from '@/lib/catalogo/preciosPublicos'
import { getIsAdminPublico } from '../actions'
import { CatalogoPageClient } from './CatalogoPageClient'

// Los precios de catálogo cambian desde el panel y deben refrescarse sin redeploy.
export const revalidate = 300

type Props = { params: Promise<{ modelo: string }> }

export async function generateStaticParams() {
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('ra_modelos_auto')
    .select('slug')
    .eq('activo', true)
  if (error) throw new Error(error.message)
  return (data ?? []).map((m) => ({ modelo: m.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { modelo: slug } = await params
  const supabase = createPublicClient()
  const { data: modelo, error } = await supabase
    .from('ra_modelos_auto')
    .select('nombre, ra_marcas_auto(nombre)')
    .eq('slug', slug)
    .eq('activo', true)
    .single()

  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  if (!modelo) return {}

  const brand = modelo.ra_marcas_auto?.nombre || "Mercedes-Benz"
  const modelName = modelo.nombre
  
  return {
    title: `Repuestos ${brand} ${modelName} | Repuestos Allende`,
    description: `Repuestos de suspensión, dirección, motor y caja para ${brand} ${modelName}. Stock disponible con garantía en La Victoria, Lima. Envíos a nivel nacional.`,
    alternates: {
      canonical: `/catalogo/${slug}`,
    },
  }
}

export default async function CatalogoModeloPage({ params }: Props) {
  const { modelo: slug } = await params
  const supabase = createPublicClient()

  const { data: modelo, error: modeloError } = await supabase
    .from('ra_modelos_auto')
    .select('*, marca:ra_marcas_auto(id, nombre)')
    .eq('slug', slug)
    .eq('activo', true)
    .single()

  if (modeloError && modeloError.code !== 'PGRST116') throw new Error(modeloError.message)
  if (!modelo) notFound()

  // La lista de categorias/marcas para los filtros del sidebar se deriva en el
  // cliente a partir de estos mismos repuestos (no de un select aparte a
  // ra_categorias) - evita mostrar categorias en 0 (de otros modelos) y
  // duplicados por nombre (ra_categorias tiene varias filas con el mismo
  // nombre, ej. "MOTOR" x7, una por subcategoria del ERP).
  const { data: repuestos, error: repuestosError } = await supabase
    .from('ra_catalogo_repuestos')
    .select('*, categoria:ra_categorias(id, nombre, slug, orden), marca_repuesto:ra_marcas_repuesto(id, nombre), ra_compatibilidades!inner(modelo_id)')
    .eq('activo', true)
    	.eq('ra_compatibilidades.modelo_id', modelo.id)
    .order('nombre')

  if (repuestosError) throw new Error(repuestosError.message)

  const isAdmin = await getIsAdminPublico()
  const precios = await getPreciosPublicos((repuestos ?? []).map((repuesto) => repuesto.id))
  const repuestosConPrecio = (repuestos ?? []).map((repuesto) => ({
    ...repuesto,
    precio_venta: precios[repuesto.id]?.precioVenta ?? null,
    precio_venta_dolar: precios[repuesto.id]?.precioVentaDolar ?? null,
  }))

  return (
    <CatalogoPageClient
      modelo={modelo}
      repuestos={repuestosConPrecio}
      isAdmin={isAdmin}
    />
  )
}
