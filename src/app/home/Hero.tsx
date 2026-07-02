'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { ChevronRight, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siteConfig, whatsappUrl } from '@/lib/site.config'
import { WhatsAppIcon } from './shared/icons'
import { fadeInUp, staggerContainer } from './shared/animations'

export function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[100vh] flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 z-0">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          className="relative w-full h-full"
        >
          <Image
            src={siteConfig.imagenes.portada}
            alt={`${siteConfig.marcaCorta} — tienda de repuestos en ${siteConfig.direccion.distrito}, ${siteConfig.direccion.ciudad}`}
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/90 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-40 w-full">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-3xl"
        >
          <motion.div
            variants={fadeInUp}
            className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 shadow-lg"
          >
            <ShieldCheck className="w-4 h-4 text-gold" />
            <span className="text-white text-sm font-semibold tracking-wide">
              EMPRESA FORMAL Y HABIDA
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-5xl sm:text-6xl lg:text-7xl font-heading font-extrabold text-white leading-tight mb-6 tracking-tight drop-shadow-md"
          >
            Expertos en Repuestos{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-200">
              Sprinter Mercedes Benz
            </span>{' '}
            y{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-200">
              Línea Pesada
            </span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-white/80 mb-10 max-w-2xl leading-relaxed font-light"
          >
            Somos especialistas en repuestos originales y certificados para Mercedes Benz Sprinter,
            Peugeot, Hyundai, Renault e Iveco. Más de una década brindando soluciones a
            transportistas y flotas del Perú.
          </motion.p>

          <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row gap-4">
            <a href={whatsappUrl()} target="_blank" rel="noopener noreferrer">
              <Button className="bg-gradient-to-r from-gold to-[#ffdf33] text-navy hover:from-[#e6c200] hover:to-[#ffdf33] font-bold rounded-full px-8 py-7 text-base shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] hover:-translate-y-1">
                <WhatsAppIcon className="w-5 h-5 mr-2" />
                Cotiza por WhatsApp
              </Button>
            </a>
            <a href="#especialidades">
              <Button
                variant="outline"
                className="border-white/30 bg-white/5 backdrop-blur-sm text-white hover:bg-white/10 hover:text-white rounded-full px-8 py-7 text-base transition-all duration-300"
              >
                Ver Especialidades
                <ChevronRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
