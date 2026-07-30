'use client'

import { motion } from 'framer-motion'
import { Quote } from 'lucide-react'
import { testimonios } from '@/lib/home/content'
import { fadeInUp, staggerContainer, viewportOnce } from './shared/animations'
import { EstrellasIcon } from './shared/icons'

export function Testimonios() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="absolute top-10 right-10 text-gold/5">
        <Quote className="w-64 h-64" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-gold-dark font-semibold text-sm uppercase tracking-widest mb-3">
            Testimonios
          </span>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            Lo que dicen{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
              nuestros clientes
            </span>
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            La confianza de transportistas, talleres y flotas es nuestro mejor respaldo.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8"
        >
          {testimonios.map((t) => (
            <motion.div
              key={t.nombre}
              variants={fadeInUp}
              whileHover={{ y: -6 }}
              className="bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow duration-300 relative"
            >
              <Quote className="w-8 h-8 text-gold mb-4" />
              <EstrellasIcon cantidad={t.estrellas} className="mb-4 [&_svg]:w-4 [&_svg]:h-4" />
              <p className="text-gray-tech font-light leading-relaxed mb-6 italic">
                &ldquo;{t.texto}&rdquo;
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-navy to-blue-700 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {t.nombre.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold text-navy text-sm">{t.nombre}</p>
                  <p className="text-xs text-gray-tech font-light">{t.rol}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

      </div>
    </section>
  )
}
