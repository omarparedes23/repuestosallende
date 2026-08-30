# Verificación — P0 tesorería idempotente y cierre atómico

Fecha: 2026-08-30 · Entorno: Supabase TEST `axcrubvtpqcyscizgoee` (PG 17.6, pooler `aws-1-eu-west-1.pooler.supabase.com:6543`)

## Veredicto

**PASS estructural y de caja manual.** Migraciones `045`–`048` aplicadas en orden a Supabase TEST y registradas en `supabase_migrations.schema_migrations`. Se ejecutaron los tests SQL de catálogo, comportamiento, fault injection, smoke E2E CxC/CxP reversible, los runners de concurrencia con conexiones reales (venta–cierre en ambos órdenes y abonos compitiendo por saldo) y el retiro no destructivo del fixture previo.

## Migraciones aplicadas (TEST)

| Versión | Archivo | Ledger remoto |
|---------|---------|---------------|
| `045` | `supabase/migrations/045_seguridad_rpc_multitenant.sql` | registrada |
| `046` | `supabase/migrations/046_tesoreria_idempotente_schema.sql` | registrada |
| `047` | `supabase/migrations/047_tesoreria_idempotente_rpc.sql` | registrada |
| `048` | `supabase/migrations/048_venta_caja_compartida_lock_order.sql` | registrada |

- Preflight: el ledger remoto tenía `044` como última versión y no contenía `045`–`048`. Total del ledger tras aplicar: 42 registros.
- Formato replicado del CLI oficial: `version='0XX'`, `name=<sufijo del archivo>`, sin tokens ni credenciales en los archivos.

## Matriz de pruebas (TEST)

| # | Prueba | Resultado | Evidencia |
|---|--------|-----------|-----------|
| 1 | `seguridad-rpc-multitenant.test.sql` | **PASS** | `SEGURIDAD RPC TESTS OK`; anon sin EXECUTE sobre las 5 funciones mutables conservadas; authenticated con EXECUTE; guard `auth.uid()`+`empresa_id` presente; funciones legacy/worker sin EXECUTE cliente |
| 2 | `tesoreria-idempotente-schema.test.sql` | **PASS** | `OK 1..5`: columnas aditivas nullable, índices únicos parciales, unicidad de caja por sucursal (`ra_cajas_sucursal_activa`), constraints de operación, triggers append-only, sin enum nuevo |
| 3 | `tesoreria-rpc-contract.test.sql` | **PASS** | Seis RPC versionadas existen, anon sin EXECUTE, authenticated con EXECUTE; cero DML directo para `authenticated` sobre tablas de tesorería; venta respeta `advisory lock → replay → caja`; `ra_confirmar_venta_v1` no filtra el turno por propietario |
| 4 | `tesoreria-rpc-behavior.test.sql` (admin TEST `petitenfant2014@gmail.com`) | **PASS** | Smoke transaccional (todo `ROLLBACK`): apertura+replay, conflicto `RA_IDEMPOTENCY_CONFLICT`, movimiento+replay, cierre con `efectivoEsperado=115` y `diferencia=0`, replay de cierre, revisión+replay `validada` |
| 5 | `tesoreria-fault-injection.test.sql` (admin TEST) | **PASS** | Trigger transitorio que falla tras insertar liquidación y antes de cerrar la caja → rollback atómico: 0 liquidaciones y caja aún `abierta`. DDL y fixtures revertidos |
| 6 | `tesoreria-concurrencia-runner.ps1` (conexiones reales TEST) | **PASS** | `RUN_ID=4c3b14fc0958430bbb2ff4a48496f22c`. SCN1: una apertura y un replay (A `replayed:false`, B `replayed:true`); 1 sola caja abierta. SCN2: A cierra, B obtiene `RA_CASHBOX_NOT_OPEN`; 0 movimientos posteriores al cierre y 1 liquidación |
| 7 | `tesoreria-abonos-e2e.test.sql` (admin TEST) | **PASS** | Smoke E2E reversible (todo `ROLLBACK`) sobre la venta CxC fixture `a38e68e7-...` (saldo 120.00) y la compra CxP fixture `c6a73306-...` (saldo 118.00): cobro `yape` 1.00 + replay con `saldoVentaNuevo=119` y pago `transferencia` 1.00 + replay con `saldoCompraNuevo=117`; **0 movimientos de caja** en ambos (`RA_CASHBOX` intacto). Evidencia: `OK: CxC y CxP E2E/replay digital (ROLLBACK)` |
| 8 | `tesoreria-venta-cierre-runner.ps1` (conexiones reales TEST) | **PASS** | `RUN_ID=df2adb54...`, dos sucursales fixture nuevas (cero ventas previas). SALE_FIRST: `RESULT:VC:SALE:...:OK` con venta `14f80966-...` + `RESULT:VC:CLOSE:...:OK`. CLOSE_FIRST: `RESULT:VC:CLOSE:...:OK` + `RESULT:VC:SALE:...:RA_CASHBOX_NOT_OPEN:...:-`. Invariantes finales: **2 cajas cerradas, 2 liquidaciones, 1 venta (solo SALE_FIRST), 0 movimientos posteriores**. El orden se demostró de forma determinista mediante espera en `pg_stat_activity` (`application_name` = `ra-vc:` + MD5 estable, 38 chars, sin truncado por Supavisor) |
| 9 | `tesoreria-abonos-concurrencia-runner.ps1` (conexiones reales TEST) | **PASS** | Sobre la venta CxC `a38e68e7-...` (saldo 120.00) y la compra CxP `c6a73306-...` (saldo 118.00): CXC → 1 abono `OK` + 1 `RA_RECEIVABLE_SETTLED`; CXP → 1 abono `OK` + 1 `RA_PAYABLE_SETTLED`. Tras la carrera: saldos 0.00, `saldo_deudor` de cliente y proveedor en 0.00. **Exactamente un abono confirmado por documento** |
| 10 | `tesoreria-concurrencia-retire-fixture.sql` | **PASS** | `RUN_ID=4c3b14fc...` retirado de operación (`activo=false`) tras verificar caja cerrada; ledger y liquidación conservados |
| 11 | Smoke de Server Actions y adaptadores RPC (Vitest) | **PASS** | Caja, cierre, CxC y CxP: 4 archivos / 9 pruebas. Verifican `operationId`, validación previa, RPC versionadas (`ra_abrir_caja_v1`, `ra_registrar_movimiento_caja_v1`, `ra_cerrar_caja_v1`, `ra_registrar_cobro_v2`, `ra_registrar_pago_proveedor_v2`) y mensajes idempotentes sanitizados. |
| 12 | Suite Vitest completa | **PASS** | 18 archivos / 114 pruebas. Incluye revisión administrativa de liquidaciones. |

