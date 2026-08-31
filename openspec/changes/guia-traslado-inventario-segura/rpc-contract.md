# Contrato RPC — guia-traslado-inventario-segura (migración 050)

Estado: **PROPUESTA — no aplicada**. Requiere aprobación del propietario antes de ejecutar.

Todas las funciones:
- `LANGUAGE plpgsql`, `SECURITY DEFINER`, `SET search_path = public, pg_temp`.
- Derivan `auth.uid()` → `empresa_id`, `rol` desde `ra_perfiles WHERE id = auth.uid() AND activo`.
- Exigen `rol IN ('administrador','superadmin')` de esa empresa.
- Grants: `REVOKE ALL ... FROM PUBLIC, anon, service_role;` + `GRANT EXECUTE ... TO authenticated;`
  ACL final: solo `postgres=X` (owner) y `authenticated=X`. Sin `service_role` (no hay consumidor server-side; contrato = `authenticated` únicamente).
- Señalan error con `RAISE EXCEPTION USING MESSAGE = 'RA_...'` (SQLSTATE `P0001`, `SQLERRM` = el código exacto). El front matchea por igualdad o `includes`.
- Efecto todo-o-nada: cualquier `RAISE` revierte la transacción implícita de la función.

---

## Códigos de error (estables)

| Código | Significado |
|---|---|
| `RA_UNAUTHENTICATED` | `auth.uid()` nulo o perfil inactivo |
| `RA_FORBIDDEN` | rol distinto de administrador/superadmin, o empresa no resuelta |
| `RA_GUIDE_NOT_FOUND` | guía inexistente **o de otra empresa** (no distingue, no filtra existencia) |
| `RA_GUIDE_INVALID_STATE` | transición no permitida / recepción sobre guía que no está `en_transito` (cubre doble recepción) |
| `RA_GUIDE_INVALID_BRANCH` | sucursal origen/destino nula, ajena o inactiva |
| `RA_GUIDE_SAME_BRANCH` | origen == destino |
| `RA_GUIDE_EMPTY` | guía sin ítems (al emitir y al recibir) |
| `RA_GUIDE_ITEM_INVALID` | `catalogo_id` nulo/ausente/no-uuid, o cantidad nula/≤ 0/escala > 3/fuera de rango |
| `RA_GUIDE_DUPLICATE_ITEM` | mismo `catalogo_id` repetido en los ítems |
| `RA_GUIDE_NUMBER_INCOMPLETE` | serie y correlativo no informados juntos, o `correlativo <= 0` |
| `RA_GUIDE_DUPLICATE_NUMBER` | la combinación `(empresa, serie, correlativo)` ya existe (chequeo previo **y** captura de `unique_violation` en carrera) |
| `RA_PRODUCT_NOT_FOUND_AT_ORIGIN` | algún catálogo sin fila en `ra_productos` de la sucursal origen |
| `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` | algún catálogo sin fila en `ra_productos` de la sucursal destino (no se auto-crea) |
| `RA_STOCK_INSUFFICIENT` | `stock_actual` de origen < cantidad a trasladar |

---

## 1. `ra_crear_guia`

```
ra_crear_guia(
  p_sucursal_origen_id  uuid,
  p_sucursal_destino_id uuid,
  p_serie               text,       -- nullable; se normaliza (btrim, '' -> NULL)
  p_correlativo         integer,    -- nullable
  p_notas               text,       -- nullable; se normaliza
  p_items               jsonb       -- array de { "catalogo_id": uuid, "cantidad": numeric }
) RETURNS jsonb
```

