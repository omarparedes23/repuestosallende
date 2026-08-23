# Design — compra-cuenta-por-pagar-atomica

Fecha: 2026-08-23. Basado en `exploration.md` (evidencia) y `proposal.md` (alcance).
Incorpora las 4 decisiones del propietario (2026-08-23). Patrón de referencia:
`venta-transaccional-idempotente` (038–040), sin modificar ese change.

## 1. Decisiones de diseño (aprobadas por el propietario)

| # | Decisión | Resolución |
|---|----------|-----------|
| D1 | Unicidad de factura | **Bloqueante**, sobre identidad normalizada del documento; duplicado devuelve código de dominio estable |
| D2 | `estado_pago` | Derivado del ledger CxP; columna como proyección mantenida solo dentro de transacciones CxP; se elimina `actualizarEstadoPago` como mutación independiente |
| D3 | Recepciones parciales | Cada recepción lógica tiene su propio `operation_id` de negocio (reintentos lo reutilizan; recepción nueva = id nuevo); con `request_hash` |
| D4 | Kardex | Nuevo valor de enum `anulacion_compra`; se crea en esta migración para trazabilidad futura, sin implementar flujo fiscal de notas de crédito |

## 2. Arquitectura

### 2.1 Una sola RPC transaccional

`ra_confirmar_compra(p_operation_id uuid, p_empresa_id uuid, p_sucursal_id uuid,
p_proveedor_id uuid, p_nro_documento text, p_notas text, p_items jsonb,
p_orden_compra_id uuid DEFAULT NULL, p_moneda CHAR(3) DEFAULT 'PEN',
p_tipo_cambio NUMERIC DEFAULT NULL, p_tipo_documento TEXT DEFAULT 'FACTURA',
p_abono_inicial JSONB DEFAULT NULL) RETURNS jsonb`

En UNA transacción PostgreSQL:

1. Resolución autoritativa server-side: `auth.uid()` → perfil activo → empresa/sucursal;
   validación de que la sucursal pertenece a la empresa y está autorizada al perfil
   (mismo criterio que `ra_confirmar_venta_v1`). `p_empresa_id`/`p_sucursal_id` se verifican
   contra la sesión, no se confían ciegamente.
2. Validaciones estructurales de items (JSON válido, cantidad > 0, precio >= 0, máx. 200 líneas,
   catálogo perteneciente a la empresa).
3. Normalización del documento: `tipo_documento` upper/btrim; `nro_documento` = `upper(btrim(x))`,
   vacío → NULL.
4. Chequeo de unicidad de factura (D1) → código `RA_INVOICE_DUPLICATE`.
5. Conciliación contra orden de compra si viene vinculada (FOR UPDATE cabecera + línea, igual que
   hoy en 034).
6. Inserción de cabecera (`operation_id`, `request_hash` incluidos) + items.
7. Bloqueo determinista y actualización de stock/costeo/kardex (§2.4).
8. Cargo CxP: insert en `ra_cuentas_por_pagar_movimientos` + incremento de saldo del proveedor
   (misma semántica de la actual `ra_registrar_cargo_compra`, ahora inline).
9. Abono inicial opcional (contado): si `p_abono_inicial` trae `{metodoPago, monto, referencia}`,
   valida monto <= total e inserta el abono + decremento de saldo en la MISMA transacción.
   NULL ⇒ compra a crédito estándar.
10. Proyección de `estado_pago` recalculada inline desde el ledger (§2.5).
11. Cierre de OC a `recibida` si no quedan pendientes.

`EXCEPTION WHEN OTHERS THEN RAISE;` — cualquier fallo revierte TODO (compra, items, stock,
kardex, cargo, abono, saldo, OC). No hay segundo commit.

### 2.2 Retiro de caminos legacy

- El adaptador (`src/app/panel/(dashboard)/compras/actions.ts`) llama únicamente a
  `ra_confirmar_compra`; se elimina la secuencia `ra_registrar_compra` +
  `ra_registrar_cargo_compra` y su manejo de error silencioso.
- La vieja firma `ra_registrar_compra` se marca deprecated en comentario pero NO se elimina en la
  misma migración (forward-only prudente); su retiro definitivo será una migración posterior una
  vez verificado que nada la invoca.
- `actualizarEstadoPago` se elimina como server action y `ComprasView.tsx` deja de ofrecer la
  edición manual (D2).

### 2.3 Idempotencia (secuencial y concurrente)

