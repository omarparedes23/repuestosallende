/**
 * Configuración central de la empresa.
 *
 * Fuente única de verdad para datos de contacto, fiscales y de marca.
 * Todos los componentes de la landing y el catálogo deben consumir este objeto
 * en lugar de hardcodedar strings (para evitar inconsistencias).
 *
 * Si un dato cambia (teléfono, dirección, etc.), se edita solo aquí.
 */

export interface RedSocial {
  nombre: string
  url: string
  handle: string
}

export interface HorarioDia {
  dia: string
  rango: string
}

export interface SiteConfig {
  /** Dominio canónico sin barra final (usado en metadata y schema) */
  dominio: string
  /** Marca corta para navegación */
  marcaCorta: string
  /** Razón social completa */
  razonSocial: string
  /** RUC con 11 dígitos */
  ruc: string
  /** Dirección postal completa */
  direccion: {
    linea: string
    distrito: string
    ciudad: string
    pais: string
    nota?: string
  }
  /** Teléfono en formato legible para mostrar */
  telefonoDisplay: string
  /** Teléfono en formato internacional sin signos para wa.me / tel: */
  telefonoIntl: string
  /** Mensaje de WhatsApp pre-cargado (texto plano) */
  whatsappMensaje: string
  email: string
  /** Coordenadas para schema LocalBusiness */
  geo: {
    lat: number
    lng: number
  }
  /** URL del iframe embed de Google Maps */
  mapsEmbedUrl: string
  /** URL de Google Maps para abrir en app */
  mapsLink: string
  horarios: HorarioDia[]
  resumenHorarios: string
  redes: {
    facebook: RedSocial
    tiktok: RedSocial
  }
  /** Imágenes públicas usadas como fallback o en metadata */
  imagenes: {
    logo: string
    portada: string
    modulos: string
  }
}

export const siteConfig: SiteConfig = {
  dominio: 'https://repuestosallende.com',
  marcaCorta: 'Repuestos Allende',
  razonSocial: 'Repuestos Allende E.I.R.L.',
  ruc: '20610105280',

  direccion: {
    linea: 'Av. Manco Cápac 316',
    distrito: 'La Victoria',
    ciudad: 'Lima',
    pais: 'Perú',
    nota: 'Al lado del BBVA',
  },

  telefonoDisplay: '+51 975 167 682',
  telefonoIntl: '51975167682',
  whatsappMensaje:
    'Hola Repuestos Allende, estoy interesado en sus repuestos.',
  email: 'ventas@repuestosallende.com',

  geo: {
    lat: -12.0641667,
    lng: -77.0138889,
  },

  mapsEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3901.757758805028!2d-77.0138889!3d-12.0641667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105c8db1e1e1e1f%3A0x1e1e1e1e1e1e1e1e!2sAv.%20Manco%20C%C3%A1pac%20316%2C%20La%20Victoria%2015018%2C%20Per%C3%BA!5e0!3m2!1ses!2sus!4v1713800000000!5m2!1ses!2sus',
  mapsLink: 'https://www.google.com/maps/search/?api=1&query=-12.0641667,-77.0138889',

  horarios: [
    { dia: 'Lunes a Viernes', rango: '9:00 a.m. – 1:00 p.m. y 2:00 – 6:00 p.m.' },
    { dia: 'Sábado', rango: '9:00 a.m. – 1:00 p.m.' },
    { dia: 'Domingo', rango: 'Cerrado' },
  ],
  resumenHorarios: 'Lun – Sáb · 9:00 am – 6:00 pm',

  redes: {
    facebook: {
      nombre: 'Facebook',
      url: 'https://www.facebook.com/repuestosallendeeirl',
      handle: '@repuestosallendeeirl',
    },
    tiktok: {
      nombre: 'TikTok',
      url: 'https://www.tiktok.com/@repuestos.allende1',
      handle: '@repuestos.allende1',
    },
  },

  imagenes: {
    logo: '/images/repuestosallendelogo.png',
    portada: '/images/portada.jpg',
    modulos: '/images/modulos.jpg',
  },
}

/* ============================================================
   Helpers derivados
   ============================================================ */

/** URL de WhatsApp lista para usar en <a href> */
export function whatsappUrl(mensaje: string = siteConfig.whatsappMensaje): string {
  return `https://wa.me/${siteConfig.telefonoIntl}?text=${encodeURIComponent(mensaje)}`
}

/** Dirección completa en una sola línea */
export function direccionCompleta(): string {
  const d = siteConfig.direccion
  return `${d.linea}, ${d.distrito}, ${d.ciudad}, ${d.pais}`
}

/** Teléfono en formato tel: */
export function telUrl(): string {
  return `tel:+${siteConfig.telefonoIntl}`
}
