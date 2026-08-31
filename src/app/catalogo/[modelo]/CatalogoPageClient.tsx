'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Phone, Package, Filter, Search } from 'lucide-react'
import type { ModeloAuto, CatalogoRepuesto, Categoria } from '@/lib/types/database'
import { siteConfig, whatsappUrl } from '@/lib/site.config'
import { productoSlug } from '@/lib/slug'
import { EditarRepuestoBoton } from '../components/EditarRepuestoBoton'

type MarcaRepuesto = { id: string; nombre: string }

type RepuestoConCategoria = CatalogoRepuesto & {
  categoria: Pick<Categoria, 'id' | 'nombre' | 'slug' | 'orden'> | null
  marca_repuesto: MarcaRepuesto | null
  precio_venta: number | null
  precio_venta_dolar: number | null
}

/** Modelo con su marca relacionada (join desde page.tsx). */
type ModeloConMarca = ModeloAuto & {
  marca?: { id: string; nombre: string } | null
}

const PRODUCTOS_POR_TANDA = 24

const CATEGORIA_COLORS: Record<string, string> = {
  'Suspensión': 'bg-blue-100 text-blue-700',
  'Dirección':  'bg-purple-100 text-purple-700',
  'Motor':      'bg-orange-100 text-orange-700',
  'Caja':       'bg-green-100 text-green-700',
}

