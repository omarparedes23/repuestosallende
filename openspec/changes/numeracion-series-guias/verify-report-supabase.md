# Verify report — Supabase (migración 051)

Fecha: 2026-08-31 · Proyecto: `axcrubvtpqcyscizgoee` (TEST)

## Estado

| Ítem | Resultado |
|---|---|
| Auditoría read-only (ledger, esquema, `ra_siguiente_correlativo`) | **PASS** — `audit-remoto.md` |
| 051 aplicada en TEST (tabla + preview + reescritura `ra_crear_guia`) | **PASS** |
| Suite SQL `051_numeracion_series.test.sql` (A–G) | **PASS** — 0 residuos en la empresa de prueba |
| Runner de concurrencia (`guia-numeracion-concurrencia-runner.ps1 -Cleanup`) | **PASS** — RUN_ID `5e7d396967864b21b80c65b9b47160ab` |
| Registro en ledger `('051','numeracion_series_guias')` | **HECHO** |
| **Configuración real de series** | **NO insertada** — pendiente de confirmación del propietario |

## Objetos aplicados

### Tabla `public.ra_series_documento`
- Columnas: `id, empresa_id (FK ra_empresas ON DELETE CASCADE), sucursal_id (FK ra_sucursales), tipo_documento, serie, siguiente_correlativo, activo, es_predeterminada, created_at, updated_at`.
- CHECKs: `siguiente_correlativo > 0`; `tipo_documento IN ('guia_remision')`; `serie = btrim(serie) AND serie <> '' AND char_length(serie) <= 20`.
- Índices únicos: `ra_series_suc_serie_unica (empresa_id, sucursal_id, tipo_documento, serie)`, `ra_series_empresa_serie_unica (empresa_id, tipo_documento, serie)` (una serie = una sucursal), `ra_series_una_predeterminada (empresa_id, sucursal_id, tipo_documento) WHERE activo AND es_predeterminada`.
- Índice de lookup: `idx_series_lookup (empresa_id, sucursal_id, tipo_documento) WHERE activo`.
- Trigger `ra_series_documento_updated_at` → `ra_set_updated_at()`.
- RLS ON; política `ra_series_documento_select` (SELECT, `empresa_id = ra_empresa_id()`). Sin política de escritura.

### Funciones

| Firma | SECDEF | search_path | ACL |
|---|---|---|---|
| `ra_obtener_preview_serie_guia(uuid)` → jsonb | sí | `public, pg_temp` | `postgres=X`, `authenticated=X` |
| `ra_crear_guia(uuid, uuid, text, jsonb)` → jsonb | sí | `public, pg_temp` | `postgres=X`, `authenticated=X` |

`PUBLIC`, `anon`, `service_role` → sin EXECUTE. La firma vieja de 6 argumentos (`…text, integer, text, jsonb`) **fue eliminada** (`DROP FUNCTION`); solo existe la de 4 args.
`ra_siguiente_correlativo(uuid,text)` (MAX+1 sobre `ra_ventas`) **no se tocó ni se llama**.

## Suite SQL — cobertura (todo PASS)

