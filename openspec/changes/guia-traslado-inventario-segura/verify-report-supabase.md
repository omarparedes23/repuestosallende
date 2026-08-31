# Verify report — Supabase (migración 050)

Fecha: 2026-08-31 · Proyecto: `axcrubvtpqcyscizgoee` (TEST)

## Estado

| Fase | Resultado |
|---|---|
| Fase 1 — auditoría read-only | **PASS** (ver `audit-remoto.md`) |
| Fase 2 — migración 050 aplicada en TEST | **PASS** |
| Fase 3 — suite SQL `050_guia_traslado.test.sql` (A–G) | **PASS** — 0 residuos |
| Fase 3 — runner de concurrencia (`guia-concurrencia-runner.ps1`, `-Cleanup`) | **PASS** — RUN_ID `7f72990bdc714719bc4e3fcf2f18c270` |
| Registro en ledger `('050','guia_traslado_inventario_segura')` | **HECHO** — verificado |
| Purga de andamiaje del runner (sucursales/productos/kardex `GUIACONC-%`) | **HECHO** — 4/4/4 borrados; residuos = 0 |

## Objetos aplicados (verificado en `pg_proc` / `pg_constraint` / `pg_indexes` / `pg_enum`)

### Enum
`ra_motivo_kardex` → `{venta, compra, ajuste_manual, devolucion, merma, traslado}` ✅

### Tabla `ra_guias_remision`
| Objeto | Definición |
|---|---|
| `ra_guias_numeracion_completa` | `CHECK ((serie IS NULL) = (correlativo IS NULL))` |
| `ra_guias_correlativo_positivo` | `CHECK (correlativo IS NULL OR correlativo > 0)` |
| `ra_guias_numeracion_unica` | `UNIQUE (empresa_id, serie, correlativo) WHERE serie IS NOT NULL AND correlativo IS NOT NULL` |

### Funciones

| Firma | owner | SECURITY DEFINER | search_path | ACL |
|---|---|---|---|---|
| `ra_crear_guia(uuid,uuid,text,integer,text,jsonb)` | postgres | sí | `public, pg_temp` | `postgres=X`, `authenticated=X` |
| `ra_avanzar_estado_guia(uuid,ra_estado_guia)` | postgres | sí | `public, pg_temp` | `postgres=X`, `authenticated=X` |
| `ra_recibir_guia(uuid)` → `jsonb` | postgres | sí | `public, pg_temp` | `postgres=X`, `authenticated=X` |

> `PUBLIC`, `anon` y `service_role`: **sin EXECUTE** (revocados explícitamente). Contrato = `authenticated` únicamente. Verificado en `pg_proc.proacl` = `postgres=X/postgres | authenticated=X/postgres`.

## Suite SQL — cobertura ejecutada (todas PASS)

| Sec | Casos |
|---|---|
| A | sin sesión→`RA_UNAUTHENTICATED`; vendedor/lectura→`RA_FORBIDDEN`; admin→OK |
| B | origen==destino; sucursal ajena; ítems vacío; cantidad≤0; **catalogo_id ausente**; **catalogo_id nulo**; catálogo duplicado; sin producto en origen; **sin producto en destino**; **numeración incompleta (serie sola / correlativo solo)**; **correlativo≤0**; happy path (nombre autoritativo + notas normalizadas); **numeración duplicada**; sin numeración repetible (NULLs no chocan en el índice) |
| C | salto borrador→en_transito rechazado; borrador→emitida (fija `fecha_emision`); emitida→en_transito; retroceso rechazado; emitir guía vacía→`RA_GUIDE_EMPTY`; guía ajena→`RA_GUIDE_NOT_FOUND` |
| D | recepción 2 ítems: stock 42/18/25/5; estado `recibida`; `fecha_recepcion`; **exactamente 1 salida + 1 entrada por artículo, `motivo='traslado'`** |
| E | estado≠en_transito→`RA_GUIDE_INVALID_STATE`; stock insuficiente→`RA_STOCK_INSUFFICIENT`; sin producto en destino→`RA_PRODUCT_NOT_FOUND_AT_DESTINATION`; sin producto en origen→`RA_PRODUCT_NOT_FOUND_AT_ORIGIN`. **Tras cada fallo: 0 kardex, stock intacto, estado intacto** |
| F | doble recepción → 2.ª `RA_GUIDE_INVALID_STATE`, sin duplicar stock ni kardex |
| G | cross-tenant: admin de otra empresa → `RA_GUIDE_NOT_FOUND` en recibir y avanzar |

