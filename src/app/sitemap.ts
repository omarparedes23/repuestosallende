import type { MetadataRoute } from 'next'
import { createPublicClient } from '@/lib/supabase/public'
import { siteConfig } from '@/lib/site.config'

/**
 * Sitemap dinámico: landing + todos los catálogos de modelo activos.
 * Next.js genera /sitemap.xml automáticamente desde este archivo.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.dominio
  const ahora = new Date()

  const estaticas: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: ahora,
      changeFrequency: 'weekly',
      priority: 1,
    },
  ]

  let dinamicas: MetadataRoute.Sitemap = []

  try {
    const supabase = createPublicClient()
    const { data } = await supabase
      .from('ra_modelos_auto')
      .select('slug, updated_at')
      .eq('activo', true)
      .returns<Array<{ slug: string; updated_at: string | null }>>()

    dinamicas =
      data?.map((m) => ({
        url: `${base}/catalogo/${m.slug}`,
        lastModified: m.updated_at ? new Date(m.updated_at) : ahora,
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })) ?? []
  } catch {
    // Si Supabase no responde en build, igual entregamos las rutas estáticas.
    dinamicas = []
  }

  return [...estaticas, ...dinamicas]
}
