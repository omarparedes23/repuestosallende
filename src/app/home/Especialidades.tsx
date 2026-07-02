'use client'

import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import type { ModeloAuto } from '@/lib/types/database'
import { siteConfig } from '@/lib/site.config'
import { fadeInUp, staggerContainer, viewportOnce } from './shared/animations'

/** Modelo con su marca relacionada (viene del join en page.tsx). */
export type ModeloConMarca = ModeloAuto & {
  marca?: { id: string; nombre: string } | null
}

/**
 * Lookup de logos de marca por nombre normalizado.
 * Idem Marcas.tsx — la FK de marca se resuelve aquí mientras no haya columna logo_url.
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

function logoPara(nombre?: string | null): string | null {
  if (!nombre) return null
  const n = normalizar(nombre)
  if (MARCA_LOGOS[n]) return MARCA_LOGOS[n]
  const key = Object.keys(MARCA_LOGOS).find((k) => n.includes(k))
  return key ? MARCA_LOGOS[key] : null
}

export function Especialidades({ modelos }: { modelos: ModeloConMarca[] }) {
  return (
    <section id="especialidades" className="py-24 bg-navy relative overflow-hidden">
      {/* Decorative spotlight background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-4">
            Nuestras{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-200">
              Especialidades
            </span>
          </h2>
          <p className="text-white/70 max-w-2xl mx-auto text-lg font-light">
            Selecciona tu modelo Mercedes Benz Sprinter y encuentra el repuesto que necesitas con
            garantía y asesoría experta.
          </p>
        </motion.div>

        {modelos.length > 0 ? (
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            variants={staggerContainer}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >
            {modelos.map((modelo) => {
              const años =
                modelo.año_desde && modelo.año_hasta
                  ? `${modelo.año_desde} – ${modelo.año_hasta}`
                  : null
              const logoMarca = logoPara(modelo.marca?.nombre)

              return (
                <motion.div key={modelo.slug} variants={fadeInUp} className="h-full">
                  <Link href={`/catalogo/${modelo.slug}`} className="block h-full group">
                    <div className="bg-slate-50 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:shadow-blue-900/50 transition-all duration-300 overflow-hidden h-full flex flex-col hover:-translate-y-2">
                      {/* Image area */}
                      <div className="relative bg-slate-50 px-4 pt-8 pb-3 overflow-hidden">
                        <div className="absolute inset-0 bg-navy/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        {logoMarca && (
                          <div className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden p-1">
                            <Image
                              src={logoMarca}
                              alt={`Logo ${modelo.marca?.nombre ?? 'marca'}`}
                              fill
                              sizes="36px"
                              className="object-contain p-1"
                            />
                          </div>
                        )}
                        <div className="relative h-44 w-full">
                          <Image
                            src={modelo.imagen_url ?? siteConfig.imagenes.modulos}
                            alt={modelo.nombre}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                            className="object-contain transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                      </div>

                      {/* Name + tagline */}
                      <div className="px-5 py-4 text-center border-t border-slate-200/60 relative bg-slate-50 z-10">
                        <h3 className="text-navy font-heading font-bold text-base leading-tight">
                          {modelo.nombre}
                        </h3>
                        {modelo.tagline && (
                          <p className="text-slate-500 text-xs mt-1.5 leading-snug">
                            {modelo.tagline}
                          </p>
                        )}
                      </div>

                      {/* Specs row */}
                      <div className="grid grid-cols-3 border-t border-slate-200/60 divide-x divide-slate-200/60 bg-slate-100/50">
                        <div className="py-3 text-center">
                          <p className="font-bold text-navy text-[11px] leading-tight px-1">
                            {modelo.motor ?? '—'}
                          </p>
                          <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">
                            Motor
                          </p>
                        </div>
                        <div className="py-3 text-center">
                          <p className="font-bold text-navy text-[11px]">{modelo.cc ?? '—'}</p>
                          <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">
                            Cilindrada
                          </p>
                        </div>
                        <div className="py-3 text-center">
                          <p className="font-bold text-navy text-[11px] leading-tight px-1">
                            {años ?? '—'}
                          </p>
                          <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">
                            Años
                          </p>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="p-4 border-t border-slate-200/60 mt-auto bg-slate-50">
                        <div className="w-full bg-white group-hover:bg-gold text-navy font-bold py-2.5 rounded-xl transition-all duration-300 text-xs text-center flex items-center justify-center gap-1.5 group-hover:shadow-md border border-slate-200/60 group-hover:border-transparent">
                          VER REPUESTOS
                          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
          </motion.div>
        ) : (
          <div className="text-center py-16">
            <p className="text-white/70 font-light">
              Próximamente publicaremos el catálogo de modelos.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
