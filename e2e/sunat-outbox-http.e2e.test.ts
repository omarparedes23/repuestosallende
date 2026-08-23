import { afterAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import path from 'node:path'

// Suite E2E opt-in para la ruta interna HTTP del outbox SUNAT.
// Requiere servidor levantado con SUNAT_OUTBOX_CRON_SECRET configurado:
//   RUN_OSE_E2E=1 OUTBOX_HTTP_URL=http://127.0.0.1:3000 npm run test:e2e:ose
// Emite comprobantes fiscales reales en el ambiente beta de SUNAT.
// Cubre: 401 sin/incorrecto secreto, procesamiento de jobs con secreto,
// finalización correcta (lease/fencing vía ra_finish_sunat_outbox) y no duplicación de envíos.

const ENABLED = process.env.RUN_OSE_E2E === '1'

if (ENABLED) {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), '.env.local'))
  } catch {
    // .env.local puede no existir; se usan las variables ya presentes en el entorno.
  }
}

const BASE_URL = process.env.OUTBOX_HTTP_URL ?? 'http://127.0.0.1:3000'
const ENDPOINT = `${BASE_URL}/api/internal/sunat-outbox`
const SECRET = process.env.SUNAT_OUTBOX_CRON_SECRET
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMPRESA = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const SUCURSAL = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
const CATEGORIA = '3eb2c88d-c723-4db5-ad81-d71ef5e11013'
const SERIE_BOLETA = 'B001'
const CATALOGO_ID = 'aaaaaaaa-0000-4000-8000-00000000e2c1'
const PRODUCTO_ID = 'aaaaaaaa-0000-4000-8000-00000000e2c2'

const email = `e2e.http.${Date.now()}@test.local`
const password = randomUUID().replaceAll('-', '') + 'Aa1!'

let adminClient: SupabaseClient
let userId: string | undefined

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function invokeEndpoint(headers: Record<string, string>) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
    signal: AbortSignal.timeout(60_000),
  })
  return { status: res.status, body: (await res.json()) as { error?: string; claimed?: number; processed?: number } }
}

async function pollOutbox(ventaId: string, timeoutMs: number) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const { data, error } = await adminClient
      .from('ra_sunat_outbox' as never)
      .select('id,status,attempt_count,external_id,error_message')
      .eq('venta_id', ventaId)
      .maybeSingle()
    if (error) throw new Error(`poll outbox: ${error.message}`)
    const row = data as unknown as { id: string; status: string; attempt_count: number; external_id: string | null; error_message: string | null } | null
    if (!row) throw new Error(`no hay outbox para venta ${ventaId}`)
    if (['accepted', 'rejected', 'dead_letter', 'submitted'].includes(row.status)) return row
    await sleep(5000)
  }
  throw new Error(`timeout esperando outbox terminal para venta ${ventaId}`)
}

const describeE2E = ENABLED ? describe : describe.skip

