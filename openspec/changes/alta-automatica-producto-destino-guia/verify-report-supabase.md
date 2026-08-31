# Verify report — Supabase (migración 052)

Fecha: 2026-08-31 · Proyecto: `axcrubvtpqcyscizgoee` (TEST)

## Estado

| Ítem | Resultado |
|---|---|
| Auditoría read-only (ledger, `ra_recibir_guia` viva, columnas `ra_productos`) | **PASS** — `audit-remoto.md` |
| 052 aplicada en TEST (`CREATE OR REPLACE ra_recibir_guia`, firma sin cambios) | **PASS** |
| Suite SQL `052_alta_automatica_destino.test.sql` (A–D) | **PASS** — 0 residuos |
| Runner de concurrencia (`guia-alta-destino-concurrencia-runner.ps1 -Cleanup`) | **PASS** — RUN_ID `cd90663a7f1e4e31b7281a946ed0a768` |
| Registro en ledger `('052','alta_automatica_producto_destino_guia')` | **HECHO** |

## Objeto aplicado

`public.ra_recibir_guia(p_guia_id uuid)` → `jsonb` — **misma firma** (`CREATE OR REPLACE`, sin `DROP`).
`SECURITY DEFINER`, `search_path = public, pg_temp`. ACL: `postgres=X`, `authenticated=X` (anon / PUBLIC / service_role sin EXECUTE).

Cambio respecto de 050/051: en el Loop 1 de validación, cuando falta la fila `ra_productos` en destino, en lugar de `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` se hace:

```sql
INSERT INTO public.ra_productos (
  empresa_id, sucursal_id, catalogo_id,
  codigo_interno, precio_venta, precio_venta_dolar, precio_compra,
  stock_minimo, moneda, stock_actual, activo)
SELECT v_empresa, v_guia.sucursal_destino_id, o.catalogo_id,
       o.codigo_interno, o.precio_venta, o.precio_venta_dolar, o.precio_compra,
       o.stock_minimo, o.moneda, 0, true
FROM public.ra_productos o WHERE o.id = v_po_id
ON CONFLICT (empresa_id, sucursal_id, catalogo_id) DO NOTHING;
-- luego: SELECT ... FOR UPDATE de la fila destino (ya siempre existe)
```

- Copia de la fila origen: `codigo_interno`, `precio_venta`, `precio_venta_dolar`, `precio_compra`, `stock_minimo`, `moneda`.
- Fija: `stock_actual = 0`, `activo = true`, `empresa_id`, `sucursal_id = destino`, `catalogo_id`.
- **No** toca `ra_catalogo_repuestos`.
- **No** sobrescribe una fila destino existente (`ON CONFLICT DO NOTHING`).
- Seguro ante concurrencia por el índice único `ra_productos_por_sucursal (empresa_id, sucursal_id, catalogo_id)`.
- Guard defensivo: si tras el upsert la fila destino aún no aparece (caso imposible), `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` — sin efecto parcial.
- Todo lo demás (auth, `FOR UPDATE`, orden canónico por `catalogo_id`, `RA_STOCK_INSUFFICIENT`, kardex `traslado`, `estado='recibida'`, atomicidad) intacto.

## Suite SQL — cobertura (todo PASS)

> Nota: 051 exige que el catálogo exista en origen **y** destino al **crear** la guía. El escenario "destino ausente al recibir" ocurre cuando la fila destino se pierde **entre** creación y recepción. Los tests lo simulan borrando la fila destino tras poner la guía `en_transito`.

| Sec | Casos |
|---|---|
| **A** | Destino borrado tras crear → recibir: se re-habilita **1** fila destino; `stock_actual=8` (0+8), `activo=true`, `codigo_interno/precio_venta/precio_venta_dolar/precio_compra/stock_minimo/moneda` **copiados de origen**; origen 50→42; 2 kardex `traslado`; guía `recibida` |
| **B** | Destino **existente** con atributos locales distintos (`codigo_interno='LOCAL-DEST'`, `precio_venta=999`, `precio_compra=555`, `stock_minimo=50`, `moneda='USD'`) → recibir: **atributos intactos**, solo `stock_actual` 10→16; 1 sola fila |
| **C** | Sin efecto parcial: (C1) estado ≠ `en_transito` → `RA_GUIDE_INVALID_STATE`, **no** crea fila destino; (C2) stock insuficiente → `RA_STOCK_INSUFFICIENT`, **el upsert de destino se revierte** (0 filas destino, 0 kardex, origen intacto, estado `en_transito`); (C3) producto ausente en origen → `RA_PRODUCT_NOT_FOUND_AT_ORIGIN` **antes** del upsert, sin fila destino |
| **D** | Multi-ítem: `c1` con destino existente (atributos intactos, 4→7) + `c2` con destino borrado tras crear (se crea con atributos de origen, 0→7); origen `c1` 30→27, `c2` 30→23; 4 kardex |

Cada sección `BEGIN … ROLLBACK`. Post-suite: 0 series/guías/productos de prueba residuales en la empresa 10101010.

## Runner de concurrencia — PASS

```
RESULT:recibe:A:OK:received
RESULT:recibe:B:OK:received
PASS alta destino concurrencia  RUN_ID=cd90663a7f1e4e31b7281a946ed0a768  (filas destino=1 destino=10 origen=10 kardex=4 cod='ORIG-cd90663a')
cleanup OK  (items=2, guias RUN_ID=2; guías empresa antes=0 despues=0 -> neto 0, aislado; andamiaje de sucursales desechables purgado)
```

Dos guías, mismo catálogo, mismo origen → mismo destino **sin** fila `ra_productos` para ese catálogo (borrada tras crear). Recepción en **dos backends paralelos**:
- **exactamente 1** fila destino habilitada (el índice único + `ON CONFLICT DO NOTHING` impide la segunda),
- `destino = 10` (5+5), `origen = 10` (20−5−5): stock **ni perdido ni duplicado**,
- `codigo_interno` de la fila nueva = el de origen,
- 4 kardex (salida+entrada por guía),
- ninguna recepción devolvió `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`.

Cleanup aislado por RUN_ID (marcas `ALTADEST:<RUN_ID>:*`, sucursales `md5('altadest-o|d-<RUN_ID>')`, serie `A<8hex>`); borró exactamente 2 guías + serie + productos + sucursales + su kardex; total de guías de la empresa volvió al valor previo.

## Frontend (Codex)

**Sin cambios necesarios.** La firma `ra_recibir_guia(p_guia_id uuid)` no cambió y el flujo de recepción usa la misma RPC. Conviene mantener el mapeo defensivo de `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` (ahora solo se emite en el caso imposible / guard).

## Rollback

`rollback-plan.md`: `CREATE OR REPLACE` con la versión 050/051 de `ra_recibir_guia` (validación estricta). No borra filas de `ra_productos` ya creadas ni altera kardex. Forward-only.