## Correcciones a los tests del otro agente (defectos detectados y corregidos)

Durante la ejecución se detectaron dos defectos en los archivos de test aportados por el otro agente. Se aplicó el fix mínimo y se re-ejecutaron con PASS:

- `supabase/tests/tesoreria-venta-cierre.test.sql` — el `operation_id` se derivaba solo de `run+ses`, por lo que SALE_FIRST y CLOSE_FIRST con el mismo `RUN_ID` colisionaban (`RA_IDEMPOTENCY_CONFLICT`). Fix: incluir `current_setting('test.branch')` en el `md5`.
- `supabase/tests/tesoreria-abonos-concurrencia-runner.ps1` — `[decimal].ToString(InvariantCulture)` producía `"120"` en lugar de `"120.00"`, haciendo fallar el preflight contra saldos correctos. Fix: `ToString('0.00', InvariantCulture)`.

## Advisors de seguridad y rendimiento (TEST)

- **Deny-by-default confirmado**: `anon`/`authenticated` conservan solo `SELECT` (más privilegios inertes `TRUNCATE/REFERENCES/TRIGGER`) sobre `ra_cajas`, `ra_movimientos_caja`, `ra_liquidaciones`, `ra_cuenta_corriente_movimientos`, `ra_cuentas_por_pagar_movimientos`. Cero `INSERT/UPDATE/DELETE` cliente.
- Las políticas RLS de escritura existentes (`cajas_insert`, `cajas_update`, `movimientos_insert`, `liquidaciones_mutate`) quedan definidas pero inoperantes para roles cliente por ausencia de privilegio a nivel tabla.
- **Funciones legacy mutables sin EXECUTE cliente**: `ra_registrar_compra`, `ra_registrar_cobro`, `ra_registrar_cargo_credito`, `ra_registrar_cargo_compra`, `ra_registrar_pago_proveedor`, `ra_confirmar_venta_v1`, `ra_siguiente_correlativo` → `anon_ex=false`, `auth_ex=false`.
- **SECURITY DEFINER nuevas** con `search_path` fijo `public, extensions, pg_temp`.
- **Índices únicos parciales** de idempotencia presentes (`uq_cc_abono_operation`, `uq_cxp_abono_operation`, `uq_cajas_empresa_operation`, `uq_movimientos_caja_turno_operation`, `uq_liquidaciones_empresa_operation`, `uq_liquidaciones_empresa_review_operation`) + `idx_cc_sucursal_fecha` / `idx_cxp_sucursal_fecha`.
- **Triggers activos**: `trg_movimientos_caja_append_only` y `trg_liquidaciones_proteger_snapshot` (`tgenabled=O`).
- Todas las tablas `ra_*` conservan PK. Sin tablas sin clave primaria.

## Requisitos de spec → evidencia

