'use client'

import Image from 'next/image'
import { MapPin, Phone, Mail, Facebook } from 'lucide-react'
import { siteConfig, whatsappUrl, direccionCompleta, telUrl } from '@/lib/site.config'
import { TikTokIcon } from './shared/icons'

const NAV_LINKS = [
  { label: 'Inicio', href: '#hero' },
  { label: 'Nosotros', href: '#quienes-somos' },
  { label: 'Marcas', href: '#marcas' },
  { label: 'Especialidades', href: '#especialidades' },
  { label: 'Contacto', href: '#contacto' },
  { label: 'Ubicación', href: '#ubicacion' },
]

export function Footer() {
  const { facebook, tiktok } = siteConfig.redes
  const anio = new Date().getFullYear()

  return (
    <footer className="bg-navy text-white border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Marca */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg p-2 flex-shrink-0 relative overflow-hidden">
                <Image
                  src={siteConfig.imagenes.logo}
                  alt={`${siteConfig.marcaCorta} — logo`}
                  fill
                  sizes="64px"
                  className="object-contain p-1.5"
                />
              </div>
              <div>
                <h3 className="text-2xl font-heading font-extrabold leading-tight">
                  REPUESTOS ALLENDE
                </h3>
                <p className="text-gold text-sm font-semibold tracking-widest mt-0.5">E.I.R.L.</p>
              </div>
            </div>
            <p className="text-white/70 leading-relaxed mb-8 max-w-md font-light">
              Especialistas en repuestos para Mercedes Benz Sprinter, Peugeot, Hyundai, Renault e
              Iveco. Más de una década brindando confianza y calidad al sector transporte y comercial
              del Perú.
            </p>
            <div className="flex gap-4">
              <a
                href={facebook.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-white/5 border border-white/10 hover:bg-gold hover:border-gold rounded-xl flex items-center justify-center transition-all duration-300 group"
                aria-label={`Visitar Facebook (${facebook.handle})`}
              >
                <Facebook className="w-5 h-5 text-white group-hover:text-navy" />
              </a>
              <a
                href={tiktok.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-11 h-11 bg-white/5 border border-white/10 hover:bg-gold hover:border-gold rounded-xl flex items-center justify-center transition-all duration-300 group"
                aria-label={`Visitar TikTok (${tiktok.handle})`}
              >
                <TikTokIcon className="w-5 h-5 text-white group-hover:text-navy" />
              </a>
              <a
                href={`mailto:${siteConfig.email}`}
                className="w-11 h-11 bg-white/5 border border-white/10 hover:bg-gold hover:border-gold rounded-xl flex items-center justify-center transition-all duration-300 group"
                aria-label={`Escribir a ${siteConfig.email}`}
              >
                <Mail className="w-5 h-5 text-white group-hover:text-navy" />
              </a>
            </div>
          </div>

          {/* Secciones */}
          <div>
            <h4 className="font-heading font-bold text-xl mb-6 text-white">Secciones</h4>
            <ul className="space-y-4">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-white/60 hover:text-gold transition-colors font-light"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="font-heading font-bold text-xl mb-6 text-white">Contacto</h4>
            <ul className="space-y-5">
              <li className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-gold" />
                </div>
                <span className="text-white/60 text-sm font-light leading-relaxed">
                  {direccionCompleta()}
                </span>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-gold" />
                </div>
                <a
                  href={telUrl()}
                  className="text-white/60 hover:text-gold text-sm font-light transition-colors"
                >
                  {siteConfig.telefonoDisplay}
                </a>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-gold" />
                </div>
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="text-white/60 hover:text-gold text-sm font-light transition-colors break-all"
                >
                  {siteConfig.email}
                </a>
              </li>
              <li className="flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-4 h-4 text-gold"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="text-white/60 text-sm font-light">
                  {siteConfig.resumenHorarios}
                </span>
              </li>
            </ul>

            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 text-gold hover:text-gold-dark text-sm font-semibold transition-colors"
            >
              Escríbenos ahora →
            </a>
          </div>
        </div>

        <div className="border-t border-white/10 mt-16 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-sm text-center md:text-left font-light">
            &copy; {anio} {siteConfig.razonSocial}. Todos los derechos reservados. RUC:{' '}
            {siteConfig.ruc}.
          </p>
          <p className="text-white/50 text-sm font-light">
            Empresa Formal Activa y Habida — {siteConfig.direccion.pais}
          </p>
        </div>
      </div>
    </footer>
  )
}
