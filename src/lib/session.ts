import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database'

export type { Perfil }

// unstable_cache() prohíbe cookies() en su interior — usar cache() de React en su lugar
export const getCachedPerfil = cache(async (userId: string): Promise<Perfil | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ra_perfiles')
    .select('id, nombre, empresa_id, sucursal_id, rol, activo')
    .eq('id', userId)
    .single()
  if (error && error.code !== 'PGRST116') throw new Error(error.message)
  return data
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The active-store cookie is client-controlled, so it is only trusted after checking
// that the sucursal is an active one of the user's own empresa (RLS-scoped query).
const sucursalActivaDeEmpresa = cache(async (sucursalId: string, empresaId: string): Promise<boolean> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ra_sucursales')
    .select('id')
    .eq('id', sucursalId)
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data !== null
})

// sucursal_id resolution:
// - vendedor: fixed to perfil.sucursal_id
// - admin: reads the active-store cookie shared by Tablet and Panel, validated against the empresa.
//   ra_sucursal_id is retained only while older browser sessions are replaced.
async function resolveSucursalId(perfil: Perfil | null): Promise<string | null> {
  if (!perfil) return null
  if (perfil.sucursal_id) return perfil.sucursal_id
  if (!perfil.empresa_id) return null
  const jar = await cookies()
  const candidate = jar.get('ra_sucursal_activa')?.value || jar.get('ra_sucursal_id')?.value
  if (!candidate || !UUID_RE.test(candidate)) return null
  return (await sucursalActivaDeEmpresa(candidate, perfil.empresa_id)) ? candidate : null
}

// Para ESCRITURAS: verifica el token contra los servidores de Supabase.
// Garantiza que el usuario no fue revocado. Usar en mutations.
export async function getSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, perfil: null, sucursalId: null }
  const perfil = await getCachedPerfil(user.id)
  const sucursalId = await resolveSucursalId(perfil)
  return { supabase, user, perfil, sucursalId }
}

// Para LECTURAS: verifica la firma del JWT con getClaims() (local con claves asimétricas,
// sin round trip a Auth). No usar getSession(): en el servidor lee la cookie sin verificarla.
// Solo expone el id del usuario, que es lo único que los llamadores necesitan.
export async function getSessionFast() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims.sub
  if (!userId) return { supabase, user: null, perfil: null, sucursalId: null }
  const perfil = await getCachedPerfil(userId)
  const sucursalId = await resolveSucursalId(perfil)
  return { supabase, user: { id: userId }, perfil, sucursalId }
}
