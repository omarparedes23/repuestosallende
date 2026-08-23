# Tasks: compra-cuenta-por-pagar-atomica
      locks FOR UPDATE adquiridos en ese orden dentro del bucle de stock/kardex.
      DESVIACION documentada (design rev.3): no hay locks "upfront" materializados;
      el orden canonico proveedor -> OC -> productos ASC elimina deadlocks (demostrado SCN1).
- Implementar en orden de fase estricto: preflight/schema → RPC transaccional →
  idempotencia/concurrencia → adaptación UI → pruebas autenticadas → verify.
- TDD: escribir primero la prueba que demuestra cada comportamiento no trivial y comprobar que
  falla por la razón esperada.
- No aplicar cambios a Supabase remoto como parte incidental del desarrollo; solo a la BD de TEST
  y con pasos explícitos documentados.
- Preflight read-only antes de cualquier índice único; la migración aborta ante duplicados y
  NUNCA corrige datos automáticamente.
- No modificar el change cerrado `venta-transaccional-idempotente` (solo correcciones docu­mentales).
- No tocar SQL Server histórico (`fasterp.sandemer.net.pe`, solo lectura).
- No habilitar scheduler ni mezclar trabajo del change anterior.
- Preservar cambios locales del usuario; no mezclar limpieza global de lint.
- Marcar una tarea completada solo con evidencia ejecutable o inspección verificable.

## Fase 0 — Preflight y entorno de pruebas

- [x] 0.1 Instantánea read-only remota de `ra_compras`, `ra_compra_items`, `ra_kardex`,
      `ra_cuentas_por_pagar_movimientos`, `ra_proveedores`, `ra_ordenes_compra(+items)`:
      columnas, constraints, índices, triggers, funciones, políticas, grants. (Evidencia:
      preflight-report.md §1–§3; PG 17.6; project axcrubvtpqcyscizgoee.)
- [x] 0.2 Preflight read-only de duplicados históricos de factura
      `(empresa_id, proveedor_id, upper(btrim(nro_documento))) HAVING count(*) > 1` en TEST;
      listar conflictos y resolverlos manualmente ANTES de aplicar migración. Documentar resultado.
      (Ejecutado: **0 duplicados** — tabla ra_compras vacía en TEST; query canónica preservada
      en preflight-report.md §4 para re-ejecutar antes de producción.)
- [x] 0.3 Preflight agregado: compras sin proveedor, totals <= 0, kardex huérfano, cargos CxP
      duplicados por compra, saldos de proveedor vs ledger divergentes. Solo reporte, no reparar.
      (Vacuo por ausencia de datos: 0 compras/CxP/OC; consistente. preflight-report.md §5.)
- [ ] 0.4 Preparar fixtures TEST aislados (empresa, sucursal, proveedor, catálogo/productos,
      OC confirmada con líneas, usuarios administrador/superadmin/vendedor/lectura) reutilizando
      el patrón del change de venta. (DIFERIDO a implementación — requiere escritura;
      composición documentada en preflight-report.md.)
- [x] 0.5 Verificar roles vigentes en `ra_perfiles` para las políticas de compras/proveedores
      (confirmar existencia y semántica de `administrador`/`superadmin`; evidencia SQL).
      (Enum {superadmin,administrador,vendedor,lectura}; perfiles: admin=15, vendedor=2,
      lectura=1, superadmin=0 — ver hallazgo H2; políticas RLS ya exigen ambos roles.)

## Fase 1 — Migración aditiva y contratos de base (TDD)

- [x] 1.1 Escribir pruebas de schema: columnas nuevas `operation_id`/`request_hash`/
      `tipo_documento`/`nro_doc_norm` generada; índices únicos parciales esperados
      (`idx_compras_operation_id`, `uq_compras_factura_proveedor` SIN exclusión de anuladas);
      **sin cambios al enum** `ra_motivo_kardex` (ajuste del propietario); trigger guard de
      `estado_pago` presente; EXECUTE público revocado en las 4 RPCs legacy.
      (`supabase/tests/compra-atomica-schema.test.sql` — ESCRITAS, pendientes de ejecución en
      TEST junto con 1.4.)
- [x] 1.2 Escribir prueba de preflight abortante: migración con duplicado sembrado debe abortar
      listando IDs y no crear el índice ni mutar datos.
      (`supabase/tests/compra-atomica-preflight.test.sql` — usa DDL transaccional para probar el
      helper aislado del índice único; ESCRITA, pendiente de ejecución en TEST.)
