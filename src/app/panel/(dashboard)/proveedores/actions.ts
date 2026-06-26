'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { RaProveedorInsert, RaProveedorUpdate } from '@/lib/types/database'

export async function getProveedores() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_proveedores')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('nombre')

  return { data, error: error?.message ?? null }
}

export async function upsertProveedor(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const id = formData.get('id') as string | null
  const nombre = (formData.get('nombre') as string)?.trim()
  const ruc = (formData.get('ruc') as string)?.trim() || null
  const telefono = (formData.get('telefono') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const direccion = (formData.get('direccion') as string)?.trim() || null
  const contacto = (formData.get('contacto') as string)?.trim() || null
  const notas = (formData.get('notas') as string)?.trim() || null

  if (!nombre) return 'El nombre del proveedor es obligatorio.'

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  if (id) {
    const payload: RaProveedorUpdate = { nombre, ruc, telefono, email, direccion, contacto, notas }
    const { error } = await supabase
      .from('ra_proveedores')
      .update(payload)
      .eq('id', id)
      .eq('empresa_id', perfil.empresa_id)
    if (error) {
      if (error.code === '23505') return 'Ya existe un proveedor con ese RUC.'
      return 'Error al actualizar el proveedor.'
    }
  } else {
    const payload: RaProveedorInsert = {
      empresa_id: perfil.empresa_id,
      nombre, ruc, telefono, email, direccion, contacto, notas,
    }
    const { error } = await supabase.from('ra_proveedores').insert(payload)
    if (error) {
      if (error.code === '23505') return 'Ya existe un proveedor con ese RUC.'
      return 'Error al crear el proveedor.'
    }
  }

  revalidatePath('/panel/proveedores')
  return null
}

export async function toggleActivoProveedor(id: string, activo: boolean): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase
    .from('ra_proveedores')
    .update({ activo: !activo })
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) return 'Error al actualizar el proveedor.'
  revalidatePath('/panel/proveedores')
  return null
}