| Requisito | Evidencia |
|-----------|-----------|
| Cobro exactamente una vez (replay/conflicto) | **PASS E2E**: `tesoreria-abonos-e2e.test.sql` cobró y repliqueó sobre venta CxC con saldo real (replay + `saldoVentaNuevo` correcto, sin tocar caja) |
| Pago a proveedor exactamente una vez | **PASS E2E**: `tesoreria-abonos-e2e.test.sql` pagó y repliqueó sobre compra CxP con saldo real (replay + `saldoCompraNuevo` correcto, sin tocar caja) |
| Autorización de tesorería | PASS por contrato (auth.uid, perfil, rol, empresa/sucursal) + ACL deny-by-default en advisors |
| Caja como turno POS, no global | PASS: unicidad por sucursal (`ra_cajas_sucursal_activa`), política RLS de lectura por sucursal, `idx_caja_una_abierta_por_usuario` eliminado; venta rechaza sin turno (`RA_CASHBOX_NOT_OPEN` en SCN2 y CLOSE_FIRST) |
| Cierre atómico e idempotente | PASS: behavior test (cierre con cálculo correcto, replay, revisión) + fault injection (rollback total tras insertar liquidación) + runner venta-cierre (2 cierres, 2 liquidaciones) |
| Composición del arqueo | PASS: cierre excluye Yape/tarjeta/transferencia/crédito del efectivo esperado (contract/behavior); crédito informativo |
| Liquidación integral por sucursal / revisión posterior | PASS: `estado_revision`, trigger de snapshot inmutable, `ra_revisar_liquidacion_v1` con replay |
| Invariantes del ledger | PASS: SCN2 y runner venta-cierre demostraron 0 movimientos posteriores al cierre; append-only verificado por trigger y grants |

## Limitaciones / no cubierto hoy

- **Resumen mixto por sucursal** (Fase 5) y **UI de estados de revisión** (6.5): no implementados/ejecutados; fuera del alcance de esta corrida de TEST.
- **Fixtures regularizados y retirados**: todas las sucursales `TESORERIA-*` quedaron **inactivas** (`activo=false`) y todas sus cajas **cerradas** con arqueo controlado (`ra_cerrar_caja_v1`, diferencia 0) y una liquidación por caja. Ledgers, movimientos y liquidaciones **conservados** (append-only). Sucursales: `TESORERIA-ABONOS-CONC:18e466...`, `TESORERIA-CONC:4c3b14...`, `TESORERIA-VENTA-CIERRE:67efa888...`, `716f029d...`, `ca7edb9f...` y `df2adb54...`.
- **Conexión**: se usó la conexión TEST autorizada por el propietario (pooler). No se tocó producción ni el SQL Server histórico. Las funciones `SECURITY DEFINER` se validaron por catálogo y ejecución con `request.jwt.claims` simulado; no se usó un JWT real de red.
- **Lint enfocado**: ejecutado sobre caja, liquidación, clientes y proveedores. Resultado: 29 errores `@typescript-eslint/no-explicit-any` y 1 advertencia de variable sin uso; no se hizo limpieza masiva fuera de este cambio. El typecheck y Vitest sí pasan.
- **UI P0 completada**: la caja tablet separa efectivo esperado de conciliación digital; el panel muestra liquidaciones recientes, estados `pendiente_revision`/`validada`/`observada` y permite revisión con motivo obligatorio por RPC versionada. Falta solo validación visual manual autenticada si se requiere evidencia de experiencia de usuario.

## Puertas pendientes para promoción

- [x] Reejecutar `tesoreria-venta-cierre-runner.ps1` endurecido contra dos fixtures TEST dedicados (**PASS determinista**, `RUN_ID=df2adb54...`, CLOSE_FIRST demostrado con `RA_CASHBOX_NOT_OPEN`).
- [x] Cobros concurrentes por el mismo saldo (**PASS**, runner abonos-concurrencia: 1 abono por documento).
- [x] Smoke E2E de CxC y CxP contra documentos con saldo pendiente, en transacción revertida (**PASS**, `tesoreria-abonos-e2e.test.sql`).
- [x] Retirar la sucursal de fixture `TESORERIA-CONC:<RunId>` de TEST sin borrar su auditoría (**PASS**, `tesoreria-concurrencia-retire-fixture.sql`).
- [x] Regularizar y desactivar los fixtures residuales abiertos (**PASS**: cajas cerradas con arqueo controlado, sucursales `activo=false`).
- [x] Smoke de Server Actions contra las RPC versionadas (4 archivos / 9 pruebas Vitest). No sustituye una prueba visual manual de UI autenticada.
- [x] Ejecutar lint enfocado de caja, liquidación, clientes y proveedores (ejecutado; 29 errores `no-explicit-any` y 1 advertencia documentados).
- [ ] Decisión de promoción a producción por parte del propietario.
