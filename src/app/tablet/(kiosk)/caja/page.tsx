import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { AbrirCajaScreen } from './components/AbrirCajaScreen'
import { CajaScreen } from './components/CajaScreen'
import type { RaCaja, RaMovimientoCaja } from '@/lib/types/database'

export default async function CajaPage() {
  const { supabase: rawSupabase, user, perfil, sucursalId } = await getSession()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) redirect('/tablet/login')
  if (!sucursalId) redirect('/tablet/sucursal')

  const { data: caja } = await supabase
    .from('ra_cajas')
    .select('id, empresa_id, sucursal_id, usuario_id, estado, monto_inicial, monto_final, fecha_apertura, fecha_cierre, notas')
    .eq('sucursal_id', sucursalId)
    .eq('empresa_id', perfil.empresa_id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (!caja) {
    return (
      <AbrirCajaScreen
        empresaId={perfil.empresa_id}
        sucursalId={sucursalId}
        rol={perfil.rol}
      />
    )
  }

  const { data: movimientos } = await supabase
    .from('ra_movimientos_caja')
    .select('id, caja_id, tipo, concepto, monto, metodo_pago, referencia_id, created_at')
    .eq('caja_id', (caja as any).id)
    .order('created_at', { ascending: false })

  return (
    <CajaScreen
      caja={caja as RaCaja}
      movimientos={(movimientos ?? []) as RaMovimientoCaja[]}
      rol={perfil.rol}
    />
  )
}
