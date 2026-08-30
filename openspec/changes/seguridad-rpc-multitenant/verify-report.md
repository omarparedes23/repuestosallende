# Verify report — seguridad RPC multitenant

Fecha: 2026-08-30 · Entorno: Supabase TEST `axcrubvtpqcyscizgoee` (PG 17.6, pooler `aws-1-eu-west-1.pooler.supabase.com:6543`)

## Veredicto

**PASS (fases de catálogo, ACL y aplicación en TEST).** La migración `045_seguridad_rpc_multitenant.sql` fue aplicada a Supabase TEST y registrada en el ledger. El test de catálogo `seguridad-rpc-multitenant.test.sql` pasa. Los advisors de seguridad confirman deny-by-default. Las pruebas REST y de comportamiento de aplicación (Fases 1–3 de `tasks.md`) permanecen pendientes y quedan documentadas como limitaciones.

## Evidencia ejecutada (TEST)

| # | Prueba | Resultado | Evidencia |
|---|--------|-----------|-----------|
| 1 | Aplicación de `045` en TEST | **PASS** | 5 funciones recreadas con guard server-side (`auth.uid()`, `empresa_id`), ACL por firma exacta (5 REVOKE + 5 GRANT authenticated), 6 RPC legacy revocadas de `PUBLIC`/`anon`/`authenticated`, workers/triggers/helpers con EXECUTE solo `service_role`, 2 COMMENT. Registrada en ledger como `045` |
| 2 | `seguridad-rpc-multitenant.test.sql` | **PASS** | `SEGURIDAD RPC TESTS OK`: anon sin EXECUTE sobre `ra_recibir_guia`, `ra_confirmar_orden_compra`, `ra_anular_orden_compra`, `ra_anular_compra`, `ra_contar_stock_bajo`; authenticated con EXECUTE; guard `auth.uid()`+`empresa_id` presente en la definición; `ra_registrar_cargo_credito`, `ra_registrar_cargo_compra`, `ra_confirmar_venta_v1`, `ra_clasificacion_bulk_upsert`, `ra_siguiente_correlativo` sin EXECUTE para anon/authenticated |
| 3 | Advisors de ACL (TEST) | **PASS** | `ra_registrar_compra`, `ra_registrar_cobro`, `ra_registrar_cargo_credito`, `ra_registrar_cargo_compra`, `ra_registrar_pago_proveedor`, `ra_confirmar_venta_v1`, `ra_siguiente_correlativo`: `anon_ex=false`, `auth_ex=false`. Tablas de tesorería: `anon`/`authenticated` solo `SELECT` (cero DML) |
| 4 | Advisors de contexto SQL | **PASS** | Funciones nuevas con `search_path` fijo `public, extensions, pg_temp` / `public, pg_temp`. Sin tablas `ra_*` sin PK |

## Requisitos de spec → evidencia

| Requisito | Evidencia |
|-----------|-----------|
| Denegación por defecto | PASS: `EXECUTE` de `PUBLIC`/`anon` revocado por firma exacta sobre funciones mutables y legacy; solo `authenticated` (mutaciones autorizadas) o `service_role` (workers) conservan EXECUTE |
| Identidad y tenant derivados en base | PASS: las 5 funciones mutables conservadas obtienen `auth.uid()`, derivan `empresa_id`/`rol` de `ra_perfiles` y filtran por `empresa_id` sin aceptar tenant del cliente |
| Autorización por capacidad | PASS por inspección de definiciones (`v_rol NOT IN ('administrador','superadmin') → RA_FORBIDDEN`); prueba de ejecución con rol sin capacidad pendiente en Fase 1/3 |
| Contexto SQL seguro | PASS: `search_path` fijo en todas las funciones recreadas; firmas exactas en grants; funciones trigger (`ra_handle_new_user`, `ra_set_updated_at`, helpers) sin EXECUTE cliente |
| Compatibilidad controlada | PASS parcial: se identificaron consumidores antes de revocar; las funciones legacy revocadas no tienen EXECUTE cliente y las Server Actions migraron a firmas versionadas; smoke funcional de aplicación pendiente (Fase 3) |

## Limitaciones / pendiente (tasks.md)

- **0.2 Matriz de funciones completa**: pendiente exportar la matriz total `ra_*` (firma, propietario, ACL, volatilidad).
- **0.5 Confirmar consultas que deben permanecer en `anon`**: pendiente.
- **1.2 / 1.3 Pruebas directas y REST con sesión anónima / matriz autenticada y cross-tenant**: pendientes; el test SQL de catálogo cubre ACL por `has_function_privilege`, pero no invocación real con JWT.
- **1.4 Evidencia del fallo esperado en TEST**: pendiente.
- **3.1–3.4 Smoke funcional de órdenes, guías, cobros/pagos y chatbot/catálogo público**: pendiente.
- **4.1 Repetir catálogo completo ACL/search_path/propietario**: parcialmente cubierto por el test SQL y advisors de esta corrida; la matriz completa queda en 0.2.
- **4.2 Matriz REST con conteos posteriores**: pendiente.
- **4.4 Pruebas unitarias/lint de archivos modificados**: no ejecutadas en esta corrida.
- **4.6 Verificación del ledger**: PASS (045 registrada, formato `version`/`name`).

## Notas

- No se tocó producción ni el SQL Server histórico. Conexión TEST autorizada por el propietario.
- La aplicación de `045` es compatible forward-only y no modifica migraciones previas.

## Puertas pendientes para promoción

- [ ] Matriz REST autenticada/cross-tenant con conteos (Fase 1/4).
- [ ] Smoke funcional de la aplicación contra las firmas conservadas (Fase 3).
- [ ] Confirmación expresa de consultas que permanecen en `anon` (0.5).
- [ ] Lint enfocado y suite unitaria proporcional al riesgo (4.4).
