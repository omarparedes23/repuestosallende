import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ChevronLeft, ArrowRight, Truck, CheckCircle, FileText } from 'lucide-react'
import Link from 'next/link'

const ESTADO_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  borrador:    { bg: '#F3F4F6', color: '#6B7280', label: 'Borrador' },
  emitida:     { bg: '#EFF6FF', color: '#2563EB', label: 'Emitida' },
  en_transito: { bg: '#FFFBEB', color: '#D97706', label: 'En tránsito' },
  recibida:    { bg: '#F0FDF4', color: '#059669', label: 'Recibida' },
}

export default async function GuiaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { data: guia } = await supabase
    .from('ra_guias_remision')
    .select(`
      *,
      origen:ra_sucursales!sucursal_origen_id ( nombre ),
      destino:ra_sucursales!sucursal_destino_id ( nombre ),
      ra_guia_items ( id, nombre_producto, cantidad )
    `)
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)
    .single()

  if (!guia) redirect('/panel/guias')

  const cfg = ESTADO_CONFIG[guia.estado] ?? ESTADO_CONFIG.borrador

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/panel/guias" className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <ChevronLeft size={20} style={{ color: '#374151' }} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Guía de remisión</h1>
          {guia.serie && guia.correlativo && (
            <p className="text-sm mt-0.5 font-mono" style={{ color: '#6B7280' }}>
              {guia.serie}-{guia.correlativo}
            </p>
          )}
        </div>
        <span
          className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {cfg.label}
        </span>
      </div>

      {/* Info */}
      <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex items-center gap-3 text-base font-semibold" style={{ color: '#111827' }}>
          <span>{guia.origen?.nombre ?? '—'}</span>
          <ArrowRight size={18} style={{ color: '#9CA3AF' }} />
          <span>{guia.destino?.nombre ?? '—'}</span>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Fecha emisión</p>
            <p style={{ color: '#374151' }}>
              {new Date(guia.fecha_emision).toLocaleDateString('es-PE', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
          {guia.fecha_recepcion && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Fecha recepción</p>
              <p style={{ color: '#374151' }}>
                {new Date(guia.fecha_recepcion).toLocaleDateString('es-PE', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
        {guia.notas && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Notas</p>
            <p className="text-sm" style={{ color: '#374151' }}>{guia.notas}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              {['Artículo', 'Cantidad'].map((h) => (
                <th
                  key={h}
                  className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#6B7280' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(guia.ra_guia_items ?? []).map((item: any, i: number) => (
              <tr
                key={item.id}
                className="border-t"
                style={{
                  borderColor: '#F3F4F6',
                  backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                }}
              >
                <td className="px-5 py-4 font-medium" style={{ color: '#111827' }}>
                  {item.nombre_producto}
                </td>
                <td className="px-5 py-4" style={{ color: '#374151' }}>
                  {item.cantidad}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
