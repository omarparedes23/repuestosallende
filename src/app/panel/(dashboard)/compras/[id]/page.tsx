import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'

const ESTADO_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pendiente: { bg: '#FEF2F2', color: '#DC2626', label: 'Pendiente' },
  parcial:   { bg: '#FFFBEB', color: '#D97706', label: 'Parcial' },
  pagado:    { bg: '#F0FDF4', color: '#059669', label: 'Pagado' },
}

export default async function CompraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { data: compra } = await supabase
    .from('ra_compras')
    .select(`
      *,
      ra_proveedores ( nombre ),
      ra_compra_items (
        id,
        nombre_producto,
        cantidad,
        precio_unitario,
        subtotal
      )
    `)
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)
    .single()

  if (!compra) redirect('/panel/compras')

  const estilo = ESTADO_STYLE[compra.estado_pago] ?? ESTADO_STYLE.pendiente

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/panel/compras"
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} style={{ color: '#374151' }} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Detalle de compra</h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: '#6B7280' }}>
            {compra.nro_documento ?? 'Sin documento'}
          </p>
        </div>
        <span
          className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: estilo.bg, color: estilo.color }}
        >
          {estilo.label}
        </span>
      </div>

      {/* Info general */}
      <div className="rounded-2xl border p-6 grid grid-cols-3 gap-6" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Proveedor</p>
          <p className="font-semibold" style={{ color: '#111827' }}>{compra.ra_proveedores?.nombre ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Fecha</p>
          <p style={{ color: '#374151' }}>
            {new Date(compra.fecha_compra).toLocaleDateString('es-PE', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Total</p>
          <p className="text-xl font-bold" style={{ color: '#002D62' }}>S/ {compra.total.toFixed(2)}</p>
        </div>
        {compra.notas && (
          <div className="col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Notas</p>
            <p style={{ color: '#374151' }}>{compra.notas}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              {['Artículo', 'Cantidad', 'Precio unit.', 'Subtotal'].map((h) => (
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
            {(compra.ra_compra_items ?? []).map((item: any, i: number) => (
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
                <td className="px-5 py-4" style={{ color: '#374151' }}>
                  S/ {item.precio_unitario.toFixed(2)}
                </td>
                <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                  S/ {item.subtotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totales */}
      <div className="rounded-2xl border p-6 space-y-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
        <div className="flex justify-between" style={{ color: '#6B7280' }}>
          <span>Subtotal</span>
          <span>S/ {compra.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between" style={{ color: '#6B7280' }}>
          <span>IGV (18%)</span>
          <span>S/ {compra.igv.toFixed(2)}</span>
        </div>
        <div
          className="flex justify-between text-base font-bold pt-2 border-t"
          style={{ borderColor: '#E5E7EB', color: '#002D62' }}
        >
          <span>Total</span>
          <span>S/ {compra.total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
