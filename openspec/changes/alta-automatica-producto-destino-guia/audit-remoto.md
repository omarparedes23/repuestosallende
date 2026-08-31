# Auditoría remota read-only — alta-automatica-producto-destino-guia (052)

Fecha: 2026-08-31 · Proyecto Supabase: `axcrubvtpqcyscizgoee` (TEST) · Solo `SELECT` / catálogo de sistema.

## Ledger

Última migración del repo: **`051` numeracion_series_guias**. Sin huecos 038–051.
**Siguiente migración: `052`.**

## `public.ra_recibir_guia(uuid)` — definición VIGENTE (de 050; 051 no la tocó)

| Atributo | Valor |
|---|---|
| Firma | `ra_recibir_guia(p_guia_id uuid)` → `jsonb` |
| Owner | `postgres` |
| `SECURITY DEFINER` | sí |
| `search_path` | `public, pg_temp` |
| ACL | `postgres=X` / `authenticated=X` (anon / PUBLIC / service_role sin EXECUTE) |

Estructura actual:
1. auth → `v_empresa`, `v_rol`; exige `administrador`/`superadmin`.
2. `SELECT … WHERE id = p_guia_id AND empresa_id = v_empresa FOR UPDATE` → `RA_GUIDE_NOT_FOUND`.
3. `estado = 'en_transito'` o `RA_GUIDE_INVALID_STATE` (cubre doble recepción).
4. `count(ítems) > 0` o `RA_GUIDE_EMPTY`; sin `catalogo_id` duplicado o `RA_GUIDE_DUPLICATE_ITEM`.
5. **Loop 1 (validación, `ORDER BY catalogo_id`)**: lock origen `FOR UPDATE` → NULL ⇒ `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`; lock destino `FOR UPDATE` → **NULL ⇒ `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`**; `stock_origen < cantidad` ⇒ `RA_STOCK_INSUFFICIENT`.
6. **Loop 2 (aplicar, `ORDER BY catalogo_id`)**: origen `-= cantidad` + kardex `('salida','traslado')`; destino `+= cantidad` + kardex `('entrada','traslado')`.
7. `UPDATE … estado='recibida', fecha_recepcion=now()`.

**Cambio de 052**: en el Loop 1, cuando la fila destino falta, en vez de `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` se hace un alta automática (`INSERT … ON CONFLICT (empresa_id,sucursal_id,catalogo_id) DO NOTHING`) copiando atributos comerciales de la fila origen, y luego se re-selecciona/bloquea. Todo lo demás intacto. Firma sin cambios → `CREATE OR REPLACE` (no `DROP`).

## `public.ra_productos` — columnas (para el alta en destino)

| Columna | Tipo | Null | Default | ¿copiar de origen? |
|---|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` | — (nueva) |
| `empresa_id` | uuid | NO | — | = `v_empresa` |
| `sucursal_id` | uuid | NO | — | = `sucursal_destino_id` |
| `catalogo_id` | uuid | NO | — | = del ítem |
| `codigo_interno` | text | SÍ | — | **sí** |
| `precio_venta` | numeric | SÍ | — | **sí** (precios) |
| `precio_venta_dolar` | numeric | SÍ | — | **sí** (precios) |
| `precio_compra` | numeric | SÍ | — | **sí** (costo) |
| `stock_minimo` | numeric | NO | `0` | **sí** |
| `moneda` | char(3) | NO | `'PEN'` | **sí** |
| `stock_actual` | numeric | NO | `0` | **NO** → inicia en `0` |
| `activo` | boolean | NO | `true` | **NO** → `true` |

Índice único relevante: `ra_productos_por_sucursal (empresa_id, sucursal_id, catalogo_id)` → soporta `ON CONFLICT (empresa_id, sucursal_id, catalogo_id) DO NOTHING`.
`CHECK (stock_actual >= 0)` sigue vigente (red de seguridad ante insuficiencia).

## Veredicto

Nada bloquea 052. Firma de `ra_recibir_guia` no cambia. No se toca `ra_catalogo_repuestos`.
