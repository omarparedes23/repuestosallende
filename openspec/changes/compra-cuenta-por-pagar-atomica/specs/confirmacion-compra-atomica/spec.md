# Spec — confirmacion-compra-atomica

## Propósito

Definir el contrato normativo para confirmar compras y generar sus efectos de inventario y
cuentas por pagar exactamente una vez, mediante una única operación PostgreSQL transaccional.

## Requisitos

### REQ-1 — Confirmación transaccional única

El sistema DEBE confirmar mediante `ra_confirmar_compra` la cabecera, los artículos, la
conciliación de la orden de compra, el stock, el costeo promedio, el kardex, el cargo CxP, el
saldo del proveedor, el abono inicial opcional y la proyección `estado_pago` en una sola
transacción. Ante cualquier fallo, NO DEBE persistir ningún efecto parcial.

#### Escenario: confirmación integral

- GIVEN un administrador autenticado, una sucursal autorizada, un proveedor válido y artículos válidos
- WHEN confirma una compra con un `operationId` nuevo
- THEN se crea exactamente una compra con todos sus efectos asociados
- AND el resultado contiene el identificador, los totales y `replayed: false`

#### Escenario: rollback total

- GIVEN una confirmación que falla después de iniciar sus efectos
- WHEN PostgreSQL aborta la operación
- THEN no queda compra, artículo, kardex, cargo ni abono parcial
- AND el stock, el saldo del proveedor y la orden de compra permanecen sin cambios

### REQ-2 — Contexto autoritativo y autorización

La RPC DEBE derivar usuario y empresa desde `auth.uid()`. El adaptador NO DEBE aceptar del
cliente `empresa_id`, `usuario_id`, totales calculados ni `estado_pago`. Solo los roles
`administrador` y `superadmin` PUEDEN confirmar compras.

#### Escenario: campo autoritativo inyectado

- GIVEN un payload que contiene un campo autoritativo o desconocido
- WHEN `registrarCompra` valida la entrada
- THEN el schema estricto rechaza el payload
- AND la RPC no es invocada

#### Escenario: rol sin permiso

- GIVEN un usuario con rol `vendedor` o `lectura`
- WHEN intenta confirmar una compra
- THEN el sistema devuelve `RA_FORBIDDEN` o su mensaje de dominio equivalente
- AND no persiste efectos

### REQ-3 — Idempotencia y recuperación

Cada recepción lógica DEBE tener un UUID `operationId`. El cliente DEBE conservarlo mientras
el resultado sea incierto y DEBE rotarlo solo tras una confirmación definitiva o al iniciar una
recepción nueva.

#### Escenario: replay idéntico

- GIVEN una compra confirmada para un `operationId`
- WHEN se reenvía el mismo payload con el mismo identificador
- THEN se devuelve la misma compra con `replayed: true`
- AND no se duplica ningún efecto

#### Escenario: conflicto idempotente

- GIVEN una compra confirmada para un `operationId`
- WHEN se reusa el identificador con un payload diferente
- THEN se devuelve `RA_IDEMPOTENCY_CONFLICT`
- AND no se agrega ningún efecto

#### Escenario: resultado incierto

- GIVEN un timeout o error de transporte durante la confirmación
- WHEN el usuario reintenta desde el mismo formulario
- THEN el cliente consulta primero `ra_obtener_resultado_compra(operationId)`
- AND si el resultado existe no reenvía la compra
- AND si no existe reenvía con el mismo `operationId`

### REQ-4 — Documento de proveedor

El sistema DEBE normalizar tipo y número de documento y DEBE impedir duplicados por empresa,
proveedor, tipo y número normalizado. Los documentos vacíos quedan excluidos de la unicidad.

#### Escenario: documento duplicado

- GIVEN una compra existente con la misma identidad documental
- WHEN se intenta confirmar otra compra
- THEN se devuelve `RA_INVOICE_DUPLICATE`
- AND no se persisten efectos adicionales

### REQ-5 — Moneda, importes y abono inicial

Los importes monetarios DEBEN validarse en servidor y calcularse en PostgreSQL. Las compras en
USD DEBEN incluir un tipo de cambio positivo; las compras en PEN NO DEBEN incluirlo. Un abono
inicial DEBE usar un método permitido y NO DEBE superar el total base.

#### Escenario: compra a crédito

- GIVEN una compra válida sin abono inicial
- WHEN se confirma
- THEN se registra un cargo CxP por el total base
- AND `estado_pago` queda `pendiente`

#### Escenario: compra con abono completo

- GIVEN una compra válida con un abono inicial igual al total base
- WHEN se confirma
- THEN cargo y abono se registran en la misma transacción
- AND `estado_pago` queda `pagado`

### REQ-6 — Estado de pago de solo lectura

`estado_pago` DEBE ser una proyección del ledger CxP. La interfaz NO DEBE permitir editarlo y
ninguna server action DEBE actualizarlo directamente.

#### Escenario: consulta desde el panel

- GIVEN una compra visible en el panel
- WHEN el usuario consulta la lista
- THEN el estado se presenta como etiqueta de solo lectura
- AND no existe selector ni acción `actualizarEstadoPago`

### REQ-7 — Retiro del flujo legacy

Las rutas TypeScript de compras NO DEBEN invocar `ra_registrar_compra` ni
`ra_registrar_cargo_compra`. Las RPC legacy PUEDEN permanecer desplegadas durante la transición,
pero DEBEN quedar marcadas como deprecadas para impedir nuevos consumidores.

#### Escenario: inspección del adaptador

- GIVEN el código TypeScript del repositorio
- WHEN se buscan invocaciones de las RPC legacy
- THEN el resultado es cero
- AND `registrarCompra` invoca exclusivamente `ra_confirmar_compra`

## Fuera de alcance

- Notas de crédito y reversos fiscales de compras.
- Eliminación física de las RPC legacy.
- Fases 5 y 6: E2E autenticado, advisors, rollout y verificación final del change.
