'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { faqItems } from '@/lib/home/content'
import { fadeInUp, staggerContainer, viewportOnce } from './shared/animations'

export function FAQ() {
  const [abierta, setAbierta] = useState<number | null>(0)

  // Schema JSON-LD para rich snippets de Google (FAQPage).
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.pregunta,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.respuesta,
      },
    })),
  }

  return (
    <section id="faq" className="py-24 bg-gray-light relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-gold-dark font-semibold text-sm uppercase tracking-widest mb-3">
            Preguntas frecuentes
          </span>
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            ¿Tienes{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
              dudas
            </span>
            ?
          </h2>
          <p className="text-gray-tech text-lg font-light">
            Resolvemos las consultas más comunes de nuestros clientes.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          variants={staggerContainer}
          className="space-y-4"
        >
          {faqItems.map((item, i) => {
            const open = abierta === i
            return (
              <motion.div
                key={item.pregunta}
                variants={fadeInUp}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  open
                    ? 'bg-white border-gold/40 shadow-lg'
                    : 'bg-white/60 border-slate-100 hover:bg-white'
                }`}
              >
                <button
                  onClick={() => setAbierta(open ? null : i)}
                  className="w-full flex items-center justify-between gap-4 p-6 text-left"
                  aria-expanded={open}
                  aria-controls={`faq-panel-${i}`}
                >
                  <span className="font-heading font-bold text-navy text-base sm:text-lg">
                    {item.pregunta}
                  </span>
                  <motion.span
                    animate={{ rotate: open ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      open ? 'bg-gold text-navy' : 'bg-navy/5 text-navy'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div
                      id={`faq-panel-${i}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: 'easeInOut' }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-6 text-gray-tech font-light leading-relaxed">
                        {item.respuesta}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </motion.div>
      </div>

      {/* Schema JSON-LD inyectado para SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
    </section>
  )
}
