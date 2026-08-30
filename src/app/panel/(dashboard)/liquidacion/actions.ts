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

export type LiquidacionRevision = {
  id: string
  created_at: string
  sucursal_nombre: string
  sistema_efectivo: number
  conteo_efectivo: number
  diff_efectivo: number
  estado_revision: 'pendiente_revision' | 'validada' | 'observada'
  motivo_revision: string | null
  revisado_at: string | null
}

type LiquidacionRevisionRow = Omit<LiquidacionRevision, 'sucursal_nombre'> & {
  ra_cajas: { ra_sucursales: { nombre: string } | null } | null
}

type LiquidacionListClient = {
  from: (table: 'ra_liquidaciones') => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => Promise<{ data: unknown; error: { message: string } | null }>
        }
      }
    }
  }
}

type RevisionRpcClient = {
  rpc: (name: 'ra_revisar_liquidacion_v1', args: {
    p_operation_id: string
    p_liquidacion_id: string
    p_decision: 'validada' | 'observada'
    p_motivo: string
  }) => Promise<{ error: { message: string } | null }>
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
  // El efectivo esperado incluye el fondo de apertura; los demás medios se
  // muestran solo para conciliación y no se reciben desde el navegador.
  totales.efectivo += caja.monto_inicial

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
  operationId: string,
  cajaId: string,
  efectivoContado: number,
  notas: string | null
): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'
  if (!['administrador', 'superadmin'].includes(perfil.rol)) return 'Sin permisos.'
  if (!UUID.test(operationId) || !UUID.test(cajaId)) return 'Identificador de operación inválido.'
  if (!Number.isFinite(efectivoContado) || efectivoContado < 0) return 'Ingresa un efectivo contado válido.'

  const { error } = await supabase.rpc('ra_cerrar_caja_v1', {
    p_operation_id: operationId,
    p_caja_id: cajaId,
    p_efectivo_contado: efectivoContado,
    p_notas: notas || null,
  })

  if (error) return rpcError(error.message, 'Error al cerrar la caja.')

  revalidatePath('/panel/liquidacion')
  revalidatePath('/panel')
  return null
}

export async function getLiquidacionesParaRevision(): Promise<{ data: LiquidacionRevision[]; error: string | null }> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as unknown as LiquidacionListClient
  if (!perfil?.empresa_id) return { data: [], error: 'No autenticado.' }
  if (!['administrador', 'superadmin'].includes(perfil.rol)) return { data: [], error: 'Sin permisos.' }

  const { data, error } = await supabase
    .from('ra_liquidaciones')
    .select(`id, created_at, sistema_efectivo, conteo_efectivo, diff_efectivo,
      estado_revision, motivo_revision, revisado_at,
      ra_cajas!inner ( ra_sucursales!inner ( nombre ) )`)
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return { data: [], error: 'Error al obtener las liquidaciones.' }
  const filas = (data ?? []) as unknown as LiquidacionRevisionRow[]
  const liquidaciones: LiquidacionRevision[] = filas.map((item) => ({
    id: item.id,
    created_at: item.created_at,
    sistema_efectivo: item.sistema_efectivo,
    conteo_efectivo: item.conteo_efectivo,
    diff_efectivo: item.diff_efectivo,
    estado_revision: item.estado_revision,
    motivo_revision: item.motivo_revision,
    revisado_at: item.revisado_at,
    sucursal_nombre: item.ra_cajas?.ra_sucursales?.nombre ?? '—',
  }))
  return { data: liquidaciones, error: null }
}

export async function revisarLiquidacion(
  operationId: string,
  liquidacionId: string,
  decision: 'validada' | 'observada',
  motivo: string
): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as unknown as RevisionRpcClient
  const motivoNormalizado = motivo.trim()
  if (!perfil?.empresa_id) return 'No autenticado.'
  if (!['administrador', 'superadmin'].includes(perfil.rol)) return 'Sin permisos.'
  if (!UUID.test(operationId) || !UUID.test(liquidacionId)) return 'Identificador de operación inválido.'
  if (!['validada', 'observada'].includes(decision) || !motivoNormalizado || motivoNormalizado.length > 1000) {
    return 'Indica una decisión y un motivo de hasta 1000 caracteres.'
  }

  const { error } = await supabase.rpc('ra_revisar_liquidacion_v1', {
    p_operation_id: operationId,
    p_liquidacion_id: liquidacionId,
    p_decision: decision,
    p_motivo: motivoNormalizado,
  })
  if (error) return rpcError(error.message, 'Error al revisar la liquidación.')

  revalidatePath('/panel/liquidacion')
  return null
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function rpcError(message: string | null | undefined, fallback: string): string {
  if (!message) return fallback
  if (message.includes('RA_UNAUTHENTICATED')) return 'No autenticado.'
  if (message.includes('RA_FORBIDDEN')) return 'Sin permisos.'
  if (message.includes('RA_IDEMPOTENCY_CONFLICT')) return 'El identificador de operación ya fue usado con otros datos.'
  if (message.includes('RA_CASHBOX_NOT_OPEN')) return 'La caja ya no está abierta.'
  if (message.includes('RA_LIQUIDATION_REVIEW_INVALID')) return 'La liquidación ya fue revisada.'
  if (message.includes('RA_NOT_FOUND')) return 'La caja no existe o no pertenece a la empresa.'
  return message
}