describeE2E('Ruta HTTP interna sunat-outbox — venta-transaccional-idempotente', () => {
  let authedClient: SupabaseClient
  let ventaId: string
  let correlativo: number

  it('1. sin secreto -> 401', async () => {
    const res = await invokeEndpoint({})
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Unauthorized')
  })

  it('2. secreto incorrecto -> 401', async () => {
    const res = await invokeEndpoint({ authorization: 'Bearer secreto-equivocado' })
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Unauthorized')
  })

  it('3. setup + venta real via RPC deja job pendiente', async () => {
    expect(SUPABASE_URL).toBeTruthy()
    expect(SERVICE_ROLE).toBeTruthy()
    adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE!, { auth: { persistSession: false } })

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: 'E2E HTTP OUTBOX TEST' },
    })
    expect(createErr).toBeNull()
    userId = created!.user!.id

    const { error: perfilErr } = await adminClient
      .from('ra_perfiles' as never)
      .update({ empresa_id: EMPRESA, sucursal_id: null, rol: 'administrador', activo: true })
      .eq('id', userId)
    expect(perfilErr).toBeNull()

    const { error: catErr } = await adminClient.from('ra_catalogo_repuestos' as never).upsert({
      id: CATALOGO_ID,
      categoria_id: CATEGORIA,
      codigo_oem: 'TEST-E2E-OSE',
      nombre: 'REPUESTO E2E OSE TEST',
      activo: true,
    }, { onConflict: 'id' })
    expect(catErr).toBeNull()

    const { error: prodErr } = await adminClient.from('ra_productos' as never).upsert({
      id: PRODUCTO_ID,
      empresa_id: EMPRESA,
      catalogo_id: CATALOGO_ID,
      codigo_interno: 'TEST-E2E-OSE',
      precio_venta: 100,
      precio_venta_dolar: 30,
      precio_compra: 50,
      stock_actual: 50,
      stock_minimo: 0,
      activo: true,
      sucursal_id: SUCURSAL,
      moneda: 'PEN',
    }, { onConflict: 'id' })
    expect(prodErr).toBeNull()

    const { data: signIn, error: signErr } = await createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    }).auth.signInWithPassword({ email, password })
    expect(signErr).toBeNull()
    authedClient = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signIn!.session!.access_token}` } },
    })

    const rpc = await authedClient.rpc('ra_confirmar_venta', {
      p_operation_id: randomUUID(),
      p_sucursal_id: SUCURSAL,
      p_tipo_comprobante: 'boleta',
      p_cliente_id: null,
      p_items: [{ productoId: PRODUCTO_ID, cantidad: 1, descuento: 0 }],
      p_pagos: [{ metodoPago: 'efectivo', monto: 118, referencia: `e2e-http-${Date.now()}` }],
      p_moneda: 'PEN',
      p_tipo_cambio: null,
      p_fecha_vencimiento: null,
    } as never)
    expect(rpc.error).toBeNull()
    const result = rpc.data as { status: string; sale: { id: string; correlativo: number } }
    expect(result.status).toBe('confirmed')
    ventaId = result.sale.id
    correlativo = result.sale.correlativo

    const job = await adminClient
      .from('ra_sunat_outbox' as never)
      .select('status')
      .eq('venta_id', ventaId)
      .maybeSingle()
    expect((job.data as unknown as { status: string }).status).toBe('pending')
  })

  it('4. secreto correcto -> procesa el job hasta accepted', async () => {
    const res = await invokeEndpoint({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(200)
    expect(res.body.claimed ?? 0).toBeGreaterThan(0)
    expect(res.body.processed ?? 0).toBeGreaterThan(0)

    const out = await pollOutbox(ventaId, 90_000)
    expect(out.status).toBe('accepted')
    expect(out.external_id).toBeTruthy()

    const { data: ventaRow } = await adminClient
      .from('ra_ventas' as never)
      .select('estado,sunat_estado,id_externo,serie,correlativo')
      .eq('id', ventaId)
      .maybeSingle()
    const venta = ventaRow as unknown as { estado: string; sunat_estado: string | null; id_externo: string | null; serie: string; correlativo: number }
    expect(venta.estado).toBe('completada')
    expect(venta.sunat_estado).toBe('aceptada')
    expect(venta.serie).toBe(SERIE_BOLETA)
    expect(venta.correlativo).toBe(correlativo)
  })

  it('5. segunda invocacion no duplica envio', async () => {
    const res = await invokeEndpoint({ authorization: `Bearer ${SECRET}` })
    expect(res.status).toBe(200)

    const outboxes = await adminClient.from('ra_sunat_outbox' as never).select('id').eq('venta_id', ventaId)
    expect((outboxes.data as unknown[]).length).toBe(1)

    const retryJobs = await adminClient
      .from('ra_sunat_outbox' as never)
      .select('id,status')
      .eq('venta_id', ventaId)
      .in('status', ['pending', 'retry'])
    expect((retryJobs.data as unknown[]).length).toBe(0)
  })
})

afterAll(async () => {
  if (!ENABLED || !adminClient || !userId) return
  const before = await adminClient.from('ra_ventas' as never).select('id').eq('usuario_id', userId)
  if ((!before.data || (before.data as unknown[]).length === 0) && userId) {
    await adminClient.auth.admin.deleteUser(userId)
  }
  const { error } = await adminClient.from('ra_productos' as never).delete().eq('id', PRODUCTO_ID)
  if (error && !(error.message ?? '').includes('No rows found')) {
    console.warn('[e2e:http-outbox] no se pudo limpiar producto', error.message)
  }
})