| Sec | Casos |
|---|---|
| A | auth: `ra_crear_guia` sin sesión→`RA_UNAUTHENTICATED`; preview sin sesión→`RA_UNAUTHENTICATED`; vendedor/lectura→`RA_FORBIDDEN` en crear; **preview de vendedor devuelve `001-00000006`** (sin gate de rol, sí de empresa); admin crea OK |
| B | preview: sin serie→`RA_GUIDE_SERIES_NOT_CONFIGURED`; sucursal ajena→`RA_GUIDE_INVALID_BRANCH`; con serie→`serie='001'`, `siguiente_correlativo=6`, `numero_preview='001-00000006'`; **dos previews NO reservan** (siguiente sigue en 6) |
| C | crear: origen sin serie→`RA_GUIDE_SERIES_NOT_CONFIGURED` sin insertar nada; con serie (001, sig 6)→guía nace `serie='001' correlativo=6`, `numero='001-00000006'`, estado `borrador`, `fecha_emision` NULL, notas normalizadas; `siguiente_correlativo`→7; segunda guía→`001-00000007`, sig→8 |
| D | validaciones de 050 preservadas (`RA_GUIDE_SAME_BRANCH`, `RA_GUIDE_EMPTY`, `RA_GUIDE_DUPLICATE_ITEM`, `RA_PRODUCT_NOT_FOUND_AT_ORIGIN`, `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`, `RA_GUIDE_ITEM_INVALID`); **ninguna consumió el correlativo** (sig sigue en 6) ni creó guía |
| E | `ra_series_documento`: dos predeterminadas activas mismo (empresa,sucursal,tipo)→`unique_violation`; misma serie en dos sucursales→`unique_violation`; `siguiente_correlativo=0`→`check_violation`; `tipo_documento='factura'`→`check_violation`; predeterminada nueva OK si la anterior quedó inactiva |
| F | pipeline con firma 051: crear (`001-00000006`) → emitir (fija `fecha_emision`) → en_transito → recibir (stock 50→42 / 10→18; 2 kardex `motivo='traslado'`) |
| G | guía nace con `fecha_emision` NULL; `COALESCE(fecha_emision, created_at)` no da fecha vieja |

Cada sección corre en `BEGIN … ROLLBACK`. Post-suite: `ra_series_documento=0`, guías de la empresa de prueba `=0`.

## Runner de concurrencia — PASS

```
RESULT:crea:A:OK:C5e7d3969:6
RESULT:crea:B:OK:C5e7d3969:7
PASS guia numeracion concurrencia  RUN_ID=5e7d396967864b21b80c65b9b47160ab  (correlativos=6,7 siguiente=8 guias=2)
cleanup OK  (items=2, guias RUN_ID=2; guías empresa antes=0 despues=0 -> neto 0, aislado)
```

Dos `ra_crear_guia` en backends paralelos desde la misma sucursal origen (serie con `siguiente_correlativo=6`): el `SELECT … FOR UPDATE` sobre la fila de serie serializó → correlativos **6 y 7**, distintos y consecutivos; `siguiente_correlativo` terminó en **8**; 2 guías persistidas. Cleanup aislado por RUN_ID (marcas `GUIANUM:<RUN_ID>:*`, sucursales `md5('guianum-o|d-<RUN_ID>')`, serie `C<8hex>`); borró exactamente 2 guías + su serie + sus productos/sucursales; total de guías de la empresa volvió al valor previo. Sin residuos.

## Observaciones

- **Hay 2 guías preexistentes en la empresa real "Repuestos Allende E.I.R.L."** (`serie=NULL` recibida; `serie='T001' correlativo=5` borrador), creadas hoy por las pruebas de integración de Codex contra la firma 050. **No se tocaron.**
- Al reemplazar `ra_crear_guia` por la firma de 4 args, **la llamada actual del frontend de Codex (6 args, con serie/correlativo del cliente) queda incompatible**. Codex debe migrar a: `rpc('ra_crear_guia', { p_sucursal_origen_id, p_sucursal_destino_id, p_notas, p_items })` + usar `rpc('ra_obtener_preview_serie_guia', { p_sucursal_id })` para el preview. Nuevo código de dominio: `RA_GUIDE_SERIES_NOT_CONFIGURED`.

## Pendiente para activar (requiere confirmación del propietario)

Insertar en `ra_series_documento` (una fila por sucursal emisora):

| Dato | Pregunta |
|---|---|
| ¿Qué sucursal emite la serie `001`? | Nicolas Arriola (`d7931340-…`) o Tienda Principal (`b2c3d4e5-…`) |
| ¿Su `siguiente_correlativo` real es `6`? | confirmar el próximo número de guía a emitir |
| Para la otra sucursal | definir su serie propia y su `siguiente_correlativo` |

## Rollback

`rollback-plan.md`: restaurar la firma 050 de `ra_crear_guia` con una migración nueva, `DROP FUNCTION ra_obtener_preview_serie_guia`, `DROP TABLE ra_series_documento`. Forward-only; no se reutilizan correlativos ya asignados.