- Columnas nuevas en `ra_compras`: `operation_id uuid NOT NULL` (para filas nuevas),
  `request_hash text NOT NULL` (hash canónico SHA-256 del payload normalizado, igual técnica que
  la venta: claves ordenadas, numéricos con precisión fija).
- Índice único parcial: `CREATE UNIQUE INDEX idx_compras_operation_id ON ra_compras(empresa_id, operation_id)`.
- **Secuencial**: mismo `(empresa_id, operation_id)` + hash igual ⇒ replay: se devuelve el
  resultado original con `replayed:true` vía `ra_obtener_resultado_compra(p_operation_id)`
  (sin fuga cross-tenant). Hash distinto ⇒ excepción `RA_IDEMPOTENCY_CONFLICT`, cero efectos.
- **Concurrente**: advisory lock por `(empresa_id, operation_id)` (`pg_advisory_xact_lock` hasheado)
  antes de cualquier lectura; dos confirmaciones paralelas del mismo operation_id serializan y
  ambas devuelven la misma compra (una `confirmed`, otra `replayed`) — patrón ya probado en venta.
- **Reintentos tras timeout** (§2.7): el cliente reintenta con el MISMO `p_operation_id`; el
  servidor responde replay o conflicto, nunca duplica.
- Filas históricas (pre-migración): `operation_id` queda NULL mediante DEFAULT NULL en columnas
  nullable + CHECK/índice parcial solo aplica a no-nulas. Las compras históricas no participan
  de la idempotencia (no tienen operación).

### 2.4 Bloqueo determinista ascendente

Antes del loop de efectos, se ordena el array de items por `catalogo_id` ASC (y por
`sucursal_id` implícito único en la llamada) y se ejecutan TODOS los `SELECT ... FOR UPDATE`
de `ra_productos` upfront en ese orden, materializando stock/precio previos en un array; luego
los UPDATE/INSERT de kardex consumen esas lecturas. Esto garantiza:

- orden global de bloqueo consistente entre transacciones concurrentes (sin deadlocks por
  orden inverso);
- lecturas consistentes para el costeo promedio ponderado (dos recepciones simultáneas del
  mismo producto serializan: la segunda ve el stock/costo ya actualizado por la primera).

La conciliación OC bloquea primero la cabecera de la OC y luego sus líneas (orden existente de
034, conservado).

### 2.5 Unicidad y proyección de documento y estado

**Identidad de factura (D1)** — migración forward-only `041_compra_atomica.sql` (número tentativo):

```sql
ALTER TABLE ra_compras ADD COLUMN IF NOT EXISTS tipo_documento TEXT NOT NULL DEFAULT 'FACTURA';
-- normalizado generado para comparar sin depender del cliente
ALTER TABLE ra_compras ADD COLUMN IF NOT EXISTS nro_doc_norm TEXT
  GENERATED ALWAYS AS (NULLIF(upper(btrim(nro_documento)), '')) STORED;

CREATE UNIQUE INDEX uq_compras_factura_proveedor
  ON ra_compras (empresa_id, proveedor_id, tipo_documento, nro_doc_norm)
  WHERE nro_doc_norm IS NOT NULL;
```

- **Sin exclusión de anuladas** (decisión del propietario, 2026-08-23): la unicidad se mantiene
  aunque la compra esté `anulada`. Una anulación conserva la identidad y evidencia del documento;
  una corrección debe hacerse mediante un flujo auditado, nunca registrando otra compra con el
  mismo comprobante.
- Violación detectada ANTES del insert con SELECT EXISTS → `RA_INVOICE_DUPLICATE`
  (nunca se llega a la excepción SQL cruda `unique_violation`).

**Preflight obligatorio antes de crear el índice** (decisión del propietario, 2026-08-23):
consulta read-only de duplicados históricos
`(empresa_id, proveedor_id, upper(btrim(nro_documento))) HAVING count(*) > 1`. Procedimiento:

1. Ejecutar primero en Supabase TEST; resolver manualmente cualquier conflicto encontrado.
2. La migración ABORTA si encuentra duplicados, listando los IDs afectados.
3. Nunca corrige datos automáticamente.
4. El mismo procedimiento preflight→resolver→aplicar se repetirá antes de un despliegue futuro
   a producción.

**`estado_pago` (D2)**:

- Fuente autoritativa: ledger `ra_cuentas_por_pagar_movimientos`
  (saldo_compra = SUM(cargo) - SUM(abono)).
