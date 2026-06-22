'use client'

import { motion } from 'framer-motion'
import { beneficios } from '@/lib/home/content'
import { fadeInUp, staggerContainer, viewportOnce } from './shared/animations'

export function PorQueElegirnos() {
  return (
    <section className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-gold-dark font-semibold text-sm uppercase tracking-widest mb-3">
            Ventajas
          </span>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            ¿Por qué elegir{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
              Repuestos Allende
            </span>
            ?
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Más que vender repuestos, te acompañamos para que tu unidad vuelva a la ruta cuanto antes.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {beneficios.map((b) => {
            const Icon = b.icon
            return (
              <motion.div
                key={b.titulo}
                variants={fadeInUp}
                whileHover={{ y: -6 }}
                className="group h-full bg-gradient-to-br from-slate-50 to-white border border-slate-100 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-navy to-blue-700 flex items-center justify-center mb-6 shadow-lg shadow-navy/20 group-hover:scale-110 transition-transform duration-300">
                  <Icon className="w-7 h-7 text-gold" />
                </div>
                <h3 className="font-heading font-bold text-xl text-navy mb-3">{b.titulo}</h3>
                <p className="text-gray-tech font-light leading-relaxed">{b.descripcion}</p>
              </motion.div>
            )
          })}
        </motion.div>
      </div>
    </section>
  )
}
