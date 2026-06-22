'use client'

import { motion } from 'framer-motion'
import { pasos } from '@/lib/home/content'
import { siteConfig, whatsappUrl } from '@/lib/site.config'
import { Button } from '@/components/ui/button'
import { WhatsAppIcon } from './shared/icons'
import { fadeInUp, staggerContainer, viewportOnce } from './shared/animations'

export function Proceso() {
  return (
    <section className="py-24 bg-gray-light relative overflow-hidden">
      <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-gold-dark font-semibold text-sm uppercase tracking-widest mb-3">
            Paso a paso
          </span>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            ¿Cómo{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
              comprar
            </span>{' '}
            repuestos?
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Un proceso simple y transparente, de la consulta a la entrega.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 relative"
        >
          {/* Línea conectora horizontal (desktop) */}
          <div className="hidden lg:block absolute top-9 left-[12.5%] right-[12.5%] h-0.5 bg-gradient-to-r from-navy/20 via-gold/40 to-navy/20 -z-10" />

          {pasos.map((p) => (
            <motion.div key={p.numero} variants={fadeInUp} className="text-center relative">
              <div className="relative inline-flex items-center justify-center mb-6">
                <div className="w-18 h-18 rounded-full bg-white border-2 border-gold shadow-lg w-[72px] h-[72px] flex items-center justify-center">
                  <span className="text-2xl font-heading font-extrabold text-navy">{p.numero}</span>
                </div>
              </div>
              <h3 className="font-heading font-bold text-lg text-navy mb-2">{p.titulo}</h3>
              <p className="text-sm text-gray-tech font-light leading-relaxed px-2">
                {p.descripcion}
              </p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-center mt-14"
        >
          <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
            <Button className="bg-gold text-navy hover:bg-gold-dark font-bold rounded-full px-8 py-6 text-base shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all hover:-translate-y-1">
              <WhatsAppIcon className="w-5 h-5 mr-2" />
              Empezar ahora por WhatsApp
            </Button>
          </a>
          <p className="text-gray-tech text-sm mt-4 font-light">
            Te respondemos en horario comercial — {siteConfig.resumenHorarios}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
