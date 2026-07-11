'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import { subirImagen, IMAGENES_TIPOS_PERMITIDOS, IMAGEN_MAX_BYTES } from '@/lib/r2'
import { FILAS_POR_PAGINA } from './constants'

export type ArticuloRow = {
  id: string
  catalogo_id: string
  codigo_oem: string | null
  codigos_alternos: string | null
  nombre: string
  categoria: string | null
  imagen_url: string | null
  stock_actual: number
  stock_minimo: number
  precio_venta: number | null
  precio_venta_dolar: number | null
  precio_compra: number | null
  activo: boolean
  sucursal_id: string
  modelos_compatibles: string[]
}

export type ModeloOption = { id: string; nombre: string }

export async function getModelosAuto(): Promise<ModeloOption[]> {
  const { supabase: raw } = await getSessionFast()
  const supabase = raw as any
  const { data } = await supabase
    .from('ra_modelos_auto')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')
  return (data ?? []) as ModeloOption[]
}

export type MarcaOption = { id: string; nombre: string }

export async function getMarcasRepuesto(): Promise<MarcaOption[]> {
  const { supabase: raw } = await getSessionFast()
  const supabase = raw as any
  const { data } = await supabase
    .from('ra_marcas_repuesto')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')
  return (data ?? []) as MarcaOption[]
}

export async function getMarcasAuto(): Promise<MarcaOption[]> {
  const { supabase: raw } = await getSessionFast()
  const supabase = raw as any
  const { data } = await supabase
    .from('ra_marcas_auto')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')
  return (data ?? []) as MarcaOption[]
}

const SELECT_ARTICULO = `
  id,
  catalogo_id,
  stock_actual,
  stock_minimo,
  precio_venta,
  precio_venta_dolar,
  precio_compra,
  activo,
  sucursal_id,
  ra_catalogo_repuestos!inner (
    codigo_oem,
    codigos_alternos,
    nombre,
    imagen_url,
    ra_categorias ( nombre ),
    ra_compatibilidades ( modelo_id )
  )
`

function mapArticuloRow(row: any): ArticuloRow {
  return {
    id: row.id,
    catalogo_id: row.catalogo_id,
    codigo_oem: row.ra_catalogo_repuestos?.codigo_oem ?? null,
    codigos_alternos: row.ra_catalogo_repuestos?.codigos_alternos ?? null,
    nombre: row.ra_catalogo_repuestos?.nombre ?? '',
    imagen_url: row.ra_catalogo_repuestos?.imagen_url ?? null,
    categoria: row.ra_catalogo_repuestos?.ra_categorias?.nombre ?? null,
    stock_actual: row.stock_actual,
    stock_minimo: row.stock_minimo,
    precio_venta: row.precio_venta,
    precio_venta_dolar: row.precio_venta_dolar,
    precio_compra: row.precio_compra,
    activo: row.activo,
    sucursal_id: row.sucursal_id,
    modelos_compatibles: (row.ra_catalogo_repuestos?.ra_compatibilidades ?? []).map(
      (c: any) => c.modelo_id
    ),
  }
}

/**
 * Búsqueda server-side, paginada. Solo trae del catálogo (43k+ productos) las
 * filas que matchean la búsqueda (o la página actual si no hay búsqueda) —
 * nunca la tabla completa, para minimizar transferencia de datos de Supabase.
 */
export async function buscarArticulos(
  query: string,
  pagina: number,
  marcaId?: string | null,
  marcaAutoId?: string | null
): Promise<{ data: ArticuloRow[]; total: number; error: string | null }> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: [], total: 0, error: 'No autenticado' }

  const offset = Math.max(0, pagina - 1) * FILAS_POR_PAGINA
  const term = query.trim().replace(/[,()]/g, ' ')

  let q = supabase
    .from('ra_productos')
    .select(SELECT_ARTICULO, { count: 'exact' })
    .eq('empresa_id', perfil.empresa_id)

  if (term) {
    q = q.or(
      `nombre.ilike.%${term}%,codigo_oem.ilike.%${term}%,codigos_alternos.ilike.%${term}%`,
      { foreignTable: 'ra_catalogo_repuestos' }
    )
  }

  if (marcaId) {
    q = q.eq('ra_catalogo_repuestos.marca_repuesto_id', marcaId)
  }

  if (marcaAutoId) {
    q = q.eq('ra_catalogo_repuestos.marca_auto_id', marcaAutoId)
  }

  const { data, count, error } = await q
    .order('ra_catalogo_repuestos(nombre)')
    .range(offset, offset + FILAS_POR_PAGINA - 1)

  if (error) return { data: [], total: 0, error: error.message }

  return { data: (data ?? []).map(mapArticuloRow), total: count ?? 0, error: null }
}

export async function getStockBajoCount(): Promise<number> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 0

  const { data } = await supabase.rpc('ra_contar_stock_bajo', {
    p_empresa_id: perfil.empresa_id,
  })
  return Number(data ?? 0)
}

