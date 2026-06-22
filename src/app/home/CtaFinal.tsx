'use client'

import { motion } from 'framer-motion'
import { Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siteConfig, whatsappUrl, telUrl } from '@/lib/site.config'
import { WhatsAppIcon } from './shared/icons'
import { viewportOnce } from './shared/animations'

export function CtaFinal() {
  return (
    <section className="relative overflow-hidden bg-navy py-24">
      {/* Brillo dorado de fondo */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-gold/40 via-yellow-300/20 to-gold/40 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl sm:text-5xl font-heading font-extrabold text-white mb-6 leading-tight">
            ¿Listo para encontrar el{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-200">
              repuesto correcto
            </span>
            ?
          </h2>
          <p className="text-white/80 text-lg sm:text-xl font-light mb-10 max-w-2xl mx-auto leading-relaxed">
            Escríbenos ahora y recibe asesoría experta al instante. Estamos para ayudarte a mantener
            tu unidad en ruta.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
              <Button className="bg-gradient-to-r from-gold to-[#ffdf33] text-navy hover:from-[#e6c200] hover:to-[#ffdf33] font-bold rounded-full px-8 py-7 text-base shadow-[0_0_25px_rgba(255,215,0,0.5)] transition-all duration-300 hover:shadow-[0_0_35px_rgba(255,215,0,0.7)] hover:-translate-y-1">
                <WhatsAppIcon className="w-5 h-5 mr-2" />
                Cotizar por WhatsApp
              </Button>
            </a>
            <a href={telUrl()}>
              <Button
                variant="outline"
                className="border-white/30 bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 hover:text-white rounded-full px-8 py-7 text-base transition-all duration-300"
              >
                <Phone className="w-5 h-5 mr-2" />
                {siteConfig.telefonoDisplay}
              </Button>
            </a>
          </div>

          <p className="text-white/60 text-sm mt-8 font-light">
            Atención {siteConfig.resumenHorarios} · {siteConfig.direccion.distrito},{' '}
            {siteConfig.direccion.ciudad}
          </p>
        </motion.div>
      </div>
    </section>
  )
}
