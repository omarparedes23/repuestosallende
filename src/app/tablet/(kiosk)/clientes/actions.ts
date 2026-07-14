'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import type { RaCliente } from '@/lib/types/database'

export type ClienteResumen = Pick<
  RaCliente,
  | 'id'
  | 'nombre'
  | 'tipo_cliente'
  | 'tipo_documento'
  | 'nro_documento'
  | 'telefono'
  | 'activo'
  | 'tiene_credito'
  | 'limite_credito'
  | 'saldo_deudor'
>

const ClienteSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio.' }).max(200),
  tipo_cliente: z.enum(['mayorista', 'minorista']),
  tipo_documento: z.enum(['DNI', 'RUC', 'CE', 'PASAPORTE']).nullable().optional(),
  nro_documento: z.string().max(20).nullable().optional(),
  telefono: z.string().max(20).nullable().optional(),
  email: z.string().max(100).nullable().optional(),
  direccion: z.string().max(300).nullable().optional(),
})

function parseClienteForm(formData: FormData) {
  return ClienteSchema.safeParse({
    nombre: formData.get('nombre'),
    tipo_cliente: formData.get('tipo_cliente') || 'minorista',
    tipo_documento: formData.get('tipo_documento') || null,
    nro_documento: (formData.get('nro_documento') as string)?.trim() || null,
    telefono: (formData.get('telefono') as string)?.trim() || null,
    email: (formData.get('email') as string)?.trim() || null,
    direccion: (formData.get('direccion') as string)?.trim() || null,
  })
}

export async function buscarClientes(query: string): Promise<{
  data: ClienteResumen[]
  error: string | null
}> {
  const { supabase: rawSupabase, user, perfil } = await getSessionFast()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return { data: [], error: 'No autenticado' }

  let q = supabase
    .from('ra_clientes')
    .select(
      'id, nombre, tipo_cliente, tipo_documento, nro_documento, telefono, activo, tiene_credito, limite_credito, saldo_deudor'
    )
    .eq('empresa_id', perfil.empresa_id)
    .eq('activo', true)
    .order('nombre')
    .limit(40)

  if (query.trim()) {
    q = q.or(`nombre.ilike.%${query.trim()}%,nro_documento.ilike.%${query.trim()}%`)
  }

  const { data, error } = await q
  if (error) return { data: [], error: 'Error buscando clientes' }

  return { data: (data as ClienteResumen[]) ?? [], error: null }
}

export async function crearCliente(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const parsed = parseClienteForm(formData)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Datos inválidos.'

  const { supabase: rawSupabase, user, perfil } = await getSession()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'
  if (!['administrador', 'vendedor'].includes(perfil.rol)) return 'Sin permisos.'

  const { error } = await supabase.from('ra_clientes').insert({
    empresa_id: perfil.empresa_id,
    ...parsed.data,
  })

  if (error) {
    if (error.code === '23505') return 'Ya existe un cliente con ese documento.'
    return 'Error al crear el cliente.'
  }

  revalidatePath('/tablet/clientes')
  return null
}

export async function actualizarCliente(
  id: string,
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const parsed = parseClienteForm(formData)
  if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Datos inválidos.'

  const { supabase: rawSupabase, user, perfil } = await getSession()
  const supabase = rawSupabase as any
  if (!user || !perfil?.empresa_id) return 'No autenticado.'
  if (!['administrador', 'vendedor'].includes(perfil.rol)) return 'Sin permisos.'

  const { error } = await supabase
    .from('ra_clientes')
    .update(parsed.data)
    .eq('id', id)
    .eq('empresa_id', perfil.empresa_id)

  if (error) {
    if (error.code === '23505') return 'Ya existe un cliente con ese documento.'
    return 'Error al actualizar el cliente.'
  }

  revalidatePath('/tablet/clientes')
  return null
}
