# Verify report — venta-transaccional-idempotente

Fecha: 2026-08-16 (actualizado con la suite de pruebas autenticadas ejecutada)

## Veredicto

**PRUEBA DE COMPORTAMIENTO AUTENTICADA COMPLETADA CONTRA SUPABASE REMOTO DE PRUEBAS.** Se ejecutaron las 9 suites del plan autenticado en una empresa TEST aislada (`10101010-1010-4010-8010-101010101010`), con sesiones reales simuladas vía `request.jwt.claims` (usuarios `vendedor`, `administrador`, `lectura` y otra empresa). Se detectó, documentó y corrigió el bug de cast enum en `ra_confirmar_venta_v1` mediante la migración forward-only `040_fix_estado_enum_venta.sql`. Todos los escenarios pasaron. Adicionalmente, el smoke test E2E opt-in contra OSE beta pasó con emisión, replay y reconciliación reales.

## Bug detectado y corregido

- **Síntoma**: `ra_confirmar_venta_v1` fallaba al insertar la cabecera con `ERROR: column "estado" is of type ra_estado_venta but expression is of type text`.
- **Causa**: `supabase/migrations/038_venta_transaccional_idempotente.sql:271` usaba `CASE WHEN ... THEN 'completada' ELSE 'pendiente' END` (tipo `text`) para la columna enum `estado`. PostgreSQL no coacciona implícitamente `text → enum` dentro de un `CASE`.
- **Corrección**: migración `040_fix_estado_enum_venta.sql` (forward-only) con `'completada'::public.ra_estado_venta` / `'pendiente'::public.ra_estado_venta`. El archivo `038` local fue actualizado para evitar deriva.
- **Evidencia de atomicidad**: pese al fallo en el paso de inserción de cabecera, quedaron 0 ventas, 0 kardex y stock intacto.

## Evidencia ejecutada (resumen)

- Migraciones `038`, `039` y `040` aplicadas al proyecto remoto de pruebas `axcrubvtpqcyscizgoee` (conexión directa `db.axcrubvtpqcyscizgoee.supabase.co:5432`).
- `npm test`: 9 archivos, 39 pruebas, 0 fallos (tras el fix; se ejecutó la suite local).
- Fixtures aislados creados y marcados TEST (IDs en la sección de fixtures).
- Suite de 9 pruebas de comportamiento ejecutada con evidencia SQL real.

## Matriz de pruebas autenticadas

| # | Prueba | Resultado | Evidencia clave |
|---|--------|-----------|-----------------|
| 1 | Replay idéntico | PASS | 1ª respuesta `replayed:false`, 2ª `replayed:true`; misma venta `6a85c207-fb00-4798-a6da-0001a114b4c6`; 1 venta/1 item/1 pago/1 caja/1 kardex; stock 50→49 |
| 2 | Conflicto de idempotencia | PASS | `RA_IDEMPOTENCY_CONFLICT`; conteos idénticos antes/después; stock 49 sin cambios |
| 3 | Crédito y warning estable | PASS | Venta crédito 200 (límite 100) → `creditLimitExceeded:true`; abono de 200 deja saldo 0; reconsulta devuelve warning `true` (congelado) y `replayed:true`; 1 solo cargo |
| 4 | Rollback | PASS | Pago insuficiente (`RA_PAYMENT_INSUFFICIENT`), stock insuficiente (`RA_STOCK_INSUFFICIENT`), cliente crédito inválido (`RA_CUSTOMER_CREDIT_DISABLED`), producto de otra empresa (`RA_PRODUCT_INVALID`); 0 efectos residuales en ventas/items/pagos/caja/kardex/cc/outbox |
| 4b | Fault injection | PASS | Triggers transitorios en transacción con ROLLBACK: fallo tras insertar `ra_venta_items` y tras `ra_kardex` → 0 ventas, 0 kardex, stock intacto; esquema restaurado (triggers/función eliminados) |
| 5 | Autorización | PASS | No autenticado (`RA_UNAUTHENTICATED`), rol lectura (`RA_FORBIDDEN`), sucursal no autorizada (`RA_BRANCH_INVALID`), caja cerrada/ajena (`RA_CASHBOX_NOT_OPEN`), cliente otra empresa (`RA_CUSTOMER_INVALID`); cross-tenant `ra_obtener_resultado_venta` → `{"status":"not_found"}` sin filtrar existencia |
| 6 | Concurrencia de idempotencia | PASS | 2 confirmaciones paralelas con mismo `operation_id`: ambas devuelven la misma venta `b21385a8-261b-416b-9037-ac4973fb1b2f` (una `replayed:false`, otra `replayed:true`); 1 venta/1 item/1 pago/1 caja/1 kardex; stock descontado una vez |
| 7 | Concurrencia de stock | PASS | Stock inicial 5, dos ventas de 4 en paralelo: una confirma (`TTST-00000004`), otra `RA_STOCK_INSUFFICIENT`; stock final 1; kardex único 5→1 (cantidad 4) |
| 8 | Correlativos | PASS | Dos tickets concurrentes → correlativos 5 y 6 distintos; cero duplicados en `(empresa_id, serie, correlativo)` |
| 9 | Outbox sin OSE | PASS | 2 claimers concurrentes: A tomó los 3 jobs, B 0 (SKIP LOCKED); finish con token obsoleto → `false`; accepted → venta `completada/aceptada`; rejected → venta `error_sunat/rechazado`; temporary_error → `retry` con backoff; lease vencido recuperado por otro worker; dead_letter tras 10 intentos |

