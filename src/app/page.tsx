import type { Metadata } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import type { MarcaAuto } from '@/lib/types/database'
import { HomePageClient } from './HomePageClient'
import type { ModeloConMarca } from './home/Especialidades'

export const metadata: Metadata = {
  title: 'Repuestos Allende | Repuestos Línea Pesada y Comercial en Lima',
  description:
    'Especialistas en repuestos para Mercedes Benz Sprinter, Peugeot, Hyundai, Renault e Iveco. Más de 10 años de experiencia atendiendo a transportistas y flotas en La Victoria, Lima. Cotiza por WhatsApp.',
  keywords: [
    'repuestos Allende',
    'repuestos Sprinter Perú',
    'repuestos Mercedes Benz Lima',
    'repuestos línea pesada Perú',
    'repuestos Iveco Lima',
    'repuestos Hyundai',
    'repuestos Renault',
    'repuestos Peugeot Perú',
    'repuestos camionetas Lima',
    'repuestos transportistas Lima',
    'repuestos flotas Perú',
    'tienda de repuestos La Victoria',
    'repuestos vehículos comerciales Lima',
    'repuestos originales Lima',
    'catálogo repuestos pesados',
    'Autopartes Lima',
    'repuestos automotrices Perú',
    'repuestos camiones Lima',
    'repuestos mecánica Lima',
    'desarrollo motor Sprinter',
    'repuestos línea comercial',
    'repuestos confiables Lima',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'es_PE',
    title: 'Repuestos Allende | Repuestos Línea Pesada y Comercial en Lima',
    description:
      'Especialistas en repuestos para Mercedes Benz Sprinter, Peugeot, Hyundai, Renault e Iveco. Más de 10 años atendiendo a transportistas en Lima.',
    siteName: 'Repuestos Allende',
  },
}

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