- La columna `ra_compras.estado_pago` se conserva como proyección cacheada por rendimiento,
  recalculada EXCLUSIVAMENTE dentro de las transacciones que tocan el ledger:
  `ra_confirmar_compra` (cargo/abono inicial), `ra_registrar_pago_proveedor` (abono),
  y una nueva `ra_recalcular_estado_pago(p_compra_id)` para reparación auditada.
- Regla de proyección: sin cargo → `pendiente`; 0 < saldo < total → `parcial`;
  saldo <= 0 con cargo → `pagado`. Anulada → n/a (columna queda como esté).
- Se retira el grant/update directo: ninguna política ni código permite UPDATE de `estado_pago`
  fuera de esas RPCs. `actualizarEstadoPago` desaparece del adaptador.

### 2.6 Enum de kardex (D4 — AJUSTADO por el propietario, 2026-08-23)

**Fuera de alcance de esta migración**: el valor `anulacion_compra` NO se crea aquí. Queda
documentado como decisión futura del change de anulaciones/devoluciones, junto con el flujo
fiscal que lo justifique. `ra_anular_compra` permanece SIN CAMBIOS en este alcance (sigue usando
motivo `ajuste_manual`). Motivos vigentes verificados en remoto: `venta,compra,ajuste_manual,
devolucion,merma`.

### 2.7 Timeout y recuperación

- El adaptador genera `operation_id` (UUIDv4) por recepción lógica y lo conserva mientras el
  resultado sea incierto (patrón `pendingSale`, versión panel: persistencia en memoria del
  formulario durante la sesión; recarga de página = operación desconocida, el usuario consulta
  por resultado antes de reenviar).
- Ante timeout/red: el adaptador invoca `ra_obtener_resultado_compra(operation_id)`:
  - `found` → mostrar resultado real, no reenviar;
  - `not_found` → seguro para confirmar de nuevo con el mismo id.
- Nunca generar un operation_id nuevo ante un resultado incierto (convertiría el reintento en
  compra duplicada).

### 2.8 Contado vs crédito

- **Crédito** (default): cargo sin abonos ⇒ `estado_pago pendiente`; pagos posteriores por el
  flujo existente de proveedores.
- **Contado**: `p_abono_inicial` con método distinto de `credito`; cargo + abono en la misma
  transacción ⇒ `estado_pago pagado` al salir de la RPC. Sobrepago rechazado
  (`RA_PAYMENT_EXCEEDS_TOTAL`).

## 3. Autorización

- RPC `SECURITY DEFINER`, `SET search_path = public`, `REVOKE EXECUTE ... FROM PUBLIC/anon`,
  `GRANT EXECUTE TO authenticated`.
- Roles autorizados para confirmar compra (decisión del propietario): **`administrador` y
  `superadmin`**. Explícitamente NO: `vendedor` ni `lectura`. Ambos roles administrativos ya
  existen y las políticas actuales de compras/proveedores los contemplan.
- Aislamiento cross-tenant en `ra_obtener_resultado_compra`: filtrar por empresa del perfil;
  existencia no revelable entre empresas (`not_found` genérico).

## 4. Códigos de error estables

Prefijo `RA_` en `RAISE EXCEPTION USING ERRCODE`/mensaje (mismo estilo de venta):

| Código | Condición |
|---|---|
| `RA_UNAUTHENTICATED` | sin `auth.uid()` o perfil inactivo |
| `RA_FORBIDDEN` | rol sin permiso de compras |
| `RA_BRANCH_INVALID` | sucursal inexistente/ajena/no autorizada |
| `RA_PROVIDER_INVALID` | proveedor inexistente o de otra empresa |
| `RA_PRODUCT_INVALID` | producto/catálogo inexistente o ajeno |
| `RA_ITEMS_INVALID` | payload estructural (vacío, >200, cantidades/precios inválidos) |
| `RA_CURRENCY_INVALID` | moneda/tipo de cambio inconsistentes |
| `RA_ORDER_INVALID` | OC inexistente, no confirmada, línea ajena o excede pendiente |
| `RA_INVOICE_DUPLICATE` | factura ya registrada para el proveedor (D1) |
| `RA_IDEMPOTENCY_CONFLICT` | mismo operation_id, hash distinto |
| `RA_PAYMENT_EXCEEDS_TOTAL` | abono inicial supera el total |
| `RA_PAYMENT_METHOD_INVALID` | abono inicial con método `credito` |

