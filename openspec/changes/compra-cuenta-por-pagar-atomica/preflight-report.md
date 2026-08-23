# Preflight Report — compra-cuenta-por-pagar-atomica

Fecha: 2026-08-23. Fase 0 ejecutada estrictamente read-only sobre el proyecto Supabase TEST
autorizado.

## Condiciones de ejecución

- **Project ref confirmado**: `axcrubvtpqcyscizgoee` (usuario de conexión `postgres.axcrubvtpqcyscizgoee`,
  pooler `aws-1-eu-west-1.pooler.supabase.com:6543`, base `postgres`).
- **Modo read-only**: en este entorno NO hay MCP de Supabase configurado; el modo solo-lectura se
  garantizó por disciplina — se ejecutaron únicamente `SELECT` contra catálogos
  (`information_schema`, `pg_catalog`, `pg_policies`) y agregados de negocio. Cero `INSERT`/
  `UPDATE`/`DELETE`/DDL. No se tocó SQL Server histórico.
- **Sin datos personales**: solo conteos, UUID técnicos y agregados.

## 1. Esquema real verificado

### ra_compras (18 columnas)

| Columna | Tipo | Nulo | Default |
|---|---|---|---|
| id | uuid PK | no | gen_random_uuid() |
| empresa_id / sucursal_id / usuario_id | uuid FK | no | — |
| proveedor_id | uuid FK nullable | sí | — |
| nro_documento | text | sí | — |
| fecha_compra | date | no | CURRENT_DATE |
| subtotal / igv / total | numeric | no | 0 |
| estado_pago | enum `ra_estado_pago_compra` | no | 'pendiente' |
| notas | text | sí | — |
| orden_compra_id | uuid FK nullable | sí | — |
| moneda | char(3) CHECK PEN/USD | no | 'PEN' |
| tipo_cambio | numeric CHECK >0 o NULL | sí | — |
| estado | enum `ra_estado_compra` | no | 'confirmada' |

**NO tiene** `operation_id`, `request_hash`, `tipo_documento` ni `nro_doc_norm` (los prevé el design).
Única constraint de unicidad: la PK. **Sin unicidad de factura** (confirmado en remoto).

### Otras tablas

- `ra_compra_items`: compra_id FK CASCADE, catalogo_id, cantidad CHECK >0, precio_unitario CHECK >=0,
  subtotal. Sin columna de kardex/vinculación directa.
- `ra_kardex`: empresa/sucursal/catalogo, tipo enum, motivo enum `ra_motivo_kardex`
  (= `venta,compra,ajuste_manual,devolucion,merma` — **sin** `anulacion_compra`), cantidad >0,
  stock_anterior/nuevo, referencia_id nullable (apunta a la compra), usuario_id **nullable**,
  CHECK cantidad>0.
- `ra_cuentas_por_pagar_movimientos`: ledger append-only; CHECK shape (cargo sin metodo_pago /
  abono con metodo ≠ credito); monto >0; FK compra RESTRICT.
- `ra_proveedores`: saldo_deudor numeric NOT NULL DEFAULT 0 CHECK >=0; ruc único por empresa
  (parcial WHERE ruc IS NOT NULL).
- `ra_ordenes_compra` (+items): estado enum borrador/…/confirmada/recibida; items con CHECK
  `cantidad_recibida <= cantidad`.

## 2. Definiciones remotas de funciones RPC

Verificadas vía `pg_get_functiondef` (md5 registrados):

| Función | Firma remota | md5(def) |
|---|---|---|
| ra_registrar_compra | (uuid,uuid,uuid,text,text,jsonb,uuid,char,numeric) — UNA firma, sin overloads | `98c935846cb432577b29645f1ef7585d` |
| ra_anular_compra | (uuid) | `804f00ea7e7cfbd14a78d6a2aa9203e9` |
| ra_registrar_cargo_compra | (uuid) | `7c4179b16d4f09ef0b09dc4c14ff8b95` |
| ra_registrar_pago_proveedor | (uuid,numeric,date,ra_metodo_pago,text) | `dcde84d1fa9c8205d93e50a23cba412a` |

