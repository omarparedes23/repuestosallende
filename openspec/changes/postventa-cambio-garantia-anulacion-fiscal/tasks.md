# Tareas: operación de devoluciones postventa

## Preparación y contrato

- [ ] Confirmar en Supabase TEST el ledger 055--057, definición vigente de las RPC y conteo por estado de `ra_devoluciones` antes de aplicar 058.
- [ ] Registrar el contrato SQL de 058 y el plan de rollback compensatorio; no editar 055--057.
- [ ] Confirmar que no existe una ejecución concurrente de migraciones ni pruebas antes de aplicar.

## Migración 058

- [ ] Aplicar `058_enum_estados_devolucion.sql` únicamente con los `ALTER TYPE ... ADD VALUE`, sin `BEGIN`/`COMMIT`; PostgreSQL no permite usar esos valores nuevos en la misma transacción.
- [ ] Aplicar `059_devoluciones_postventa.sql` en transacción, después de 058: columnas, constraints, índice, auditoría y RPC.
- [ ] Agregar columnas tipadas de recepción, idempotencia y decisión de reingreso a `ra_devoluciones`; mantener `receptor_id` como compatibilidad.
- [ ] Agregar `CHECK` para combinaciones de recepción y observación, y para forma de `recibida`/`aprobada` solamente. No aplicar el nuevo CHECK a `liquidada`, pues 055 ya contiene filas históricas sin las columnas 058.
- [ ] Crear índice de bandeja por `(empresa_id, sucursal_id, estado, created_at DESC)` y contrastar su uso con la consulta administrativa.
- [ ] Extender auditoría con eventos de recepción, no recibido, aprobación, rechazo y override.
- [ ] Reemplazar `ra_solicitar_devolucion_v1` conservando firma; deprecar e ignorar `reingresaStock`, y persistir nuevas líneas con `reingresa_stock=false`.
- [ ] Crear `ra_registrar_recepcion_devolucion_v1` con roles, sucursal, hash, replay y validación bidireccional de `recibido`/`no_recibido`.
- [ ] Crear `ra_aprobar_devolucion_v1` con decisión tipada, override auditado y transición `recibida -> aprobada`.
- [ ] Crear `ra_rechazar_devolucion_v1` con motivo, hash, auditoría y transiciones permitidas.
- [ ] Reemplazar `ra_liquidar_devolucion_v1`: exigir `aprobada`, recepción real y decisión tipada; no sobrescribir receptor ni aprobador.
- [ ] Bloquear `ra_venta_items` con `ORDER BY id FOR UPDATE` antes de sumar devoluciones liquidadas; conservar el check `RA_RETURN_QUANTITY_EXCEEDED`.
- [ ] Revisar grants, RLS, `search_path` y revocaciones de las tres RPC nuevas y de la liquidación reemplazada.

## Aplicación

- [ ] Actualizar tipos manuales de Supabase y schemas Zod para estados, recepción, aprobación, rechazo y errores de negocio.
- [ ] Implementar Server Actions tablet para solicitar y registrar recepción; cada acto genera una `operation_id` independiente.
- [ ] Implementar ruta y componentes tablet de devoluciones, restringidos a venta/sucursal activa y sin lógica autoritativa de importes o stock.
- [ ] Implementar consultas y acciones administrativas de bandeja, detalle, aprobación, rechazo y liquidación.
- [ ] Mostrar explícitamente el bloqueo `RA_RETURN_FISCAL_RECONCILIATION_REQUIRED`, el estado de la outbox original y el estado de NC.
- [ ] Implementar bandeja manual NC que muestra acción solo en estados permitidos por el claim RPC; no agregar cron.
- [ ] Asegurar revalidación de rutas y mensajes de error sin exponer datos de otra empresa/sucursal.

## Pruebas SQL

- [ ] Schema: columnas, enum, constraints, grants, RLS y compatibilidad de solicitudes/liquidaciones 055 existentes.
- [ ] Estados: solicitud, recepción true/false, contradicciones, aprobación, rechazo, liquidación y replay/conflicto de cada RPC.
- [ ] Concurrencia: dos conexiones con devoluciones distintas, `operation_id` distintas y la misma `venta_item_id`; confirmar una ganadora y `RA_RETURN_QUANTITY_EXCEEDED` para la otra.
- [ ] Economía: efectivo/caja cerrada, digital con referencia, pago mixto, CxC puro y cobro parcial.
- [ ] Aislamiento: RLS y llamadas RPC cruzadas entre empresa y sucursal.
- [ ] Fallos inyectados: stock, caja y CxC revierten completamente la liquidación.
- [ ] Fiscal: mantener gate de outbox original y verificar que NC usa solo motivos `06`/`07`.

## Pruebas de aplicación y entrega

- [ ] Vitest para schemas, Server Actions, mapeo de errores y estados visibles críticos.
- [ ] Ejecutar pruebas focalizadas y revisar lint enfocado, sin limpiar deuda global preexistente. El `next build` queda para una validación separada autorizada.
- [ ] Ejecutar prueba manual OSE exclusivamente en tenant TEST: NC inicial, replay y conflicto 409; adjuntar evidencia sin secretos.
- [ ] Revisar drift del ledger, advisors, grants y políticas en TEST después de aplicar 058.
- [ ] Completar `verify-report.md` con resultados, límites de bandeja manual, rollback real de RPC y pendientes de fase 2/3.
