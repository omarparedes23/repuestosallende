'use client'

import { MotionConfig } from 'framer-motion'
import type { MarcaAuto } from '@/lib/types/database'
import { Navbar } from './home/Navbar'
import { Hero } from './home/Hero'
import { TrustBar } from './home/TrustBar'
import { Metricas } from './home/Metricas'
import { QuienesSomos } from './home/QuienesSomos'
import { Marcas } from './home/Marcas'
import { PorQueElegirnos } from './home/PorQueElegirnos'
import { Especialidades } from './home/Especialidades'
import { Proceso } from './home/Proceso'
import { Testimonios } from './home/Testimonios'
import { SocialMedia } from './home/SocialMedia'
import { FAQ } from './home/FAQ'
import { Ubicacion } from './home/Ubicacion'
import { CtaFinal } from './home/CtaFinal'
import { Footer } from './home/Footer'
import { WhatsAppFloat } from './home/WhatsAppFloat'
import { ChatWidget } from './home/ChatWidget'
import type { ModeloConMarca } from './home/Especialidades'

interface HomePageClientProps {
  marcas: MarcaAuto[]
  modelos: ModeloConMarca[]
}

/**
 * Orquestador de la landing. La composición real vive en componentes bajo /home.
 *
 * MotionConfig reducedMotion="user" desactiva las animaciones automáticamente
 * para usuarios con prefers-reduced-motion (accesibilidad).
 */
export function HomePageClient({ marcas, modelos }: HomePageClientProps) {
  return (
    <MotionConfig reducedMotion="user">
      <Navbar />
      <main id="contenido">
        <Hero />
        <TrustBar />
        <Especialidades modelos={modelos} />
        <Metricas />
        <QuienesSomos />
        <Marcas marcas={marcas} />
        <PorQueElegirnos />
        <Proceso />
        <Testimonios />
        <SocialMedia />
        <FAQ />
        <Ubicacion />
        <CtaFinal />
      </main>
      <Footer />
      <WhatsAppFloat />
      <ChatWidget />
    </MotionConfig>
  )
}