## Fixtures de prueba (para limpieza posterior)

Empresa TEST: `10101010-1010-4010-8010-101010101010` · Sucursal: `20202020-2020-4020-8020-202020202020` · Sucursal sin caja: `21212121-...` · Empresa OTRA: `30303030-3030-4030-8030-303030303030`

Usuarios auth + perfiles: `a0a0a0a0-...-0001` (vendedor), `...0002` (admin), `...0003` (lectura), `...0004` (otra empresa). Emails marcados `@test.local`.

Caja TEST abierta: `50505050-5050-4050-8050-505050505050` · Caja OTRA: `51515151-...` · Clientes: `60606060-...` (crédito), `61616161-...` (sin crédito), `62626262-...` (otra empresa) · Catálogos: `70707070-...` a `73737373-...` · Productos: `80808080-...` a `83838383-...`

Ventas de prueba confirmadas (serie `TTST`, correlativos 1–6): `b0b0b0b0-...` (replay), `c0c0c0c0-...` (crédito, quedó `error_sunat/rechazado` por el test de outbox), `f0f0f0f0-...` (concurrencia idempotencia), `f1f1f1f1-...` (stock), `f2f2f2f2-...081/082` (correlativos). La venta `b0b0b0b0` quedó `completada/aceptada` por el test de outbox.

Outbox de prueba: eliminada (3 trabajos accepted/rejected/dead_letter borrados). Abono TEST en `ra_cuenta_corriente_movimientos` con referencia `ABONO TEST IDEMPOTENCIA`.

## Limitaciones

- La sesión autenticada se simuló con `SET request.jwt.claims` sobre la conexión de `postgres` (función `auth.uid()` lee ese GUC). No se usó un JWT real; el comportamiento de RLS/grants de red se verificó por inspección y las funciones `SECURITY DEFINER` se ejecutan con el rol definido.
- Fault injection se realizó con triggers transitorios dentro de una transacción con `ROLLBACK` (no se modificó el esquema persistente). No se probó fallo tras insertar `ra_sunat_outbox` ni fallo del `UPDATE` de stock por separado; el caso kardex cubre el efecto de descuento+registro.
- No se habilitó scheduler. El camino de emisión y reconciliación `/por-numero` sí fue validado contra OSE beta mediante la suite E2E opt-in; queda pendiente únicamente probar la ruta HTTP interna completa en lugar de invocar directamente su misma lógica.
- Los huecos de correlativo (el 4 se reservó en un intento revertido de la prueba de stock) son esperados y no violan la especificación.
- La prueba de crédito modificó `ra_clientes.saldo_deudor` (cargo 200 + abono 200, saldo final 0) y las ventas `b0b0b0b0`/`c0c0c0c0` quedaron con estados fiscales de fixture; si estos fixtures se reutilizan, debe reconciliarse su `sunat_estado`.

## Estado de tareas relacionadas

- `tasks.md` Fase 3 (3.1, 3.3, 3.4, 3.6, 3.7) y Fase 5 (5.1, 5.3): las pruebas correspondientes fueron ejecutadas contra el entorno de pruebas con evidencia real. La reconciliación del ledger de migraciones y el smoke test OSE staging permanecen pendientes (Fases 6–7).
- `authenticated-test-plan.md`: los 7 casos mínimos del plan (replay, conflicto, crédito estable, rollback, stock concurrente, claim/fencing, aislamiento) quedaron cubiertos; este reporte los documenta con evidencia.

## Riesgos residuales no bloqueantes

