# Tasks: venta-transaccional-idempotente

## Reglas de ejecución

- Implementar en orden de fase; no aplicar cambios a Supabase remoto como parte incidental del desarrollo.
- Escribir primero la prueba que demuestra cada comportamiento no trivial y comprobar que falla por la razón esperada.
- Usar PostgreSQL/Supabase aislado para pruebas de RPC, rollback y concurrencia; no usar SQL Server histórico para ninguna escritura.
- Preservar los cambios locales del usuario y no mezclar limpieza global de lint.
- Marcar una tarea como completada solo con evidencia ejecutable o inspección verificable.

## Fase 0 — Preflight y entorno de pruebas

- [x] 0.1 Guardar una instantánea de solo lectura de columnas, constraints, índices, triggers, funciones, políticas y grants remotos de los objetos `ra_*` afectados.
- [x] 0.2 Reconciliar el ledger remoto de migraciones con los archivos locales y documentar cómo se registrará/desplegará `038_venta_transaccional_idempotente.sql` sin reaplicar `001`–`037`.
- [x] 0.3 Ejecutar preflight agregado de duplicados de correlativo, operaciones, pagos, cargos, kardex y referencias; no reparar datos en esta fase.
- [x] 0.4 Preparar PostgreSQL/Supabase local o staging aislado capaz de ejecutar migraciones, transacciones concurrentes y fault injection.
- [x] 0.5 Crear helpers/fixtures de integración para empresa, perfiles, sucursales, caja, clientes, productos y limpieza segura por test.
- [ ] 0.6 Registrar vectores monetarios PEN/USD compartidos entre Decimal.js y PostgreSQL.

## Fase 1 — Migración aditiva y contratos de base

- [ ] 1.1 Escribir pruebas de migración para columnas `operation_id`/`request_hash`, unicidad parcial de operación y correlativo, y compatibilidad con filas históricas nulas.
- [x] 1.2 Crear `supabase/migrations/038_venta_transaccional_idempotente.sql` con columnas e índices aditivos, preflight explícito y comentarios operativos.
- [ ] 1.3 Escribir pruebas de schema para `ra_sunat_outbox`: estados permitidos, identidad única por venta/documento, intentos, lease, próximo intento y límites de texto/payload.
- [x] 1.4 Añadir `ra_sunat_outbox`, constraints, índices de claim/monitorización, RLS sin acceso de navegador y grants mínimos.
- [x] 1.5 Implementar helpers SQL privados para canonicalización/hash y resultado estable; revocar ejecución pública directa.
- [x] 1.6 Actualizar `src/lib/types/database.ts` con columnas, tabla outbox y firmas RPC sin debilitar tipos a `any`.

## Fase 2 — RPC transaccional de venta

- [x] 2.1 Escribir pruebas de autorización para no autenticado, rol lectura, sucursal/cliente/producto ajenos y caja no autorizada.
- [x] 2.2 Implementar resolución server-side de `auth.uid()`, perfil activo, empresa, sucursal y caja en `ra_confirmar_venta` con `SECURITY DEFINER`, `search_path` fijo y grants mínimos.
- [ ] 2.3 Escribir pruebas de forma/límites: UUID, JSON, máximo 200 ítems, máximo 20 pagos, duplicados de producto, cantidades, textos y precisión numérica.
- [x] 2.4 Implementar validación estructural y códigos de dominio estables sin exponer errores internos PostgreSQL.
- [ ] 2.5 Escribir pruebas PEN/USD, descuentos, IGV, pagos divididos, tolerancia 0.01 y valores manipulados por el cliente.
- [x] 2.6 Implementar bloqueo determinista de productos y recálculo autoritativo de precios/totales con `numeric`.
- [ ] 2.7 Escribir pruebas de éxito para ticket, boleta, factura, efectivo, Yape/tarjeta y crédito con advertencia de límite excedido.
- [x] 2.8 Implementar en una transacción cabecera, ítems, pagos, caja, cargo/saldo de crédito, correlativo, stock, kardex y outbox aplicable.
- [x] 2.9 Escribir fault-injection tests después de cada efecto crítico y demostrar rollback total, incluido stock y outbox.

## Fase 3 — Idempotencia y concurrencia PostgreSQL

- [x] 3.1 Escribir pruebas para replay secuencial idéntico, conflicto de hash y recuperación del resultado por `operation_id`.
- [x] 3.2 Implementar advisory lock por empresa+operación, comparación de hash y `ra_obtener_resultado_venta` sin fuga cross-tenant.
- [x] 3.3 Escribir prueba de dos confirmaciones concurrentes con la misma operación y comprobar un solo agregado completo.
- [x] 3.4 Escribir pruebas de dos ventas sobre el mismo producto con stock suficiente e insuficiente; verificar stock final y secuencia exacta de kardex.
- [ ] 3.5 Escribir prueba multítem con orden inverso para detectar deadlocks y confirmar bloqueo ascendente determinista.
- [x] 3.6 Escribir prueba de correlativos concurrentes y comprobar unicidad sin exigir ausencia de huecos.
- [x] 3.7 Escribir prueba de crédito reintentado/concurrente y comprobar un único cargo y un único incremento de saldo.

## Fase 4 — Adaptador POS y recuperación del intento

