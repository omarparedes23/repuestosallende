# Plan de rollback — migración 053

Forward-only. No borra guías ni filas `ra_productos` ya creadas.

## Qué toca 053

| Objeto | Acción | Estado previo |
|---|---|---|
| `ra_crear_guia(uuid,uuid,text,jsonb)` | `CREATE OR REPLACE` (misma firma) | versión de 051 (validaba `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`) |

Ningún cambio de esquema, enum, índice, grant ni datos.

## Reversión

```sql
BEGIN;
-- Pegar textualmente el bloque CREATE OR REPLACE FUNCTION public.ra_crear_guia(uuid,uuid,text,jsonb)
-- de openspec/changes/numeracion-series-guias/sql/051_numeracion_series_guias.sql
-- (vuelve a incluir el IF EXISTS ... RA_PRODUCT_NOT_FOUND_AT_DESTINATION antes de la resolución de serie)
-- + REVOKE/GRANT idénticos.
CREATE OR REPLACE FUNCTION public.ra_crear_guia(uuid, uuid, text, jsonb) ... ;
COMMIT;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '053';
```

## Datos

Las guías creadas bajo 053 con el artículo ausente en destino **permanecen**. Si además ya se
recibieron, sus filas `ra_productos` de destino (creadas por 052) también permanecen. El rollback
solo restablece la exigencia de la fila destino al **crear** nuevas guías.
