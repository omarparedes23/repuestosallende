import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { siteConfig } from '@/lib/site.config'
import type { ModeloConMarca } from '../home/Especialidades'

export const metadata: Metadata = {
  alternates: {
    canonical: '/catalogo',
  },
}

async function fetchModelos(): Promise<ModeloConMarca[]> {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('ra_modelos_auto')
    .select('*, marca:ra_marcas_auto(id, nombre)')
    .eq('activo', true)
    .order('nombre')
  return (data ?? []) as ModeloConMarca[]
}

export default async function CatalogoIndexPage() {
  const modelos = await fetchModelos()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-heading font-extrabold text-[#002D62] mb-4">
          Catálogo de Repuestos
        </h1>
        <p className="text-slate-500 max-w-2xl mx-auto text-lg">
          Selecciona tu modelo y encuentra el repuesto que necesitas con garantía y asesoría
          experta.
        </p>
      </div>

      {modelos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {modelos.map((modelo) => {
            const años =
              modelo.año_desde && modelo.año_hasta
                ? `${modelo.año_desde} – ${modelo.año_hasta}`
                : null

            return (
              <Link
                key={modelo.slug}
                href={`/catalogo/${modelo.slug}`}
                className="block h-full group"
              >
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden h-full flex flex-col hover:-translate-y-1">
                  <div className="relative bg-slate-50 h-44 w-full">
                    <Image
                      src={modelo.imagen_url ?? siteConfig.imagenes.modulos}
                      alt={modelo.nombre}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 25vw"
                      className="object-contain p-4 transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>

                  <div className="px-5 py-4 text-center border-t border-slate-100">
                    <h3 className="text-[#002D62] font-heading font-bold text-base leading-tight">
                      {modelo.nombre}
                    </h3>
                    {modelo.tagline && (
                      <p className="text-slate-500 text-xs mt-1.5 leading-snug">
                        {modelo.tagline}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-3 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50">
                    <div className="py-3 text-center">
                      <p className="font-bold text-[#002D62] text-[11px] leading-tight px-1">
                        {modelo.motor ?? '—'}
                      </p>
                      <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">
                        Motor
                      </p>
                    </div>
                    <div className="py-3 text-center">
                      <p className="font-bold text-[#002D62] text-[11px]">{modelo.cc ?? '—'}</p>
                      <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">
                        Cilindrada
                      </p>
                    </div>
                    <div className="py-3 text-center">
                      <p className="font-bold text-[#002D62] text-[11px] leading-tight px-1">
                        {años ?? '—'}
                      </p>
                      <p className="text-slate-400 text-[9px] uppercase tracking-wider mt-1">
                        Años
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-100 mt-auto">
                    <div className="w-full bg-slate-50 group-hover:bg-[#FFD700] text-[#002D62] font-bold py-2.5 rounded-xl transition-all duration-300 text-xs text-center flex items-center justify-center gap-1.5 border border-slate-200 group-hover:border-transparent">
                      VER REPUESTOS
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <p className="text-center text-slate-500 py-16">
          Próximamente publicaremos el catálogo de modelos.
        </p>
      )}
    </div>
  )
}