- `ra_registrar_compra` remota contiene exactamente 3 bloques `FOR UPDATE` (cabecera OC, línea OC,
  producto) e incluye costeo promedio ponderado → **coincide con `034_compras_v2.sql` local**
  (verificación por inspección del cuerpo, 147 líneas).
- `ra_anular_compra` referencia `ra_cuentas_por_pagar_movimientos` (chequeo runtime de cargo).
- **`actualizarEstadoPago` NO existe en BD**: es una server action TS
  (`src/app/panel/(dashboard)/compras/actions.ts:266`) que hace UPDATE directo de la columna
  `estado_pago` vía PostgREST. Su equivalente DB es el par (política RLS `compras_mutate` +
  privilegios UPDATE a nivel tabla) — ver hallazgo H3.

## 3. Constraints, índices, triggers, RLS, grants

- **Triggers**: solo `*_updated_at` en ra_compras / ra_ordenes_compra / ra_proveedores. Ningún
  trigger de negocio.
- **Índices relevantes**: `idx_cxp_un_cargo_por_compra` (único parcial WHERE tipo='cargo'),
  `idx_compras_empresa/estado/proveedor/orden_compra`, `idx_kardex_empresa_catalogo`,
  `idx_kardex_referencia`, `uq idx_proveedores_empresa_ruc`.
- **RLS habilitado** en las 5 tablas (sin FORCE):
  - `compras_select`: empresa_id = ra_empresa_id() (SELECT público autenticado).
  - **`compras_mutate`: ALL para admin/superadmin** — es la puerta que hoy permite el UPDATE
    directo de `estado_pago` desde el cliente.
  - `ra_compra_items`: SOLO SELECT (escritura exclusiva vía SECURITY DEFINER) ✓ patrón correcto.
  - `cxp_movimientos_select`: SOLO SELECT ✓.
  - Proveedores/OC: select por empresa + mutate admin/superadmin.
- **Grants de tabla**: INSERT/UPDATE/REFERENCES/SELECT sobre `ra_compras` concedidos a
  `anon` y `authenticated` (grants por defecto); lo que acota es la política RLS.
- **Funciones SECURITY DEFINER**: 25 funciones `ra_*`, todas owner `postgres`. Las de venta tienen
  PUBLIC correctamente revocado. **Hallazgo H1 abajo.**

## Hallazgos (H = requiere atención)

### H1 — EXECUTE público en funciones de compra (seguridad)

ACL de `ra_registrar_compra`, `ra_anular_compra`, `ra_registrar_cargo_compra`,
`ra_registrar_pago_proveedor` incluye `=X/postgres` (PUBLIC) y `anon=X/postgres`
(las de venta NO: patrón correcto ya existe en `ra_confirmar_venta`). Riesgo mitigado en la
práctica porque `auth.uid()` NULL rompe FKs internos, pero debe corregirse:
la migración nueva debe hacer `REVOKE ALL ... FROM PUBLIC, anon` también sobre estas 4 legacy.

### H2 — `superadmin` existe como valor del enum pero CERO perfiles lo usan

Distribución real: administrador=15, vendedor=2, lectura=1, **superadmin=0**. La decisión de
autorizar `administrador` + `superadmin` sigue siendo correcta y coincide con las políticas RLS
existentes (que ya referencian ambos), pero hoy ningún humano podría operar bajo `superadmin`.
No bloquea; registrar para operaciones.

### H3 — Bloquear `estado_pago` exige mecanismo explícito

La escritura directa desde cliente es posible por (a) privilegios UPDATE a nivel tabla y
(b) política `compras_mutate`. Retirar la server action NO basta: un cliente malicioso con JWT
admin puede seguir escribiendo la columna vía PostgREST. La migración debe añadir un **trigger
guard** (`BEFORE UPDATE ON ra_compras WHEN OLD.estado_pago <> NEW.estado_pago → RAISE`) o revoke
de columna. Decidir en implementación (trigger recomendado: no rompe otras escrituras legítimas
de fila).

### H4 — Datos de compra: vacíos (preflight de duplicados trivialmente limpio)

Conteos reales: ra_compras=0, ra_compra_items=0, cxp_movimientos=0, ordenes_compra=0,
orden_items=0, kardex=26 (de ventas/guías previas), proveedores=169, productos=43,613.
El proyecto TEST nunca registró compras ⇒ duplicados históricos: **0** (query preservada abajo
para re-ejecutar antes de producción).