- [x] 1.3 Crear `supabase/migrations/041_compra_cuenta_pagar_atomica.sql` (forward-only):
      columnas aditivas nullable, índice único parcial de operation_id, índice único de factura
      (sin predicado de estado), preflight abortante inline, REVOKE de PUBLIC/anon en las 4 RPCs
      legacy, protección de `estado_pago` (proyección desde ledger + guard row-level sin GUC +
      sincronizador statement-level como único escritor), backfill idempotente. SIN ALTER TYPE
      (`anulacion_compra` queda documentada para el change futuro de anulaciones/devoluciones).
- [x] 1.4 Ejecutar migración en TEST tras preflight limpio y verificar contra las pruebas de 1.1.
      (APLICADA 2026-08-23 con autorización del propietario: COMMIT limpio, backfill UPDATE 0.
      Suite schema 8/8 OK y suite preflight 3/3 OK, ambas con ON_ERROR_STOP; transacciones de
      prueba terminadas en ROLLBACK. Sin fixtures residuales: ra_compras/items/cxp = 0,
      proveedores = 169 (baseline). Registrada '041' en supabase_migrations.schema_migrations.)
- [x] 1.5 Actualizar `src/lib/types/database.ts` (columnas, firmas RPC nuevas) sin debilitar a
       `any`; registrar entrada en `supabase_migrations.schema_migrations` al aplicar (lección 038–040).
       (Completado: ra_compras con operation_id/request_hash/tipo_documento/nro_doc_norm/total_pen,
       ra_auditoria_estado_pago_compras, RPCs ra_confirmar_compra, ra_obtener_resultado_compra,
       ra_recalcular_estado_pago tipadas sin `any`.)

## Fase 2 — RPC transaccional ra_confirmar_compra (TDD)

> APLICADO (2026-08-23, rev.3): 042 en TEST con COMMIT; suite RPC 15/15 OK (A-I); runner 2 escenarios PASS con concurrencia real. Hallazgo y fix durante ejecucion: deadlock FK/FOR UPDATE sobre proveedor -> FOR UPDATE temprano (orden canonico proveedor->OC->productos ASC). Desviaciones de fixtures corregidas en vivo: email vive en auth.users (JOIN), ra_productos sin created_at, OC items exige subtotal, empresa TEST sin proveedor (insert condicional).
> REV.2 (2026-08-23): firma con p_sucursal_id obligatorio; moneda base PEN (	otal_pen, cargo/saldo/costeo/estado_pago en base); fault injection por triggers transitorios pg_temp (sin hooks desplegables); hash canonico trim_scale + orden ascendente; replay ANTES de estados mutables; unique_violation de factura -> RA_INVOICE_DUPLICATE; lineas duplicadas rechazadas; nombre desde catalogo; overflow/escalas acotados. Pruebas escritas en supabase/tests/compra-atomica-{rpc,concurrencia}.test.sql — pendientes de ejecucion tras aplicar.

- [x] 2.1 Escribir pruebas de autorización: sin sesión → `RA_UNAUTHENTICATED`; `vendedor` y
      `lectura` → `RA_FORBIDDEN`; sucursal ajena → `RA_BRANCH_INVALID`; proveedor/producto/OC
      cross-tenant → códigos estables sin fuga de existencia.
- [x] 2.2 Implementar resolución server-side de identidad y autorización de roles
      (`administrador`/`superadmin`) con SECURITY DEFINER + search_path fijo + grants mínimos
      (REVOKE a PUBLIC/anon).
- [x] 2.3 Escribir pruebas de forma/límites del payload: items vacíos, >200 líneas, cantidad <= 0,
      precio negativo, JSON inválido, moneda/tipo_cambio inconsistentes → `RA_ITEMS_INVALID` /
      `RA_CURRENCY_INVALID`.
- [x] 2.4 Implementar validación estructural y normalización de documento
      (`upper(btrim)`, vacío→NULL, tipo_documento normalizado).
- [x] 2.5 Escribir pruebas de unicidad de factura: duplicado exacto → `RA_INVOICE_DUPLICATE`;
      mismo número en otra empresa/proveedor/tipo → permitido; NULL/vacío → excluido del índice;
      compra anulada NO libera el número.
- [x] 2.6 Implementar chequeo previo de unicidad dentro de la RPC (SELECT EXISTS antes del insert).
- [x] 2.7 Escribir pruebas de éxito integral: 1 cabecera + N items + stock incrementado +
      costeo promedio ponderado correcto + kardex entrada + 1 cargo CxP + saldo proveedor
      incrementado + cierre de OC a `recibida`; conteos exactos SQL.
