import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { SucursalPickerClient } from './SucursalPickerClient'
import type { RaSucursal } from '@/lib/types/database'

export default async function SucursalPage() {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()
  const supabase = rawSupabase as any

  if (!user || !perfil?.empresa_id) redirect('/tablet/login')

  // Vendors have a fixed store — skip picker
  if (sucursalId) redirect('/tablet/pos')

  const { data: sucursales } = await supabase
    .from('ra_sucursales')
    .select('id, empresa_id, nombre, direccion, activo, created_at')
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .order('nombre')

  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ backgroundColor: '#F0F4FF' }}>
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl text-2xl font-bold text-white"
            style={{ backgroundColor: '#002D62' }}
          >
            RA
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#002D62' }}>
            Selecciona la tienda
          </h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>
            Elige desde qué tienda estás operando hoy
          </p>
        </div>

        <SucursalPickerClient sucursales={(sucursales ?? []) as RaSucursal[]} />

        <p className="text-center text-xs" style={{ color: '#9CA3AF' }}>
          Sistema POS para tablet · Repuestos Allende S.A.C.
        </p>
      </div>
    </div>
  )
}
