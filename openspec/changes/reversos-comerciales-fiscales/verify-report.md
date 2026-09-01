# Verificación — devolución comercial y fiscal trazable

Fecha: 2026-09-01 · Entorno: Supabase TEST.

## Aplicación remota

| Elemento | Resultado |
|---|---|
| `055_reversos_comerciales_fiscales_schema` | PASS: aplicada y registrada en el ledger remoto |
| `056_nota_credito_outbox_inmediata` | PASS: aplicada, registrada y restringida a `service_role` |
| `057_nota_credito_reintento_manual` | PASS: aplicada y registrada; adelanta solo estados `retry` |
| Series NC | PASS: cuatro series activas y predeterminadas, correlativo inicial 1 |
| RLS outbox NC | PASS: una política de lectura por empresa; sin escrituras directas para `authenticated` |

## Pruebas ejecutadas

| Prueba | Resultado | Evidencia |
|---|---|---|
| `devolucion-fiscal-schema.test.sql` | PASS | Tablas, RPC, ACL, locks, series, RLS y outbox presentes |
| `devolucion-fiscal-rpc.test.sql` | PASS | Solicitud, liquidación, replay y outbox NC bajo `ROLLBACK` |
| `devolucion-fiscal-fault-injection.test.sql` | PASS | Error inyectado revierte stock, kardex, caja y outbox; `ROLLBACK` final |
| Claim/finalización NC | PASS | Lease, backoff temporal, reintento manual y auditoría fiscal bajo `ROLLBACK` |
| Vitest | PASS | 25 archivos, 146 pruebas |
| `next build` | PASS | Compilación, TypeScript y 32 rutas generadas |

## Límites vigentes

- Aún faltan pruebas de concurrencia, pagos mixtos, CxC puro, RLS multiempresa
  y la integración de UI/Server Actions.
- La acción de liquidación intenta emitir la NC inmediatamente después del
  commit. Si OSE falla, el reembolso no se revierte y la outbox queda para
  reintento manual. El worker/cron general sigue en espera mientras el proyecto
  use Vercel Hobby, cuya frecuencia diaria no es suficiente para esa cola.
- No hubo llamada a OSE/SUNAT ni emisión fiscal real durante estas pruebas.
