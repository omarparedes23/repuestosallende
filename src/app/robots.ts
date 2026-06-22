import type { MetadataRoute } from 'next'
import { siteConfig } from '@/lib/site.config'

/**
 * robots.txt dinámico.
 * Bloquea las rutas internas (/tablet, /panel) que no deben indexarse.
 */
export default function robots(): MetadataRoute.Robots {
  const base = siteConfig.dominio
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/tablet/', '/panel/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
