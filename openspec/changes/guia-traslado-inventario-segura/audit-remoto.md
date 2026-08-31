# Auditoría remota read-only — guia-traslado-inventario-segura

Fecha: 2026-08-31
Proyecto Supabase: `axcrubvtpqcyscizgoee` (TEST — único proyecto; no existe otro de producción)
Método: solo `SELECT` / catálogo de sistema. Cero escritura. No se consultó `auth.users` por email de personas reales (solo emails `%test%` para inventario de fixtures).

---

## 1. Ledger de migraciones

`supabase_migrations.schema_migrations` contiene DOS familias:

- Timestamp (Studio / dashboard): `202608...` — categorías, chatbot.
- Repo (`NNN_*`): del **038** al **049**, sin huecos.

| version | name |
|---|---|
| 038 | venta_transaccional_idempotente |
| 039 | venta_idempotencia_hardening |
| 040 | fix_estado_enum_venta |
| 041 | compra_cuenta_pagar_atomica |
| 042 | ra_confirmar_compra |
| 043 | recalcular_estado_pago_compra |
| 044 | deprecar_ra_registrar_compra |
| 045 | seguridad_rpc_multitenant |
| 046 | tesoreria_idempotente_schema |
| 047 | tesoreria_idempotente_rpc |
| 048 | venta_caja_compartida_lock_order |
| 049 | outbox_manual_por_venta |

**Siguiente número disponible: `050`.** No hay divergencia local↔remoto en 038–049.

---

## 2. `public.ra_recibir_guia(uuid)` — definición VIGENTE

La función viva **no** es la de `009_guias.sql`; fue reescrita por **045** (`seguridad_rpc_multitenant`).

| Atributo | Valor |
|---|---|
| Firma | `ra_recibir_guia(p_guia_id uuid)` → `void` |
| Owner | `postgres` |
| `SECURITY DEFINER` | sí |
| `search_path` | `public, pg_temp` (fijo) ✅ |
| Lenguaje | plpgsql |
| ACL | `postgres=X` / `authenticated=X` / `service_role=X` — `anon` y `PUBLIC` revocados ✅ |

Lo que ya hace bien (herencia de 045):
- Deriva `auth.uid()` → `empresa_id`, `rol` desde `ra_perfiles WHERE activo`.
- Exige `rol IN ('administrador','superadmin')` → `RA_FORBIDDEN`.
- `SELECT ... WHERE id = p_guia_id AND empresa_id = v_empresa FOR UPDATE` → un UUID ajeno da `RA_GUIDE_NOT_FOUND` sin filtrar existencia real ✅
- `estado <> 'en_transito'` → `RA_GUIDE_INVALID_STATE` (esto **ya cubre la doble recepción**: la 2.ª llamada, tras el `FOR UPDATE`, ve `recibida`).
- `FOR UPDATE` sobre cada fila de `ra_productos`.
- Códigos estables vía `RAISE EXCEPTION USING MESSAGE = 'RA_...'`.
- Ya **no** tiene el `EXCEPTION WHEN OTHERS THEN RAISE` inútil de 009.

### FALLOS que persisten (a corregir en 050)

| # | Defecto | Efecto | Código faltante |
|---|---|---|---|
| F1 | El descuento de origen está dentro de `IF v_prod_origen_id IS NOT NULL` | Si el catálogo no tiene fila en la sucursal **origen**: NO descuenta, pero SÍ suma en destino → **stock creado de la nada** | `RA_PRODUCT_NOT_FOUND_AT_ORIGIN` |
| F2 | La entrada a destino está dentro de `IF v_prod_destino_id IS NOT NULL` | Si no hay fila en **destino**: la mercadería **desaparece** (sale de origen, no entra a ningún lado) | `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` |
| F3 | No hay comprobación `stock_origen >= cantidad` | Depende del `CHECK (stock_actual >= 0)` de `ra_productos`, que lanza un `check_violation` crudo (sin código de dominio) | `RA_STOCK_INSUFFICIENT` |
| F4 | No valida guía vacía | Marca `recibida` sin efecto | `RA_GUIDE_EMPTY` |
| F5 | `motivo = 'ajuste_manual'` en kardex | El kardex no distingue un traslado de un ajuste de inventario | `motivo = 'traslado'` (requiere ampliar enum) |
| F6 | Efectos parciales | Cada ítem se aplica en su iteración; un fallo en el ítem N deja aplicados 1..N-1 dentro de la misma transacción — el rollback de la función lo revierte, pero no hay una fase de validación previa a la mutación | pre-validación en 2 pasos |

---

## 3. `ra_productos` — índices y checks

| Objeto | Definición |
|---|---|
| `ra_productos_por_sucursal` | **UNIQUE** `(empresa_id, sucursal_id, catalogo_id)` ✅ (una fila por artículo y sucursal → filtrar por sucursal elimina el duplicado del buscador) |
| `ra_productos_stock_actual_check` | `CHECK (stock_actual >= 0)` ✅ (red de seguridad ante F3, pero con error crudo) |
| `idx_productos_sucursal` | `(sucursal_id, activo)` — cubre el nuevo buscador por sucursal |
| FKs | `empresa_id`→`ra_empresas`, `sucursal_id`→`ra_sucursales`, `catalogo_id`→`ra_catalogo_repuestos` |

