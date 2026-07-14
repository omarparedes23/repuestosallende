'use server'

import { getSessionFast } from '@/lib/session'
import type { RaCliente } from '@/lib/types/database'
import type { MovimientoConVenta } from '../clientes/actions'

export type MovimientoConVentaYCliente = MovimientoConVenta & {
  ra_clientes: Pick<RaCliente, 'id' | 'nombre'> | null
}

export async function getCuentasPorCobrarGlobal(): Promise<{
  data: MovimientoConVentaYCliente[] | null
  error: string | null
}> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data: movimientos, error } = await supabase
    .from('ra_cuenta_corriente_movimientos')
    .select(
      `id, empresa_id, cliente_id, venta_id, tipo, monto, fecha, fecha_vencimiento,
       moneda_cobro, tipo_cambio_cobro, metodo_pago, referencia, usuario_id, created_at,
       ra_ventas ( id, numero_completo, moneda, total, created_at ),
       ra_clientes ( id, nombre )`
    )
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })

  if (error) return { data: null, error: 'Error al obtener cuentas por cobrar' }

  const filas = movimientos ?? []
  const usuarioIds = [...new Set(filas.map((m: any) => m.usuario_id))]
  const { data: perfiles } = usuarioIds.length
    ? await supabase.from('ra_perfiles').select('id, nombre').in('id', usuarioIds)
    : { data: [] }
  const nombrePorUsuario: Record<string, string> = Object.fromEntries(
    (perfiles ?? []).map((p: any) => [p.id, p.nombre])
  )

  const data: MovimientoConVentaYCliente[] = filas.map((m: any) => ({
    ...m,
    usuario_nombre: nombrePorUsuario[m.usuario_id] ?? null,
  }))

  return { data, error: null }
}
