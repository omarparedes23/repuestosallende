'use server'

import { getSessionFast } from '@/lib/session'

const ROLES_ADMIN = ['administrador', 'superadmin']

/**
 * /catalogo/* no pasa por el middleware (proxy.ts solo matchea /panel y
 * /tablet), así que cada página del catálogo público resuelve la sesión
 * explícitamente para decidir si mostrar el botón "editar".
 */
export async function getIsAdminPublico(): Promise<boolean> {
  const { perfil } = await getSessionFast()
  return !!perfil && ROLES_ADMIN.includes(perfil.rol)
}

export type ArticuloEdicionPublica = {
  id: string
  catalogo_id: string
  nombre: string
  descripcion: string | null
  imagen_url: string | null
  precio_venta: number | null
  precio_venta_dolar: number | null
  precio_compra: number | null
  stock_minimo: number
  modelos_compatibles: string[]
}

/**
 * Trae los datos de precio/stock (ra_productos, por sucursal) que la página
 * pública del catálogo no tiene cargados (solo carga ra_catalogo_repuestos).
 * Hoy existe una sola sucursal, así que catalogo_id -> ra_productos es 1:1;
 * si se agregan más sucursales habrá que revisar este supuesto.
 */
export async function getArticuloParaEdicionPublico(
  catalogoId: string
): Promise<ArticuloEdicionPublica | null> {
  // Lectura, no mutación -> getSessionFast() (JWT local, sin round-trip a
  // Supabase Auth). Usar getSession() aquí solo agregaba latencia al abrir
  // el modal (~1s extra medido en logs locales) sin ganancia real, ya que
  // esta función no escribe nada.
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id || !ROLES_ADMIN.includes(perfil.rol)) return null

  const { data, error } = await supabase
    .from('ra_productos')
    .select(
      `
      id,
      catalogo_id,
      precio_venta,
      precio_venta_dolar,
      precio_compra,
      stock_minimo,
      ra_catalogo_repuestos!inner (
        nombre,
        descripcion,
        imagen_url,
        ra_compatibilidades ( modelo_id )
      )
    `
    )
    .eq('catalogo_id', catalogoId)
    .eq('empresa_id', perfil.empresa_id)
    .single()

  if (error || !data) return null

  return {
    id: data.id,
    catalogo_id: data.catalogo_id,
    nombre: data.ra_catalogo_repuestos?.nombre ?? '',
    descripcion: data.ra_catalogo_repuestos?.descripcion ?? null,
    imagen_url: data.ra_catalogo_repuestos?.imagen_url ?? null,
    precio_venta: data.precio_venta,
    precio_venta_dolar: data.precio_venta_dolar,
    precio_compra: data.precio_compra,
    stock_minimo: data.stock_minimo,
    modelos_compatibles: (data.ra_catalogo_repuestos?.ra_compatibilidades ?? []).map(
      (c: any) => c.modelo_id
    ),
  }
}
