'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { siteConfig } from '@/lib/site.config'

const NAV_LINKS = [
  { label: 'Inicio', href: '#hero' },
  { label: 'Nosotros', href: '#quienes-somos' },
  { label: 'Marcas', href: '#marcas' },
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Contacto', href: '#ubicacion' },
]

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-navy/85 backdrop-blur-xl border-b border-white/10 shadow-lg py-2'
          : 'bg-transparent py-4'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <a href="#hero" className="flex items-center group" aria-label={siteConfig.razonSocial}>
            {/* PERFORMANCE: el archivo original pesa ~4MB. Comprimir a <100KB mejora el LCP. */}
            <Image
              src={siteConfig.imagenes.logo}
              alt={`${siteConfig.razonSocial} — logo`}
              width={192}
              height={48}
              style={{ width: 'auto', height: '3rem' }}
              className="object-contain transition-transform duration-300 group-hover:scale-105"
              priority
            />
          </a>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
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
            <Link
              href="/tablet/login"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
              aria-label="Acceso al sistema interno"
              title="Sistema interno"
            >
              <Lock className="w-4 h-4" />
            </Link>
          </div>

          <button
            className="md:hidden text-white p-2 hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={isOpen}
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
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block text-white/90 hover:text-gold py-2 text-sm font-medium transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <Link
                href="/tablet/login"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 text-white/60 hover:text-gold py-2 text-sm font-medium transition-colors"
              >
                <Lock className="w-4 h-4" />
                Sistema interno
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
