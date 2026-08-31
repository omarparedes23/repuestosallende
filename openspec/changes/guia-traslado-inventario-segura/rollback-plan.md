# Plan de rollback — migración 050

Forward-only. No se editan migraciones históricas ni se reintroducen permisos públicos.

## Qué toca 050

| Objeto | Acción | Estado previo |
|---|---|---|
| `ra_motivo_kardex` | `ADD VALUE 'traslado'` | enum sin `traslado` |
| `ra_crear_guia(uuid,uuid,text,integer,text,jsonb)` | CREATE | no existía |
| `ra_avanzar_estado_guia(uuid,ra_estado_guia)` | CREATE | no existía |
| `ra_recibir_guia(uuid)` | DROP + CREATE (retorno `void`→`jsonb`) | versión de migración 045 |
| `ra_guias_numeracion_completa` | ADD CONSTRAINT CHECK | no existía |
| `ra_guias_correlativo_positivo` | ADD CONSTRAINT CHECK | no existía |
| `ra_guias_numeracion_unica` | CREATE UNIQUE INDEX | no existía |

## Reversión

### 1. Funciones nuevas
```sql
BEGIN;
DROP FUNCTION IF EXISTS public.ra_crear_guia(uuid, uuid, text, integer, text, jsonb);
DROP FUNCTION IF EXISTS public.ra_avanzar_estado_guia(uuid, public.ra_estado_guia);
COMMIT;
```

### 2. `ra_recibir_guia` — volver a la versión 045
```sql
BEGIN;
DROP FUNCTION IF EXISTS public.ra_recibir_guia(uuid);
-- Pegar textualmente el bloque CREATE OR REPLACE FUNCTION public.ra_recibir_guia
-- de supabase/migrations/045_seguridad_rpc_multitenant.sql (líneas 5–80)
-- + REVOKE/GRANT de las líneas 220 y 225 de esa misma migración.
COMMIT;
```
El texto exacto está en `045_seguridad_rpc_multitenant.sql` (no se modifica ese archivo; se copia).

### 3. Esquema de numeración
```sql
DROP INDEX IF EXISTS public.ra_guias_numeracion_unica;
ALTER TABLE public.ra_guias_remision
  DROP CONSTRAINT IF EXISTS ra_guias_numeracion_completa,
  DROP CONSTRAINT IF EXISTS ra_guias_correlativo_positivo;
```

### 4. Enum `traslado`
**No se puede quitar** un valor de un enum en PostgreSQL. Queda `traslado` en `ra_motivo_kardex` aunque nada lo use. Es inocuo. Si molesta, se recrea el tipo entero (operación mayor, fuera de un rollback de emergencia). Por eso la alternativa de bajo riesgo es no agregarlo y usar `'ajuste_manual'`.

### 5. Ledger
```sql
DELETE FROM supabase_migrations.schema_migrations WHERE version = '050';
```
(solo si se había registrado)

## Impacto en la app durante el rollback

- El front de Codex aún **no** está conectado a `ra_crear_guia` / `ra_avanzar_estado_guia` (fase 2.3 pendiente). Mientras no lo esté, revertir esas dos funciones no afecta a usuarios.
- `recibirGuia` ya llama `ra_recibir_guia`; volver a la 045 restaura el comportamiento anterior (con F1–F6) sin romper la llamada, porque el front ignora el valor de retorno.

## Datos

050 no escribe datos. No hay migración de datos que revertir. Con 0 guías en TEST, tampoco hay estado operativo en riesgo.