- [x] 2.8 Implementar bloqueo determinista ascendente: items ordenados por `catalogo_id` y
      locks FOR UPDATE adquiridos en ese orden dentro del bucle de stock/kardex.
      DESVIACION documentada: sin locks upfront; orden canonico
      proveedor -> OC -> productos ASC elimina deadlocks (demostrado en SCN1).
      saldo proveedor intacto).
- [x] 2.10 Escribir pruebas de abono inicial (contado): completo ⇒ `pagado`; parcial ⇒ `parcial`;
       sin abono ⇒ `pendiente`; sobrepago ⇒ `RA_PAYMENT_EXCEEDS_TOTAL`; método `credito` ⇒
       `RA_PAYMENT_METHOD_INVALID`. Ambos movimientos presentes en ledger.
- [x] 2.11 Implementar cargo CxP inline + abono inicial opcional + proyección de `estado_pago`
       recalculada desde el ledger dentro de la misma transacción.
- [x] 2.12 Implementar conciliación OC conservando orden de bloqueo (cabecera → línea) y cierre
       a `recibida`; pruebas de línea ajena/excedente ya cubren rollback.
- [x] 2.13 Implementar `ra_recalcular_estado_pago(p_operation_id, p_compra_id, p_motivo)`
      para reparacion auditada (043 rev.3 aplicada: tabla ra_auditoria_estado_pago_compras,
      advisory lock, replay/conflicto, RLS admin, backfill migracion idempotente).
## Fase 3 — Idempotencia y concurrencia PostgreSQL (TDD)

- [x] 3.1 Escribir pruebas de replay secuencial: mismo operation_id/hash ? misma compra con
       `replayed:true`, cero efectos nuevos; `ra_obtener_resultado_compra` sin fuga cross-tenant.
       (Suite RPC seccion C: C1 replay, C5 found/not_found. Evidencia verify-report 2026-08-23.)
- [x] 3.2 Implementar hash canonico SHA-256 del payload normalizado y advisory lock por
       `(empresa_id, operation_id)` (`pg_advisory_xact_lock`). (042 rev.3; equivalencias
       numericas y multimoneda verificadas en secciones I y G.)
- [x] 3.3 Escribir pruebas de conflicto: mismo operation_id con payload distinto ?
       `RA_IDEMPOTENCY_CONFLICT`, cero efectos adicionales. (Suite RPC seccion C2.)
- [x] 3.4 Concurrencia VERIFICADA CON CORRIDA REAL (RUN_ID b300345962fb44b3814073cbb14596a8):
       SCN1 orden inverso ambos OK sin deadlock (PIDs 4133671/4133672, solape real);
       SCN3 mismo operation_id payload identico => misma compra 5f4a066c, una confirmed + una replayed:true, 1 compra/1 cargo/1 kardex;
       SCN4 mismo op payload distinto => 1 OK + 1 RA_IDEMPOTENCY_CONFLICT, cero efectos del perdedor.
       (seccion E/E2 de la suite RPC; OC cierra `recibida` con cantidades exactas).
## Fase 4 — Adaptador del panel (UI)

- [x] 4.1 Añadir tests unitarios (vitest) del schema zod de entrada: `operationId` UUID obligatorio,
       items/pagos validados, campos autoritativos rechazados.
       (`src/app/panel/(dashboard)/compras/actions.schema.test.ts` — 27 pruebas PASS.)
- [x] 4.2 Refactorizar `registrarCompra` (`compras/actions.ts`) para usar únicamente
       `ra_confirmar_compra`; generar/conservar `operationId` durante resultado incierto;
       sanitizar errores a códigos de dominio; retirar llamada suelta a `ra_registrar_cargo_compra`.
       (`src/app/panel/(dashboard)/compras/actions.test.ts` — 22 pruebas PASS; `actions.ts` refactorizado.)
- [x] 4.3 Eliminar `actualizarEstadoPago` y su uso en `ComprasView.tsx`; exponer `estado_pago`
       como dato de lectura derivado del ledger.
       (`ComprasView.tsx` adaptado: sin selector manual de estado; 0 usos de `actualizarEstadoPago` en el repo.)
- [x] 4.4 Marcar `ra_registrar_compra` legacy como deprecated (comentario + nota en migración)
        sin eliminarla; verificar que ninguna ruta de código la invoque (grep + revisión).
        (`044_deprecar_ra_registrar_compra.sql` APLICADA y REGISTRADA en el ledger remoto
        2026-08-23 con autorización del propietario: COMMIT verificado, comentario confirmado
        sobre la firma exacta por lectura de `obj_description`, proacl y atributos
        (SECURITY DEFINER, search_path, volatile) intactos. Demostrado mediante `rg`:
        0 invocaciones en TypeScript/TSX. No se modificaron las migraciones aplicadas 041–043.)
