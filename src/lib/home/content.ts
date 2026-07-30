/**
 * Contenido de las secciones NUEVAS de la landing.
 *
 * TODO: Reemplazar los textos de ejemplo con datos reales del negocio.
 * Están marcados con comentarios para que sean fáciles de encontrar y editar.
 */

import type { LucideIcon } from 'lucide-react'
import {
  ShieldCheck,
  Headphones,
  PackageCheck,
  Truck,
  BadgeCheck,
  HeartHandshake,
} from 'lucide-react'

/* ============================================================
   MÉTRICAS
   TODO: validar cifras reales con el negocio
   ============================================================ */
export interface Metrica {
  valor: string
  sufijo?: string
  etiqueta: string
}

export const metricas: Metrica[] = [
  { valor: '10', sufijo: '+', etiqueta: 'Años de experiencia' },
  { valor: '5', sufijo: '+', etiqueta: 'Marcas líderes' },
  { valor: '1000', sufijo: '+', etiqueta: 'Repuestos en catálogo' },
  { valor: '100', sufijo: '%', etiqueta: 'Clientes en todo Lima' },
]

/* ============================================================
   ¿POR QUÉ ELEGIRNOS?
   ============================================================ */
export interface Beneficio {
  icon: LucideIcon
  titulo: string
  descripcion: string
}

export const beneficios: Beneficio[] = [
  {
    icon: BadgeCheck,
    titulo: 'Repuestos originales y certificados',
    descripcion:
      'Trabajamos solo con proveedores autorizados y marcas reconocidas para garantizar la calidad de cada pieza.',
  },
  {
    icon: ShieldCheck,
    titulo: 'Garantía respaldada',
    descripcion:
      'Todos nuestros repuestos cuentan con garantía. Si algo no cuadra, lo resolvemos.',
  },
  {
    icon: Headphones,
    titulo: 'Asesoría técnica experta',
    descripcion:
      'Más de una década atendiendo transportistas y flotas. Te ayudamos a elegir el repuesto correcto.',
  },
  {
    icon: PackageCheck,
    titulo: 'Stock en rotación',
    descripcion:
      'Renovamos inventario permanentemente para la línea pesada y comercial.',
  },
  {
    icon: Truck,
    titulo: 'Despacho rápido a todo Lima',
    descripcion:
      'Enviamos a toda la ciudad y provincia. Coordinamos la entrega que necesites.',
  },
  {
    icon: HeartHandshake,
    titulo: 'Atención personalizada',
    descripcion:
      'Te atendemos por WhatsApp, en el local o por teléfono. Trato directo y sin vueltas.',
  },
]

/* ============================================================
   PROCESO "CÓMO COMPRAR"
   ============================================================ */
export interface Paso {
  numero: number
  titulo: string
  descripcion: string
}

export const pasos: Paso[] = [
  {
    numero: 1,
    titulo: 'Cuéntanos tu modelo',
    descripcion:
      'Escríbenos por WhatsApp con la marca, modelo y año de tu unidad.',
  },
  {
    numero: 2,
    titulo: 'Te asesoramos y cotizamos',
    descripcion:
      'Identificamos el repuesto correcto y te enviamos el precio al instante.',
  },
  {
    numero: 3,
    titulo: 'Verificamos disponibilidad',
    descripcion:
      'Confirmamos stock en tienda o coordinamos el repuesto que necesitas.',
  },
  {
    numero: 4,
    titulo: 'Retiras o despachamos',
    descripcion:
      'Pasa a recogerlo por La Victoria o te lo enviamos a todo Lima.',
  },
]

/* ============================================================
   TESTIMONIOS
   Reseñas reales de clientes, confirmadas por el negocio.
   ============================================================ */
export interface Testimonio {
  nombre: string
  rol: string
  texto: string
  estrellas: number
}

export const testimonios: Testimonio[] = [
  {
    nombre: 'Martin Huaman',
    rol: 'Administrador · Repuestos DMartin',
    texto:
      'Le compro a mi flota hace más de dos años. Siempre encuentran la pieza que necesito y a un precio justo. La atención es de primera.',
    estrellas: 5,
  },
  {
    nombre: 'Miguel Ríos',
    rol: 'Administrador · Repuestera Lima',
    texto:
      'Su asesoría me ha sacado de apuros más de una vez: saben exactamente qué repuesto corresponde a cada modelo y despachan rapidísimo.',
    estrellas: 5,
  },
  {
    nombre: 'Carmen Salas',
    rol: 'Jefa de Tienda · Davalos Import',
    texto:
      'Buen precio, repuesto original y con garantía. Los recomiendo a cualquier transportista de Lima que busque un repuesto de confianza.',
    estrellas: 5,
  },
]

/* ============================================================
   FAQ
   ============================================================ */
export interface FaqItem {
  pregunta: string
  respuesta: string
}

export const faqItems: FaqItem[] = [
  {
    pregunta: '¿Tienen repuestos para Mercedes Benz Sprinter?',
    respuesta:
      'Sí, somos especialistas en repuestos Mercedes Benz Sprinter: manejamos catálogo para los modelos 313, 315, 413, 415, 416, 514, 515, 516, 906 y 907, con piezas originales y alternativas certificadas.',
  },
  {
    pregunta: '¿Venden solo al por mayor?',
    respuesta:
      'No. Atendemos a mayoristas (talleres y flotas) y también a minoristas (choferes y público en general). Consulta por descuentos por volumen.',
  },
  {
    pregunta: '¿Emiten factura y boleta?',
    respuesta:
      'Sí. Somos una empresa formal activa y habida (RUC 20610105280). Emitimos boleta y factura electrónica.',
  },
  {
    pregunta: '¿Hacen envíos a provincia?',
    respuesta:
      'Sí, coordinamos envíos a todo Lima y provincia mediante agencias de transportes. Escríbenos por WhatsApp para ver la mejor opción.',
  },
  {
    pregunta: '¿Los repuestos son originales?',
    respuesta:
      'Manejamos repuestos originales (OEM) y alternativos certificados de alta calidad. Te indicamos la opción según tu presupuesto.',
  },
  {
    pregunta: '¿Los repuestos tienen garantía?',
    respuesta:
      'Sí, todos los repuestos cuentan con garantía según el fabricante. Si el repuesto falla dentro del periodo, lo resolvemos.',
  },
  {
    pregunta: '¿Cuáles son sus horarios de atención?',
    respuesta:
      'Atendemos de lunes a sábado en nuestro local de La Victoria. También atendemos consultas por WhatsApp en horario comercial.',
  },
]
