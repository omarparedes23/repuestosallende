'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'

export type ArticuloRow = {
  id: string
  catalogo_id: string
  codigo_oem: string | null
  nombre: string
  categoria: string | null
  stock_actual: number
  stock_minimo: number
  precio_venta: number | null
  precio_mayorista: number | null
  precio_compra: number | null
  activo: boolean
  sucursal_id: string
}

export async function getArticulos() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_productos')
    .select(`
      id,
      catalogo_id,
      stock_actual,
      stock_minimo,
      precio_venta,
      precio_mayorista,
      precio_compra,
      activo,
      sucursal_id,
      ra_catalogo_repuestos!inner (
        codigo_oem,
        nombre,
        ra_categorias ( nombre )
      )
    `)
    .eq('empresa_id', perfil.empresa_id)
    .order('ra_catalogo_repuestos(nombre)')

  const mapped = (data ?? []).map((row: any) => ({
    id: row.id,
    catalogo_id: row.catalogo_id,
    codigo_oem: row.ra_catalogo_repuestos?.codigo_oem ?? null,
    nombre: row.ra_catalogo_repuestos?.nombre ?? '',
    categoria: row.ra_catalogo_repuestos?.ra_categorias?.nombre ?? null,
    stock_actual: row.stock_actual,
    stock_minimo: row.stock_minimo,
    precio_venta: row.precio_venta,
    precio_mayorista: row.precio_mayorista,
    precio_compra: row.precio_compra,
    activo: row.activo,
    sucursal_id: row.sucursal_id,
  }))

  return { data: mapped as ArticuloRow[], error: error?.message ?? null }
}

export async function updatePreciosArticulo(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const id = formData.get('id') as string
  const precioVenta = parseFloat(formData.get('precio_venta') as string)
  const precioMayorista = parseFloat(formData.get('precio_mayorista') as string)
  const precioCompra = parseFloat(formData.get('precio_compra') as string)
  const stockMinimo = parseFloat(formData.get('stock_minimo') as string)

  if ([precioVenta, precioMayorista, precioCompra, stockMinimo].some(
    (v) => isNaN(v) || v < 0
  )) {
    return 'Todos los valores deben ser números mayores o iguales a 0.'
  }

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase
    .from('ra_productos')
    .update({
      precio_venta: precioVenta,
      precio_mayorista: precioMayorista,
      precio_compra: precioCompra,
      stock_minimo: stockMinimo,
    })
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) return 'Error al actualizar el artículo.'

  revalidatePath('/panel/articulos')
  return null
}
