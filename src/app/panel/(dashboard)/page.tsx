import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { TrendingUp, AlertTriangle, Archive, ShoppingBag } from 'lucide-react'

async function getDashboardData(empresaId: string, supabase: any) {
  const hoy = new Date().toISOString().split('T')[0]

  const [ventasHoy, stockBajo, cajasAbiertas, ultimasVentas] = await Promise.all([
    supabase
      .from('ra_ventas')
      .select('total')
      .eq('empresa_id', empresaId)
      .eq('estado', 'completada')
      .gte('created_at', `${hoy}T00:00:00`)
      .lte('created_at', `${hoy}T23:59:59`),

    supabase
      .from('ra_productos')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .filter('stock_actual', 'lt', 'stock_minimo'),

    supabase
      .from('ra_cajas')
      .select('id', { count: 'exact', head: true })
      .eq('empresa_id', empresaId)
      .eq('estado', 'abierta'),

    supabase
      .from('ra_ventas')
      .select('id, total, tipo_comprobante, numero_completo, created_at')
      .eq('empresa_id', empresaId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const totalVentasHoy = (ventasHoy.data ?? []).reduce(
    (sum: number, v: { total: number }) => sum + v.total, 0
  )

  return {
    totalVentasHoy,
    articulosStockBajo: stockBajo.count ?? 0,
    cajasAbiertas: cajasAbiertas.count ?? 0,
    ultimasVentas: ultimasVentas.data ?? [],
  }
}

export default async function PanelDashboardPage() {
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { totalVentasHoy, articulosStockBajo, cajasAbiertas, ultimasVentas } =
    await getDashboardData(perfil.empresa_id, supabase)

  const KPIS = [
    {
      label: 'Ventas hoy',
      value: `S/. ${totalVentasHoy.toFixed(2)}`,
      icon: TrendingUp,
      color: '#059669',
      bg: '#F0FDF4',
    },
    {
      label: 'Stock bajo',
      value: articulosStockBajo,
      icon: AlertTriangle,
      color: articulosStockBajo > 0 ? '#D97706' : '#059669',
      bg: articulosStockBajo > 0 ? '#FFFBEB' : '#F0FDF4',
    },
    {
      label: 'Cajas abiertas',
      value: cajasAbiertas,
      icon: Archive,
      color: '#002D62',
      bg: '#EFF6FF',
    },
    {
      label: 'Ventas del mes',
      value: '—',
      icon: ShoppingBag,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
  ]

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>
          Dashboard
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          {new Date().toLocaleDateString('es-PE', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          })}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {KPIS.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="rounded-2xl p-5 border"
            style={{ backgroundColor: bg, borderColor: '#E5E7EB' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium" style={{ color: '#6B7280' }}>
                {label}
              </p>
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${color}18` }}
              >
                <Icon size={18} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#111827' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Últimas ventas */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
        <div
          className="px-6 py-4 border-b"
          style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: '#374151' }}>
            Últimas ventas
          </h2>
        </div>
        {ultimasVentas.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm" style={{ color: '#9CA3AF' }}>
            Sin ventas registradas aún.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#F9FAFB' }}>
                {['Comprobante', 'Tipo', 'Total', 'Fecha'].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: '#6B7280' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ultimasVentas.map((v: any, i: number) => (
                <tr
                  key={v.id}
                  className="border-t"
                  style={{
                    borderColor: '#F3F4F6',
                    backgroundColor: i % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                  }}
                >
                  <td className="px-6 py-4 font-medium" style={{ color: '#111827' }}>
                    {v.numero_completo ?? '—'}
                  </td>
                  <td className="px-6 py-4 capitalize" style={{ color: '#6B7280' }}>
                    {v.tipo_comprobante}
                  </td>
                  <td className="px-6 py-4 font-semibold" style={{ color: '#059669' }}>
                    S/. {v.total.toFixed(2)}
                  </td>
                  <td className="px-6 py-4" style={{ color: '#6B7280' }}>
                    {new Date(v.created_at).toLocaleDateString('es-PE')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
