'use client'

import { motion } from 'framer-motion'
import { Facebook, MoveRight, Clock } from 'lucide-react'
import { siteConfig } from '@/lib/site.config'
import { TikTokIcon } from './shared/icons'
import { fadeInUp, staggerContainer, viewportOnce } from './shared/animations'

export function SocialMedia() {
  const { facebook, tiktok } = siteConfig.redes

  const tarjetas = [
    {
      nombre: 'Facebook',
      handle: facebook.handle,
      url: facebook.url,
      icono: Facebook,
      claseIcono: 'from-[#1877F2] to-[#0d6efd]',
      claseBoton: 'bg-[#1877F2] group-hover:bg-[#0d6efd]',
      claseOverlay: 'from-[#1877F2]/10 to-transparent',
      cta: 'Visitar página',
    },
    {
      nombre: 'TikTok',
      handle: tiktok.handle,
      url: tiktok.url,
      icono: TikTokIcon,
      claseIcono: 'from-black to-black',
      claseBoton: 'bg-black group-hover:bg-[#222]',
      claseOverlay: 'from-black/5 to-transparent',
      cta: 'Ver perfil',
    },
  ]

  return (
    <section id="contacto" className="py-24 bg-gray-light relative overflow-hidden">
      {/* Decorative background blur */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/20 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            Síguenos en{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
              Redes Sociales
            </span>
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Conéctate con nosotros y conoce nuestro stock diario, promociones y novedades del mundo automotriz.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
        >
          {tarjetas.map((t) => {
            const Icon = t.icono
            return (
              <motion.a
                key={t.nombre}
                variants={fadeInUp}
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ y: -8, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="group"
                aria-label={`Visitar ${t.nombre}`}
              >
                <div className="h-full rounded-3xl overflow-hidden border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white/60 backdrop-blur-md flex flex-col relative">
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${t.claseOverlay} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />
                  <div className="px-8 pt-10 pb-6 flex flex-col items-center relative z-10">
                    <div
                      className={`w-20 h-20 bg-gradient-to-br ${t.claseIcono} rounded-2xl flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      <Icon className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-3xl font-heading font-bold text-navy">{t.nombre}</h3>
                  </div>
                  <div className="px-8 py-6 flex flex-col items-center text-center flex-1 relative z-10">
                    <p className="text-slate-500 mb-6 font-medium">{t.handle}</p>
                    <span
                      className={`inline-flex items-center gap-2 ${t.claseBoton} text-white font-semibold px-6 py-3 rounded-full text-sm group-hover:shadow-lg transition-all duration-300`}
                    >
                      {t.cta}
                      <MoveRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </motion.a>
            )
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-14 text-center"
        >
          <div className="inline-flex items-center gap-3 bg-navy/5 border border-navy/10 backdrop-blur-sm rounded-full px-8 py-4 shadow-sm hover:shadow-md transition-shadow">
            <Clock className="w-5 h-5 text-gold-dark" />
            <span className="text-navy font-semibold text-sm sm:text-base">
              Síguenos para ver nuestro stock diario y promociones exclusivas
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
