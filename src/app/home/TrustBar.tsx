'use client'

import { motion } from 'framer-motion'
import { ShieldCheck, MapPin } from 'lucide-react'
import { siteConfig } from '@/lib/site.config'

export function TrustBar() {
  return (
    <section className="relative z-20 -mt-20 mb-16 sm:mb-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="bg-white/90 backdrop-blur-xl border border-white rounded-2xl shadow-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-around gap-6 sm:gap-10 text-center"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-navy/5 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-navy" />
          </div>
          <div className="text-left">
            <p className="text-navy font-bold text-sm sm:text-base">
              RUC: {siteConfig.ruc}
            </p>
            <p className="text-slate-500 text-xs font-medium">{siteConfig.razonSocial}</p>
          </div>
        </div>
        <div className="hidden sm:block w-px h-12 bg-slate-200" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6 text-gold-dark" />
          </div>
          <p className="text-navy font-semibold text-sm sm:text-base">
            Empresa Formal Activa y Habida
          </p>
        </div>
        <div className="hidden md:block w-px h-12 bg-slate-200" />
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-navy/5 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-6 h-6 text-navy" />
          </div>
          <p className="text-navy font-semibold text-sm sm:text-base">
            {siteConfig.direccion.distrito}, {siteConfig.direccion.ciudad} — {siteConfig.direccion.pais}
          </p>
        </div>
      </motion.div>
    </section>
  )
}
