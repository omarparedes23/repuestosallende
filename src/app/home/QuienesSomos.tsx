'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Award, Users, Wrench } from 'lucide-react'
import { siteConfig } from '@/lib/site.config'
import { fadeInUp, fadeIn, viewportOnce } from './shared/animations'

const PILARES = [
  {
    icon: Award,
    titulo: '+10 años de experiencia',
    descripcion: 'Una década atendiendo al sector transporte y comercial del Perú.',
  },
  {
    icon: Users,
    titulo: 'Trato directo',
    descripcion: 'Atendemos transportistas, talleres y flotas con asesoría personalizada.',
  },
  {
    icon: Wrench,
    titulo: 'Especialistas en línea pesada',
    descripcion: 'Conocemos a fondo Mercedes Benz Sprinter, Iveco, Hyundai y más.',
  },
]

export function QuienesSomos() {
  return (
    <section id="quienes-somos" className="py-24 bg-gray-light relative overflow-hidden">
      <div className="absolute top-20 right-0 w-80 h-80 bg-gold/10 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Imagen */}
          <motion.div
            variants={fadeIn}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="relative order-2 lg:order-1"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/3]">
              <Image
                src="https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter313.png"
                alt={`${siteConfig.marcaCorta} — Sprinter 313`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-navy/40 via-transparent to-transparent" />
            </div>

            {/* Badge flotante */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={viewportOnce}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
              className="absolute -bottom-6 -left-4 sm:-left-6 bg-navy text-white rounded-2xl shadow-xl p-5 max-w-[200px]"
            >
              <p className="text-3xl font-heading font-extrabold text-gold leading-none">+10</p>
              <p className="text-sm text-white/80 font-medium mt-1">
                años brindando confianza al transporte peruano
              </p>
            </motion.div>
          </motion.div>

          {/* Texto */}
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="order-1 lg:order-2"
          >
            <span className="inline-block text-gold-dark font-semibold text-sm uppercase tracking-widest mb-3">
              Quiénes somos
            </span>
            <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-6 leading-tight">
              Tu socio de confianza en{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
                repuestos Sprinter y transporte pesado
              </span>
            </h2>
            <div className="space-y-4 text-gray-tech text-lg font-light leading-relaxed mb-8">
              <p>
                En <strong className="font-semibold text-navy">{siteConfig.razonSocial}</strong> nos
                especializamos en repuestos para Mercedes Benz Sprinter y vehículos de línea pesada
                y comercial. Atendemos a transportistas, talleres y flotas que necesitan piezas
                confiables para mantener sus unidades siempre en ruta.
              </p>
              <p>
                Más de una década de trabajo nos ha posicionado como referentes en{' '}
                {siteConfig.direccion.distrito}, {siteConfig.direccion.ciudad}, con un catálogo
                curado de las marcas más demandadas del mercado y asesoría técnica que solo da la
                experiencia.
              </p>
            </div>

            <div className="space-y-4">
              {PILARES.map((p) => {
                const Icon = p.icon
                return (
                  <div key={p.titulo} className="flex items-start gap-4">
                    <div className="w-11 h-11 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-navy" />
                    </div>
                    <div>
                      <p className="font-semibold text-navy">{p.titulo}</p>
                      <p className="text-sm text-gray-tech font-light">{p.descripcion}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