Post-suite: `ra_guias_remision=0`, `ra_guia_items=0`, `ra_kardex(motivo='traslado')=0`, sin cambios de rol residuales. Cada sección corre en `BEGIN … ROLLBACK`.

## Runner de concurrencia — PASS

Ejecutado contra TEST (conexión directa) con `RUN_ID=7f72990bdc714719bc4e3fcf2f18c270 -Cleanup`:

```
RESULT:recepcion:A:OK:received
RESULT:recepcion:B:ERR:RA_STOCK_INSUFFICIENT
PASS recepcion  (ok=1 insuf=1 origen=2 destino=8 kardex=2 recibidas=1)
RESULT:creacion:A:OK:created
RESULT:creacion:B:ERR:RA_GUIDE_DUPLICATE_NUMBER
PASS creacion   (ok=1 dup=1 persistidas=1)
PASS guia concurrencia  RUN_ID=7f72990bdc714719bc4e3fcf2f18c270
cleanup OK  (items=3, guias RUN_ID borradas=3; guías empresa antes=0 despues=0 -> neto 0, aislado; kardex append-only conservado; sucursales desechables desactivadas)
```

- **recepción** (dos backends reales compitiendo por el mismo stock): `FOR UPDATE` serializó → 1 `received`, 1 `RA_STOCK_INSUFFICIENT`; stock movido una sola vez (10→2 / 0→8); 2 kardex; 1 guía recibida.
- **creación** (dos backends con la misma numeración `TC-<RUN_ID>`-1): 1 `created`, 1 `RA_GUIDE_DUPLICATE_NUMBER`; **1** fila persistida.
- **cleanup aislado**: borró exactamente las 3 guías del RUN_ID; el total de guías de la empresa volvió a 0 (neto 0 → no se tocó nada ajeno). Kardex append-only conservado; sucursales desechables desactivadas.
- Post-run se purgó el andamiaje del runner (todo con prefijo de nombre `GUIACONC-%`): 4 kardex + 4 productos + 4 sucursales. Residuos finales = 0.

## Runner de concurrencia — detalle

`sql/tests/guia-concurrencia-runner.ps1` + `sql/tests/guia-concurrencia.test.sql`. Dos `Start-Job` psql en paralelo.

- **recepcion**: dos guías `en_transito`, mismo producto de origen (stock 10, 8 c/u) → 1 `received` + 1 `RA_STOCK_INSUFFICIENT`; origen 2, destino 8; 2 kardex; 1 guía recibida.
- **creacion**: dos `ra_crear_guia` con `serie='TC-<RUN_ID>', correlativo=1` en paralelo → 1 `created` + 1 `RA_GUIDE_DUPLICATE_NUMBER` (rama `EXCEPTION WHEN unique_violation`); 1 fila persistida.

Correcciones aplicadas a pedido del propietario:
1. **Cleanup aislado por RUN_ID**: filtra solo por `notas LIKE 'GUIACONC:<RUN_ID>:%'` / `'GUIACONC-CREATE:<RUN_ID>:%'`. Serie por corrida `TC-<RUN_ID>` (nunca `serie='TC'` global). Prueba de aislamiento: `Δ(guías empresa) == filas borradas por el DELETE del RUN_ID`.
2. **Sin `:'X'` psql dentro del `DO`**: `SCN/SES/RUN_ID` se pasan con `SELECT set_config('app.guia_*', :'X', false)` y dentro del bloque se leen con `current_setting('app.guia_*', true)`.

Ejecución:
```powershell
$env:DATABASE_URL = '<TEST pooler URL>'
$env:GUIA_TEST_ADMIN_EMAIL = 'test.admin.idempotencia@test.local'
pwsh openspec/changes/guia-traslado-inventario-segura/sql/tests/guia-concurrencia-runner.ps1 -Cleanup
```

## Plan de rollback

`rollback-plan.md` (sin cambios respecto a la versión previa, más `DROP CONSTRAINT` de los dos CHECK nuevos).
