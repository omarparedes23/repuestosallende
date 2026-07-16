import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ChevronLeft, Truck } from 'lucide-react'
import Link from 'next/link'
import { OrdenCompraAcciones } from './components/OrdenCompraAcciones'

const ESTADO_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  borrador:   { bg: '#F3F4F6', color: '#374151', label: 'Borrador' },
  confirmada: { bg: '#FFFBEB', color: '#D97706', label: 'Confirmada' },
  recibida:   { bg: '#F0FDF4', color: '#059669', label: 'Recibida' },
  anulada:    { bg: '#FEF2F2', color: '#DC2626', label: 'Anulada' },
}

export default async function OrdenCompraDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { data: ordenCompra } = await supabase
    .from('ra_ordenes_compra')
    .select(`
      *,
      ra_proveedores ( nombre ),
      ra_orden_compra_items (
        id,
        nombre_producto,
        cantidad,
        precio_unitario,
        subtotal,
        cantidad_recibida
      )
    `)
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)
    .single()

  if (!ordenCompra) redirect('/panel/ordenes-compra')

  const estilo = ESTADO_STYLE[ordenCompra.estado] ?? ESTADO_STYLE.borrador
  const items = ordenCompra.ra_orden_compra_items ?? []
  const totalEstimado = items.reduce((acc: number, item: any) => acc + Number(item.subtotal), 0)

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/panel/ordenes-compra"
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} style={{ color: '#374151' }} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>Detalle de orden de compra</h1>
          <p className="text-sm mt-0.5 font-mono" style={{ color: '#6B7280' }}>
            {ordenCompra.referencia ?? 'Sin referencia'}
          </p>
        </div>
        <span
          className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: estilo.bg, color: estilo.color }}
        >
          {estilo.label}
        </span>
      </div>

      {/* Acciones */}
      <OrdenCompraAcciones id={ordenCompra.id} estado={ordenCompra.estado} />

      {ordenCompra.estado === 'confirmada' && (
        <Link
          href={`/panel/compras/nueva?ordenCompraId=${ordenCompra.id}`}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
          style={{ backgroundColor: '#002D62', color: '#FFD700' }}
        >
          <Truck size={16} />
          Recibir mercadería
        </Link>
      )}

      {/* Info general */}
      <div className="rounded-2xl border p-6 grid grid-cols-3 gap-6" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Proveedor</p>
          <p className="font-semibold" style={{ color: '#111827' }}>{ordenCompra.ra_proveedores?.nombre ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Fecha</p>
          <p style={{ color: '#374151' }}>
            {new Date(ordenCompra.fecha).toLocaleDateString('es-PE', {
              day: '2-digit', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Total estimado</p>
          <p className="text-xl font-bold" style={{ color: '#002D62' }}>S/ {totalEstimado.toFixed(2)}</p>
        </div>
        {ordenCompra.notas && (
          <div className="col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Notas</p>
            <p style={{ color: '#374151' }}>{ordenCompra.notas}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: '#F9FAFB' }}>
              {['Artículo', 'Cantidad', 'Precio unit.', 'Subtotal', 'Recibido', 'Pendiente'].map((h) => (
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
            {items.map((item: any, i: number) => {
              const pendiente = Number(item.cantidad) - Number(item.cantidad_recibida)
              return (
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
                    S/ {Number(item.precio_unitario).toFixed(2)}
                  </td>
                  <td className="px-5 py-4 font-semibold" style={{ color: '#111827' }}>
                    S/ {Number(item.subtotal).toFixed(2)}
                  </td>
                  <td className="px-5 py-4" style={{ color: '#374151' }}>
                    {item.cantidad_recibida}
                  </td>
                  <td className="px-5 py-4 font-semibold" style={{ color: pendiente > 0 ? '#D97706' : '#059669' }}>
                    {pendiente}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="rounded-2xl border p-6 space-y-2 text-sm" style={{ borderColor: '#E5E7EB' }}>
        <div
          className="flex justify-between text-base font-bold"
          style={{ color: '#002D62' }}
        >
          <span>Total estimado</span>
          <span>S/ {totalEstimado.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}
