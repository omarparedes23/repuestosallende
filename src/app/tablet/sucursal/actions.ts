'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export async function seleccionarSucursal(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const { supabase: rawSupabase, user, perfil } = await getSession()
  const supabase = rawSupabase as any

  if (!user || !perfil?.empresa_id) return 'No autenticado'

  const sucursalId = formData.get('sucursal_id') as string
  if (!sucursalId) return 'Selecciona una tienda'

  // Validate the sucursal belongs to this empresa
  const { data } = await supabase
    .from('ra_sucursales')
    .select('id')
    .eq('id', sucursalId)
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .single()

  if (!data) return 'Tienda no válida'

  const jar = await cookies()
  // La sucursal activa debe acompañar al usuario también dentro del Panel.
  jar.set('ra_sucursal_activa', sucursalId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 hours
  })
  // Retira la cookie anterior, limitada a /tablet, para evitar dos contextos.
  jar.set('ra_sucursal_id', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/tablet',
    maxAge: 0,
  })

  redirect('/tablet/pos')
}

export async function cambiarSucursal(): Promise<void> {
  const { user, perfil } = await getSession()
  if (!user || !perfil?.empresa_id) redirect('/tablet/login')

  // Los vendedores tienen una sucursal asignada en su perfil y no pueden cambiarla.
  if (perfil.sucursal_id || !['administrador', 'superadmin'].includes(perfil.rol)) {
    redirect('/tablet/pos')
  }

  const jar = await cookies()
  jar.set('ra_sucursal_activa', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  jar.set('ra_sucursal_id', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/tablet',
    maxAge: 0,
  })
  redirect('/tablet/sucursal')
}
