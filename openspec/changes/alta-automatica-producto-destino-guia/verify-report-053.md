# Verify report — Supabase (migración 053)

Fecha: 2026-08-31 · Proyecto: `axcrubvtpqcyscizgoee` (TEST)

## Estado

| Ítem | Resultado |
|---|---|
| Auditoría read-only (ledger, `ra_crear_guia` viva) | **PASS** — `audit-053.md` |
| 053 aplicada en TEST (`CREATE OR REPLACE ra_crear_guia`, firma sin cambios) | **PASS** |
| Suite SQL `053_crear_guia_destino_ausente.test.sql` (A–D) | **PASS** — 0 residuos |
| Runner de concurrencia 053 (`guia-crear-sin-destino-concurrencia-runner.ps1 -Cleanup`) | **PASS** — RUN_ID `6aebb5e65f744ed0b7d57a1864ab9263` |
| Regresión runner 051 (numeración) | **PASS** — RUN_ID `00615878ae564337a642aa034f05915c` |
| Regresión runner 052 (alta destino al recibir) | **PASS** — RUN_ID `694ff713193e4772bae7892dfd9cd674` |
| Registro en ledger `('053','crear_guia_destino_ausente')` | **HECHO** |

## Objeto aplicado

`public.ra_crear_guia(uuid, uuid, text, jsonb)` → `jsonb` — **misma firma** (`CREATE OR REPLACE`, sin `DROP`).
`SECURITY DEFINER`, `search_path = public, pg_temp`. ACL: `postgres=X`, `authenticated=X` (anon / PUBLIC / service_role sin EXECUTE).

**Único cambio respecto de 051**: se eliminó el bloque que exigía una fila `ra_productos` en la sucursal **destino** (`RA_PRODUCT_NOT_FOUND_AT_DESTINATION`).
Verificado en `pg_get_functiondef`: `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` **ausente** del cuerpo; `RA_PRODUCT_NOT_FOUND_AT_ORIGIN` **presente**.

Sin cambios: auth, empresa, roles, `SECURITY DEFINER`, `search_path`, sucursales (nula/igual/ajena/inactiva), guía vacía, `catalogo_id` nulo/inválido, cantidades, artículos duplicados, `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`, serie predeterminada `FOR UPDATE` + `RA_GUIDE_SERIES_NOT_CONFIGURED`, asignación atómica de correlativo, `siguiente_correlativo + 1`, `RA_GUIDE_DUPLICATE_NUMBER`, `nombre_producto` autoritativo, formato `numero`.

`RA_PRODUCT_NOT_FOUND_AT_DESTINATION` sigue existiendo como guard imposible en `ra_recibir_guia` (052).

## Suite SQL — cobertura (todo PASS)

| Sec | Casos |
|---|---|
| **A** | Producto en origen, **ausente en destino** → `ra_crear_guia` OK (`numero='001-00000006'`, 1 ítem); **0 filas** en `ra_productos` de destino; `siguiente_correlativo` 6→7 |
| **B** | End-to-end: crear (destino ausente) → emitir → en_transito → **recibir**: 052 crea **1** fila destino con `stock_actual=9`, `activo=true`, y `codigo_interno/precio_venta/precio_venta_dolar/precio_compra/stock_minimo/moneda` **copiados de origen**; origen 40→31; 2 kardex `traslado`; guía `recibida` |
| **C** | Producto **inexistente en origen** → `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`; 0 guías, 0 filas destino, `siguiente_correlativo` intacto (6) |
| **D** | Regresión (siempre con destino ausente): `RA_GUIDE_SERIES_NOT_CONFIGURED`; sin sesión → `RA_UNAUTHENTICATED`; vendedor → `RA_FORBIDDEN`; `RA_GUIDE_SAME_BRANCH`; `RA_GUIDE_EMPTY`; `RA_GUIDE_DUPLICATE_ITEM`; numeración 6→7→8 (`001-00000006`, `001-00000007`); **0 filas destino** creadas en ninguna |

Cada sección `BEGIN … ROLLBACK`. Post-suite: 0 guías/series de prueba en la empresa 10101010.

## Runners de concurrencia — PASS

| Runner | Resultado |
|---|---|
| **053** `guia-crear-sin-destino` | `correlativos=6,7 siguiente=8 guias=2 filas_destino=0` — dos `ra_crear_guia` en backends paralelos desde el mismo origen con **destino sin fila** → correlativos distintos y consecutivos (`FOR UPDATE` sobre la serie serializó); **ninguna** creación creó fila en destino |
| **051** `guia-numeracion` (regresión) | `correlativos=6,7 siguiente=8 guias=2` |
| **052** `guia-alta-destino` (regresión) | `filas destino=1 destino=10 origen=10 kardex=4` — la alta automática al recibir sigue creando una sola fila y sumando stock sin pérdida/duplicación |

Los 3 con cleanup aislado por RUN_ID (`neto 0`). Sin residuos.

## Frontend (Codex)

**Sin cambios necesarios.** Firma pública sin cambios. Conservar el mapeo de `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` (ahora solo lo puede emitir `ra_recibir_guia` en su guard imposible).

Flujo completo habilitado: crear guía Arriola→Tienda Principal (o viceversa) aunque el artículo aún no esté en la sucursal destino; al **recibir**, 052 habilita la disponibilidad en destino copiando las condiciones comerciales de origen.

## Datos

No se borró ni alteró ninguna guía ni serie real: 2 guías de Codex en Repuestos Allende y series `005` (Arriola) / `001` (Tienda Principal) — **intactas**.

## Rollback

`rollback-plan-053.md`: `CREATE OR REPLACE` con la versión 051 de `ra_crear_guia` (re-añade la validación de destino). Forward-only; no borra guías ni filas `ra_productos` ya creadas.