Ningún mensaje expone detalles internos de Postgres; los errores no clasificados salen como
`RA_INTERNAL_ERROR` logueado server-side.

## 5. Migración forward-only

Una sola migración aditiva (sin downgrades), con preflight explícito:

1. `ALTER TYPE ra_motivo_kardex ADD VALUE IF NOT EXISTS 'anulacion_compra'`.
2. Columnas `operation_id`/`request_hash` (nullable) + índice único parcial.
3. Columnas `tipo_documento` + `nro_doc_norm` generada.
4. **Preflight de duplicados** (aborta listando conflictos; no muta datos).
5. Índice único de factura (solo tras preflight limpio).
6. `ra_confirmar_compra` + `ra_obtener_resultado_compra` + `ra_recalcular_estado_pago`.
7. Backfill de `estado_pago` histórico desde el ledger (UPDATE idempotente de proyección).
8. Grants/revokes.
9. Actualización de tipos manuales `src/lib/types/database.ts` (sin `any`).

Registro en ledger: aplicar vía conexión directa y luego INSERTAR entrada en
`supabase_migrations.schema_migrations` (lección aprendida de 038–040, ver Engram/verify-report
del change anterior).

## 6. Estrategia de pruebas (PostgreSQL real)

Entorno: Supabase remoto de pruebas, fixtures TEST aislados (empresa/proveedor/productos/OC),
sesiones simuladas con `request.jwt.claims` — metodología ya validada en el change de venta.

| # | Suite | Demuestra |
|---|-------|-----------|
| 1 | Éxito integral | 1 compra + N items + stock + kardex + 1 cargo + saldo proveedor + estado_pago correcto; conteos exactos SQL |
| 2 | Replay secuencial | mismo operation_id/hash ⇒ misma compra, `replayed:true`, cero efectos nuevos |
| 3 | Conflicto idempotencia | mismo id, hash distinto ⇒ `RA_IDEMPOTENCY_CONFLICT`, cero efectos |
| 4 | Concurrencia de idempotencia | 2 confirmaciones paralelas mismo id ⇒ 1 sola compra |
| 5 | Concurrencia inversa | mismos productos, órdenes inversas en paralelo ⇒ sin deadlock, stock final exacto, kardex encadenado consistente |
| 6 | Recepción parcial OC | 2 recepciones parciales consecutivas cierran OC a `recibida`; línea que excede pendiente ⇒ `RA_ORDER_INVALID` con rollback total |
| 7 | Fault injection | triggers transitorios después de items / kardex / cargo / abono ⇒ rollback TOTAL en cada punto (0 filas residuales, stock intacto) |
| 8 | Unicidad de factura | duplicado exacto ⇒ `RA_INVOICE_DUPLICATE`; mismo número en otra empresa/proveedor ⇒ permitido; NULL/vacío ⇒ excluido; compra anulada libera el número |
| 9 | Contado vs crédito | abono inicial completo ⇒ `pagado`; parcial ⇒ `parcial`; sin abono ⇒ `pendiente`; sobrepago y método credito ⇒ errores estables |
| 10 | Proyección estado_pago | abono posterior vía `ra_registrar_pago_proveedor` actualiza proyección; intento de UPDATE directo bloqueado/denegado |
| 11 | Autorización | sin sesión, rol sin permiso, cross-tenant (proveedor/producto/OC/resultado) ⇒ códigos estables sin fuga de existencia |
| 12 | Timeout recovery | not_found ⇒ reintento confirma; found ⇒ replay sin doble efecto |

Además: `npm test` unitarias (schema zod del adaptador, sanitización de errores) en verde.

## 7. Rollback

- Migración forward-only; sin downgrade scripts. Revert de código es seguro (columnas nullable,
  índices no afectan escrituras legacy).
- Si `ra_confirmar_compra` presenta defectos post-deploy: kill switch operativo = el adaptador
  vuelve temporalmente a… NADA: no existe fallback legacy aceptable. Mitigación: detener el
  rollout, corregir forward-only (patrón 040). Por eso la suite autenticada es puerta de salida
  obligatoria antes de tocar producción.
- `ra_registrar_compra` legacy permanece desplegada (deprecated) hasta verificación posterior,
  pero SIN ruta de llamada desde la UI.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Duplicados históricos reales impidan crear el índice | Preflight aborta listando; resolución manual documentada antes de aplicar |
