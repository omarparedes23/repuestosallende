import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database'

export type { Perfil }

// unstable_cache() prohíbe cookies() en su interior — usar cache() de React en su lugar
export const getCachedPerfil = cache(async (userId: string): Promise<Perfil | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ra_perfiles' as never)
    .select('id, empresa_id, sucursal_id, rol, activo')
    .eq('id', userId)
    .single()
  return (data as Perfil | null) ?? null
})

// sucursal_id resolution:
// - vendedor: fixed to perfil.sucursal_id
// - admin: reads the active-store cookie shared by Tablet and Panel.
//   ra_sucursal_id is retained only while older browser sessions are replaced.
async function resolveSucursalId(perfil: Perfil | null): Promise<string | null> {
  if (!perfil) return null
  if (perfil.sucursal_id) return perfil.sucursal_id
  const jar = await cookies()
  return jar.get('ra_sucursal_activa')?.value ?? jar.get('ra_sucursal_id')?.value ?? null
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

// Para LECTURAS: valida la firma del JWT localmente (~0ms).
// No hace round trip a Supabase. Seguro para queries de solo lectura.
export async function getSessionFast() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { supabase, user: null, perfil: null, sucursalId: null }
  const perfil = await getCachedPerfil(session.user.id)
  const sucursalId = await resolveSucursalId(perfil)
  return { supabase, user: session.user, perfil, sucursalId }
}
