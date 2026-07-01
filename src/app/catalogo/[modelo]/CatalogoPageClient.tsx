'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Phone, Package, Filter } from 'lucide-react'
import type { ModeloAuto, CatalogoRepuesto, Categoria } from '@/lib/types/database'
import { siteConfig, whatsappUrl } from '@/lib/site.config'
import { productoSlug } from '@/lib/slug'

type RepuestoConCategoria = CatalogoRepuesto & {
  categoria: Pick<Categoria, 'id' | 'nombre' | 'slug' | 'orden'> | null
}

/** Modelo con su marca relacionada (join desde page.tsx). */
type ModeloConMarca = ModeloAuto & {
  marca?: { id: string; nombre: string } | null
}

const CATEGORIA_COLORS: Record<string, string> = {
  'Suspensión': 'bg-blue-100 text-blue-700',
  'Dirección':  'bg-purple-100 text-purple-700',
  'Motor':      'bg-orange-100 text-orange-700',
  'Caja':       'bg-green-100 text-green-700',
}

function ProductoCard({ repuesto, priority = false }: { repuesto: RepuestoConCategoria; priority?: boolean }) {
  const categoriaNombre = repuesto.categoria?.nombre ?? ''

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group">
      <Link href={`/catalogo/producto/${productoSlug(repuesto.nombre, repuesto.id)}`}>
        <div className="bg-slate-50 p-4 flex items-center justify-center h-64 border-b border-slate-100">
          <div className="relative w-full h-full">
            <Image
              src={repuesto.imagen_url ?? siteConfig.imagenes.modulos}
              alt={repuesto.nombre}
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-contain transition-transform duration-300 group-hover:scale-105"
              priority={priority}
            />
          </div>
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <span className={`self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2 ${CATEGORIA_COLORS[categoriaNombre] ?? 'bg-slate-100 text-slate-600'}`}>
          {categoriaNombre}
        </span>

        <Link href={`/catalogo/producto/${productoSlug(repuesto.nombre, repuesto.id)}`}>
          <h3 className="font-bold text-[#002D62] text-sm leading-snug mb-1 hover:underline">{repuesto.nombre}</h3>
        </Link>

        {repuesto.codigo_oem && (
          <p className="text-slate-400 text-[11px] mb-2">OEM: {repuesto.codigo_oem}</p>
        )}

        <p className="text-slate-500 text-xs leading-relaxed line-clamp-3 mb-3">
          {repuesto.descripcion}
        </p>

        <div className="mt-auto pt-3 border-t border-slate-100">
          <p className="text-[#002D62] text-xs font-semibold mb-2 flex items-center gap-1">
            <Package className="w-3 h-3 text-[#FFD700]" />
            Consulte disponibilidad
          </p>
          <a
            href={whatsappUrl(`Hola Repuestos Allende, estoy interesado en: ${repuesto.nombre}${repuesto.codigo_oem ? ` (OEM: ${repuesto.codigo_oem})` : ''}. ¿Tienen disponibilidad?`)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-xs font-bold py-2.5 rounded-xl transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}

export function CatalogoPageClient({
  modelo,
  repuestos,
  categorias,
}: {
  modelo: ModeloConMarca
  repuestos: RepuestoConCategoria[]
  categorias: Pick<Categoria, 'id' | 'nombre' | 'slug' | 'orden'>[]
}) {
  const [categoriaActiva, setCategoriaActiva] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const repuestosFiltrados = categoriaActiva
    ? repuestos.filter((r) => r.categoria?.nombre === categoriaActiva)
    : repuestos

  const conteo = (nombre: string) =>
    repuestos.filter((r) => r.categoria?.nombre === nombre).length

  const años =
    modelo.año_desde && modelo.año_hasta
      ? `${modelo.año_desde} – ${modelo.año_hasta}`
      : null

  return (
    <>
      {/* Model hero strip */}
      <div className="bg-[#002D62]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="w-40 h-28 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden p-3">
              <div className="relative w-full h-full">
                <Image
                  src={modelo.imagen_url ?? siteConfig.imagenes.modulos}
                  alt={modelo.nombre}
                  fill
                  sizes="160px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[#FFD700] text-xs font-bold uppercase tracking-widest mb-1">
                {modelo.marca?.nombre ?? 'Repuestos'}
              </p>
              <h1 className="text-white text-3xl sm:text-4xl font-extrabold mb-2">
                {modelo.nombre}
              </h1>
              {modelo.tagline && (
                <p className="text-white/60 text-sm mb-4">{modelo.tagline}</p>
              )}
              <div className="flex flex-wrap justify-center sm:justify-start gap-4">
                {modelo.motor && (
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">{modelo.motor}</p>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">Motor</p>
                  </div>
                )}
                {modelo.cc && (
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">{modelo.cc}</p>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">Cilindrada</p>
                  </div>
                )}
                {años && (
                  <div className="text-center">
                    <p className="text-white font-bold text-sm">{años}</p>
                    <p className="text-white/40 text-[10px] uppercase tracking-wider">Años</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">

          {/* Sidebar — desktop */}
          <aside className="hidden lg:block w-56 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-[#002D62] font-bold text-sm uppercase tracking-wider">Filtrar por</h2>
              </div>
              <div className="p-3 space-y-1">
                <button
                  onClick={() => setCategoriaActiva(null)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex justify-between items-center ${
                    categoriaActiva === null
                      ? 'bg-[#002D62] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span>Todos</span>
                  <span className={`text-xs rounded-full px-2 py-0.5 ${categoriaActiva === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {repuestos.length}
                  </span>
                </button>
                {categorias.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setCategoriaActiva(cat.nombre)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex justify-between items-center ${
                      categoriaActiva === cat.nombre
                        ? 'bg-[#002D62] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>{cat.nombre}</span>
                    <span className={`text-xs rounded-full px-2 py-0.5 ${categoriaActiva === cat.nombre ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      {conteo(cat.nombre)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="p-4 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-3">¿No encuentra lo que busca?</p>
                <a
                  href={whatsappUrl('Hola, busco un repuesto para mi unidad.')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-[#FFD700] hover:bg-[#e6c200] text-[#002D62] text-xs font-bold py-2.5 rounded-xl transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" />
                  Consulte al equipo
                </a>
              </div>
            </div>
          </aside>

          {/* Grid area */}
          <div className="flex-1 min-w-0">

            {/* Toolbar */}
            <div className="flex items-center justify-between mb-5">
              <p className="text-slate-500 text-sm">
                Mostrando{' '}
                <span className="font-bold text-[#002D62]">{repuestosFiltrados.length}</span>{' '}
                {repuestosFiltrados.length === 1 ? 'repuesto' : 'repuestos'}
                {categoriaActiva && (
                  <span className="ml-1">· <span className="text-[#002D62] font-semibold">{categoriaActiva}</span></span>
                )}
              </p>

              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden flex items-center gap-2 bg-white border border-slate-200 text-[#002D62] text-sm font-medium px-4 py-2 rounded-xl shadow-sm hover:bg-slate-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filtros
              </button>
            </div>

            {/* Mobile filter pills */}
            {sidebarOpen && (
              <div className="lg:hidden flex flex-wrap gap-2 mb-5 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <button
                  onClick={() => { setCategoriaActiva(null); setSidebarOpen(false) }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    categoriaActiva === null ? 'bg-[#002D62] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  Todos ({repuestos.length})
                </button>
                {categorias.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setCategoriaActiva(cat.nombre); setSidebarOpen(false) }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      categoriaActiva === cat.nombre ? 'bg-[#002D62] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.nombre} ({conteo(cat.nombre)})
                  </button>
                ))}
              </div>
            )}

            {/* Product grid */}
            {repuestosFiltrados.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {repuestosFiltrados.map((repuesto, i) => (
                  <ProductoCard key={repuesto.id} repuesto={repuesto} priority={i === 0} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No hay repuestos en esta categoría aún.</p>
                <p className="text-slate-400 text-sm mt-1">Consúltenos directamente por WhatsApp.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