function ProductoCard({ repuesto, priority = false, isAdmin = false }: { repuesto: RepuestoConCategoria; priority?: boolean; isAdmin?: boolean }) {
  const categoriaNombre = repuesto.categoria?.nombre ?? ''
  const formatoPrecio = new Intl.NumberFormat('es-PE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group">
      {isAdmin && (
        <div className="absolute top-2 right-2 z-10">
          <EditarRepuestoBoton catalogoId={repuesto.id} />
        </div>
      )}
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
          {(repuesto.precio_venta != null || repuesto.precio_venta_dolar != null) && (
            <div className="mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Precio</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {repuesto.precio_venta != null && (
                  <p className="text-base font-extrabold text-[#002D62]">S/ {formatoPrecio.format(repuesto.precio_venta)}</p>
                )}
                {repuesto.precio_venta_dolar != null && (
                  <p className="text-sm font-bold text-slate-600 self-end">US$ {formatoPrecio.format(repuesto.precio_venta_dolar)}</p>
                )}
              </div>
            </div>
          )}
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
  isAdmin = false,
}: {
  modelo: ModeloConMarca
  repuestos: RepuestoConCategoria[]
  isAdmin?: boolean
}) {
  const [categoriaActiva, setCategoriaActiva] = useState('')
  const [marcaActiva, setMarcaActiva] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PRODUCTOS_POR_TANDA)

  // Derivadas de los propios repuestos ya cargados (no de un select aparte a
  // ra_categorias) - evita mostrar categorias en 0 (de otros modelos) y
  // duplicados por nombre (ra_categorias tiene varias filas con el mismo
  // nombre, ej. "MOTOR" x7, una por subcategoria del ERP).
  const categorias = useMemo(() => {
    const porNombre = new Map<string, Pick<Categoria, 'id' | 'nombre' | 'slug' | 'orden'>>()
    for (const r of repuestos) {
      if (r.categoria && !porNombre.has(r.categoria.nombre)) porNombre.set(r.categoria.nombre, r.categoria)
    }
    return Array.from(porNombre.values()).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
  }, [repuestos])

  const marcas = useMemo(() => {
    const porNombre = new Map<string, MarcaRepuesto>()
    for (const r of repuestos) {
      if (r.marca_repuesto && !porNombre.has(r.marca_repuesto.nombre)) porNombre.set(r.marca_repuesto.nombre, r.marca_repuesto)
    }
    return Array.from(porNombre.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [repuestos])

  const busquedaNorm = busqueda.trim().toLowerCase()

  const repuestosFiltrados = repuestos.filter((r) => {
    if (categoriaActiva && r.categoria?.nombre !== categoriaActiva) return false
    if (marcaActiva && r.marca_repuesto?.nombre !== marcaActiva) return false
    if (busquedaNorm) {
      const enNombre = r.nombre.toLowerCase().includes(busquedaNorm)
      const enOem = (r.codigo_oem ?? '').toLowerCase().includes(busquedaNorm)
      const enAlternos = ((r as any).codigos_alternos ?? '').toLowerCase().includes(busquedaNorm)
      if (!enNombre && !enOem && !enAlternos) return false
    }
    return true
  })

  // Vuelve a la primera tanda cada vez que cambian los filtros o la búsqueda.
  useEffect(() => {
    setVisibleCount(PRODUCTOS_POR_TANDA)
  }, [categoriaActiva, marcaActiva, busquedaNorm])

  const repuestosVisibles = repuestosFiltrados.slice(0, visibleCount)
  const hayMas = visibleCount < repuestosFiltrados.length

  const conteoCategoria = (nombre: string) =>
    repuestos.filter((r) => r.categoria?.nombre === nombre).length

  const conteoMarca = (nombre: string) =>
    repuestos.filter((r) => r.marca_repuesto?.nombre === nombre).length

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

        {/* Buscador */}
        <div className="relative max-w-md mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, código OEM o código alterno..."
            className="w-full rounded-xl border-2 border-slate-200 pl-10 pr-4 py-3 text-sm outline-none focus:border-[#002D62]"
          />
        </div>

        <div className="flex gap-8">

          {/* Sidebar — desktop */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-24">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-[#002D62] font-bold text-sm uppercase tracking-wider">Filtrar por</h2>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Categoría</label>
                  <select
                    value={categoriaActiva}
                    onChange={(e) => setCategoriaActiva(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#002D62]"
                  >
                    <option value="">Todas ({repuestos.length})</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nombre}>
                        {cat.nombre} ({conteoCategoria(cat.nombre)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Marca</label>
                  <select
                    value={marcaActiva}
                    onChange={(e) => setMarcaActiva(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#002D62]"
                  >
                    <option value="">Todas las marcas</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.nombre}>
                        {m.nombre} ({conteoMarca(m.nombre)})
                      </option>
                    ))}
                  </select>
                </div>
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
                <span className="font-bold text-[#002D62]">{repuestosVisibles.length}</span>{' '}
                de <span className="font-bold text-[#002D62]">{repuestosFiltrados.length}</span>{' '}
                {repuestosFiltrados.length === 1 ? 'repuesto' : 'repuestos'}
                {categoriaActiva && (
                  <span className="ml-1">· <span className="text-[#002D62] font-semibold">{categoriaActiva}</span></span>
                )}
                {marcaActiva && (
                  <span className="ml-1">· <span className="text-[#002D62] font-semibold">{marcaActiva}</span></span>
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

            {/* Mobile filters */}
            {sidebarOpen && (
              <div className="lg:hidden flex flex-col gap-3 mb-5 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Categoría</label>
                  <select
                    value={categoriaActiva}
                    onChange={(e) => setCategoriaActiva(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#002D62]"
                  >
                    <option value="">Todas ({repuestos.length})</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nombre}>
                        {cat.nombre} ({conteoCategoria(cat.nombre)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">Marca</label>
                  <select
                    value={marcaActiva}
                    onChange={(e) => setMarcaActiva(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-[#002D62]"
                  >
                    <option value="">Todas las marcas</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.nombre}>
                        {m.nombre} ({conteoMarca(m.nombre)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Product grid */}
            {repuestosFiltrados.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {repuestosVisibles.map((repuesto, i) => (
                    <ProductoCard key={repuesto.id} repuesto={repuesto} priority={i === 0} isAdmin={isAdmin} />
                  ))}
                </div>

                {hayMas && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => setVisibleCount((c) => c + PRODUCTOS_POR_TANDA)}
                      className="bg-white border-2 border-[#002D62] text-[#002D62] text-sm font-bold px-8 py-3 rounded-xl hover:bg-[#002D62] hover:text-white transition-colors"
                    >
                      Cargar más ({repuestosFiltrados.length - visibleCount} restantes)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Package className="w-12 h-12 text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">No se encontraron repuestos con estos filtros.</p>
                <p className="text-slate-400 text-sm mt-1">Consúltenos directamente por WhatsApp.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
