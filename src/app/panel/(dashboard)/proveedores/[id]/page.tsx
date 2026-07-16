import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getEstadoCuentaProveedor } from '../actions'
import { EstadoCuentaProveedorView } from './components/EstadoCuentaProveedorView'

export default async function ProveedorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { data: proveedor } = await supabase
    .from('ra_proveedores')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)
    .single()

  if (!proveedor) redirect('/panel/proveedores')

  const { data: movimientos } = await getEstadoCuentaProveedor(id)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/panel/proveedores"
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} style={{ color: '#374151' }} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>{proveedor.nombre}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {proveedor.ruc ? `RUC ${proveedor.ruc}` : 'Sin RUC'}
          </p>
        </div>
      </div>

      {/* Resumen — a diferencia de clientes, un proveedor no tiene
          tiene_credito/limite_credito en el schema (no aplica: la deuda con
          el proveedor nace de la compra, no de un límite otorgado por él). */}
      <div className="rounded-2xl border p-6 grid grid-cols-3 gap-6" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Contacto</p>
          <p className="font-semibold" style={{ color: '#111827' }}>{proveedor.contacto ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Teléfono</p>
          <p className="font-semibold" style={{ color: '#111827' }}>{proveedor.telefono ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Saldo por pagar</p>
          <p
            className="text-xl font-bold"
            style={{ color: proveedor.saldo_deudor > 0 ? '#DC2626' : '#059669' }}
          >
            S/ {proveedor.saldo_deudor.toFixed(2)}
          </p>
        </div>
      </div>

      <EstadoCuentaProveedorView proveedor={proveedor} movimientos={movimientos ?? []} />
    </div>
  )
}
