'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone,
  MapPin,
  Mail,
  Facebook,
  Menu,
  X,
  ChevronRight,
  Truck,
  ShieldCheck,
  Clock,
  MoveRight,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ModeloAuto } from '@/lib/types/database'

/* ============================================================
   CUSTOM ICONS
   ============================================================ */
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
)

/* ============================================================
   ANIMATION VARIANTS
   ============================================================ */
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, type: "spring", stiffness: 50 } },
} as const

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
}

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const navLinks = [
    { label: 'Inicio', href: '#hero' },
    { label: 'Marcas', href: '#marcas' },
    { label: 'Especialidades', href: '#especialidades' },
    { label: 'Contacto', href: '#contacto' },
    { label: 'Ubicación', href: '#ubicacion' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? 'bg-navy/85 backdrop-blur-xl border-b border-white/10 shadow-lg py-2' : 'bg-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#hero" className="flex items-center group">
            <img
              src="/images/repuestosallendelogo.png"
              alt="Repuestos Allende E.I.R.L."
              className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white/90 hover:text-gold text-sm font-medium transition-colors relative after:content-[''] after:absolute after:w-full after:scale-x-0 after:h-0.5 after:bottom-0 after:left-0 after:bg-gold after:origin-bottom-right after:transition-transform after:duration-300 hover:after:scale-x-100 hover:after:origin-bottom-left"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://wa.me/51975167682?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-gold text-navy hover:bg-gold-dark font-bold rounded-full px-6 shadow-[0_0_15px_rgba(255,215,0,0.3)] transition-all duration-300 hover:shadow-[0_0_25px_rgba(255,215,0,0.5)] hover:-translate-y-0.5">
                <WhatsAppIcon className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </a>
            <Link
              href="/tablet/login"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              aria-label="Acceso sistema interno"
              title="Sistema interno"
            >
              <Lock className="w-4 h-4" />
            </Link>
          </div>

          <button
            className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-navy/95 backdrop-blur-xl border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block text-white/90 hover:text-gold py-2 text-sm font-medium transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="https://wa.me/51975167682?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
                target="_blank"
                rel="noopener noreferrer"
                className="block pt-2"
              >
                <Button className="w-full bg-gold text-navy hover:bg-gold-dark font-bold rounded-full">
                  <WhatsAppIcon className="w-4 h-4 mr-2" />
                  Escríbenos por WhatsApp
                </Button>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}

/* ============================================================
   HERO
   ============================================================ */
function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[100vh] flex items-center justify-center overflow-hidden"
    >
      <div className="absolute inset-0 z-0">
        <motion.img
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          src="/images/portada.jpg"
          alt="Repuestos Allende - Tienda"
          className="w-full h-full object-cover"
        />
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
            Expertos en Repuestos para{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-200">
              Línea Pesada
            </span> y{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-200">
              Comercial
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
            <a
              href="https://wa.me/51975167682?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
              target="_blank"
              rel="noopener noreferrer"
            >
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

/* ============================================================
   TRUST BAR (FLOATING)
   ============================================================ */
function TrustBar() {
  return (
    <section className="relative z-20 -mt-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <p className="text-navy font-bold text-sm sm:text-base">RUC: 20610105280</p>
            <p className="text-slate-500 text-xs font-medium">REPUESTOS ALLENDE E.I.R.L.</p>
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
          <p className="text-navy font-semibold text-sm sm:text-base">La Victoria, Lima — Perú</p>
        </div>
      </motion.div>
    </section>
  )
}

/* ============================================================
   MARCAS
   ============================================================ */
function Marcas() {
  const brands = [
    { name: 'Mercedes-Benz', logo: '/images/mercedesbenz.png' },
    { name: 'Sprinter', logo: '/images/sprinter.jpg' },
    { name: 'Peugeot', logo: '/images/peugeot.webp' },
    { name: 'Hyundai', logo: '/images/hyundailogo.jpg' },
    { name: 'Renault', logo: '/images/renaultlogo.svg' },
    { name: 'Iveco', logo: '/images/iveco.jpg' },
  ]

  return (
    <section id="marcas" className="pt-32 pb-20 bg-gray-light">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            Marcas que <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">Trabajamos</span>
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Repuestos originales y de alta calidad para las principales marcas del mercado peruano.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6"
        >
          {brands.map((brand) => (
            <motion.div
              key={brand.name}
              variants={fadeInUp}
              className="h-full"
            >
              <Card className="h-full border-0 bg-white/70 backdrop-blur-sm shadow-md hover:shadow-2xl hover:shadow-navy/10 hover:-translate-y-2 transition-all duration-300 cursor-default rounded-2xl group">
                <CardContent className="flex flex-col items-center justify-center py-8 px-4">
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center mb-4 bg-white border border-slate-100 shadow-sm overflow-hidden p-2 group-hover:scale-110 transition-transform duration-300">
                    <img
                      src={brand.logo}
                      alt={`Logo ${brand.name}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                      }}
                    />
                  </div>
                  <h3 className="text-navy font-bold text-center text-sm">{brand.name}</h3>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

/* ============================================================
   ESPECIALIDADES
   ============================================================ */
function Especialidades({ modelos }: { modelos: ModeloAuto[] }) {
  return (
    <section id="especialidades" className="py-24 bg-navy relative overflow-hidden">
      {/* Decorative spotlight background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-[600px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-white mb-4">
            Nuestras <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold to-yellow-200">Especialidades</span>
          </h2>
          <p className="text-white/70 max-w-2xl mx-auto text-lg font-light">
            Selecciona tu modelo y encuentra el repuesto que necesitas con garantía y asesoría experta.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
        >
          {modelos.map((modelo) => {
            const años =
              modelo.año_desde && modelo.año_hasta
                ? `${modelo.año_desde} – ${modelo.año_hasta}`
                : null

            return (
              <motion.div key={modelo.slug} variants={fadeInUp} className="h-full">
                <Link href={`/catalogo/${modelo.slug}`} className="block h-full group">
                  <div className="bg-slate-50 rounded-2xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] hover:shadow-blue-900/50 transition-all duration-300 overflow-hidden h-full flex flex-col hover:-translate-y-2">

                    {/* Image area */}
                    <div className="relative bg-slate-50 px-4 pt-8 pb-3 overflow-hidden">
                      <div className="absolute inset-0 bg-navy/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center">
                        <img
                          src="/images/mercedesbenz.png"
                          alt="Mercedes-Benz"
                          className="w-6 h-6 object-contain"
                        />
                      </div>
                      <img
                        src={modelo.imagen_url ?? '/images/modulos.jpg'}
                        alt={modelo.nombre}
                        className="w-full h-44 object-contain relative z-10 transition-transform duration-500 group-hover:scale-110"
                      />
                    </div>

                    {/* Name + tagline */}
                    <div className="px-5 py-4 text-center border-t border-slate-200/60 relative bg-slate-50 z-10">
                      <h3 className="text-navy font-heading font-bold text-base leading-tight">
                        {modelo.nombre}
                      </h3>
                      {modelo.tagline && (
                        <p className="text-slate-500 text-xs mt-1.5 leading-snug">{modelo.tagline}</p>
                      )}
                    </div>

                    {/* Specs row */}
                    <div className="grid grid-cols-3 border-t border-slate-200/60 divide-x divide-slate-200/60 bg-slate-100/50">
                      <div className="py-3 text-center">
                        <p className="font-bold text-navy text-[11px] leading-tight px-1">
                          {modelo.motor ?? '—'}
                        </p>
                        <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">Motor</p>
                      </div>
                      <div className="py-3 text-center">
                        <p className="font-bold text-navy text-[11px]">{modelo.cc ?? '—'}</p>
                        <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">Cilindrada</p>
                      </div>
                      <div className="py-3 text-center">
                        <p className="font-bold text-navy text-[11px] leading-tight px-1">
                          {años ?? '—'}
                        </p>
                        <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">Años</p>
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
      </div>
    </section>
  )
}

/* ============================================================
   SOCIAL MEDIA & CONTACTO
   ============================================================ */
function SocialMedia() {
  return (
    <section
      id="contacto"
      className="py-24 bg-gray-light relative overflow-hidden"
    >
      {/* Decorative background blur */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gold/20 rounded-full blur-3xl -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            Síguenos en <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">Redes Sociales</span>
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Conéctate con nosotros y conoce nuestro stock diario, promociones y novedades del mundo automotriz.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
        >
          {/* Facebook */}
          <motion.a
            variants={fadeInUp}
            href="https://www.facebook.com/repuestosallendeeirl"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="group"
          >
            <div className="h-full rounded-3xl overflow-hidden border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white/60 backdrop-blur-md flex flex-col relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1877F2]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="px-8 pt-10 pb-6 flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-gradient-to-br from-[#1877F2] to-[#0d6efd] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-500/30 group-hover:scale-110 transition-transform duration-300">
                  <Facebook className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-3xl font-heading font-bold text-navy">Facebook</h3>
              </div>
              <div className="px-8 py-6 flex flex-col items-center text-center flex-1 relative z-10">
                <p className="text-slate-500 mb-6 font-medium">@repuestosallendeeirl</p>
                <span className="inline-flex items-center gap-2 bg-[#1877F2] text-white font-semibold px-6 py-3 rounded-full text-sm group-hover:bg-[#0d6efd] group-hover:shadow-lg transition-all duration-300">
                  Visitar página
                  <MoveRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </motion.a>

          {/* TikTok */}
          <motion.a
            variants={fadeInUp}
            href="https://www.tiktok.com/@repuestos_allende"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ y: -8, scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 300 }}
            className="group"
          >
            <div className="h-full rounded-3xl overflow-hidden border border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 bg-white/60 backdrop-blur-md flex flex-col relative">
              <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="px-8 pt-10 pb-6 flex flex-col items-center relative z-10">
                <div className="w-20 h-20 bg-black rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </div>
                <h3 className="text-3xl font-heading font-bold text-navy">TikTok</h3>
              </div>
              <div className="px-8 py-6 flex flex-col items-center text-center flex-1 relative z-10">
                <p className="text-slate-500 mb-6 font-medium">@repuestos_allende</p>
                <span className="inline-flex items-center gap-2 bg-black text-white font-semibold px-6 py-3 rounded-full text-sm group-hover:bg-[#222] group-hover:shadow-lg transition-all duration-300">
                  Ver perfil
                  <MoveRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
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

/* ============================================================
   UBICACIÓN
   ============================================================ */
function Ubicacion() {
  return (
    <section id="ubicacion" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            Nuestra <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">Ubicación</span>
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Visítanos en nuestro local en La Victoria, Lima. Estamos al lado del BBVA, con fácil acceso desde toda la ciudad.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid lg:grid-cols-3 gap-8 items-stretch"
        >
          <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-navy text-white h-full relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-bl-full -z-0" />
            <CardContent className="p-10 flex flex-col justify-center h-full relative z-10">
              <div className="space-y-10">
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <MapPin className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-white">Dirección</h3>
                    <p className="text-white/70 leading-relaxed font-light">
                      Av. Manco Cápac 316, La Victoria, Lima, Perú
                      <br />
                      <span className="text-sm text-gold-dark font-medium mt-1 inline-block">(Al lado del BBVA)</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <Phone className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-white">Teléfono / WhatsApp</h3>
                    <p className="text-white/70 font-light">+51 975 167 682</p>
                  </div>
                </div>

                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <Mail className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-white">Correo electrónico</h3>
                    <p className="text-white/70 font-light">ventas@repuestosallende.com</p>
                  </div>
                </div>

                <div className="pt-6">
                  <a
                    href="https://wa.me/51975167682?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="w-full bg-gold text-navy hover:bg-gold-dark font-bold rounded-full py-7 text-base shadow-[0_0_15px_rgba(255,215,0,0.2)] transition-all hover:shadow-[0_0_25px_rgba(255,215,0,0.4)] hover:-translate-y-1">
                      <WhatsAppIcon className="w-5 h-5 mr-2" />
                      Escríbenos por WhatsApp
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 h-[450px] lg:h-auto rounded-3xl overflow-hidden shadow-2xl border border-slate-100">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3901.757758805028!2d-77.0138889!3d-12.0641667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105c8db1e1e1e1f%3A0x1e1e1e1e1e1e1e1e!2sAv.%20Manco%20C%C3%A1pac%20316%2C%20La%20Victoria%2015018%2C%20Per%C3%BA!5e0!3m2!1ses!2sus!4v1713800000000!5m2!1ses!2sus"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Repuestos Allende"
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  return (
    <footer className="bg-navy text-white border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg p-2 flex-shrink-0">
                <img 
                  src="/images/repuestosallendelogo.png" 
                  alt="Repuestos Allende" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-2xl font-heading font-extrabold leading-tight">REPUESTOS ALLENDE</h3>
                <p className="text-gold text-sm font-semibold tracking-widest mt-0.5">E.I.R.L.</p>
              </div>
            </div>
            <p className="text-white/70 leading-relaxed mb-8 max-w-md font-light">
              Especialistas en repuestos para Mercedes Benz Sprinter, Peugeot, Hyundai, Renault e Iveco.
              Más de una década brindando confianza y calidad al sector transporte y comercial del Perú.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/repuestosallendeeirl"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-white/5 border border-white/10 hover:bg-gold hover:border-gold rounded-xl flex items-center justify-center transition-all duration-300 group"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5 text-white group-hover:text-navy" />
              </a>
              <a
                href="https://www.tiktok.com/@repuestos_allende"
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-white/5 border border-white/10 hover:bg-gold hover:border-gold rounded-xl flex items-center justify-center transition-all duration-300 group"
                aria-label="TikTok"
              >
                <svg
                  className="w-5 h-5 text-white group-hover:text-navy"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
              <a
                href="mailto:ventas@repuestosallende.com"
                className="w-11 h-11 bg-white/5 border border-white/10 hover:bg-gold hover:border-gold rounded-xl flex items-center justify-center transition-all duration-300 group"
                aria-label="Email"
              >
                <Mail className="w-5 h-5 text-white group-hover:text-navy" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-heading font-bold text-xl mb-6 text-white">Secciones</h4>
            <ul className="space-y-4">
              {[
                { label: 'Inicio', href: '#hero' },
                { label: 'Marcas', href: '#marcas' },
                { label: 'Especialidades', href: '#especialidades' },
                { label: 'Contacto', href: '#contacto' },
                { label: 'Ubicación', href: '#ubicacion' },
              ].map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="text-white/60 hover:text-gold transition-colors font-light">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-heading font-bold text-xl mb-6 text-white">Contacto</h4>
            <ul className="space-y-5">
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-gold" />
                </div>
                <span className="text-white/60 text-sm font-light leading-relaxed">
                  Av. Manco Cápac 316, <br />La Victoria, Lima, Perú
                </span>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-gold" />
                </div>
                <span className="text-white/60 text-sm font-light">+51 975 167 682</span>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-gold" />
                </div>
                <span className="text-white/60 text-sm font-light">ventas@repuestosallende.com</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/40 text-sm text-center md:text-left font-light">
            &copy; {new Date().getFullYear()} Repuestos Allende E.I.R.L. Todos los derechos reservados. RUC: 20610105280.
          </p>
          <p className="text-white/40 text-sm font-light">Empresa Formal Activa y Habida — Perú</p>
        </div>
      </div>
    </footer>
  )
}

/* ============================================================
   WHATSAPP FLOAT
   ============================================================ */
function WhatsAppFloat() {
  return (
    <motion.a
      href="https://wa.me/51975167682?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full p-4 shadow-[0_10px_25px_rgba(37,211,102,0.5)] transition-all duration-300"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1, y: -5 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Contactar por WhatsApp"
    >
      <WhatsAppIcon className="w-7 h-7" />
    </motion.a>
  )
}

/* ============================================================
   MAIN EXPORT
   ============================================================ */
export function HomePageClient({ modelos }: { modelos: ModeloAuto[] }) {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <Marcas />
        <Especialidades modelos={modelos} />
        <SocialMedia />
        <Ubicacion />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  )
}
