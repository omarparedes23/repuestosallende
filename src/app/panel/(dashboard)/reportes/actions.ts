'use server'

/* eslint-disable @typescript-eslint/no-explicit-any -- joins de reportes aún no están expresados en los tipos manuales de Supabase. */

import { getSessionFast } from '@/lib/session'
import { agruparPorMoneda, calcularResumenCredito } from '@/lib/reportes/ventasCobros'

const PAGE_SIZE = 100

export type ReporteFiltros = {
  desde?: string
  hasta?: string
  sucursalId?: string
  clienteId?: string
  tipoComprobante?: string
  estado?: string
  metodoPago?: string
  referencia?: string
  pagina?: number
}

export type SucursalReporte = { id: string; nombre: string }
export type ClienteReporte = { id: string; nombre: string }

export type VentaReporte = {
  id: string
  createdAt: string
  numeroCompleto: string | null
  tipoComprobante: string
  estado: string
  sunatEstado: string | null
  moneda: string
  total: number
  clienteNombre: string
  sucursalNombre: string
  cobradoAlEmitir: number
  creditoOriginal: number
  cobradoPosteriormente: number
  saldoCredito: number
}

export type CobroRegistrado = {
  id: string
  fecha: string
  monto: number
  moneda: string
  metodoPago: string | null
  referencia: string | null
  numeroCompleto: string | null
  clienteNombre: string
  sucursalNombre: string
  cajaId: string | null
  usuarioNombre: string | null
}

function aplicarRango(query: any, columna: string, filtros: ReporteFiltros) {
  const esFechaSinHora = columna === 'fecha'
  if (filtros.desde) query = query.gte(columna, esFechaSinHora ? filtros.desde : `${filtros.desde}T00:00:00`)
  if (filtros.hasta) query = query.lte(columna, esFechaSinHora ? filtros.hasta : `${filtros.hasta}T23:59:59`)
  return query
}

export async function getOpcionesReporte(): Promise<{ sucursales: SucursalReporte[]; clientes: ClienteReporte[] }> {
  const { supabase: raw, perfil } = await getSessionFast()
  // ra_sucursales aún no forma parte del tipo manual completo.
  const supabase = raw as any
  if (!perfil?.empresa_id) return { sucursales: [], clientes: [] }

  const [sucursales, clientes] = await Promise.all([
    supabase.from('ra_sucursales').select('id, nombre').eq('empresa_id', perfil.empresa_id).eq('activo', true).order('nombre'),
    supabase.from('ra_clientes').select('id, nombre').eq('empresa_id', perfil.empresa_id).order('nombre'),
  ])
  return { sucursales: sucursales.data ?? [], clientes: clientes.data ?? [] }
}

export async function getVentasReporte(filtros: ReporteFiltros): Promise<{ data: VentaReporte[]; totales: Record<string, number>; totalFilas: number; error: string | null }> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: [], totales: {}, totalFilas: 0, error: 'No autenticado' }

  const pagina = Math.max(1, filtros.pagina ?? 1)
  const desdeFila = (pagina - 1) * PAGE_SIZE

  let query = supabase
    .from('ra_ventas')
    .select(`id, created_at, numero_completo, tipo_comprobante, estado, sunat_estado, moneda, total,
      ra_clientes ( nombre ), ra_sucursales ( nombre ), ra_venta_pagos ( metodo_pago, monto )`, { count: 'exact' })
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at', { ascending: false })
    .range(desdeFila, desdeFila + PAGE_SIZE - 1)
  query = aplicarRango(query, 'created_at', filtros)
  if (filtros.sucursalId) query = query.eq('sucursal_id', filtros.sucursalId)
  if (filtros.clienteId) query = query.eq('cliente_id', filtros.clienteId)
  if (filtros.tipoComprobante) query = query.eq('tipo_comprobante', filtros.tipoComprobante)
  if (filtros.estado) query = query.eq('estado', filtros.estado)
  else query = query.neq('estado', 'anulada')

  const { data: ventas, error, count } = await query
  if (error) return { data: [], totales: {}, totalFilas: 0, error: 'Error al obtener ventas' }

  const ventaIds = (ventas ?? []).map((venta: any) => venta.id)
  const { data: movimientos } = ventaIds.length
    ? await supabase
      .from('ra_cuenta_corriente_movimientos')
      .select('venta_id, tipo, monto')
      .eq('empresa_id', perfil.empresa_id)
      .in('venta_id', ventaIds)
    : { data: [] }

  const abonosPorVenta: Record<string, number> = {}
  for (const movimiento of movimientos ?? []) {
    if (movimiento.tipo === 'abono') {
      abonosPorVenta[movimiento.venta_id] = (abonosPorVenta[movimiento.venta_id] ?? 0) + Number(movimiento.monto)
    }
  }

  const data = (ventas ?? []).map((venta: any): VentaReporte => {
    const resumen = calcularResumenCredito(venta.ra_venta_pagos ?? [], abonosPorVenta[venta.id] ?? 0)
    return {
      id: venta.id,
      createdAt: venta.created_at,
      numeroCompleto: venta.numero_completo ?? null,
      tipoComprobante: venta.tipo_comprobante,
      estado: venta.estado,
      sunatEstado: venta.sunat_estado ?? null,
      moneda: venta.moneda ?? 'PEN',
      total: Number(venta.total),
      clienteNombre: venta.ra_clientes?.nombre ?? 'Cliente varios',
      sucursalNombre: venta.ra_sucursales?.nombre ?? 'Sin sucursal / histórico',
      ...resumen,
    }
  })

  return { data, totales: agruparPorMoneda(data.map((venta: VentaReporte) => ({ moneda: venta.moneda, monto: venta.total }))), totalFilas: count ?? 0, error: null }
}

