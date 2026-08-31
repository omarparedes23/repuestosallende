'use server'

import { revalidatePath } from 'next/cache'
import { getSession, getSessionFast } from '@/lib/session'
import { consultarRuc, consultarDni } from '@/lib/services/dniRuc'
import type {
  RaClienteInsert,
  RaClienteUpdate,
  RaCuentaCorrienteMovimiento,
  RaMetodoPago,
  RaMoneda,
  RaVenta,
} from '@/lib/types/database'

export type MovimientoConVenta = RaCuentaCorrienteMovimiento & {
  ra_ventas: Pick<RaVenta, 'id' | 'numero_completo' | 'moneda' | 'total' | 'created_at'> | null
  usuario_nombre: string | null
}

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

export async function consultarDocumento(
  tipoDocumento: 'DNI' | 'RUC',
  numero: string
): Promise<{ data: { nombre: string; direccion?: string | null } | null; error: string | null }> {
  const { user, perfil } = await getSessionFast()
  if (!user || !perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  if (tipoDocumento === 'RUC') {
    const resultado = await consultarRuc(numero)
    if (!resultado.exito) return { data: null, error: resultado.error }
    return { data: { nombre: resultado.data.razonSocial, direccion: resultado.data.direccion }, error: null }
  }

  const resultado = await consultarDni(numero)
  if (!resultado.exito) return { data: null, error: resultado.error }
  const nombre = [resultado.data.nombres, resultado.data.apellidoPaterno, resultado.data.apellidoMaterno]
    .filter(Boolean)
    .join(' ')
  return { data: { nombre }, error: null }
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

export async function getEstadoCuenta(clienteId: string): Promise<{
  data: MovimientoConVenta[] | null
  error: string | null
}> {
  const { supabase: raw, perfil } = await getSessionFast()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { data: null, error: 'No autenticado' }

  const { data: movimientos, error } = await supabase
    .from('ra_cuenta_corriente_movimientos')
    .select(
      `id, empresa_id, cliente_id, venta_id, tipo, monto, fecha, fecha_vencimiento,
       moneda_cobro, tipo_cambio_cobro, metodo_pago, referencia, usuario_id, created_at,
       ra_ventas ( id, numero_completo, moneda, total, created_at )`
    )
    .eq('cliente_id', clienteId)
    .eq('empresa_id', perfil.empresa_id)
    .order('fecha', { ascending: false })

  if (error) return { data: null, error: 'Error al obtener el estado de cuenta' }

  const filas = movimientos ?? []
  const usuarioIds = [...new Set(filas.map((m: any) => m.usuario_id))]
  const { data: perfiles } = usuarioIds.length
    ? await supabase.from('ra_perfiles').select('id, nombre').in('id', usuarioIds)
    : { data: [] }
  const nombrePorUsuario: Record<string, string> = Object.fromEntries(
    (perfiles ?? []).map((p: any) => [p.id, p.nombre])
  )

  const data: MovimientoConVenta[] = filas.map((m: any) => ({
    ...m,
    usuario_nombre: nombrePorUsuario[m.usuario_id] ?? null,
  }))

  return { data, error: null }
}

export async function registrarCobro(
  operationId: string,
  sucursalId: string,
  ventaId: string,
  monto: number,
  fecha: string,
  metodoPago: RaMetodoPago,
  moneda: RaMoneda,
  referencia: string | null
): Promise<{ error: string | null }> {
  // PostgreSQL admite UUID canónicos que no necesariamente siguen las versiones
  // RFC 1–5; algunas sucursales históricas usan ese formato válido.
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuid.test(operationId) || !uuid.test(sucursalId) || !uuid.test(ventaId)) {
    return { error: 'Identificador de operación inválido.' }
  }
  if (!Number.isFinite(monto) || monto <= 0) return { error: 'El monto debe ser mayor a cero.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { error: 'Fecha inválida.' }
  if (['yape', 'tarjeta', 'transferencia'].includes(metodoPago) && !referencia?.trim()) {
    return { error: 'Los pagos digitales requieren número de operación o voucher.' }
  }
  const { supabase: raw, perfil } = await getSession()
  const supabase = raw as any
  if (!perfil?.empresa_id) return { error: 'No autenticado' }
  if (!['administrador', 'superadmin'].includes(perfil.rol)) return { error: 'Sin permisos.' }
  const { error } = await supabase.rpc('ra_registrar_cobro_v2', {
    p_operation_id: operationId,
    p_sucursal_id: sucursalId,
    p_venta_id: ventaId,
    p_monto: monto,
    p_fecha: fecha,
    p_metodo_pago: metodoPago,
    p_moneda_cobro: moneda,
    p_tipo_cambio_cobro: null,
    p_referencia: referencia,
  })

  if (error) return { error: mapTreasuryError(error.message, 'Error al registrar el cobro') }

  revalidatePath('/panel/clientes')
  revalidatePath('/panel/tesoreria')
  revalidatePath('/panel/ventas')
  return { error: null }
}

function mapTreasuryError(message: string | null | undefined, fallback: string): string {
  if (!message) return fallback
  if (message.includes('RA_UNAUTHENTICATED')) return 'No autenticado.'
  if (message.includes('RA_FORBIDDEN')) return 'Sin permisos.'
  if (message.includes('RA_IDEMPOTENCY_CONFLICT')) return 'El identificador de operación ya fue usado con otros datos.'
  if (message.includes('RA_NOT_FOUND')) return 'La venta no existe o no pertenece a la empresa.'
  if (message.includes('RA_AMOUNT_INVALID')) return 'El monto debe ser mayor a cero.'
  return message
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
