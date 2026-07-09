import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Package, Phone } from 'lucide-react'
import { createPublicClient } from '@/lib/supabase/public'
import { siteConfig, whatsappUrl } from '@/lib/site.config'
import { productoSlug, parseProductoId } from '@/lib/slug'
import { getIsAdminPublico } from '../../actions'
import { EditarRepuestoBoton } from '../../components/EditarRepuestoBoton'

type Props = { params: Promise<{ slug: string }> }

async function getProducto(id: string) {
  const supabase = createPublicClient()
  const { data } = await supabase
    .from('ra_catalogo_repuestos')
    .select(
      `*,
       categoria:ra_categorias ( id, nombre, slug, orden ),
       compatibilidades:ra_compatibilidades ( modelo:ra_modelos_auto ( id, nombre, slug ) )`
    )
    .eq('id', id)
    .eq('activo', true)
    .single()

  return data as any
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const id = parseProductoId(slug)
  if (!id) return {}

  const producto = await getProducto(id)
  if (!producto) return {}

  const oem = producto.codigo_oem ? ` (OEM: ${producto.codigo_oem})` : ''

  return {
    title: `${producto.nombre}${oem} | Repuestos Allende`,
    description:
      producto.descripcion?.slice(0, 155) ??
      `Repuesto ${producto.nombre} disponible en Repuestos Allende. Consulte stock y precio por WhatsApp.`,
  }
}

export default async function ProductoDetallePage({ params }: Props) {
  const { slug } = await params
  const id = parseProductoId(slug)
  if (!id) notFound()

  const producto = await getProducto(id)
  if (!producto) notFound()

  const isAdmin = await getIsAdminPublico()

  const modelos: { id: string; nombre: string; slug: string }[] = (
    producto.compatibilidades ?? []
  )
    .map((c: any) => c.modelo)
    .filter(Boolean)

  const supabase = createPublicClient()
  const modeloIds = modelos.map((m) => m.id)

  // Prioriza relacionados que compartan modelo de vehículo (evita mezclar marcas
  // dentro de una misma categoría amplia como "Motor"). Si el producto no tiene
  // modelo asignado, cae a solo filtrar por categoría.
  const { data: relacionadosData } = modeloIds.length > 0
    ? await supabase
        .from('ra_catalogo_repuestos')
        .select('id, nombre, imagen_url, codigo_oem, ra_compatibilidades!inner(modelo_id)')
        .eq('categoria_id', producto.categoria_id)
        .eq('activo', true)
        .neq('id', id)
        .in('ra_compatibilidades.modelo_id', modeloIds)
        .limit(8)
    : await supabase
        .from('ra_catalogo_repuestos')
        .select('id, nombre, imagen_url, codigo_oem')
        .eq('categoria_id', producto.categoria_id)
        .eq('activo', true)
        .neq('id', id)
        .limit(4)

  const relacionados = Array.from(
    new Map((relacionadosData ?? []).map((r: any) => [r.id, r])).values()
  ).slice(0, 4)

  const codigosAlternos = producto.codigos_alternos
    ? producto.codigos_alternos.split(/[,;]/).map((c: string) => c.trim()).filter(Boolean)
    : []

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center flex-wrap gap-1 text-xs text-slate-500 mb-6">
        <Link href="/" className="hover:text-[#002D62]">Inicio</Link>
        <ChevronRight className="w-3 h-3" />
        {modelos[0] && (
          <>
            <Link href={`/catalogo/${modelos[0].slug}`} className="hover:text-[#002D62]">
              {modelos[0].nombre}
            </Link>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        {producto.categoria && (
          <>
            <span>{producto.categoria.nombre}</span>
            <ChevronRight className="w-3 h-3" />
          </>
        )}
        <span className="text-slate-700 font-medium truncate">{producto.nombre}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Imagen */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center h-80 md:h-96 p-6">
          <div className="relative w-full h-full">
            <Image
              src={producto.imagen_url ?? siteConfig.imagenes.modulos}
              alt={producto.nombre}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col">
          {producto.categoria && (
            <span className="self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-3 bg-slate-100 text-slate-600">
              {producto.categoria.nombre}
            </span>
          )}

          <div className="flex items-start justify-between gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#002D62]">
              {producto.nombre}
            </h1>
            {isAdmin && (
              <EditarRepuestoBoton
                catalogoId={producto.id}
                className="shrink-0 flex items-center justify-center w-9 h-9 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors"
              />
            )}
          </div>

          {producto.codigo_oem && (
            <p className="text-slate-500 text-sm mb-1">
              Código OEM: <span className="font-mono font-semibold text-slate-700">{producto.codigo_oem}</span>
            </p>
          )}

          {codigosAlternos.length > 0 && (
            <p className="text-slate-400 text-xs mb-4">
              Códigos alternos: {codigosAlternos.join(', ')}
            </p>
          )}

          {producto.descripcion && (
            <p className="text-slate-600 text-sm leading-relaxed mb-5">
              {producto.descripcion}
            </p>
          )}

          {modelos.length > 0 && (
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Compatible con
              </p>
              <div className="flex flex-wrap gap-2">
                {modelos.map((m) => (
                  <Link
                    key={m.id}
                    href={`/catalogo/${m.slug}`}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#002D62]/5 text-[#002D62] hover:bg-[#002D62]/10 transition-colors"
                  >
                    {m.nombre}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-auto pt-4 border-t border-slate-100">
            <p className="text-[#002D62] text-sm font-semibold mb-3 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-[#FFD700]" />
              Consulte disponibilidad y precio
            </p>
            <a
              href={whatsappUrl(`Hola Repuestos Allende, estoy interesado en: ${producto.nombre}${producto.codigo_oem ? ` (OEM: ${producto.codigo_oem})` : ''}. ¿Tienen disponibilidad?`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full sm:w-auto sm:px-8 bg-[#25D366] hover:bg-[#128C7E] text-white text-sm font-bold py-3 rounded-xl transition-colors"
            >
              <Phone className="w-4 h-4" />
              Consultar por WhatsApp
            </a>
          </div>
        </div>
      </div>

      {/* Relacionados */}
      {relacionados && relacionados.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-[#002D62] mb-4">Productos relacionados</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {relacionados.map((r: any) => (
              <Link
                key={r.id}
                href={`/catalogo/producto/${productoSlug(r.nombre, r.id)}`}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all overflow-hidden group"
              >
                <div className="bg-slate-50 h-32 flex items-center justify-center p-3 border-b border-slate-100">
                  <div className="relative w-full h-full">
                    <Image
                      src={r.imagen_url ?? siteConfig.imagenes.modulos}
                      alt={r.nombre}
                      fill
                      sizes="200px"
                      className="object-contain transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-semibold text-[#002D62] line-clamp-2 leading-snug">
                    {r.nombre}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