- El tipo `Database` es manual y las llamadas RPC nuevas requieren un cast localizado `as never`; regenerar el tipo completo es un cambio separado.
- `ra_sunat_outbox` sin policy de navegador (intencional) y con índices que solo usan jobs de prueba; el advisor la marcará como `rls_enabled_no_policy` y sin uso real.
- El ledger de migraciones fue reconciliado el 2026-08-23: 038/039/040 registradas en `supabase_migrations.schema_migrations` (con verificación previa de objetos en remoto). Las migraciones locales `001`–`037` siguen fuera del ledger (condición conocida, no bloqueante).

## Siguientes pasos verificables

1. ~~Reconciliar el ledger remoto de migraciones (038, 039, 040) con los archivos locales.~~ **COMPLETADO (2026-08-23).** Hallazgos: el ledger (`supabase_migrations.schema_migrations`) solo contenía las 30 migraciones aplicadas vía MCP (trabajo de catálogo/RLS del 15-08 y anteriores); ninguna migración local `001`–`040` estaba registrada porque todas se aplicaron out-of-band vía psql. Se verificó por inspección que todos los objetos de 038–040 existen en remoto (`ra_sunat_outbox`, columnas `operation_id`/`request_hash` en `ra_ventas`, funciones `ra_confirmar_venta`/`ra_confirmar_venta_v1`/`ra_claim_sunat_outbox`/`ra_finish_sunat_outbox`/`ra_obtener_resultado_venta`, índice `idx_ventas_serie_correlativo`) y se insertaron las entradas `('038','venta_transaccional_idempotente')`, `('039','venta_idempotencia_hardening')`, `('040','fix_estado_enum_venta')` usando el prefijo del archivo local como versión, para mapeo 1:1 filesystem↔ledger. Nota abierta: las migraciones locales `001`–`037` siguen sin registrar en el ledger; registrarlas es un cambio separado de alcance mayor.
2. ~~Probar opcionalmente la ruta HTTP interna completa (`POST /api/internal/sunat-outbox`) con el servidor levantado.~~ **COMPLETADO (2026-08-23).** Nueva suite opt-in `e2e/sunat-outbox-http.e2e.test.ts` (5 pruebas, todas PASS) contra servidor dev real con `SUNAT_OUTBOX_CRON_SECRET` efímero: sin header → 401 `{"error":"Unauthorized"}`; secreto incorrecto → 401; secreto correcto → procesa el job de una venta boleta real creada vía RPC hasta `accepted` (venta `completada/aceptada`, serie B001, con `id_externo`, attempt_count=1); segunda invocación → cero jobs `pending/retry` y un solo outbox (sin duplicación de envío). **El scheduler sigue deshabilitado**: no existe `vercel.json` ni cron configurado, y `SUNAT_OUTBOX_CRON_SECRET` no está definida en ningún entorno; la ruta queda operativa pero SIN invocador automático — **no se habilita automáticamente**, la activación requiere decisión explícita del propietario según `operations.md` (secciones 5.4/5.5).
3. ~~Definir propietario/SLA de `submitted`, `rejected` y `dead_letter` y luego habilitar el cron.~~ **RESUELTO POR DECISIÓN OPERATIVA PROVISIONAL DEL PROPIETARIO (2026-08-23).** Aprobados en `operations.md`: submitted → admin del sistema, SLA 24h, reconciliación por `/por-numero`, nunca reenvío ciego; rejected → estado terminal con corrección de causa y reemisión controlada; dead_letter → alerta diaria + reintento manual auditado previa reconciliación fiscal. **El scheduler permanece deshabilitado** (sin Vercel Cron); su activación futura requiere nueva decisión explícita. Migraciones 001–037 intocadas (tarea separada).
4. Limpiar fixtures TEST de la empresa `10101010-...` tras confirmar que no interfieren.

## Decisión operativa del propietario (2026-08-23)

El propietario del sistema aprobó provisionalmente las propuestas operativas de `operations.md`:

- **submitted**: responsable admin del sistema, SLA 24 horas, reconciliación por `/por-numero`, nunca reenvío ciego.
- **rejected**: estado terminal; corrección de causa en maestros y reemisión controlada.
- **dead_letter**: alerta diaria y reintento manual auditado, previa reconciliación fiscal.
- **Scheduler**: se mantiene deshabilitado por ahora. No se habilitó Vercel Cron.
- Tareas 7.5 y 8.5 marcadas como completadas bajo esta salvedad de aprobación provisional.
- Las migraciones históricas 001–037 no fueron tocadas (tarea separada).

---

# Suplemento: Smoke test E2E opt-in contra OSE beta real (2026-08-16)

## Veredicto del smoke test OSE

