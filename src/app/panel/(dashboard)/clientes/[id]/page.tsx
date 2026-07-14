import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getEstadoCuenta } from '../actions'
import { EstadoCuentaView } from './components/EstadoCuentaView'

export default async function ClienteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase: raw, perfil } = await getSession()
  if (!perfil?.empresa_id) redirect('/panel/login')
  const supabase = raw as any

  const { data: cliente } = await supabase
    .from('ra_clientes')
    .select('*')
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)
    .single()

  if (!cliente) redirect('/panel/clientes')

  const { data: movimientos } = await getEstadoCuenta(id)

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/panel/clientes"
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={20} style={{ color: '#374151' }} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002D62' }}>{cliente.nombre}</h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {cliente.tipo_documento && cliente.nro_documento
              ? `${cliente.tipo_documento} ${cliente.nro_documento}`
              : 'Sin documento'}
          </p>
        </div>
      </div>

      {/* Resumen de crédito */}
      <div className="rounded-2xl border p-6 grid grid-cols-3 gap-6" style={{ borderColor: '#E5E7EB' }}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Crédito habilitado</p>
          <p className="font-semibold" style={{ color: '#111827' }}>{cliente.tiene_credito ? 'Sí' : 'No'}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Límite de crédito</p>
          <p className="font-semibold" style={{ color: '#111827' }}>S/ {cliente.limite_credito.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#9CA3AF' }}>Saldo deudor</p>
          <p
            className="text-xl font-bold"
            style={{ color: cliente.saldo_deudor > 0 ? '#DC2626' : '#059669' }}
          >
            S/ {cliente.saldo_deudor.toFixed(2)}
          </p>
        </div>
      </div>

      <EstadoCuentaView cliente={cliente} movimientos={movimientos ?? []} />
    </div>
  )
}
