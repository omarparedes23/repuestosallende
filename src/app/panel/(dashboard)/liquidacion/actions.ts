'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'

export type CajaActiva = {
  id: string
  monto_inicial: number
  fecha_apertura: string
  sucursal_nombre: string
  totales: {
    efectivo: number
    yape: number
    tarjeta: number
    transferencia: number
    credito: number
  }
}

export async function getCajaActiva(): Promise<{ data: CajaActiva | null; error: string | null }> {
  const { supabase: raw, perfil, sucursalId } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  let query = supabase
    .from('ra_cajas')
    .select(`
      id,
      monto_inicial,
      fecha_apertura,
      sucursal_id,
      ra_sucursales ( nombre )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .eq('estado', 'abierta')

  if (sucursalId) query = query.eq('sucursal_id', sucursalId)

  const { data: caja, error: cajaError } = await query
    .order('fecha_apertura', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cajaError || !caja) return { data: null, error: cajaError?.message ?? null }

  const { data: movimientos } = await supabase
    .from('ra_movimientos_caja')
    .select('metodo_pago, monto, tipo')
    .eq('caja_id', caja.id)

  const totales = { efectivo: 0, yape: 0, tarjeta: 0, transferencia: 0, credito: 0 }
  for (const m of movimientos ?? []) {
    const key = m.metodo_pago as keyof typeof totales
    if (key in totales) {
      totales[key] += m.tipo === 'ingreso' ? m.monto : -m.monto
    }
  }

  return {
    data: {
      id: caja.id,
      monto_inicial: caja.monto_inicial,
      fecha_apertura: caja.fecha_apertura,
      sucursal_nombre: caja.ra_sucursales?.nombre ?? '—',
      totales,
    },
    error: null,
  }
}

export async function cerrarConLiquidacion(
  cajaId: string,
  conteo: {
    efectivo: number
    yape: number
    tarjeta: number
    transferencia: number
    credito: number
  },
  sistemaTotales: {
    efectivo: number
    yape: number
    tarjeta: number
    transferencia: number
    credito: number
  },
  notas: string | null
): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error: liquidacionError } = await supabase
    .from('ra_liquidaciones')
    .insert({
      caja_id: cajaId,
      empresa_id: perfil.empresa_id,
      usuario_id: perfil.id,
      sistema_efectivo: sistemaTotales.efectivo,
      sistema_yape: sistemaTotales.yape,
      sistema_tarjeta: sistemaTotales.tarjeta,
      sistema_transferencia: sistemaTotales.transferencia,
      sistema_credito: sistemaTotales.credito,
      conteo_efectivo: conteo.efectivo,
      conteo_yape: conteo.yape,
      conteo_tarjeta: conteo.tarjeta,
      conteo_transferencia: conteo.transferencia,
      conteo_credito: conteo.credito,
      notas: notas || null,
    })

  if (liquidacionError) {
    if (liquidacionError.code === '23505') return 'Esta caja ya fue liquidada.'
    return 'Error al crear la liquidación.'
  }

  const totalSistema =
    sistemaTotales.efectivo +
    sistemaTotales.yape +
    sistemaTotales.tarjeta +
    sistemaTotales.transferencia +
    sistemaTotales.credito

  const { error: cajaError } = await supabase
    .from('ra_cajas')
    .update({
      estado: 'cerrada',
      fecha_cierre: new Date().toISOString(),
      monto_final: totalSistema,
    })
    .eq('id', cajaId)
    .eq('empresa_id', perfil.empresa_id)

  if (cajaError) return 'Liquidación creada pero error al cerrar la caja.'

  revalidatePath('/panel/liquidacion')
  revalidatePath('/panel')
  return null
}
