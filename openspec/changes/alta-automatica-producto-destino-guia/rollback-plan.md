# Plan de rollback — migración 052

Forward-only. No borra filas de `ra_productos` ya creadas ni altera kardex.

## Qué toca 052

| Objeto | Acción | Estado previo |
|---|---|---|
| `ra_recibir_guia(uuid)` | `CREATE OR REPLACE` (misma firma) | versión de 050/051 (rechazaba con `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`) |

Ningún cambio de esquema, enum, índice ni datos.

## Reversión

```sql
BEGIN;
-- Pegar textualmente el bloque CREATE OR REPLACE FUNCTION public.ra_recibir_guia(uuid)
-- de openspec/changes/guia-traslado-inventario-segura/sql/050_guia_traslado_inventario_segura.sql
-- (Paso 1 vuelve a: destino NULL -> RAISE RA_PRODUCT_NOT_FOUND_AT_DESTINATION, sin upsert)
-- + REVOKE/GRANT idénticos.
CREATE OR REPLACE FUNCTION public.ra_recibir_guia(p_guia_id uuid) ... ;
COMMIT;

DELETE FROM supabase_migrations.schema_migrations WHERE version = '052';
```

## Datos

Las filas `ra_productos` que 052 haya habilitado automáticamente en destino
**permanecen** (stock, precios y demás quedan tal cual). El rollback solo
restablece la validación estricta: nuevas recepciones volverán a exigir el alta
manual de la fila destino.