**PASS.** Se ejecutó la suite E2E opt-in contra el OSE beta real del VPS (`https://w3sicad.cloud/osesunat`, SUNAT beta) con la bandera `RUN_OSE_E2E=1 npm run test:e2e:ose`. Se confirmó la emisión real de boletas, el replay idempotente, la reconciliación por `/por-numero` y el conflicto de Idempotency-Key. No se habilitó scheduler y no se invocó ningún endpoint OSE fuera de los contratos del adaptador.

## Evidencia ejecutada

| # | Requisito | Resultado | Evidencia |
|---|-----------|-----------|-----------|
| 1 | Conectividad al OSE | PASS | `POST /api/v1/comprobantes` sin key responde `401 {"error":"Header X-Api-Key requerido"}` |
| 2-6 | Venta real por RPC + worker + emisión aceptada | PASS | Venta `B001` confirmada vía `ra_confirmar_venta` (sesión autenticada real), outbox procesado por `processSunatOutbox` (service role), OSE respondió `EMITIDA`; venta `completada`/`aceptada` con `id_externo` y hash |
| 7 | Replay idéntico | PASS | Mismo `operation_id` y payload → `replayed:true`, misma venta, 1 solo outbox, stock sin doble descuento |
| 8 | Reconciliación `/por-numero` | PASS | `GET /api/v1/comprobantes/por-numero?tipo=BOLETA&serie=B001&correlativo=N` → `200`, `estado:EMITIDA`, `sunatAceptada:true`, `numeroCompleto`, `id` coincide con el de la venta |
| 9 | Conflicto mismo Idempotency-Key payload distinto | PASS | A nivel OSE → `rejected` (rechazo controlado); a nivel RPC → `RA_IDEMPOTENCY_CONFLICT`; 1 venta y 1 outbox, cero efectos adicionales |
| 10 | Sin reenvío ciego | PASS | Tras aceptación no quedan jobs `pending`/`retry`; identidad fiscal consultable vía `/por-numero` |

## Fecha/hora, estados y conteos

- Ejecutado: 2026-08-16 07:10 UTC (última corrida verde), repetible con la bandera.
- Compobrantes de prueba emitidos en OSE beta (serie B001, empresa existente `a1b2c3d4-...`):
  - `B001-00000001` → venta `error_sunat`/`rechazado`, outbox `rejected` (ya existía en OSE beta con payload distinto; conflicto de identidad fiscal esperado y verificado).
  - `B001-00000002` a `B001-00000006` → ventas `completada`/`aceptada`, outbox `accepted`, con `id_externo` y `sunat_hash`.
- `id_externo` (ejemplo): `58c06327-8cb7-4b54-84ae-9536d42572f3`; `sunatHash` presente en `/por-numero`.
- `npm test` normal: 9 archivos, 39 pruebas, 0 fallos. Suite E2E: 10 archivos, 45 pruebas, 0 fallos (9 unitarias + 6 E2E en `e2e/ose.e2e.test.ts`).

## Limitaciones

- La suite genera comprobantes fiscales reales en el ambiente beta de SUNAT; cada ejecución avanza el correlativo de la serie `B001`. No se borran comprobantes del OSE (por política). Los fixtures locales sin valor fiscal (producto/catálogo reutilizables y el usuario de cada corrida) se limpian o documentan; el usuario y el catálogo quedan referenciados por las ventas con valor fiscal (FK RESTRICT) y se conservan.
- El endpoint `admin.listUsers`/`generateLink` de Supabase devolvió `500` con esta service-role key, por lo que la suite crea un usuario nuevo por corrida con email único y lo elimina al final; si el usuario queda referenciado por ventas, se documenta.
- La ruta HTTP interna (`POST /api/internal/sunat-outbox`) no se invocó por HTTP en esta corrida; se ejecutó su misma lógica (`processSunatOutbox`) con los secrets del entorno. La autenticación de la ruta (401 sin secreto) queda cubierta por inspección; un test HTTP real requeriría levantar el servidor.
- El correlativo `B001-00000001` ya existía en el OSE beta de ejecuciones previas; el flujo lo trató como rechazo definitivo (correcto según el contrato de identidad fiscal), no como error.

## Archivos nuevos

- `e2e/ose.e2e.test.ts` — suite E2E opt-in (gated por `RUN_OSE_E2E=1`).
- `vitest.e2e.config.ts` — config separada que incluye solo `e2e/**`.
- `package.json` — script `test:e2e:ose`.
- `vitest.config.ts` — `include` restringido a `src/**` para que `npm test` no ejecute E2E.
