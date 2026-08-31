'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { Json } from '@/lib/types/database'

export type GuiaRow = {
  id: string
  estado: 'borrador' | 'emitida' | 'en_transito' | 'recibida'
  serie: string | null
  correlativo: number | null
  notas: string | null
  fecha_emision: string | null
  created_at: string
  fecha_recepcion: string | null
  sucursal_origen_nombre: string
  sucursal_destino_nombre: string
}

export type ItemGuia = {
  catalogo_id: string
  nombre: string
  cantidad: number
}

type RpcGuiaResult = {
  status: 'created' | 'ok' | 'received'
  guia: {
    id: string
    estado: GuiaRow['estado']
    items?: number
  }
}

const GUIA_ERROR_MESSAGES: Record<string, string> = {
  RA_UNAUTHENTICATED: 'Tu sesión expiró. Vuelve a ingresar.',
  RA_FORBIDDEN: 'No tienes permisos para gestionar guías.',
  RA_GUIDE_NOT_FOUND: 'La guía no existe o no tienes acceso a ella.',
  RA_GUIDE_INVALID_STATE: 'La guía ya no está en el estado requerido para esta operación.',
  RA_GUIDE_INVALID_BRANCH: 'La sucursal de origen o destino no es válida.',
  RA_GUIDE_SAME_BRANCH: 'Origen y destino deben ser distintos.',
  RA_GUIDE_EMPTY: 'La guía debe contener al menos un artículo.',
  RA_GUIDE_ITEM_INVALID: 'Uno o más artículos o cantidades no son válidos.',
  RA_GUIDE_DUPLICATE_ITEM: 'Un artículo no puede repetirse en la misma guía.',
  RA_GUIDE_NUMBER_INCOMPLETE: 'Ingresa serie y correlativo juntos, con correlativo positivo.',
  RA_GUIDE_DUPLICATE_NUMBER: 'Ya existe una guía con esa serie y correlativo.',
  RA_GUIDE_SERIES_NOT_CONFIGURED: 'La sucursal origen no tiene una serie de guías configurada.',
  RA_PRODUCT_NOT_FOUND_AT_ORIGIN: 'Uno de los artículos ya no está configurado en la sucursal origen.',
  RA_PRODUCT_NOT_FOUND_AT_DESTINATION: 'Uno de los artículos no está configurado en la sucursal destino.',
  RA_STOCK_INSUFFICIENT: 'El stock disponible en origen ya no alcanza para recibir esta guía.',
}

function guiaErrorMessage(message: string | undefined, fallback: string): string {
  const code = Object.keys(GUIA_ERROR_MESSAGES).find((candidate) => message?.includes(candidate))
  return code ? GUIA_ERROR_MESSAGES[code] : fallback
}

function mapRpcGuiaResult(raw: unknown): RpcGuiaResult | null {
  if (!raw || typeof raw !== 'object') return null
  const result = raw as Partial<RpcGuiaResult>
  if (!result.guia?.id || !result.guia.estado || !result.status) return null
  return result as RpcGuiaResult
}

function mapPreviewSerieGuia(raw: unknown): PreviewSerieGuia | null {
  if (!raw || typeof raw !== 'object') return null
  const preview = raw as {
    serie?: unknown
    siguiente_correlativo?: unknown
    numero_preview?: unknown
  }
  if (
    typeof preview.serie !== 'string' ||
    typeof preview.siguiente_correlativo !== 'number' ||
    typeof preview.numero_preview !== 'string'
  ) return null

  return {
    serie: preview.serie,
    siguienteCorrelativo: preview.siguiente_correlativo,
    numeroPreview: preview.numero_preview,
  }
}

export type ProductoEnSucursal = {
  productoId: string
  catalogoId: string
  nombre: string
  codigoOem: string | null
  stockDisponible: number
}

export type PreviewSerieGuia = {
  serie: string
  siguienteCorrelativo: number
  numeroPreview: string
}

type ProductoEnSucursalQuery = {
  id: string
  catalogo_id: string
  stock_actual: number
  ra_catalogo_repuestos: {
    nombre: string
    codigo_oem: string | null
  } | null
}

type GuiaQueryResult = {
  id: string
  estado: GuiaRow['estado']
  serie: string | null
  correlativo: number | null
  notas: string | null
  fecha_emision: string | null
  created_at: string
  fecha_recepcion: string | null
  origen: { nombre: string } | null
  destino: { nombre: string } | null
}

/**
 * Busca únicamente el inventario disponible de la sucursal que será origen de
 * la guía. La validación definitiva sigue perteneciendo a las RPC de guía:
 * este resultado puede quedar obsoleto antes de la recepción.
 */