- [x] 4.1 Añadir tests a `actions.schema.ts` para `operationId` obligatorio/UUID y payload de intención sin campos autoritativos.
- [x] 4.2 Actualizar el schema y tipos de entrada/salida con resultado `confirmed/replayed/not_found` y códigos de dominio.
- [x] 4.3 Crear tests unitarios para persistencia versionada, reutilización tras recarga, aislamiento usuario+empresa y descarte seguro de registros inválidos.
- [x] 4.4 Crear `src/lib/ventas/pendingSale.ts` sin tokens/secretos y con operaciones explícitas `load/save/markUnknown/clear`.
- [ ] 4.5 Escribir tests de `procesarVenta()` para éxito inicial, replay, conflicto, fallo definitivo, error desconocido y sanitización de errores.
- [x] 4.6 Refactorizar `procesarVenta()` para usar únicamente `ra_confirmar_venta`/`ra_obtener_resultado_venta`; retirar inserts directos, service role, cargo separado, `after()` y emisión OSE directa.
- [x] 4.7 Adaptar `PaymentSheet`/store para crear una sola operación, conservarla mientras sea incierta, consultar antes de reenviar y limpiar solo ante éxito o fallo definitivo.
- [ ] 4.8 Verificar que primera respuesta y replay alimentan el mismo flujo de ticket/impresión sin doble cobro ni doble limpieza del carrito.

## Fase 5 — Claim/finish durable de outbox

- [x] 5.1 Escribir pruebas SQL para dos claimers concurrentes, orden de selección, límite de lote, lease vencido y recuperación.
- [x] 5.2 Implementar `ra_claim_sunat_outbox` con `FOR UPDATE SKIP LOCKED`, lease token, fencing, intentos y reloj de base de datos.
- [x] 5.3 Escribir pruebas SQL para finish aceptado/rechazado/retry/submitted, token obsoleto y actualización atómica de venta+outbox.
- [x] 5.4 Implementar `ra_finish_sunat_outbox` y cálculo de backoff acotado; `submitted`/incierto nunca vuelve automáticamente a `pending/retry`.
- [ ] 5.5 Añadir consulta operativa agregada por estado/antigüedad sin exponer payload fiscal a roles del POS.

## Fase 6 — Integración con el OSE idempotente

- [ ] 6.1 Escribir tests del adaptador para HTTP 201/200/202/409/422/503, error de transporte y cuerpo inválido.
- [x] 6.2 Modificar `src/lib/facturacion/ose.ts` para enviar `document_key` como `Idempotency-Key` estable y devolver resultados estructurados.
- [ ] 6.3 Escribir tests de reconciliación por `GET /api/v1/comprobantes/por-numero`, incluido `RESULTADO_INCIERTO` sin reenvío.
- [x] 6.4 Implementar clasificación: `EMITIDA→accepted`, `RECHAZADA→rejected`, `RESERVADO/ENVIANDO→submitted`, `ERROR_REINTENTABLE→temporary_error`, `RESULTADO_INCIERTO`/transporte desconocido→uncertain.
- [x] 6.5 Crear `src/lib/facturacion/outbox.ts` con claim, procesamiento secuencial/concurrencia máxima 2, finish con lease token y logs sanitizados.
- [x] 6.6 Probar que dos ejecuciones del worker no duplican el envío y que un worker obsoleto no puede finalizar el lease vigente.

## Fase 7 — Endpoint interno y scheduler portable

- [x] 7.1 Escribir tests de autenticación del endpoint: secreto ausente/incorrecto 401, comparación timing-safe y header nunca registrado.
- [x] 7.2 Crear `POST /api/internal/sunat-outbox` server-only, batch máximo 10 y duración acotada.
- [x] 7.3 Añadir variables documentadas `SUNAT_OUTBOX_CRON_SECRET` y configuración de procesamiento sin incluir valores reales.
- [x] 7.4 Documentar Vercel Cron como invocador inicial y cron/systemd/curl autenticado como alternativa VPS usando el mismo endpoint.
- [x] 7.5 Mantener el procesamiento deshabilitado hasta completar smoke test OSE en staging y definir propietario/SLA de `submitted`, `rejected` y `dead_letter`. (Smoke OSE beta y HTTP completados; propietario/SLA definidos en `operations.md` por DECISIÓN OPERATIVA PROVISIONAL del propietario el 2026-08-23. El scheduler permanece deshabilitado.)

## Fase 8 — Verificación y rollout

- [x] 8.1 Ejecutar tests unitarios y de integración tocados; registrar conteos y evidencia por requisito.
- [x] 8.2 Ejecutar `npm test` completo y lint solo de archivos modificados; reportar por separado el baseline global preexistente.
- [x] 8.3 Ejecutar advisors de seguridad/rendimiento y revisar RLS, grants, `search_path`, índices y exposición de RPCs.
- [x] 8.4 Ejecutar smoke test OSE beta: confirmación real por RPC, worker outbox, emisión aceptada, replay idempotente, conflicto Idempotency-Key y reconciliación `/por-numero` (suite opt-in `RUN_OSE_E2E=1 npm run test:e2e:ose`; evidencia en verify-report.md).
- [x] 8.5 Preparar checklist de despliegue, métricas/alertas, detención del scheduler y rollback forward-only sin reactivar silenciosamente el flujo inseguro. (Checklist completo en `operations.md`, aprobado por DECISIÓN OPERATIVA PROVISIONAL del propietario el 2026-08-23. Vercel Cron sigue SIN habilitar; migraciones 001–037 intocadas.)

- [x] 8.6 Crear `verify-report.md` con matriz requirement→test/evidencia, desviaciones del design y riesgos residuales.

## Dependencias y puertas de producción

- La Fase 0 bloquea cualquier aplicación remota de la migración.
- Las Fases 1–3 bloquean el corte del POS; no existe fallback al flujo legacy.
- Las Fases 5–7 pueden desarrollarse después de la RPC, pero boleta/factura no entra en producción sin consumidor programado y monitorizado.
- El scheduler no participa en la transacción de venta: si se detiene, la venta y su outbox permanecen durables, pero la emisión no progresa hasta reanudarlo.
- No habilitar reenvío automático de un resultado OSE incierto; requiere reconciliación por identidad fiscal u operación manual auditada.
