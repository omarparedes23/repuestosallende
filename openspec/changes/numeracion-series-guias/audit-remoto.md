# Auditoría remota read-only — numeracion-series-guias (051)

Fecha: 2026-08-31 · Proyecto Supabase: `axcrubvtpqcyscizgoee` (TEST) · Solo `SELECT` / catálogo de sistema.

## Ledger

Última migración del repo: **`050` guia_traslado_inventario_segura**. Sin huecos 038–050.
**Siguiente migración: `051`.**

## Estado relevante

| Objeto | Estado |
|---|---|
| `ra_series_documento` | **no existe** — la crea 051 |
| `ra_crear_guia` | firma actual `(uuid,uuid,text,integer,text,jsonb)` (050: origen, destino, serie, correlativo, notas, items). `SECURITY DEFINER`, `search_path=public,pg_temp`, ACL `postgres=X \| authenticated=X`. **051 la reemplaza** (`DROP` + `CREATE` con 4 args). |
| `ra_avanzar_estado_guia`, `ra_recibir_guia` | 050, sin cambios en 051 |
| `ra_siguiente_correlativo(uuid,text)` | existe — usa `MAX(correlativo)+1` **sobre `ra_ventas`**. Es de ventas; 051 **no la toca ni la llama**. Prohibido reutilizarla para guías. |
| `ra_guias_remision` CHECKs | `ra_guias_numeracion_completa` `((serie IS NULL)=(correlativo IS NULL))`, `ra_guias_correlativo_positivo` `(correlativo IS NULL OR correlativo>0)`, `sucursal_origen_id<>sucursal_destino_id` |
| `ra_guias_numeracion_unica` | `UNIQUE (empresa_id, serie, correlativo) WHERE serie IS NOT NULL AND correlativo IS NOT NULL` |
| Helpers | `ra_empresa_id()` ✅, `ra_set_updated_at()` ✅ |
| Roles | `anon`, `authenticated`, `service_role` |

## Sucursales activas de Repuestos Allende (RUC 20610105280) — para config real

| Sucursal | id | activo |
|---|---|---|
| Sucursal Nicolas Arriola | `d7931340-7bac-4eb3-8772-7494eb58e9a0` | sí |
| Tienda Principal | `b2c3d4e5-f6a7-8901-bcde-f12345678901` | sí |

(el resto son sucursales desechables `TESORERIA-*` inactivas)

## Veredicto

Nada bloquea 051. La reescritura de `ra_crear_guia` cambia el número de argumentos → `DROP FUNCTION` + `CREATE`.
**No se insertará ninguna fila real en `ra_series_documento`** hasta que el propietario confirme: qué sucursal emite la serie `001` y su `siguiente_correlativo` real.