- [x] 4.5 Ejecutar lint solo de archivos modificados (baseline global preexistente reportado aparte).
       (0 errores, 0 warnings en los 8 archivos modificados/creados de la Fase 4.)

### Correcciones de revisión de Fase 4

- [x] Añadir el contrato normativo ausente en
      `specs/confirmacion-compra-atomica/spec.md`, con escenarios GIVEN/WHEN/THEN.
- [x] Alinear `tipoDocumento` y el límite de `nroDocumento` del schema Zod con el dominio real
      de la RPC (`FACTURA | BOLETA | OTROS`, máximo 60 caracteres).
- [x] Mapear y probar `RA_INVOICE_INVALID` sin exponer mensajes SQL.
- [x] Hacer visible el change OpenSpec a Git mediante excepciones acotadas en `.gitignore`.

## Fase 5 — Pruebas autenticadas E2E contra TEST

- [x] 5.1 Suite autenticada completa (patrón del change de venta): éxito integral, replay,
       conflicto, rollback, concurrencia doble (idempotencia + stock inverso), recepción parcial
       OC, unicidad de factura, contado/crédito, proyección estado_pago, autorización,
       timeout recovery (not_found/found). Evidencia SQL real por escenario.
       (EJECUTADA 2026-08-23 contra Supabase TEST, RUN_ID edf1090b9e324f5abe08c54c672535b9:
       `compra-atomica-e2e-fase5.test.sql` S0–S9 todos OK con efectos COMMITADOS.
       Concurrencia real con doble conexión: RUN_ID 7d040885d7584f2eac6bd159e44a185a,
       SCN1 mismo op => una confirmed + una replayed:true misma compra
       2eb91670-764f-4653-81f7-bb9fcc4430cc; SCN2 ops distintos orden inverso => ambos OK
       sin deadlock, stock consistente. Matriz completa en verify-report.md.)
- [x] 5.2 Documentar matriz requisito→prueba→evidencia en verify-report.md.
- [x] 5.3 Limpieza de fixtures TEST no referenciados; documentar los que se conservan por FK.
       (`compra-atomica-fase5-cleanup.sql` sobre 6 RUN_IDs de la sesión: 70 filas eliminadas.
       Residuo INTENCIONAL documentado: la compra auditada por S9 es indeleble porque
       ra_auditoria_estado_pago_compras es append-only (RA_AUDIT_IMMUTABLE) con FK RESTRICT:
       compra 3feb8e17-00ba-4763-98c5-8e7c50fcb0d5 + 1 item + 1 kardex + 2 movimientos CxP +
       su proveedor 'F5E2E:<run>:PROV' + 1 auditoría no-op.)

## Fase 6 — Verificación y rollout

- [x] 6.1 `npm test` completo en verde; conteos registrados.
       (2026-08-23: 11 archivos, 88/88 PASS, 0 fallos.)
- [x] 6.2 Advisors de seguridad/rendimiento sobre objetos nuevos (RLS, grants, search_path,
       índices, exposición de RPCs).
       (Verificación read-only con `compra-atomica-fase6-verificacion.sql`: ledger/columnas/
       índices únicos/RLS/grants/SECURITY DEFINER+search_path/044 sin hallazgos del change;
       7 funciones DEFINER sin search_path fijado son baseline preexistente; cero tablas
       expuestas sin RLS.)
- [x] 6.3 Checklist operativo: actualizar/crear sección en operations-style si aplica
       (no hereda scheduler del change anterior).
       (Creado `operations.md`: preflight P0, orden P1, verificación P2, corte UI P3,
       rollback forward-only, riesgos separados.)
- [x] 6.4 Crear `verify-report.md` con veredicto, desviaciones del design y riesgos residuales.
       (VEREDICTO FINAL DEL CHANGE: PASS. Riesgos separados: residuo S9, 038–040 untracked
       en Git, baselines tsc/lint ajenos, 7 funciones DEFINER legacy.)

## Dependencias y puertas

- Fase 0 bloquea la aplicación de la migración (preflight de duplicados obligatorio).
- Las Fases 1–3 bloquean el corte del adaptador UI; no se retira la UI vieja sin RPC probada.
- La Fase 5 es puerta obligatoria antes de considerar despliegue futuro: NO existe fallback
  legacy aceptable.
- Producción solo tras repetir preflight→resolver→aplicar y decisión explícita del propietario.