RLS: `productos_select` (empresa) y `productos_mutate` `FOR ALL` a `administrador`/**`vendedor`** (nota: NO incluye `superadmin`; irrelevante para las RPC `SECURITY DEFINER`, que hacen bypass).

---

## 4. `ra_kardex`

Columnas: `id, empresa_id, catalogo_id, tipo ra_tipo_kardex, motivo ra_motivo_kardex, cantidad, stock_anterior, stock_nuevo, referencia_id, usuario_id, notas, created_at, sucursal_id`.

- `CHECK (cantidad > 0)`.
- `usuario_id` → `auth.users` (nullable).
- `ra_tipo_kardex` = `{ entrada, salida, ajuste }` — la RPC usa `entrada`/`salida` ✅
- `ra_motivo_kardex` = `{ venta, compra, ajuste_manual, devolucion, merma }` — **NO existe `traslado`**.
- RLS: solo `kardex_select` (empresa). Sin política de escritura → escritura exclusiva por RPC `SECURITY DEFINER` ✅

---

## 5. RLS y tablas de guías

| Tabla | RLS | Policies |
|---|---|---|
| `ra_guias_remision` | ON (no forced) | `guias_select` (empresa) · `guias_mutate` `FOR ALL` a `administrador`/`superadmin` de la empresa |
| `ra_guia_items` | ON (no forced) | **solo `guia_items_select`** — NO hay INSERT/UPDATE/DELETE |
| `ra_productos` | ON | select + mutate (admin/vendedor) |
| `ra_kardex` | ON | solo select |

> **Hallazgo:** `ra_guia_items` tiene RLS activo y **ninguna** política de escritura. El `crearGuia` actual (inserción directa vía PostgREST en `guias/actions.ts`) NO puede insertar líneas → dejaría cabecera huérfana o error. Está latente porque hoy hay 0 guías. La corrección correcta es mover TODA la escritura de guías a RPC `SECURITY DEFINER` (como el resto del sistema) y **no** agregar política de INSERT a `ra_guia_items`.

### Estructura

`ra_guias_remision`: `id, empresa_id, sucursal_origen_id, sucursal_destino_id, usuario_id (NOT NULL), estado (default 'borrador'), serie, correlativo int, notas, fecha_emision date (nullable), fecha_recepcion timestamptz (nullable), created_at, updated_at`.
- `CHECK (sucursal_origen_id != sucursal_destino_id)`.
- Trigger `ra_guias_updated_at`.
- **No hay UNIQUE sobre `(empresa_id, serie, correlativo)`** → numeración de guía duplicable.

`ra_guia_items`: `id, guia_id (FK ON DELETE CASCADE), catalogo_id (FK), nombre_producto (NOT NULL), cantidad numeric(10,3) CHECK (cantidad > 0), created_at`.
- **No hay UNIQUE sobre `(guia_id, catalogo_id)`** → líneas repetidas del mismo catálogo permitidas a nivel DB.

`ra_estado_guia` = `{ borrador, emitida, en_transito, recibida }`.

---

## 6. Calidad de datos (conteos agregados)

| Métrica | Valor |
|---|---|
| Total guías | **0** |
| Total ítems | **0** |
| Guías por estado | borrador 0 · emitida 0 · en_transito 0 · recibida 0 |
| Cabeceras sin ítems | 0 |
| Guías con ítem duplicado | 0 |
| Guías no recibidas con producto ausente en origen | 0 |
| Guías no recibidas con producto ausente en destino | 0 |
| Guías no recibidas con stock origen insuficiente | 0 |

**El módulo nunca se usó / fue reseteado.** No hace falta migración de reparación de datos.

---

## 7. Fixtures disponibles para pruebas SQL

| Empresa | id | Roles con usuario | Sucursales |
|---|---|---|---|
| EMPRESA TEST IDEMPOTENCIA | `10101010-1010-4010-8010-101010101010` | administrador, vendedor, lectura (`test.*.idempotencia@test.local`) | `20202020-2020-4020-8020-202020202020`, `21212121-2121-4121-8121-212121212121` |
| EMPRESA TEST OTRA IDEMPOTENCIA | `30303030-3030-4030-8030-303030303030` | vendedor (`test.otraempresa.idempotencia@test.local`) | `40404040-4040-4040-8040-404040404040` |

Suficiente: dos sucursales en la misma empresa (transición + happy path), tres roles (autorización), otra empresa (cross-tenant). Los productos en ambas sucursales se crean dentro del `BEGIN/ROLLBACK` de cada prueba.

---

## 8. Veredicto Fase 1

| Ítem | Estado |
|---|---|
| Ledger reconciliado, siguiente = 050 | **PASS** |
| `ra_recibir_guia` inspeccionada (owner/grants/search_path/def) | **PASS** — segura en tenant/rol, con F1–F6 pendientes |
| UNIQUE `ra_productos` por empresa+sucursal+catálogo | **PASS** (existe) |
| `CHECK stock_actual >= 0` | **PASS** (existe) |
| RLS de las 4 tablas | **PASS** con hallazgo: `ra_guia_items` sin política de escritura |
| Conteos de datos inconsistentes | **PASS** — 0 en todo |
| Datos personales | No se consultaron |

Nada bloquea la Fase 2.
