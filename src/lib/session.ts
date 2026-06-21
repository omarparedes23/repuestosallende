import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import type { Perfil } from '@/lib/types/database'

export type { Perfil }

// unstable_cache() prohíbe cookies() en su interior — usar cache() de React en su lugar
export const getCachedPerfil = cache(async (userId: string): Promise<Perfil | null> => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ra_perfiles' as never)
    .select('id, empresa_id, rol, activo')
    .eq('id', userId)
    .single()
  return (data as Perfil | null) ?? null
})

// Para ESCRITURAS: verifica el token contra los servidores de Supabase.
// Garantiza que el usuario no fue revocado. Usar en mutations.
export async function getSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, perfil: null }
  const perfil = await getCachedPerfil(user.id)
  return { supabase, user, perfil }
}

// Para LECTURAS: valida la firma del JWT localmente (~0ms).
// No hace round trip a Supabase. Seguro para queries de solo lectura.
export async function getSessionFast() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) return { supabase, user: null, perfil: null }
  const perfil = await getCachedPerfil(session.user.id)
  return { supabase, user: session.user, perfil }
}