export async function buscarProductosEnSucursal(
  query: string,
  sucursalOrigenId: string
): Promise<ProductoEnSucursal[]> {
  const term = query.trim().replace(/[%_(),.]/g, ' ')
  if (!term || !sucursalOrigenId) return []

  const { supabase, perfil } = await getSessionFast()
  if (!perfil?.empresa_id) return []

  const { data, error } = await supabase
    .from('ra_productos')
    .select(`
      id,
      catalogo_id,
      stock_actual,
      ra_catalogo_repuestos!inner ( nombre, codigo_oem )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .eq('sucursal_id', sucursalOrigenId)
    .eq('activo', true)
    .gt('stock_actual', 0)
    .or(`nombre.ilike.%${term}%,codigo_oem.ilike.%${term}%`, {
      foreignTable: 'ra_catalogo_repuestos',
    })
    .order('stock_actual', { ascending: false })
    .limit(20)

  if (error) return []

  return ((data ?? []) as unknown as ProductoEnSucursalQuery[]).map((row) => ({
    productoId: row.id,
    catalogoId: row.catalogo_id,
    nombre: row.ra_catalogo_repuestos?.nombre ?? '',
    codigoOem: row.ra_catalogo_repuestos?.codigo_oem ?? null,
    stockDisponible: Number(row.stock_actual),
  }))
}

export async function getGuias() {
  const { supabase, perfil } = await getSessionFast()
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
      created_at,
      fecha_recepcion,
      origen:ra_sucursales!sucursal_origen_id ( nombre ),
      destino:ra_sucursales!sucursal_destino_id ( nombre )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .order('created_at', { ascending: false })

  const mapped = ((data ?? []) as unknown as GuiaQueryResult[]).map((row) => ({
    id: row.id,
    estado: row.estado,
    serie: row.serie,
    correlativo: row.correlativo,
    notas: row.notas,
    fecha_emision: row.fecha_emision,
    created_at: row.created_at,
    fecha_recepcion: row.fecha_recepcion,
    sucursal_origen_nombre: row.origen?.nombre ?? '—',
    sucursal_destino_nombre: row.destino?.nombre ?? '—',
  }))

  return { data: mapped as GuiaRow[], error: error?.message ?? null }
}

export async function getSucursales() {
  const { supabase, perfil } = await getSessionFast()
  if (!perfil?.empresa_id) return []

  const { data } = await supabase
    .from('ra_sucursales')
    .select('id, nombre')
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .order('nombre')

  return data ?? []
}

/** La vista previa no reserva un número; la asignación definitiva es atómica al crear. */
export async function obtenerPreviewSerieGuia(
  sucursalId: string
): Promise<{ preview: PreviewSerieGuia | null; error: string | null }> {
  if (!sucursalId) return { preview: null, error: 'Selecciona la sucursal origen.' }

  const { supabase, perfil } = await getSessionFast()
  if (!perfil?.empresa_id) return { preview: null, error: 'No autenticado.' }

  const { data, error } = await supabase.rpc('ra_obtener_preview_serie_guia', {
    p_sucursal_id: sucursalId,
  } as never)
  if (error) {
    return {
      preview: null,
      error: guiaErrorMessage(error.message, 'No se pudo obtener la serie de la sucursal.'),
    }
  }

  const preview = mapPreviewSerieGuia(data)
  return preview
    ? { preview, error: null }
    : { preview: null, error: 'La serie de la sucursal no devolvió un resultado válido.' }
}

export async function crearGuia(
  sucursalOrigenId: string,
  sucursalDestinoId: string,
  notas: string | null,
  items: ItemGuia[]
): Promise<{ id: string | null; error: string | null }> {
  if (items.length === 0) return { id: null, error: 'Debes agregar al menos un artículo.' }
  if (sucursalOrigenId === sucursalDestinoId) return { id: null, error: 'Origen y destino deben ser distintos.' }

  if (items.some((item) => !item.catalogo_id || !Number.isFinite(item.cantidad) || item.cantidad <= 0)) {
    return { id: null, error: 'Uno o más artículos o cantidades no son válidos.' }
  }

  const { supabase, perfil } = await getSession()
  if (!perfil?.empresa_id) return { id: null, error: 'No autenticado.' }

  const payload = {
    p_sucursal_origen_id: sucursalOrigenId,
    p_sucursal_destino_id: sucursalDestinoId,
    p_notas: notas?.trim() || null,
    p_items: items.map(({ catalogo_id, cantidad }) => ({ catalogo_id, cantidad })) as Json,
  }
  const { data, error } = await supabase.rpc('ra_crear_guia', payload as never)
  if (error) return { id: null, error: guiaErrorMessage(error.message, 'No se pudo crear la guía.') }

  const result = mapRpcGuiaResult(data)
  if (result?.status !== 'created') return { id: null, error: 'La creación de la guía no devolvió un resultado válido.' }

  revalidatePath('/panel/guias')
  return { id: result.guia.id, error: null }
}

export async function avanzarEstadoGuia(
  id: string,
  nuevoEstado: 'emitida' | 'en_transito'
): Promise<string | null> {
  const { supabase, perfil } = await getSession()
  if (!perfil?.empresa_id) return 'No autenticado.'

  const payload = {
    p_guia_id: id,
    p_nuevo_estado: nuevoEstado,
  }
  const { data, error } = await supabase.rpc('ra_avanzar_estado_guia', payload as never)

  if (error) return guiaErrorMessage(error.message, 'No se pudo actualizar el estado de la guía.')
  if (mapRpcGuiaResult(data)?.status !== 'ok') return 'La actualización no devolvió un resultado válido.'
  revalidatePath('/panel/guias')
  return null
}

export async function recibirGuia(id: string): Promise<string | null> {
  const { supabase, perfil } = await getSession()
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { data, error } = await supabase.rpc('ra_recibir_guia', { p_guia_id: id } as never)
  if (error) return guiaErrorMessage(error.message, 'No se pudo recibir la guía. Verifica que esté en tránsito.')
  if (mapRpcGuiaResult(data)?.status !== 'received') return 'La recepción no devolvió un resultado válido.'

  revalidatePath('/panel/guias')
  return null
}
