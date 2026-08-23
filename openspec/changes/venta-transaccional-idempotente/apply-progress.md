# Apply progress — venta-transaccional-idempotente

Actualizado: 2026-08-16

## Reanudar aquí después de reiniciar Codex

1. Confirmar que `.codex/config.toml` conserva el `project_ref` actual y tiene temporalmente `read_only=false`.
2. Verificar que el MCP de Supabase expone herramientas de migración/escritura para el proyecto remoto de pruebas.
3. Tratar ese Supabase remoto como entorno de prueba, no como producción; no se necesita PostgreSQL ni Supabase local.
4. Antes de escribir, volver a comprobar el proyecto remoto seleccionado y el ledger de migraciones.
5. Aplicar únicamente `supabase/migrations/038_venta_transaccional_idempotente.sql`; no reaplicar las migraciones locales `001`-`037`.
6. Ejecutar las pruebas SQL reales de migración, rollback, concurrencia, RLS, claim y fencing, y registrar la evidencia en este cambio OpenSpec.
7. Corregir cualquier fallo encontrado y continuar con `sdd-verify` contra `spec.md` y `tasks.md`.
8. Al terminar las operaciones remotas, restaurar `read_only=true` en `.codex/config.toml` y reiniciar Codex.

No habilitar todavía el scheduler ni realizar envíos reales al OSE hasta completar el smoke test controlado y definir el tratamiento operativo de estados inciertos.

## Completado localmente

- Preflight remoto de solo lectura: esquema, índices, funciones, RLS, grants, ledger y agregados.
- Migración local `038_venta_transaccional_idempotente.sql` con RPC atómica, idempotencia, resultado recuperable y outbox con leases/fencing.
- `procesarVenta()` usa exclusivamente `ra_confirmar_venta`; se eliminó el flujo legacy con inserts separados, service role y `after()`.
- Persistencia del intento por usuario/empresa y recuperación por `operation_id` después de recarga.
- Adaptador OSE con `Idempotency-Key` y clasificación de estados seguros/inciertos.
- Worker outbox con concurrencia máxima 2 y endpoint interno autenticado compatible con Vercel GET y VPS POST.
- Suite Vitest: 9 archivos, 39 pruebas, 0 fallos.

## Estado remoto despues de aplicar 038

- Los objetos principales de `038` existen en el Supabase remoto de pruebas.
- La colision nominal de `idx_ventas_serie_correlativo` se resolvio renombrando el indice de `ptovta_ventas` y creando el indice unico correcto en `ra_ventas`.
- La aplicacion no figura en el ledger de migraciones de Supabase; debe reconciliarse antes de produccion.
- `sdd-verify` quedo parcial: consultar `verify-report.md` para los hallazgos y pruebas pendientes.
- `039_venta_idempotencia_hardening.sql` esta preparado localmente, pero aun no aplicado al remoto. Las instrucciones estan en `hardening-apply.md`.

## Evidencia de preflight

- 5 ventas remotas; 0 sin ítems; 0 sin pagos.
- 0 correlativos duplicados; 0 cargos duplicados por venta; 0 productos repetidos por venta.
- 0 productos con stock negativo.
- 6 kardex históricos con motivo venta sin referencia actual, fuera del alcance y sin modificar.
- El ledger remoto usa versiones timestamp y no registra la secuencia local `001`–`037`.
- No se aplicó DDL ni se modificaron datos remotos durante apply.

## Pendiente antes de producción

1. Ejecutar `038` en PostgreSQL/Supabase aislado y añadir pruebas SQL reales de rollback, concurrencia, RLS, claim y fencing.
2. Corregir cualquier error detectado por esa ejecución; no aplicar aún a producción.
3. Ejecutar smoke test contra OSE staging para replay y `/por-numero`.
4. Configurar scheduler y propietario/SLA de `submitted`, `rejected` y `dead_letter`.
5. Reconciliar formalmente el ledger remoto y aprobar el identificador de despliegue.

## Baseline ajeno al cambio

`npx tsc --noEmit` conserva un error preexistente en
`src/app/tablet/(kiosk)/clientes/components/ClienteFormSheet.tsx:113`.
No fue modificado como parte de esta implementación.
