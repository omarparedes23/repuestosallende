# Tareas: devolución comercial y fiscal trazable

## Contratos y preflight

- [x] Verificar ledger, tablas, constraints, funciones y grants vigentes en
  Supabase TEST antes de diseñar la migración final. Ver `preflight-remoto.md`.
- [ ] Confirmar con contador los motivos/plazos de nota de crédito aplicables y
  la política para comprobantes originalmente rechazados.
- [x] Fijar primera política operativa: un único acto administrativo de
  recepción/liquidación y sin plazo automático rígido; antigüedad y motivo
  auditados.
- [ ] Verificar contrato OSE de nota de crédito, series configuradas y consulta
  de estado sin emitir documentos reales.

## Base de datos

- [x] Crear migración aditiva de agregado, auditoría, índices, RLS y grants.
- [x] Extender de forma compatible caja/CxC para movimientos compensatorios de
  devolución sin alterar libros históricos.
- [x] Implementar solicitud y liquidación RPC con idempotencia, locks y
  resultados recuperables.
- [x] Crear configuración/contador seguro de series NC y outbox exclusiva con
  leases/fencing.
- [ ] Escribir y ejecutar pruebas SQL de schema, rollback, concurrencia, RLS,
  seguridad, pagos mixtos y estados fiscales. **Parcial:** schema, liquidación
  reversible y rollback por fallo inyectado PASS en TEST; concurrencia y los
  demás casos quedan pendientes.

## Aplicación

- [x] Actualizar tipos manuales de Supabase y contratos Zod para liquidación.
- [x] Implementar Server Action de liquidación sin lógica autoritativa en
  cliente, con emisión NC posterior al commit y reintento manual autorizado.
- [x] Extender adaptador OSE para nota de crédito inmediata; el worker/cron de
  cola general permanece en espera. Ante fallo, la outbox queda durable para
  reintento manual y futuro VPS.
- [ ] Construir detalle administrativo de venta/devolución y UI de solicitud
  tablet con estados y referencias seguras.

## Verificación y entrega

- [ ] Ejecutar suites TypeScript y SQL en entorno de prueba aislado. **Parcial:**
  tres pruebas SQL PASS en Supabase TEST; faltan concurrencia y la suite UI/TS.
- [ ] Ejecutar revisión de advisors, grants, políticas y drift de migraciones.
- [ ] Verificar manualmente reembolso inmediato con NC pending/retry sin
  duplicación ni reverso de stock/caja.
- [ ] Registrar `verify-report.md`, límites de operación y plan de rollback.
