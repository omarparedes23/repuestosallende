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
  jar.set('ra_sucursal_id', sucursalId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/tablet',
    maxAge: 60 * 60 * 12, // 12 hours
  })

  redirect('/tablet/pos')
}
