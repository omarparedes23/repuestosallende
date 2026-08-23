# Exploration — compra-cuenta-por-pagar-atomica

Fecha: 2026-08-23. Inspección de código local + esquema real remoto de Supabase
(`axcrubvtpqcyscizgoee`, solo lectura). Change cerrado previo:
`venta-transaccional-idempotente` (no se modifica).

## Estado actual

### Flujo de compras (panel admin)

`registrarCompra` (`src/app/panel/(dashboard)/compras/actions.ts:177-247`) ejecuta **dos RPC
separadas en secuencia**:

1. `ra_registrar_compra` (definida en `supabase/migrations/034_compras_v2.sql:52-229`,
   SECURITY DEFINER): en UNA transacción inserta cabecera + items, concilia contra orden de
   compra (bloqueo FOR UPDATE de OC y líneas), actualiza stock con costeo promedio ponderado,
   inserta kardex (`entrada/compra`) y marca OC como `recibida` si no queda pendiente.
2. `ra_registrar_cargo_compra` (definida en `supabase/migrations/035_cuentas_por_pagar.sql:60-113`,
   SECURITY DEFINER): inserta el cargo en `ra_cuentas_por_pagar_movimientos` e incrementa
   `ra_proveedores.saldo_deudor`.

El propio código documenta el gap (`actions.ts:228-234`): si la segunda RPC falla, la compra queda
registrada (stock/kardex/costeo aplicados) **sin cargo en CxP**, sin revertir; solo se loguea.
Es el mismo gap aceptado en `sdd/cuentas-corrientes/design` (Open Questions).

### Escritores relacionados de stock / kardex / CxP

- `ra_anular_compra` (`034_compras_v2.sql:256-336`): revierte stock + kardex atómicamente;
  rechaza anular si la compra ya tiene cargo CxP (requeriría Nota de Crédito, fuera de alcance v1).
  Kardex de anulación usa motivo `ajuste_manual` porque `ra_motivo_kardex` no tiene `anulacion`.
- `ra_recibir_guia`: otro escritor de stock/kardex (guías de remisión), bloquea la fila cabecera.
- `ra_registrar_pago_proveedor` (`035_cuentas_por_pagar.sql:121-195`): abono contra una compra con
  cargo, FOR UPDATE sobre la compra, valida sobrepago, actualiza saldo del proveedor. Atómico.
- `actualizarEstadoPago` (`compras/actions.ts:266-284`): UPDATE directo del cliente sobre
  `ra_compras.estado_pago` desde `ComprasView.tsx:39`, SIN pasar por el ledger de CxP.

### Esquema real remoto verificado (2026-08-23)

- `ra_registrar_compra(uuid, uuid, uuid, text, text, jsonb, uuid, char, numeric)` — una sola firma,
  sin overloads residuales. Grants a `authenticated`.
- `ra_compras`: 18 columnas (incluye `orden_compra_id`, `moneda`, `tipo_cambio`, `estado` enum
  `confirmada/anulada`). **No tiene** `operation_id` ni `request_hash`.
- **No existe** constraint único sobre `(empresa_id, proveedor_id, nro_documento)` — solo la PK.
- `ra_cuentas_por_pagar_movimientos`: ledger append-only, RLS solo-SELECT para authenticated,
  índice único parcial `idx_cxp_un_cargo_por_compra ON (compra_id) WHERE tipo='cargo'`.
- `ra_proveedores.saldo_deudor`: caché recalculada inline por las RPC.

## Riesgos identificados

### 1. Atomicidad (confirmado, documentado en el propio código)

Fallo (red, timeout, deploy) entre RPC1 y RPC2 → compra con stock/kardex/costeo aplicados y
**deuda fantasma ausente**: el proveedor no figura como acreedor aunque la mercadería ya ingresó.
Estado comercial incorrecto silencioso (solo `console.error`).

### 2. Duplicación / idempotencia

