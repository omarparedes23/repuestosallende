import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { siteConfig } from '@/lib/site.config'

export const metadata: Metadata = {
  title: 'Catálogo de Repuestos — Repuestos Allende E.I.R.L.',
  description: 'Encuentre el repuesto que necesita para su unidad. Suspensión, dirección, motor y caja.',
}

export default function CatalogoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col">
      <nav className="bg-[#002D62] shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group" aria-label={siteConfig.razonSocial}>
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center p-1.5 shadow-sm flex-shrink-0 relative overflow-hidden">
                <Image
                  src={siteConfig.imagenes.logo}
                  alt={`${siteConfig.marcaCorta} — logo`}
                  fill
                  sizes="40px"
                  className="object-contain p-1"
                />
              </div>
              <div className="hidden sm:block">
                <p className="text-white font-bold text-sm leading-tight">REPUESTOS ALLENDE</p>
                <p className="text-[#FFD700] text-[9px] font-semibold tracking-wider">E.I.R.L.</p>
              </div>
            </Link>

            <Link
              href="/#especialidades"
              className="flex items-center gap-2 text-white/80 hover:text-[#FFD700] text-sm font-medium transition-colors"
            >
              ← Volver a modelos
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1">{children}</main>

      <footer className="bg-[#002D62] text-white/60 text-center text-xs py-4">
        © {new Date().getFullYear()} {siteConfig.razonSocial} · RUC: {siteConfig.ruc}
      </footer>
    </div>
  )
}
