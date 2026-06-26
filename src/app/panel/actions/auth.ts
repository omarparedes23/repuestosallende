'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCachedPerfil } from '@/lib/session'

export async function signInPanel(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return 'Ingresa tu correo y contraseña.'

  const supabase = await createClient()
  const { error, data } = await supabase.auth.signInWithPassword({ email, password })

  if (error) return 'Correo o contraseña incorrectos.'

  const perfil = await getCachedPerfil(data.user.id)
  if (!perfil || !['administrador', 'superadmin'].includes(perfil.rol)) {
    await supabase.auth.signOut()
    return 'No tienes permisos para acceder al panel administrativo.'
  }

  redirect('/panel')
}

export async function signOutPanel(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/panel/login')
}
