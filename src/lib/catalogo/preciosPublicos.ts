import 'server-only'

import { createClient } from '@supabase/supabase-js'

const EMPRESA_PUBLICA_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const SUCURSAL_PUBLICA_ID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'

export type PrecioPublico = {
  precioVenta: number | null
  precioVentaDolar: number | null
}

/**
 * El catálogo público solo expone los precios vigentes de la sucursal principal.
 * El stock y otros datos operativos permanecen fuera de esta consulta.
 */
export async function getPreciosPublicos(catalogoIds: string[]): Promise<Record<string, PrecioPublico>> {
  if (catalogoIds.length === 0) return {}

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return {}

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('ra_productos')
    .select('catalogo_id, precio_venta, precio_venta_dolar')
    .eq('empresa_id', EMPRESA_PUBLICA_ID)
    .eq('sucursal_id', SUCURSAL_PUBLICA_ID)
    .eq('activo', true)
    .in('catalogo_id', catalogoIds)

  if (error) {
    console.error('[catalogo] No se pudieron obtener los precios públicos:', error.message)
    return {}
  }

  return Object.fromEntries(
    (data ?? []).map((producto) => [
      producto.catalogo_id,
      {
        precioVenta: producto.precio_venta,
        precioVentaDolar: producto.precio_venta_dolar,
      },
    ])
  )
}