export async function getCobrosRegistrados(filtros: ReporteFiltros): Promise<{ data: CobroRegistrado[]; totales: Record<string, number>; totalFilas: number; error: string | null }> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: [], totales: {}, totalFilas: 0, error: 'No autenticado' }

  const pagina = Math.max(1, filtros.pagina ?? 1)
  const desdeFila = (pagina - 1) * PAGE_SIZE

  let query = supabase
    .from('ra_cuenta_corriente_movimientos')
    .select(`id, fecha, monto, moneda_cobro, metodo_pago, referencia, caja_id, usuario_id,
      ra_ventas ( numero_completo ), ra_clientes ( nombre ), ra_sucursales ( nombre )`, { count: 'exact' })
    .eq('empresa_id', perfil.empresa_id)
    .eq('tipo', 'abono')
    .order('fecha', { ascending: false })
    .range(desdeFila, desdeFila + PAGE_SIZE - 1)
  query = aplicarRango(query, 'fecha', filtros)
  if (filtros.sucursalId) query = query.eq('sucursal_id', filtros.sucursalId)
  if (filtros.clienteId) query = query.eq('cliente_id', filtros.clienteId)
  if (filtros.metodoPago) query = query.eq('metodo_pago', filtros.metodoPago)
  if (filtros.referencia?.trim()) query = query.ilike('referencia', `%${filtros.referencia.trim()}%`)

  const { data: filas, error, count } = await query
  if (error) return { data: [], totales: {}, totalFilas: 0, error: 'Error al obtener cobros registrados' }

  const usuarioIds = [...new Set((filas ?? []).map((fila: any) => fila.usuario_id).filter(Boolean))]
  const { data: perfiles } = usuarioIds.length
    ? await supabase.from('ra_perfiles').select('id, nombre').in('id', usuarioIds)
    : { data: [] }
  const nombres = Object.fromEntries((perfiles ?? []).map((item: any) => [item.id, item.nombre])) as Record<string, string>

  const data = (filas ?? []).map((fila: any): CobroRegistrado => ({
    id: fila.id,
    fecha: fila.fecha,
    monto: Number(fila.monto),
    moneda: fila.moneda_cobro ?? 'PEN',
    metodoPago: fila.metodo_pago ?? null,
    referencia: fila.referencia ?? null,
    numeroCompleto: fila.ra_ventas?.numero_completo ?? null,
    clienteNombre: fila.ra_clientes?.nombre ?? 'Cliente desconocido',
    sucursalNombre: fila.ra_sucursales?.nombre ?? 'Sin sucursal / histórico',
    cajaId: fila.caja_id ?? null,
    usuarioNombre: nombres[fila.usuario_id] ?? null,
  }))

  return { data, totales: agruparPorMoneda(data.map((cobro: CobroRegistrado) => ({ moneda: cobro.moneda, monto: cobro.monto }))), totalFilas: count ?? 0, error: null }
}