| Cambio de comportamiento visible (estado_pago ya no editable) | Comunicación al usuario del panel; la vista muestra estado derivado confiable |
| Costeo inline bajo concurrencia alta | Lecturas upfront ordenadas; serialización por fila de producto |
| Deriva de schema manual `database.ts` | Actualización tipada en la misma PR; cast localizado `as never` para RPCs nuevas (aceptado en change anterior) |
| **H1** EXECUTE público (`PUBLIC`+`anon`) sobre las 4 RPCs legacy de compra | `REVOKE` incluido en la migración nueva (preflight 2026-08-23) |
| **H2** `superadmin` sin perfiles reales (0 de 18) | Autorización correcta igualmente; constancia operativa, no bloquea |
| **H3** `estado_pago` escribible a nivel columna vía RLS `compras_mutate` | Trigger guard `BEFORE UPDATE` en la migración (retirar la server action no basta contra cliente malicioso) |

---

# Anexo rev.3 — ra_recalcular_estado_pago y auditoria (043, APLICADA EN TEST)

Decision del propietario (2026-08-23): tabla de auditoria ESPECIFICA
`ra_auditoria_estado_pago_compras` (NO transversal; eso sera un change SDD aparte).
Reconocimiento previo: no existe mecanismo de auditoria en el dominio ra_*.

## Tabla ra_auditoria_estado_pago_compras

| Columna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK RESTRICT | aislamiento |
| compra_id | uuid FK RESTRICT | SIN CASCADE: la evidencia no se borra con la compra |
| operation_id | uuid NOT NULL | idempotencia de reparacion |
| request_hash | text CHECK hex64 | hash canonico de (compra, motivo) |
| usuario_id | uuid NULL | NULL solo para backfill de migracion |
| actor_tipo | text CHECK ('usuario','migracion') | coherencia con usuario_id |
| estado_anterior / estado_nuevo | enum NOT NULL | |
| motivo | text NOT NULL, 1..200 | |
| created_at | timestamptz | |

Unicidad `(empresa_id, operation_id)` => replay sin duplicar auditoria; conflicto si se
reutiliza para otra compra/motivo. Append-only real: RLS solo-SELECT admin/superadmin de
la misma empresa, sin grants de escritura, trigger BEFORE UPDATE/DELETE que rechaza,
FK RESTRICT.

## RPC ra_recalcular_estado_pago(op, compra, motivo)

- auth.uid() -> empresa/rol (administrador/superadmin).
- Idempotencia ANTES de locks: replay devuelve resultado original (replayed:true);
  reutilizacion con otra compra/motivo -> RA_IDEMPOTENCY_CONFLICT.
- FOR UPDATE de la compra (bloqueada durante la reparacion); cross-tenant -> not_found.
- Calculo exclusivo desde ledger CxP + COALESCE(total_pen,total) via
  ra_estado_pago_proyectado.
- Auditoria SIEMPRE (tambien en no-op): habilita replay/conflicto uniformes.
- update de estado + auditoria en una sola transaccion.

## Backfill

Preflight read-only (ra_preflight_estado_pago_divergencias) -> correccion SOLO de
divergentes con auditoria actor_tipo='migracion' (usuario NULL, operation_id
determinista md5('043-backfill-'+id)) -> segunda corrida: cero cambios, cero auditorias.

## Correcciones rev.2 (2026-08-23, revision del propietario)

1. Idempotencia concurrente de reparacion: pg_advisory_xact_lock(empresa, operation_id)
   ANTES de consultar auditoria; prueba concurrente SCN5 (dos sesiones reales sobre
   divergencia sembrada) prevista junto al runner.
2. Replay devuelve el resultado ORIGINAL: changed = estado_anterior IS DISTINCT FROM
   estado_nuevo (no siempre false).
3. Privilegios tabla: REVOKE ALL a PUBLIC/anon/authenticated; GRANT SELECT solo
   authenticated; RLS decide admin/superadmin misma empresa; pruebas de ausencia de
   INSERT/UPDATE/DELETE para authenticated.
4. Contrato unico preflight/backfill documentado en encabezado, design y pruebas:
   preflight read-only ANTES -> conteo e IDs -> autorizacion -> aplicar -> segunda
   corrida cero cambios/cero auditorias.
5. No-op: CONSERVA auditoria (cada operation_id nuevo = exactamente una fila;
   replays no agregan). Encabezado, codigo y design alineados.
