'use client'

import { motion } from 'framer-motion'
import { MapPin, Phone, Mail, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  siteConfig,
  whatsappUrl,
  telUrl,
  direccionCompleta,
} from '@/lib/site.config'
import { WhatsAppIcon } from './shared/icons'
import { viewportOnce } from './shared/animations'

export function Ubicacion() {
  const d = siteConfig.direccion

  return (
    <section id="ubicacion" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-heading font-extrabold text-navy mb-4">
            Nuestra{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-dark to-yellow-500">
              Ubicación
            </span>
          </h2>
          <p className="text-gray-tech max-w-2xl mx-auto text-lg font-light">
            Visítanos en nuestro local en {d.distrito}, {d.ciudad}. {d.nota ? `${d.nota}, ` : ''}
            con fácil acceso desde toda la ciudad.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.6 }}
          className="grid lg:grid-cols-3 gap-8 items-stretch"
        >
          <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-navy text-white h-full relative">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-bl-full -z-0" />
            <CardContent className="p-10 flex flex-col justify-center h-full relative z-10">
              <div className="space-y-8">
                {/* Dirección */}
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <MapPin className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-white">Dirección</h3>
                    <p className="text-white/70 leading-relaxed font-light">
                      {direccionCompleta()}
                      {d.nota && (
                        <>
                          <br />
                          <span className="text-sm text-gold-dark font-medium mt-1 inline-block">
                            ({d.nota})
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {/* Horario */}
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <Clock className="w-6 h-6 text-gold" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2 text-white">Horario de atención</h3>
                    <ul className="space-y-1">
                      {siteConfig.horarios.map((h) => (
                        <li
                          key={h.dia}
                          className="text-white/70 font-light text-sm flex justify-between gap-4"
                        >
                          <span>{h.dia}</span>
                          <span className="text-white/90 text-right">{h.rango}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Teléfono */}
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <Phone className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-white">Teléfono / WhatsApp</h3>
                    <a
                      href={telUrl()}
                      className="text-white/70 hover:text-gold font-light transition-colors"
                    >
                      {siteConfig.telefonoDisplay}
                    </a>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-start gap-5">
                  <div className="w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center flex-shrink-0 border border-white/10">
                    <Mail className="w-6 h-6 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1 text-white">Correo electrónico</h3>
                    <a
                      href={`mailto:${siteConfig.email}`}
                      className="text-white/70 hover:text-gold font-light transition-colors break-all"
                    >
                      {siteConfig.email}
                    </a>
                  </div>
                </div>

                <div className="pt-4">
                  <a
                    href={whatsappUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
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
              src={siteConfig.mapsEmbedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title={`Ubicación de ${siteConfig.marcaCorta}`}
            />
          </div>
        </motion.div>
      </div>
    </section>
  )
}
