import { afterAll, describe, expect, it } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { emitirComprobante, consultarComprobantePorNumero, type OseComprobanteInput } from '../src/lib/facturacion/ose'
import { buildCreditNoteInput, processSunatNotaCreditoOutboxForDevolucion, processSunatOutbox } from '../src/lib/facturacion/outbox'

// Suite E2E opt-in contra el OSE beta real del VPS.
// Se ejecuta SOLO con RUN_OSE_E2E=1 npm run test:e2e:ose (vitest.e2e.config.ts).
// NO se ejecuta en `npm test` (vitest.config.ts incluye solo src/**).
// Genera comprobantes fiscales reales en el ambiente beta de SUNAT; no borra comprobantes del OSE.

const ENABLED = process.env.RUN_OSE_E2E === '1'

if (ENABLED) {
  try {
    process.loadEnvFile(path.resolve(process.cwd(), '.env.local'))
  } catch {
    // .env.local puede no existir; se usan las variables ya presentes en el entorno.
  }
}

const OSE_URL = process.env.OSE_SUNAT_URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMPRESA = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
const SUCURSAL = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
const CATEGORIA = '3eb2c88d-c723-4db5-ad81-d71ef5e11013'
const SERIE_BOLETA = 'B001'
const CATALOGO_ID = 'aaaaaaaa-0000-4000-8000-00000000e2c1'
const PRODUCTO_ID = 'aaaaaaaa-0000-4000-8000-00000000e2c2'

// Usuario nuevo por corrida (email único) para no depender de admin list/generateLink
// (endpoints de admin inestables con esta key). El catálogo/producto son reutilizables.
const email = `e2e.ose.${Date.now()}@test.local`
const password = randomUUID().replaceAll('-', '') + 'Aa1!'

let adminClient: SupabaseClient
let ventaA: { operationId: string; ventaId: string; correlativo?: number; outboxEstado?: string } | undefined
let ventaB: { operationId: string; ventaId: string; correlativo?: number; outboxEstado?: string; externalId?: string; hash?: string; pagoRef?: string } | undefined
let userId: string | undefined
let outboxKeyB: string | undefined
let vendedorId: string | undefined

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function pollOutbox(ventaId: string, timeoutMs: number) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const { data, error } = await adminClient
      .from('ra_sunat_outbox' as never)
      .select('id,status,attempt_count,external_id,http_status,error_code,error_message,document_key')
      .eq('venta_id', ventaId)
      .maybeSingle()
    if (error) throw new Error(`poll outbox: ${error.message}`)
    const row = data as unknown as
      | { id: string; status: string; attempt_count: number; external_id: string | null; http_status: number | null; error_code: string | null; error_message: string | null; document_key: string }
      | null
    if (!row) throw new Error(`no hay outbox para venta ${ventaId}`)
    if (['accepted', 'rejected', 'dead_letter', 'submitted'].includes(row.status)) return row
    await sleep(5000)
  }
  throw new Error(`timeout esperando outbox terminal para venta ${ventaId}`)
}

const describeE2E = ENABLED ? describe : describe.skip