Validaciones, en orden:
1. auth + rol.
2. `p_sucursal_origen_id`, `p_sucursal_destino_id` no nulas → `RA_GUIDE_INVALID_BRANCH`.
3. origen ≠ destino → `RA_GUIDE_SAME_BRANCH`.
4. ambas sucursales existen, son de la empresa y `activo` → `RA_GUIDE_INVALID_BRANCH`.
5. Numeración: `serie` (normalizada: btrim, `''`→NULL) y `p_correlativo` deben estar **ambos informados o ambos NULL**, y `p_correlativo > 0` → si no, `RA_GUIDE_NUMBER_INCOMPLETE`.
6. Si hay numeración: `(empresa, serie, correlativo)` no debe existir → `RA_GUIDE_DUPLICATE_NUMBER` (chequeo previo).
7. `p_items` array no vacío → `RA_GUIDE_EMPTY`.
8. cada ítem: `catalogo_id` presente y uuid válido; `cantidad` no nula, > 0, `= round(cantidad,3)`, ≤ 99999.999 → `RA_GUIDE_ITEM_INVALID`.
9. sin `catalogo_id` repetido → `RA_GUIDE_DUPLICATE_ITEM`.
10. todo `catalogo_id` tiene fila en `ra_productos` de la sucursal **origen** → `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`.
11. todo `catalogo_id` tiene fila en `ra_productos` de la sucursal **destino** → `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` (no se auto-crea la fila; se revalida en la recepción porque la config puede cambiar).
    (No se valida stock aquí: el stock se mueve al recibir.)
12. INSERT cabecera `estado='borrador'`, `usuario_id = auth.uid()`; `unique_violation` (carrera por la numeración) se captura → `RA_GUIDE_DUPLICATE_NUMBER`.
13. INSERT ítems con `nombre_producto` **autoritativo** desde `ra_catalogo_repuestos` (se ignora cualquier nombre del cliente).

Respuesta:
```json
{ "status": "created", "guia": { "id": "<uuid>", "estado": "borrador", "items": <int> } }
```

---

## 2. `ra_avanzar_estado_guia`

```
ra_avanzar_estado_guia(
  p_guia_id      uuid,
  p_nuevo_estado ra_estado_guia   -- solo 'emitida' | 'en_transito'
) RETURNS jsonb
```

Validaciones:
1. auth + rol.
2. `p_nuevo_estado IN ('emitida','en_transito')` → si no, `RA_GUIDE_INVALID_STATE`.
3. `SELECT ... WHERE id = p_guia_id AND empresa_id = v_empresa FOR UPDATE` → `RA_GUIDE_NOT_FOUND`.
4. Transición permitida SOLO:
   - `borrador → emitida`
   - `emitida → en_transito`
   cualquier otra (incl. saltos, retrocesos, tocar `recibida`) → `RA_GUIDE_INVALID_STATE`.
5. Al pasar a `emitida`: la guía debe tener ítems → `RA_GUIDE_EMPTY`.
6. UPDATE estado; si `emitida` y `fecha_emision IS NULL` ⇒ `fecha_emision = CURRENT_DATE`.

**No mueve stock.** El inventario se afecta solo en la recepción.

Respuesta:
```json
{ "status": "ok", "guia": { "id": "<uuid>", "estado": "emitida|en_transito" } }
```

---

## 3. `ra_recibir_guia` (reescritura)

```
ra_recibir_guia(p_guia_id uuid) RETURNS jsonb
```

> Cambia el tipo de retorno de `void` → `jsonb`, por lo que la migración hace `DROP FUNCTION` + `CREATE` + `GRANT`. El front actual (`recibirGuia`) ignora el retorno, así que no rompe la app.

Flujo:
1. auth + rol.
2. `SELECT ... WHERE id = p_guia_id AND empresa_id = v_empresa FOR UPDATE` → `RA_GUIDE_NOT_FOUND`.
3. `estado = 'en_transito'` o `RA_GUIDE_INVALID_STATE` (cubre doble recepción: la 2.ª llamada, ya con lock, ve `recibida`).
4. `count(ítems) > 0` o `RA_GUIDE_EMPTY`.
5. sin `catalogo_id` duplicado o `RA_GUIDE_DUPLICATE_ITEM` (defensa en profundidad).
6. **Paso 1 — bloquear y validar TODO antes de mutar.** Recorre los ítems `ORDER BY catalogo_id` (orden canónico de locks → sin deadlock con otra recepción):
   - `SELECT ... FOR UPDATE` fila de origen; NULL → `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`.
   - `SELECT ... FOR UPDATE` fila de destino; NULL → `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`.
   - `stock_origen >= cantidad` o `RA_STOCK_INSUFFICIENT`.