const INVALID = Symbol('invalid')

function parsePrecioOpcional(value: FormDataEntryValue | null): number | null | typeof INVALID {
  const s = (value as string ?? '').trim()
  if (s === '') return null
  const n = parseFloat(s)
  if (isNaN(n) || n < 0) return INVALID
  return n
}

// ra_productos permite mutación a 'administrador' Y 'vendedor' vía RLS
// (productos_mutate en 001_initial_schema.sql), a diferencia de
// ra_catalogo_repuestos que ya restringe a admin/superadmin (catalogo_mutate
// en 020_catalogo_mutate_administrador.sql). Como esta acción ahora también
// se invoca desde el catálogo público (sin guardia de ruta), hace falta este
// chequeo explícito de rol para no depender solo de la RLS de ra_productos.
const ROLES_ADMIN = ['administrador', 'superadmin']

export async function updatePreciosArticulo(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const id = formData.get('id') as string
  const precioVenta = parsePrecioOpcional(formData.get('precio_venta'))
  const precioVentaDolar = parsePrecioOpcional(formData.get('precio_venta_dolar'))
  const precioCompra = parsePrecioOpcional(formData.get('precio_compra'))
  const stockMinimo = parseFloat(formData.get('stock_minimo') as string)

  if (
    precioVenta === INVALID ||
    precioVentaDolar === INVALID ||
    precioCompra === INVALID ||
    isNaN(stockMinimo) ||
    stockMinimo < 0
  ) {
    return 'Todos los valores deben ser números mayores o iguales a 0.'
  }

  if (precioVenta === null && precioVentaDolar === null) {
    return 'Debe ingresar al menos un precio de venta (soles o dólares).'
  }

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'
  if (!ROLES_ADMIN.includes(perfil.rol)) return 'No tienes permisos para editar artículos.'

  const { error } = await supabase
    .from('ra_productos')
    .update({
      precio_venta: precioVenta,
      precio_venta_dolar: precioVentaDolar,
      precio_compra: precioCompra,
      stock_minimo: stockMinimo,
    })
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) return 'Error al actualizar el artículo.'

  revalidatePath('/panel/articulos')
  return null
}

const EXT_POR_TIPO: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export async function subirImagenArticulo(
  catalogoId: string,
  formData: FormData
): Promise<string | null> {
  const file = formData.get('imagen')
  if (!(file instanceof File) || file.size === 0) return 'Selecciona una imagen.'

  if (!IMAGENES_TIPOS_PERMITIDOS.includes(file.type)) {
    return 'Formato no soportado. Usa JPG, PNG o WEBP.'
  }
  if (file.size > IMAGEN_MAX_BYTES) {
    return 'La imagen no debe superar los 5MB.'
  }

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'
  if (!ROLES_ADMIN.includes(perfil.rol)) return 'No tienes permisos para editar artículos.'

  const ext = EXT_POR_TIPO[file.type]
  const key = `productos/${catalogoId}.${ext}`

  let url: string
  try {
    url = await subirImagen(file, key)
  } catch {
    return 'Error al subir la imagen.'
  }

  const { error } = await supabase
    .from('ra_catalogo_repuestos')
    .update({ imagen_url: url })
    .eq('id', catalogoId)

  if (error) return 'Imagen subida, pero no se pudo guardar en el producto.'

  revalidatePath('/panel/articulos')
  revalidatePath('/catalogo', 'layout')
  return null
}

export async function actualizarInfoCatalogo(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const catalogoId = formData.get('catalogo_id') as string
  const nombre = (formData.get('nombre') as string ?? '').trim()
  const descripcion = (formData.get('descripcion') as string ?? '').trim()

  if (!nombre) return 'El nombre no puede estar vacío.'

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'
  if (!ROLES_ADMIN.includes(perfil.rol)) return 'No tienes permisos para editar artículos.'

  const { error } = await supabase
    .from('ra_catalogo_repuestos')
    .update({ nombre, descripcion: descripcion || null })
    .eq('id', catalogoId)

  if (error) return 'Error al actualizar el producto.'

  revalidatePath('/panel/articulos')
  revalidatePath('/catalogo', 'layout')
  return null
}

export async function updateCompatibilidad(
  catalogoId: string,
  modeloIds: string[]
): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'
  if (!ROLES_ADMIN.includes(perfil.rol)) return 'No tienes permisos para editar artículos.'

  const { error: deleteError } = await supabase
    .from('ra_compatibilidades')
    .delete()
    .eq('catalogo_id', catalogoId)

  if (deleteError) return 'Error al actualizar modelos compatibles.'

  if (modeloIds.length > 0) {
    const { error: insertError } = await supabase
      .from('ra_compatibilidades')
      .insert(modeloIds.map((modeloId) => ({ catalogo_id: catalogoId, modelo_id: modeloId })))

    if (insertError) return 'Error al actualizar modelos compatibles.'
  }

  revalidatePath('/panel/articulos')
  return null
}
