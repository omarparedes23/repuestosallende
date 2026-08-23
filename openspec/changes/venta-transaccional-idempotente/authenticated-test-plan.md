# Plan de pruebas autenticadas pendiente

Estas pruebas requieren una sesion real de un usuario de pruebas con rol `vendedor` o `administrador` y fixtures aislados. No usar datos de produccion ni credenciales en archivos.

## Casos minimos

1. **Replay de ticket**: confirmar con `operationId=A`, repetir exactamente el payload y comprobar una venta, un pago, un movimiento de caja, un kardex y respuesta `replayed=true`.
2. **Conflicto**: repetir `A` cambiando cantidad o producto y comprobar `RA_IDEMPOTENCY_CONFLICT` sin nuevos efectos.
3. **Credito estable**: confirmar una venta a credito que exceda el limite, guardar `warnings.creditLimitExceeded`, cambiar el saldo en una operacion controlada y consultar `A`; el warning debe ser identico.
4. **Rollback**: provocar fallo validado antes del commit y comprobar que no quedan venta, items, pagos, caja, kardex, credito ni outbox.
5. **Stock concurrente**: lanzar dos confirmaciones sobre el mismo producto y comprobar que no hay stock negativo ni actualizacion perdida.
6. **Claim/fencing**: dos workers reclaman una outbox; solo uno obtiene el lease y un token obsoleto no puede finalizarlo.
7. **Aislamiento**: un usuario no puede consultar el `operationId` de otra empresa; la respuesta debe ser `not_found` o rechazo sin filtrar existencia.

## Evidencia a guardar

- IDs tecnicos de las operaciones de prueba, sin datos personales.
- Conteos antes/despues de ventas, pagos, caja, kardex, credito y outbox.
- Respuestas y codigos de dominio sanitizados.
- Estado/lease/attempt_count de outbox.
- Resultado de `npm test`, TypeScript y advisors.

Al finalizar, actualizar `verify-report.md` y marcar solo los escenarios realmente ejecutados en `tasks.md`.