7. **Paso 2 — aplicar** (locks del paso 1 retenidos hasta el fin de la función):
   - origen: `stock_actual -= cantidad` + kardex `('salida','traslado')` con `referencia_id = p_guia_id`.
   - destino: `stock_actual += cantidad` + kardex `('entrada','traslado')` con `referencia_id = p_guia_id`.
8. `UPDATE ra_guias_remision SET estado='recibida', fecha_recepcion = now()`.

Garantía: exactamente **una salida y una entrada de kardex por artículo**, y la guía queda `recibida` una sola vez. Falta de origen, falta de destino, stock insuficiente o estado inválido ⇒ rollback total, sin efectos.

Respuesta:
```json
{ "status": "received", "guia": { "id": "<uuid>", "estado": "recibida", "items": <int> } }
```

---

## Cambios de esquema en 050 (además de las 3 funciones)

| Cambio | Motivo | Reversibilidad |
|---|---|---|
| `ALTER TYPE ra_motivo_kardex ADD VALUE IF NOT EXISTS 'traslado'` (fuera de transacción) | kardex distingue traslado de ajuste — hecho de negocio | **irreversible** (no se puede quitar un valor de enum) |
| `DROP FUNCTION ra_recibir_guia(uuid)` + recreación con retorno `jsonb` | contrato uniforme; retorno útil | forward-only: rollback = recrear la versión de 045 |
| `CHECK ra_guias_numeracion_completa` = `(serie IS NULL) = (correlativo IS NULL)` | numeración completa o ausente | `DROP CONSTRAINT` |
| `CHECK ra_guias_correlativo_positivo` = `correlativo IS NULL OR correlativo > 0` | correlativo positivo | `DROP CONSTRAINT` |
| `CREATE UNIQUE INDEX ra_guias_numeracion_unica ON ra_guias_remision (empresa_id, serie, correlativo) WHERE serie IS NOT NULL AND correlativo IS NOT NULL` | evita numeración de guía duplicada (problema fiscal) | `DROP INDEX` |

---

## Incompatibilidades para el front (Codex)

1. `crearGuia` debe pasar a `supabase.rpc('ra_crear_guia', {...})` con `p_items` = `[{catalogo_id, cantidad}]`. **No** enviar `nombre_producto` (lo pone la RPC). Ya no insertar en `ra_guias_remision` / `ra_guia_items` directamente. Serie y correlativo: enviar los dos o ninguno.
2. `avanzarEstadoGuia` → `supabase.rpc('ra_avanzar_estado_guia', { p_guia_id, p_nuevo_estado })`. Mapear los nuevos códigos `RA_GUIDE_*` a mensajes.
3. `recibirGuia` → sigue llamando `ra_recibir_guia({ p_guia_id })`; ahora devuelve `jsonb` (puede ignorarse) y arroja `RA_PRODUCT_NOT_FOUND_AT_ORIGIN|DESTINATION`, `RA_STOCK_INSUFFICIENT`, `RA_GUIDE_EMPTY` — añadir estos mensajes de dominio.
4. El buscador local (`buscarProductosEnSucursal`) ya está alineado: la RPC de creación rechaza cualquier catálogo sin fila en origen con `RA_PRODUCT_NOT_FOUND_AT_ORIGIN` y sin fila en destino con `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`.
5. **`RaMotivoKardex`** (tipo TS generado / manual) debe incluir `'traslado'`. Cualquier `switch`/mapa de motivos de kardex en UI debe contemplar el nuevo valor.
6. Códigos nuevos a mapear en mensajes de dominio: `RA_GUIDE_NUMBER_INCOMPLETE`, `RA_GUIDE_DUPLICATE_NUMBER`, `RA_GUIDE_ITEM_INVALID`, `RA_GUIDE_DUPLICATE_ITEM`, `RA_GUIDE_SAME_BRANCH`, `RA_GUIDE_INVALID_BRANCH`.
