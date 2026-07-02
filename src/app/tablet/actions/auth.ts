'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCachedPerfil } from '@/lib/session'

export async function signIn(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return 'Ingresa tu correo y contraseña.'

  const supabase = await createClient()
  const { error, data } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    console.error(
      '[tablet/signIn] error completo:',
      JSON.stringify(error, Object.getOwnPropertyNames(error)),
      'email:', email
    )
    return 'Correo o contraseña incorrectos.'
  }

  // Admins (sucursal_id = null) must pick their store before entering the POS
  const perfil = await getCachedPerfil(data.user.id)
  console.log('[tablet/signIn] user.id:', data.user.id, 'perfil:', perfil)

  if (!perfil?.sucursal_id) {
    redirect('/tablet/sucursal')
  }

  redirect('/tablet/pos')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/tablet/login')
}
