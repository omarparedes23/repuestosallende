# Auditoría read-only + propuesta — migración 053 (crear guía con destino ausente)

Fecha: 2026-08-31 · Proyecto Supabase: `axcrubvtpqcyscizgoee` (TEST) · Solo `SELECT` / catálogo de sistema.

## Hallazgo

### Ledger
Última migración: **`052` alta_automatica_producto_destino_guia**. Sin huecos 038–052.
**Siguiente migración: `053`.**

### `public.ra_crear_guia(uuid, uuid, text, jsonb)` — definición VIGENTE (de 051)

| Atributo | Valor |
|---|---|
| Firma | `ra_crear_guia(p_sucursal_origen_id uuid, p_sucursal_destino_id uuid, p_notas text, p_items jsonb)` → `jsonb` |
| Owner | `postgres` · `SECURITY DEFINER` · `search_path = public, pg_temp` |
| ACL | `postgres=X` / `authenticated=X` (anon / PUBLIC / service_role sin EXECUTE) |

Secuencia actual:
1. `auth.uid()` → `RA_UNAUTHENTICATED`.
2. `ra_perfiles` activo + rol `administrador`/`superadmin` → `RA_FORBIDDEN`.
3. Sucursales no nulas / distintas / de la empresa y activas → `RA_GUIDE_INVALID_BRANCH` / `RA_GUIDE_SAME_BRANCH`.
4. `p_items` array no vacío → `RA_GUIDE_EMPTY`; normalización; `catalogo_id` nulo/inválido o `cantidad` inválida → `RA_GUIDE_ITEM_INVALID`; `catalogo_id` repetido → `RA_GUIDE_DUPLICATE_ITEM`.
5. **Validación origen**: todo `catalogo_id` con fila en `ra_productos (empresa, sucursal_origen, catalogo)` → si falta, `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`.
6. **Validación destino** *(← ESTA se elimina en 053)*: todo `catalogo_id` con fila en `ra_productos (empresa, sucursal_destino, catalogo)` → si falta, `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`.
7. Serie predeterminada de origen `… FOR UPDATE` → `RA_GUIDE_SERIES_NOT_CONFIGURED`; asigna `correlativo`, inserta guía (`unique_violation` → `RA_GUIDE_DUPLICATE_NUMBER`), `siguiente_correlativo + 1`, inserta ítems (`nombre_producto` autoritativo).
8. Devuelve `{status, guia:{id, estado, items, serie, correlativo, numero}}`.

## Propuesta — migración 053 (forward-only)

**Único cambio**: `CREATE OR REPLACE FUNCTION public.ra_crear_guia(uuid, uuid, text, jsonb)` **idéntica a la de 051 salvo que se elimina el bloque del paso 6** (la validación `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`).

- Firma pública: **sin cambios** (`CREATE OR REPLACE`, sin `DROP`).
- Se conservan intactos: auth, empresa, roles, `SECURITY DEFINER`, `search_path`, series, correlativos, `FOR UPDATE` de la serie, validación de cantidades, artículos duplicados, sucursales, guía vacía, `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`, `RA_GUIDE_DUPLICATE_NUMBER`, formato de número.
- **No** se crea ninguna fila `ra_productos` en destino durante la creación.
- La creación sigue devolviendo la guía y el número asignado.
- El alta automática en destino la sigue haciendo **`ra_recibir_guia` (052)** al recibir.
- Grants: se re-aplican `REVOKE ALL … FROM PUBLIC, anon, service_role` + `GRANT EXECUTE … TO authenticated` (idénticos; `CREATE OR REPLACE` ya los preserva).

`RA_PRODUCT_NOT_FOUND_AT_DESTINATION` deja de emitirse desde `ra_crear_guia`; sigue existiendo como guard imposible en `ra_recibir_guia` (052). El frontend conserva su mapeo.

## Pruebas (ver `sql/tests/053_*`)

1. Producto en origen y NO en destino → crear guía OK, `0` filas en destino.
2. `emitir → en_transito → recibir` → 052 crea **1** fila destino, copia atributos comerciales, suma stock.
3. Producto inexistente en origen → `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`, sin guía ni fila destino.
4. Regresión: numeración (serie/correlativo atómico, `siguiente_correlativo++`), auth, estados (same branch, empty, dup item), `RA_GUIDE_SERIES_NOT_CONFIGURED`.
5. Runner de concurrencia: dos `ra_crear_guia` en paralelo desde el mismo origen con destino ausente → correlativos consecutivos y distintos, `0` filas destino, `siguiente_correlativo` correcto; cleanup aislado por RUN_ID. Más regresión de los runners de 051 y 052.

## Restricción

No se borra ni altera ninguna guía ni serie real existente (2 guías de Codex en Repuestos Allende; series `005` Arriola / `001` Tienda Principal). Los tests usan la empresa `10101010` con `BEGIN … ROLLBACK` y fixtures desechables marcados por RUN_ID.
