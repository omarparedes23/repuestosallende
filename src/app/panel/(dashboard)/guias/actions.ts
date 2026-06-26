'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { RaGuiaRemisionInsert } from '@/lib/types/database'

export type GuiaRow = {
  id: string
  estado: 'borrador' | 'emitida' | 'en_transito' | 'recibida'
  serie: string | null
  correlativo: string | null
  notas: string | null
  fecha_emision: string
  fecha_recepcion: string | null
  sucursal_origen_nombre: string
  sucursal_destino_nombre: string
}

export type ItemGuia = {
  catalogo_id: string
  nombre: string
  cantidad: number
}

export async function getGuias() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_guias_remision')
    .select(`
      id,
      estado,
      serie,
      correlativo,
      notas,
      fecha_emision,
      fecha_recepcion,
      origen:ra_sucursales!sucursal_origen_id ( nombre ),
      destino:ra_sucursales!sucursal_destino_id ( nombre )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha_emision', { ascending: false })

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    estado: row.estado,
    serie: row.serie,
    correlativo: row.correlativo,
    notas: row.notas,
    fecha_emision: row.fecha_emision,
    fecha_recepcion: row.fecha_recepcion,
    sucursal_origen_nombre: row.origen?.nombre ?? '—',
    sucursal_destino_nombre: row.destino?.nombre ?? '—',
  }))

  return { data: mapped as GuiaRow[], error: error?.message ?? null }
}

export async function getSucursales() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return []

  const { data } = await supabase
    .from('ra_sucursales')
    .select('id, nombre')
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .order('nombre')

  return data ?? []
}

export async function crearGuia(
  sucursalOrigenId: string,
  sucursalDestinoId: string,
  serie: string | null,
  correlativo: string | null,
  notas: string | null,
  items: ItemGuia[]
): Promise<{ id: string | null; error: string | null }> {
  if (items.length === 0) return { id: null, error: 'Debes agregar al menos un artículo.' }
  if (sucursalOrigenId === sucursalDestinoId) return { id: null, error: 'Origen y destino deben ser distintos.' }

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { id: null, error: 'No autenticado.' }

  const payload: RaGuiaRemisionInsert = {
    empresa_id: perfil.empresa_id,
    sucursal_origen_id: sucursalOrigenId,
    sucursal_destino_id: sucursalDestinoId,
    usuario_id: perfil.id,
    estado: 'borrador',
    serie: serie || null,
    correlativo: correlativo ? parseInt(correlativo, 10) : null,
    notas: notas || null,
  }

  const { data: guia, error: guiaError } = await supabase
    .from('ra_guias_remision')
    .insert(payload)
    .select('id')
    .single()

  if (guiaError) return { id: null, error: 'Error al crear la guía.' }

  const guiaItems = items.map((i) => ({
    guia_id: guia.id,
    catalogo_id: i.catalogo_id,
    nombre_producto: i.nombre,
    cantidad: i.cantidad,
  }))

  const { error: itemsError } = await supabase.from('ra_guia_items').insert(guiaItems)
  if (itemsError) return { id: null, error: 'Error al agregar los artículos.' }

  revalidatePath('/panel/guias')
  return { id: guia.id, error: null }
}

export async function avanzarEstadoGuia(
  id: string,
  nuevoEstado: 'emitida' | 'en_transito'
): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase
    .from('ra_guias_remision')
    .update({ estado: nuevoEstado })
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) return 'Error al actualizar la guía.'
  revalidatePath('/panel/guias')
  return null
}

export async function recibirGuia(id: string): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase.rpc('ra_recibir_guia', { p_guia_id: id })
  if (error) return 'Error al recibir la guía. Verifica que esté en tránsito.'

  revalidatePath('/panel/guias')
  return null
}