- Sin `operation_id`/`request_hash`: un reintento tras timeout o doble clic registra **dos compras
  completas** (stock duplicado, dos cargos, dos kardex). El índice `idx_cxp_un_cargo_por_compra`
  protege el cargo por compra, pero no evita dos compras idénticas.
- Sin unicidad de `(empresa_id, proveedor_id, nro_documento)`: la misma factura física del
  proveedor puede registrarse dos veces (error humano o reintento), inflando deuda y stock.

### 3. Concurrencia

- `ra_registrar_compra` bloquea filas de producto con FOR UPDATE **en el orden del array jsonb**
  de items, sin ordenamiento determinista. Dos recepciones concurrentes que incluyan los mismos
  productos en distinto orden pueden deadlockear (la venta lo resuelve con orden ascendente;
  compras aún no).
- La conciliación contra OC es correcta (FOR UPDATE de cabecera y líneas), pero la recepción
  parcial concurrente de la misma OC serializa bien solo por ese bloqueo; sin idempotencia, un
  reintento de la misma recepción parcial genera segunda compra legítima pero duplicada en hechos.

### 4. Rollback

- Entre RPC1 y RPC2 no hay rollback posible: RPC1 ya hizo commit.
- `ra_anular_compra` rechaza anular si hay cargo — correcto fiscalmente — pero combinado con el
  gap #1 produce un callejón: si el cargo se registró por error para una compra errónea, no hay
  camino de reversión sin Nota de Crédito (fuera de alcance v1).

### 5. Confianza / integridad de datos

- `actualizarEstadoPago` permite marcar `pagado` desde la UI sin abonos reales en el ledger →
  `estado_pago` puede divergir del saldo real (`cargo - abonos`). Debe derivarse del ledger, no
  escribirse libremente.
- `p_empresa_id` llega como parámetro desde la sesión del servidor (no es client-trusted hoy),
  pero la resolución autoritativa debería seguir el patrón de la venta (auth.uid() server-side).

## Evidencia

| Hecho | Evidencia |
|---|---|
| Gap de atomicidad reconocido | `compras/actions.ts:228-242` (comentario + console.error sin revertir) |
| Dos RPC separadas | `compras/actions.ts:209` y `:236` |
| Sin idempotencia en compras | `ra_compras` remota sin `operation_id`; `034_compras_v2.sql` sin hash |
| Sin unicidad de factura | Remoto: única constraint en `ra_compras` es la PK |
| Orden de bloqueos no determinista | `034_compras_v2.sql:114-201` (loop en orden del array) |
| estado_pago escribible fuera del ledger | `compras/actions.ts:266-284`, `ComprasView.tsx:39` |
| Anulación bloqueada con cargo | `034_compras_v2.sql:283-290` |

## Preguntas abiertas

1. ¿Debe la unicidad de factura ser `(empresa_id, proveedor_id, nro_documento)` con nulos
   excluidos (facturas sin número)? ¿O advertencia no bloqueante?
2. ¿Se mantiene `estado_pago` como columna cacheada derivada del ledger, o se elimina de la UI?
3. ¿Recepciones parciales repetidas de la misma OC requieren idempotencia por operación del
   usuario (mismo patrón operation_id de venta) o basta unicidad de factura + confirmación UX?
4. ¿El costeo promedio ponderado permanece inline en la misma transacción (sí, recomendado)?
5. ¿Kardex necesita motivo específico `anulacion_compra` (nueva migración de enum) o se conserva
   `ajuste_manual`?

## Alcance técnico tentativo (para proposal)

Una única RPC transaccional `ra_confirmar_compra` al estilo de `ra_confirmar_venta`:
cabecera + items + conciliación OC + stock + costeo + kardex + **cargo CxP + saldo proveedor**
en una sola transacción, con `operation_id`/`request_hash` para replay/conflicto, orden de
bloqueo determinista, resolución server-side de identidad, y códigos de dominio estables.