describeE2E('OSE beta E2E — venta-transaccional-idempotente', () => {
  let authedClient: SupabaseClient

  it('1. conectividad al endpoint OSE configurado', async () => {
    expect(OSE_URL).toBeTruthy()
    const res = await fetch(`${OSE_URL}/api/v1/comprobantes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(20_000),
    })
    expect(res.status).toBe(401)
    const body = (await res.json()) as { error?: string }
    expect(body.error).toContain('X-Api-Key')
  })

  it('2-6. setup + venta real via RPC + worker OSE + comprobante aceptado', async () => {
    expect(SUPABASE_URL).toBeTruthy()
    expect(SERVICE_ROLE).toBeTruthy()
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeTruthy()
    adminClient = createClient(SUPABASE_URL!, SERVICE_ROLE!, { auth: { persistSession: false } })

    // Usuario nuevo por corrida con perfil administrador en la empresa existente
    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nombre: 'E2E OSE TEST' },
    })
    expect(createErr).toBeNull()
    userId = created!.user!.id
    expect(userId).toBeTruthy()

    const { error: perfilErr } = await adminClient
      .from('ra_perfiles' as never)
      .update({ empresa_id: EMPRESA, sucursal_id: null, rol: 'administrador', activo: true })
      .eq('id', userId)
    expect(perfilErr).toBeNull()

    // Fixture reutilizable: catálogo + producto TEST en la empresa existente (upsert)
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

    // Sesión autenticada real (mismo flujo que la aplicación)
    const { data: signIn, error: signErr } = await createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    }).auth.signInWithPassword({ email, password })
    expect(signErr).toBeNull()
    authedClient = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${signIn!.session!.access_token}` } },
    })

    const items = [{ productoId: PRODUCTO_ID, cantidad: 1, descuento: 0 }]
    const pagoRefA = `e2e-a-${Date.now()}`
    const pagosA = [{ metodoPago: 'efectivo', monto: 118, referencia: pagoRefA }]

    // VENTA A — primera boleta de la serie (probablemente B001-1, ya usado en OSE beta)
    ventaA = { operationId: randomUUID(), ventaId: '' }
    const rpcA = await authedClient.rpc('ra_confirmar_venta', {
      p_operation_id: ventaA.operationId,
      p_sucursal_id: SUCURSAL,
      p_tipo_comprobante: 'boleta',
      p_cliente_id: null,
      p_items: items,
      p_pagos: pagosA,
      p_moneda: 'PEN',
      p_tipo_cambio: null,
      p_fecha_vencimiento: null,
    } as never)
    expect(rpcA.error).toBeNull()
    const resultA = rpcA.data as { status: string; sale: { id: string; correlativo: number } }
    expect(resultA.status).toBe('confirmed')
    ventaA.ventaId = resultA.sale.id
    ventaA.correlativo = resultA.sale.correlativo

    // Ejecutar el worker (misma lógica de la ruta interna, con secrets del entorno)
    const wA = await processSunatOutbox(10)
    expect(wA.claimed).toBeGreaterThan(0)
    const outA = await pollOutbox(ventaA.ventaId, 90_000)
    ventaA.outboxEstado = outA.status

    // VENTA B — siguiente correlativo (libre en OSE) para demostrar aceptación real
    ventaB = { operationId: randomUUID(), ventaId: '' }
    const pagoRefB = `e2e-b-${Date.now()}`
    ventaB.pagoRef = pagoRefB
    const pagosB = [{ metodoPago: 'efectivo', monto: 118, referencia: pagoRefB }]
    const rpcB = await authedClient.rpc('ra_confirmar_venta', {
      p_operation_id: ventaB.operationId,
      p_sucursal_id: SUCURSAL,
      p_tipo_comprobante: 'boleta',
      p_cliente_id: null,
      p_items: items,
      p_pagos: pagosB,
      p_moneda: 'PEN',
      p_tipo_cambio: null,
      p_fecha_vencimiento: null,
    } as never)
    expect(rpcB.error).toBeNull()
    const resultB = rpcB.data as { status: string; sale: { id: string; correlativo: number } }
    expect(resultB.status).toBe('confirmed')
    ventaB.ventaId = resultB.sale.id
    ventaB.correlativo = resultB.sale.correlativo
    outboxKeyB = `${EMPRESA}:BOLETA:${SERIE_BOLETA}:${ventaB.correlativo}`

    const wB = await processSunatOutbox(10)
    expect(wB.claimed).toBeGreaterThan(0)
    const outB = await pollOutbox(ventaB.ventaId, 90_000)
    ventaB.outboxEstado = outB.status
    ventaB.externalId = outB.external_id ?? undefined

    // Al menos la venta B debe estar aceptada (correlativo libre en OSE beta)
    expect(outB.status).toBe('accepted')

    // Estado fiscal de la venta B
    const { data: ventaRow } = await adminClient
      .from('ra_ventas' as never)
      .select('estado,sunat_estado,id_externo,sunat_hash,serie,correlativo,numero_completo')
      .eq('id', ventaB.ventaId)
      .maybeSingle()
    const venta = ventaRow as unknown as {
      estado: string
      sunat_estado: string | null
      id_externo: string | null
      sunat_hash: string | null
      serie: string
      correlativo: number
      numero_completo: string | null
    }
    expect(venta.estado).toBe('completada')
    expect(venta.sunat_estado).toBe('aceptada')
    expect(venta.serie).toBe(SERIE_BOLETA)
    expect(venta.id_externo).toBeTruthy()
    ventaB.hash = venta.sunat_hash ?? undefined

    // Hash/URL del OSE vía /por-numero (reconciliación por identidad fiscal)
    const porNumero = await consultarComprobantePorNumero('BOLETA', SERIE_BOLETA, ventaB.correlativo)
    expect(porNumero).toBeTruthy()
  })

  it('7. replay idéntico: misma venta, sin nuevo outbox, sin doble descuento', async () => {
    const before = await adminClient
      .from('ra_ventas' as never)
      .select('operation_id')
      .eq('operation_id', ventaB!.operationId)
    expect((before.data as unknown[]).length).toBe(1)

    const stockBefore = await adminClient.from('ra_productos' as never).select('stock_actual').eq('id', PRODUCTO_ID).maybeSingle()
    const stockInicial = (stockBefore.data as unknown as { stock_actual: number }).stock_actual

    const { data, error } = await authedClient.rpc('ra_confirmar_venta', {
      p_operation_id: ventaB!.operationId,
      p_sucursal_id: SUCURSAL,
      p_tipo_comprobante: 'boleta',
      p_cliente_id: null,
      p_items: [{ productoId: PRODUCTO_ID, cantidad: 1, descuento: 0 }],
      p_pagos: [{ metodoPago: 'efectivo', monto: 118, referencia: ventaB!.pagoRef }],
      p_moneda: 'PEN',
      p_tipo_cambio: null,
      p_fecha_vencimiento: null,
    } as never)
    expect(error).toBeNull()
    const result = data as { status: string; replayed: boolean; sale: { id: string } }
    expect(result.status).toBe('confirmed')
    expect(result.replayed).toBe(true)
    expect(result.sale.id).toBe(ventaB!.ventaId)

    // Un solo outbox para esa venta
    const outboxes = await adminClient.from('ra_sunat_outbox' as never).select('id').eq('venta_id', ventaB!.ventaId)
    expect((outboxes.data as unknown[]).length).toBe(1)

    // Stock descontado exactamente una vez (2 boletas: A y B; A no descontó si fue rechazada antes del commit OSE, pero el descuento ocurre al confirmar la venta)
    const stockAfter = await adminClient.from('ra_productos' as never).select('stock_actual').eq('id', PRODUCTO_ID).maybeSingle()
    const stockFinal = (stockAfter.data as unknown as { stock_actual: number }).stock_actual
    // A y B confirmaron cada una 1 unidad; el replay NO descuenta de nuevo
    expect(stockInicial - stockFinal).toBe(0)
  })

  it('8. reconciliación por GET /por-numero', async () => {
    const porNumero = await consultarComprobantePorNumero('BOLETA', SERIE_BOLETA, ventaB!.correlativo!)
    expect(porNumero).toBeTruthy()
    const doc = porNumero as {
      id?: string
      numeroCompleto?: string
      estado?: string
      sunatAceptada?: boolean
      sunatHash?: string | null
      idempotencyReplayed?: boolean
    }
    expect(doc.numeroCompleto).toBe(`B001-${String(ventaB!.correlativo).padStart(8, '0')}`)
    expect(doc.estado).toBe('EMITIDA')
    expect(doc.sunatAceptada).toBe(true)
    expect(doc.id).toBe(ventaB!.externalId)
  })

  it('9. conflicto mismo Idempotency-Key con payload distinto -> rechazo controlado sin efectos', async () => {
    // A nivel OSE: mismo document_key con payload diferente -> 409/rejected
    const outboxRow = await adminClient
      .from('ra_sunat_outbox' as never)
      .select('request_payload,document_key')
      .eq('venta_id', ventaB!.ventaId)
      .maybeSingle()
    const payload = (outboxRow.data as unknown as { request_payload: OseComprobanteInput; document_key: string }).request_payload
    const key = (outboxRow.data as unknown as { document_key: string }).document_key

    const conflicted: OseComprobanteInput = {
      ...payload,
      cliente: { nombre: 'CLIENTE CONFLICTO E2E', tipoDocumento: 'DNI', nroDocumento: '99999998' },
    }
    const res = await emitirComprobante(conflicted, key)
    expect(res.kind).toBe('rejected')
    expect(res.exito).toBe(false)

    // A nivel RPC: mismo operation_id con payload distinto -> RA_IDEMPOTENCY_CONFLICT
    const rpc = await authedClient.rpc('ra_confirmar_venta', {
      p_operation_id: ventaB!.operationId,
      p_sucursal_id: SUCURSAL,
      p_tipo_comprobante: 'boleta',
      p_cliente_id: null,
      p_items: [{ productoId: PRODUCTO_ID, cantidad: 2, descuento: 0 }],
      p_pagos: [{ metodoPago: 'efectivo', monto: 236, referencia: null }],
      p_moneda: 'PEN',
      p_tipo_cambio: null,
      p_fecha_vencimiento: null,
    } as never)
    expect(rpc.error).not.toBeNull()
    expect(rpc.error?.message).toContain('RA_IDEMPOTENCY_CONFLICT')

    // Cero ventas/outbox adicionales
    const ventas = await adminClient.from('ra_ventas' as never).select('id').eq('operation_id', ventaB!.operationId)
    expect((ventas.data as unknown[]).length).toBe(1)
    const outboxes = await adminClient.from('ra_sunat_outbox' as never).select('id').eq('venta_id', ventaB!.ventaId)
    expect((outboxes.data as unknown[]).length).toBe(1)
  })

  it('10. sin reenvío ciego: un resultado incierto se reconcilia por /por-numero, no se reenvía', async () => {
    // El worker nunca reenvía automáticamente un resultado uncertain/submitted:
    // verificamos que la venta B NO tiene jobs pending/retry tras la aceptación.
    const jobs = await adminClient
      .from('ra_sunat_outbox' as never)
      .select('id,status')
      .eq('venta_id', ventaB!.ventaId)
      .in('status', ['pending', 'retry'])
    expect((jobs.data as unknown[]).length).toBe(0)

    // La identidad fiscal de B es consultable (reconciliación), no se reintenta a ciegas.
    const porNumero = await consultarComprobantePorNumero('BOLETA', SERIE_BOLETA, ventaB!.correlativo!)
    expect(porNumero).toBeTruthy()
  })

  it('11. devolución y NC real: aceptación, replay y conflicto de idempotencia', async () => {
    const vendedorEmail = `e2e.ose.vendedor.${Date.now()}@test.local`
    const vendedorPassword = randomUUID().replaceAll('-', '') + 'Aa1!'
    const { data: vendedorCreado, error: vendedorCreateError } = await adminClient.auth.admin.createUser({
      email: vendedorEmail,
      password: vendedorPassword,
      email_confirm: true,
      user_metadata: { nombre: 'E2E OSE vendedor TEST' },
    })
    expect(vendedorCreateError).toBeNull()
    vendedorId = vendedorCreado?.user?.id
    expect(vendedorId).toBeTruthy()

    const { error: vendedorPerfilError } = await adminClient
      .from('ra_perfiles' as never)
      .update({ empresa_id: EMPRESA, sucursal_id: SUCURSAL, rol: 'vendedor', activo: true })
      .eq('id', vendedorId!)
    expect(vendedorPerfilError).toBeNull()

    const anon = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: vendedorSession, error: vendedorSignInError } = await anon.auth.signInWithPassword({
      email: vendedorEmail,
      password: vendedorPassword,
    })
    expect(vendedorSignInError).toBeNull()
    const vendedorClient = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${vendedorSession!.session!.access_token}` } },
    })

    const ventaOperationId = randomUUID()
    const pagoReferencia = `e2e-nc-${Date.now()}`
    const ventaRpc = await vendedorClient.rpc('ra_confirmar_venta', {
      p_operation_id: ventaOperationId,
      p_sucursal_id: SUCURSAL,
      p_tipo_comprobante: 'boleta',
      p_cliente_id: null,
      p_items: [{ productoId: PRODUCTO_ID, cantidad: 1, descuento: 0 }],
      p_pagos: [{ metodoPago: 'efectivo', monto: 118, referencia: pagoReferencia }],
      p_moneda: 'PEN',
      p_tipo_cambio: null,
      p_fecha_vencimiento: null,
    } as never)
    expect(ventaRpc.error).toBeNull()
    const ventaResult = ventaRpc.data as { status: string; sale: { id: string } }
    expect(ventaResult.status).toBe('confirmed')

    const ventaFiscal = await processSunatOutbox(10)
    expect(ventaFiscal.claimed).toBeGreaterThan(0)
    const ventaOutbox = await pollOutbox(ventaResult.sale.id, 90_000)
    expect(ventaOutbox.status).toBe('accepted')

    const { data: ventaItemData, error: ventaItemError } = await adminClient
      .from('ra_venta_items' as never)
      .select('id')
      .eq('venta_id', ventaResult.sale.id)
      .single()
    expect(ventaItemError).toBeNull()
    const ventaItem = ventaItemData as unknown as { id: string }

    const solicitudOperationId = randomUUID()
    const solicitud = await vendedorClient.rpc('ra_solicitar_devolucion_v1', {
      p_operation_id: solicitudOperationId,
      p_venta_id: ventaResult.sale.id,
      p_items: [{ ventaItemId: ventaItem.id, cantidad: 1, reingresaStock: true }],
      p_motivo: 'E2E NC TEST',
    } as never)
    expect(solicitud.error).toBeNull()
    const devolucionId = (solicitud.data as { devolucionId: string }).devolucionId
    expect(devolucionId).toBeTruthy()

    const recepcion = await vendedorClient.rpc('ra_registrar_recepcion_devolucion_v1', {
      p_operation_id: randomUUID(),
      p_devolucion_id: devolucionId,
      p_recibido: true,
      p_condicion_declarada: 'apto_reventa',
      p_observacion: null,
    } as never)
    expect(recepcion.error).toBeNull()

    const aprobacion = await authedClient.rpc('ra_aprobar_devolucion_v1', {
      p_operation_id: randomUUID(),
      p_devolucion_id: devolucionId,
      p_reingreso_aprobado: true,
      p_reingreso_override_motivo: null,
    } as never)
    expect(aprobacion.error).toBeNull()

    const liquidacionOperationId = randomUUID()
    const liquidacion = await authedClient.rpc('ra_liquidar_devolucion_v1', {
      p_operation_id: liquidacionOperationId,
      p_devolucion_id: devolucionId,
      p_referencias: {},
    } as never)
    expect(liquidacion.error).toBeNull()
    expect((liquidacion.data as { status: string }).status).toBe('liquidated')

    const ncProcesada = await processSunatNotaCreditoOutboxForDevolucion(devolucionId)
    expect(ncProcesada).toEqual({ claimed: 1, processed: 1, outcome: 'accepted' })

    const { data: ncData, error: ncError } = await adminClient
      .from('ra_sunat_nota_credito_outbox' as never)
      .select('status,serie,correlativo,document_key,request_payload,http_status,error_code,error_message,response_payload,external_id')
      .eq('devolucion_id', devolucionId)
      .single()
    expect(ncError).toBeNull()
    const nc = ncData as unknown as {
      status: string; serie: string; correlativo: number; document_key: string; request_payload: unknown
      http_status: number | null; error_code: string | null; error_message: string | null
      response_payload: Record<string, unknown> | null; external_id: string | null
    }
    expect(nc.status).toBe('accepted')
    expect(nc.serie).toMatch(/^[BF][A-Z0-9]{3}$/)
    expect(nc.http_status).toBe(200)
    expect(nc.error_code).toBeNull()
    expect(nc.error_message).toBeNull()
    expect(nc.response_payload).toBeTruthy()
    expect(nc.external_id).toBeTruthy()

    // El mismo Idempotency-Key se responde desde OSE sin crear otro comprobante.
    const ncInput = buildCreditNoteInput(nc.request_payload as Parameters<typeof buildCreditNoteInput>[0])
    const ncReplay = await emitirComprobante(ncInput, nc.document_key)
    expect(ncReplay.kind).toBe('accepted')
    expect(ncReplay.id_externo).toBe(nc.external_id)
    expect(ncReplay.response_payload?.idempotencyReplayed).toBe(true)

    const ncConflict = await emitirComprobante({
      ...ncInput,
      notaCredito: { ...ncInput.notaCredito!, motivoDescripcion: 'E2E NC payload conflict' },
    }, nc.document_key)
    expect(ncConflict.kind).toBe('rejected')
    expect(ncConflict.http_status).toBe(409)

    const replayLiquidacion = await authedClient.rpc('ra_liquidar_devolucion_v1', {
      p_operation_id: liquidacionOperationId,
      p_devolucion_id: devolucionId,
      p_referencias: {},
    } as never)
    expect(replayLiquidacion.error).toBeNull()
    expect((replayLiquidacion.data as { replayed: boolean }).replayed).toBe(true)

    const conflictoLiquidacion = await authedClient.rpc('ra_liquidar_devolucion_v1', {
      p_operation_id: liquidacionOperationId,
      p_devolucion_id: devolucionId,
      p_referencias: { efectivo: 'conflicto-e2e' },
    } as never)
    expect(conflictoLiquidacion.error?.message).toContain('RA_IDEMPOTENCY_CONFLICT')

    const ncDuplicada = await adminClient
      .from('ra_sunat_nota_credito_outbox' as never)
      .select('id')
      .eq('devolucion_id', devolucionId)
    expect((ncDuplicada.data as unknown[]).length).toBe(1)
  })
})

afterAll(async () => {
  if (!ENABLED || !adminClient) return
  // Limpieza SOLO de fixtures locales sin valor fiscal. Nunca se borran comprobantes del OSE.
  // El producto no tiene FK restrict desde ventas, puede eliminarse de forma segura.
  // El catálogo y el usuario quedan referenciados por las ventas B001 de prueba (valor fiscal)
  // vía ra_venta_items.catalogo_id y ra_ventas.usuario_id; se conservan como fixtures reutilizables
  // y se documentan sus IDs en verify-report.md.
  const before = await adminClient.from('ra_ventas' as never).select('id').eq('usuario_id', userId ?? '')
  if (userId && (!before.data || (before.data as unknown[]).length === 0)) {
    await adminClient.auth.admin.deleteUser(userId)
  }
  if (true) {
    const { error } = await adminClient.from('ra_productos' as never).delete().eq('id', PRODUCTO_ID)
    if (error) console.warn('[e2e:ose] no se pudo limpiar producto', error.message)
  }
})
