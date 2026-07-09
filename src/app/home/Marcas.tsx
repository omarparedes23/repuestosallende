'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import type { MarcaAuto } from '@/lib/types/database'
import { fadeInUp, staggerContainer, viewportOnce } from './shared/animations'

/**
 * Lookup de logos de marca por nombre normalizado.
 * La tabla `ra_marcas_auto` no tiene columna `logo_url`, por eso resolvemos aquí
 * el path del asset por nombre. Si no hay match, se muestra una card estilada
 * con el nombre en tipografía.
 *
 * Para añadir una marca nueva, agrega su entrada aquí y sube el archivo a /public/images.
 */
const MARCA_LOGOS: Record<string, string> = {
  'mercedes-benz': '/images/mercedesbenz.png',
  'mercedes benz': '/images/mercedesbenz.png',
  mercedes: '/images/mercedesbenz.png',
  peugeot: '/images/peugeot.webp',
  hyundai: '/images/hyundailogo.jpg',
  renault: '/images/renaultlogo.svg',
  iveco: '/images/iveco.jpg',
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function logoPara(nombre: string): string | null {
  const n = normalizar(nombre)
  if (MARCA_LOGOS[n]) return MARCA_LOGOS[n]
  // coincidencia parcial
  const key = Object.keys(MARCA_LOGOS).find((k) => n.includes(k))
  return key ? MARCA_LOGOS[key] : null
}

export function Marcas({ marcas }: { marcas: MarcaAuto[] }) {
  // Solo mostramos las marcas que ya tienen logo en MARCA_LOGOS (hoy: Mercedes-Benz,
  // Peugeot, Hyundai, Renault, Iveco) — ra_marcas_auto tiene 87 marcas activas y
  // mostrarlas todas sin logo se veía como una lista genérica de texto.
  const lista = marcas.filter((m) => logoPara(m.nombre) !== null)

  return (
    <section id="marcas" className="pt-32 pb-20 bg-gray-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            Marcas que{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
              Trabajamos
            </span>
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Repuestos originales y de alta calidad para Mercedes Benz Sprinter y las principales
            marcas de línea pesada y comercial del mercado peruano.
          </p>
        </motion.div>

        {lista.length > 0 ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6"
          >
            {lista.map((marca) => {
              const logo = logoPara(marca.nombre)
              return (
                <motion.div key={marca.id} variants={fadeInUp} className="h-full">
                  <Card className="h-full border-0 bg-white/70 backdrop-blur-sm shadow-md hover:shadow-2xl hover:shadow-navy/10 hover:-translate-y-2 transition-all duration-300 cursor-default rounded-2xl group">
                    <CardContent className="flex flex-col items-center justify-center py-8 px-4">
                      <div className="relative w-20 h-20 rounded-xl flex items-center justify-center mb-4 bg-white border border-slate-100 shadow-sm overflow-hidden p-2 group-hover:scale-110 transition-transform duration-300">
                        {logo ? (
                          <Image
                            src={logo}
                            alt={`Logo ${marca.nombre}`}
                            fill
                            sizes="80px"
                            className="object-contain p-1"
                          />
                        ) : (
                          <span className="font-heading font-bold text-navy text-center text-xs px-2">
                            {marca.nombre}
                          </span>
                        )}
                      </div>
                      <h3 className="text-navy font-bold text-center text-sm">{marca.nombre}</h3>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <p className="text-center text-gray-tech font-light">
            Próximamente publicaremos el listado completo de marcas.
          </p>
        )}
      </div>
    </section>
  )
}