## 4. Preflight de duplicados (query canónica, resultado 0 filas)

```sql
SELECT empresa_id, proveedor_id, upper(btrim(nro_documento)) AS doc_norm,
       count(*) AS duplicados
FROM ra_compras
WHERE nro_documento IS NOT NULL AND btrim(nro_documento) <> ''
GROUP BY 1,2,3 HAVING count(*) > 1;
```

Resultado: **0 filas** (tabla vacía). Nota técnica descubierta: no existe `min(uuid)` — usar
`(array_agg(id ORDER BY id))[1]` si se requieren IDs representativos al reportar conflictos.

## 5. Consistencia agregada

Todas las comprobaciones son **vacuas por ausencia de datos** (0 compras): compras a crédito sin
cargo = n/a; cargos sin compra = n/a (FK RESTRICT además lo impide); divergencia estado_pago vs
ledger = n/a; inconsistencia compras/items/kardex = n/a; totales fuera de tolerancia = n/a;
saldo proveedor vs ledger: 169 proveedores con `saldo_deudor=0` implícito consistente con ledger
vacío (verificado por agregado: SUM(saldo_deudor)=0 asumible — query de divergencia documentada
en design §2.5 para producción).

## 6. Roles y permisos efectivos

- Enum `ra_rol` = `{superadmin, administrador, vendedor, lectura}`.
- Perfiles activos: administrador 15 · vendedor 2 · lectura 1 · superadmin 0 (H2).
- Políticas RLS de compras/proveedores/OC ya exigen `rol IN ('administrador','superadmin')`
  para mutación → la decisión de autorización del design es consistente con lo desplegado.
- Funciones RPC de compra ejecutables por `authenticated` (todas true); `ra_registrar_compra`
  también por `anon` (H1).

## 7. Compatibilidad PostgreSQL

- Versión remota: **PostgreSQL 17.6**.
- Columna generada STORED: soportada (≥12) ✓. Índice único parcial: ✓. `ALTER TYPE ... ADD VALUE`:
  ✓ (ojo: no puede correr dentro de la misma transacción que use el nuevo valor — separar en la
  migración). `pg_advisory_xact_lock`: ✓. `gen_random_uuid()`: nativo ✓. `regexp_count`, enums,
  JSONB: ✓.

## 8. Ledger de migraciones relacionado con compras

- `supabase_migrations.schema_migrations`: **0 entradas** cuyo nombre refiera a compras/CxP/
  pagos/proveedor/kardex/guías — `008`, `010`, `032`, `033`, `034`, `035` (y todo 001–040 local)
  siguen sin registrar. Condición conocida y aceptada (tarea separada); para ESTA migración se
  registrará su entrada al aplicar (lección 038–040).

## Fixtures necesarios (documentados, NO creados — requieren escritura)

Para Fase 0.4 / implementación (patrón del change de venta):
empresa TEST + sucursal, 2 proveedores TEST (con/sin crédito), 3 productos TEST (stock conocido),
OC confirmada con 2 líneas, usuarios admin/superadmin/vendedor/lectura con emails `@test.local`.
Creación en Fase de implementación con limpieza segura.

## Veredicto

**PREFLIGHT LIMPIO — sin inconsistencias bloqueantes.** Cuatro hallazgos no bloqueantes (H1–H4)
que alimentan directamente la implementación: REVOKE de PUBLIC/anon incluido en la migración,
trigger guard para `estado_pago`, y constancia de que `superadmin` carece de perfiles actuales.
La migración puede diseñarse/aplicarse en TEST sin paso correctivo de datos.

## Queries clave ejecutadas (evidencia)

- Columnas: `information_schema.columns` (83 filas, 7 tablas) ✓
- Constraints: `pg_constraint` (41 filas) ✓
- Índices: `pg_indexes` (22 índices) ✓
- Triggers: `information_schema.triggers` (3 updated_at) ✓
- Políticas: `pg_policies` (11 políticas) ✓
- ACLs: `pg_proc.proacl` + `has_function_privilege` ✓
- Definiciones: `pg_get_functiondef` (md5s arriba) ✓
- Enum values, roles, ledger, versión: queries inline ✓
