# Plan de rollback — migración 051

Forward-only. No se editan migraciones históricas ni se reutilizan correlativos ya asignados.

## Qué toca 051

| Objeto | Acción | Estado previo |
|---|---|---|
| `public.ra_series_documento` | CREATE TABLE + índices + trigger + RLS | no existía |
| `ra_obtener_preview_serie_guia(uuid)` | CREATE | no existía |
| `ra_crear_guia(uuid,uuid,text,integer,text,jsonb)` | DROP | firma de 050 |
| `ra_crear_guia(uuid,uuid,text,jsonb)` | CREATE | no existía |

`ra_avanzar_estado_guia`, `ra_recibir_guia`, `ra_siguiente_correlativo` — sin cambios.

## Reversión

```sql
BEGIN;

-- 1. Restaurar la firma 050 de ra_crear_guia (copiar textualmente el bloque
--    CREATE FUNCTION public.ra_crear_guia(uuid,uuid,text,integer,text,jsonb)
--    de openspec/changes/guia-traslado-inventario-segura/sql/050_guia_traslado_inventario_segura.sql
--    + su REVOKE/GRANT).
DROP FUNCTION IF EXISTS public.ra_crear_guia(uuid, uuid, text, jsonb);
-- <pegar aquí el CREATE FUNCTION de 050> ;

-- 2. Preview
DROP FUNCTION IF EXISTS public.ra_obtener_preview_serie_guia(uuid);

-- 3. Tabla de series
DROP TABLE IF EXISTS public.ra_series_documento;   -- CASCADE no necesario: nada la referencia

COMMIT;

-- 4. Ledger
DELETE FROM supabase_migrations.schema_migrations WHERE version = '051';
```

## Datos

051 no inserta configuración real. Si ya se hubiera insertado config y creado guías con
numeración de series, el rollback **no** re-numera esas guías: quedan con la serie/correlativo
que se les asignó (append-only de facto). Solo se pierde el mecanismo de asignación automática.

## Impacto en la app

El frontend de Codex debe migrar a la firma de 4 args + preview antes de que 051 sea usable
por usuarios. Un rollback a 050 vuelve a exigir serie/correlativo del cliente.
