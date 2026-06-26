'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { RaClienteInsert, RaClienteUpdate } from '@/lib/types/database'

export async function getClientes() {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ra_clientes')
    .select('*')
    .eq('empresa_id', perfil.empresa_id)
    .order('nombre')

  return { data, error: error?.message ?? null }
}

export async function upsertCliente(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const id = formData.get('id') as string | null
  const nombre = (formData.get('nombre') as string)?.trim()
  const tipoDocumento = (formData.get('tipo_documento') as string) || null
  const nroDocumento = (formData.get('nro_documento') as string)?.trim() || null
  const telefono = (formData.get('telefono') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const direccion = (formData.get('direccion') as string)?.trim() || null
  const tieneCredito = formData.get('tiene_credito') === 'on'
  const limiteCredito = parseFloat((formData.get('limite_credito') as string) || '0')

  if (!nombre) return 'El nombre del cliente es obligatorio.'
  if (isNaN(limiteCredito) || limiteCredito < 0) return 'El límite de crédito debe ser mayor o igual a 0.'

  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  if (id) {
    const payload: RaClienteUpdate = {
      nombre,
      tipo_documento: tipoDocumento as any,
      nro_documento: nroDocumento,
      telefono,
      email,
      direccion,
      tiene_credito: tieneCredito,
      limite_credito: limiteCredito,
    }
    const { error } = await supabase
      .from('ra_clientes')
      .update(payload)
      .eq('id', id)
      .eq('empresa_id', perfil.empresa_id)
    if (error) return 'Error al actualizar el cliente.'
  } else {
    const payload: RaClienteInsert = {
      empresa_id: perfil.empresa_id,
      nombre,
      tipo_documento: tipoDocumento as any,
      nro_documento: nroDocumento,
      telefono,
      email,
      direccion,
      tiene_credito: tieneCredito,
      limite_credito: limiteCredito,
    }
    const { error } = await supabase.from('ra_clientes').insert(payload)
    if (error) return 'Error al crear el cliente.'
  }

  revalidatePath('/panel/clientes')
  return null
}

export async function toggleActivoCliente(id: string, activo: boolean): Promise<string | null> {
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return 'No autenticado.'

  const { error } = await supabase
    .from('ra_clientes')
    .update({ activo: !activo })
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) return 'Error al actualizar el cliente.'
  revalidatePath('/panel/clientes')
  return null
}
