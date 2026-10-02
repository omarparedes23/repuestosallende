import { getSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { AbrirCajaScreen } from './components/AbrirCajaScreen'
import { CajaScreen } from './components/CajaScreen'

export default async function CajaPage() {
  const { supabase, user, perfil, sucursalId } = await getSession()
  if (!user || !perfil?.empresa_id) redirect('/tablet/login')
  if (!sucursalId) redirect('/tablet/sucursal')

  const { data: caja, error: cajaError } = await supabase
    .from('ra_cajas')
    .select('id, empresa_id, sucursal_id, usuario_id, estado, monto_inicial, monto_final, fecha_apertura, fecha_cierre, notas')
    .eq('sucursal_id', sucursalId)
    .eq('empresa_id', perfil.empresa_id)
    .eq('estado', 'abierta')
    .maybeSingle()

  if (cajaError) throw new Error(cajaError.message)

  if (!caja) {
    return (
      <AbrirCajaScreen
        empresaId={perfil.empresa_id}
        sucursalId={sucursalId}
        rol={perfil.rol}
      />
    )
  }

  const { data: movimientos, error: movimientosError } = await supabase
    .from('ra_movimientos_caja')
    .select('id, caja_id, tipo, concepto, monto, metodo_pago, referencia_id, created_at')
    .eq('caja_id', caja.id)
    .order('created_at', { ascending: false })

  if (movimientosError) throw new Error(movimientosError.message)

  return (
    <CajaScreen
      caja={caja}
      movimientos={movimientos ?? []}
      rol={perfil.rol}
    />
  )
}
