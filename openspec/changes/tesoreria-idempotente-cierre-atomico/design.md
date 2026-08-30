# Diseño — tesorería idempotente y cierre atómico

## Enfoque técnico

Sustituir las escrituras directas y los comandos no idempotentes por RPC
PostgreSQL versionadas. El diseño conserva una sola caja física por sucursal y
usa `ra_cajas` como historial de turnos. Los cobros, pagos y movimientos en
efectivo se enlazan al turno; los instrumentos bancarios/digitales se registran
en el ledger financiero sin alterar el efectivo físico.

El cierre bloquea el turno, recalcula los totales desde la base, crea una
liquidación inmutable y cierra la caja dentro de una sola transacción. La
revisión administrativa de la liquidación es posterior e independiente del
cierre operativo.

## Restricciones verificadas

- `ra_cajas` ya contiene `empresa_id`, `sucursal_id`, usuario responsable,
  monto inicial/final y fechas de apertura/cierre.
- Ya existe un índice parcial que permite una sola caja abierta por sucursal;
  esa cardinalidad coincide con la decisión del negocio.
- `ra_movimientos_caja` registra ingreso/egreso, importe y método, pero las
  escrituras manuales actuales son directas y no idempotentes.
- `ra_liquidaciones` guarda sistema/conteo por método, pero la Server Action
  confía en totales recibidos desde el cliente y después cierra la caja en una
  segunda escritura.
- Los ledgers CxC/CxP guardan método, referencia, usuario y fecha, pero no
  `operation_id`, hash, sucursal de la operación ni vínculo uniforme a caja.
- `ra_confirmar_venta` exige turno abierto y genera movimientos para pagos no
  crediticios; su lock debe coordinarse con el nuevo cierre.
- No existe todavía un maestro profesional de cuentas bancarias; P0 conserva
  método/referencia y separa los importes bancarios, sin afirmar conciliación
  bancaria contable completa.

## Modelo operativo aprobado

```text
Empresa Repuestos Allende
  ├─ Sucursal 1 → un turno abierto como máximo
  ├─ Sucursal 2 → un turno abierto como máximo
  └─ Sucursal 3 → un turno abierto como máximo

Sucursal
  └─ ra_cajas (turnos históricos)
       ├─ ra_movimientos_caja (ledger operativo)
       └─ ra_liquidaciones (snapshot de cierre y revisión)
```

No se crea `ra_puntos_caja` en P0. Varios usuarios pueden operar en la tienda,
pero todos usan el mismo turno abierto y cada movimiento registra su actor.

## Decisiones de arquitectura

| Decisión | Opción elegida | Motivo |
|---|---|---|
| Cardinalidad | Una caja física/un turno abierto por sucursal | Es el modelo real de la empresa y ya está protegido por índice |
| Identidad del turno | Conservar `ra_cajas` | Evita migración destructiva y mantiene historial actual |
| Instrumento financiero | Efectivo exige caja; banco/digital no siempre | Separa cajón físico de tesorería, como los ERP de referencia |
| POS digital | Asociado al turno, separado del efectivo | Permite conciliar el turno sin contar Yape/tarjeta como billetes |
| Crédito | Informativo CxC/CxP | Crear deuda no mueve fondos |
| Idempotencia | `operation_id` + hash en la fila de efecto principal | Replay recuperable sin tabla global innecesaria |
| Concurrencia | Advisory lock de operación + row locks | Serializa replay y protege saldos/cierre |
| Cierre | Una RPC y un commit | Impide liquidación creada con caja abierta |
| Totales | Autoridad exclusiva de PostgreSQL | Evita manipulación o deriva del navegador |
| Revisión | Estado separado de la caja | La siguiente jornada no espera aprobación administrativa |
| Correcciones | Reversos/ajustes auditados | No editar movimientos o snapshots cerrados |

## Clasificación de operaciones

| Operación | `sucursal_id` | `caja_id` | Afecta efectivo | Aparece en resumen |
|---|---:|---:|---:|---:|
| Venta POS efectivo | Sí | Sí | Sí | Sí |
| Venta POS Yape/tarjeta/transferencia | Sí | Sí | No | Sí, sección POS digital |
| Venta POS crédito | Sí | Turno de origen | No | Sí, sección crédito |
| Cobro cliente efectivo | Sí | Sí | Sí | Sí |
| Cobro cliente bancario/digital backoffice | Sí | No | No | Sí, sección bancaria/digital |
| Pago proveedor efectivo | Sí | Sí | Sí, egreso | Sí |
| Pago proveedor bancario | Sí | No | No | Sí, sección bancaria |
| Compra a crédito | Sucursal del documento | No | No | Sí, sección CxP |
| Operación sin movimiento financiero | Según dominio | No | No | No en caja |

## Cambios de datos propuestos

El DDL definitivo depende del preflight remoto. La intención aditiva es:

### `ra_cuenta_corriente_movimientos`

Para abonos nuevos:

- `operation_id uuid`;
- `request_hash text`;
- `sucursal_id uuid`;
- `caja_id uuid null`;
- índice único parcial `(empresa_id, operation_id)`.

Un abono en efectivo requiere `caja_id`; uno bancario/digital de backoffice no.
Los cargos históricos y de venta pueden conservar columnas nuevas nulas y
derivar sucursal desde la venta.

### `ra_cuentas_por_pagar_movimientos`

Mismas columnas y unicidad. La sucursal representa dónde se ejecutó el pago,
no necesariamente la sucursal original de la compra. El cargo de compra no
afecta caja.

### `ra_cajas`

- `operation_id` y `request_hash` para apertura recuperable;
- conservar unicidad parcial de turno abierto por `sucursal_id`;
- `monto_final` representará el efectivo físico contado al cierre, no la suma
  de todos los métodos.

### `ra_movimientos_caja`

- `operation_id` para movimientos manuales o efectos vinculados;
- `usuario_id` real del actor;
- origen tipado/referencia a venta, cobro, pago o ajuste;
- protección append-only para roles cliente;
- unicidad que impida duplicar el efecto financiero de una misma operación.

Las filas POS digitales permanecen asociadas al turno para conciliación, pero
el cálculo de efectivo filtra exclusivamente `metodo_pago='efectivo'`.

### `ra_liquidaciones`

- `operation_id` y `request_hash`, únicos por empresa;
- una liquidación por `caja_id`;
- efectivo esperado, efectivo contado y diferencia;
- snapshots separados de Yape, tarjeta, transferencia y crédito informativo;
- `estado_revision`: `pendiente_revision`, `validada` u `observada`;
- usuario/fecha de cierre y usuario/fecha/motivo de revisión.

Los campos legacy `conteo_yape`, `conteo_tarjeta`, `conteo_transferencia` y
`conteo_credito` dejan de ser autoridad de conteo físico. Su migración/uso
definitivo se decidirá tras inspeccionar datos reales; no se borran en P0.

## Contratos RPC propuestos

Los nombres versionados permiten transición sin modificar silenciosamente una
firma consumida. Las firmas exactas se cerrarán tras preflight.

### Apertura

```sql
ra_abrir_caja_v1(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_monto_inicial numeric,
  p_notas text
) returns jsonb
```

Valida admin/superadmin, sucursal de la empresa, importe y ausencia de otro
turno abierto. Usa advisory lock por sucursal y replay por operación.

### Cobro de cliente

```sql
ra_registrar_cobro_v2(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_venta_id uuid,
  p_monto numeric,
  p_fecha date,
  p_metodo_pago ra_metodo_pago,
  p_moneda_cobro char(3),
  p_tipo_cambio_cobro numeric,
  p_referencia text
) returns jsonb
```

Deriva empresa/usuario, bloquea saldo y evita sobrecobro. Si el método es
efectivo, bloquea primero el turno abierto de la sucursal e inserta el ingreso
de caja junto con el abono. Si no es efectivo, no exige caja.

### Pago a proveedor

```sql
ra_registrar_pago_proveedor_v2(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_compra_id uuid,
  p_monto numeric,
  p_fecha date,
  p_metodo_pago ra_metodo_pago,
  p_referencia text
) returns jsonb
```

Usa saldo PEN base desde ledger. Efectivo crea egreso de caja en el mismo
commit; transferencia/Yape/tarjeta conserva sucursal/método/referencia sin caja.

### Movimiento manual

```sql
ra_registrar_movimiento_caja_v1(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_tipo text,
  p_concepto text,
  p_monto numeric,
  p_notas text
) returns jsonb
```

P0 limita el movimiento manual al efectivo. Otros instrumentos deben proceder
de su ledger de origen para evitar doble contabilización.

### Liquidación y cierre

```sql
ra_cerrar_caja_v1(
  p_operation_id uuid,
  p_caja_id uuid,
  p_efectivo_contado numeric,
  p_notas text
) returns jsonb
```

El cliente no envía totales del sistema ni conteos digitales/crédito.

### Revisión

```sql
ra_revisar_liquidacion_v1(
  p_operation_id uuid,
  p_liquidacion_id uuid,
  p_decision text,
  p_motivo text
) returns jsonb
```

Permite `validada` u `observada`. No modifica snapshots ni reabre la caja.

## Algoritmo de cierre

1. Validar sesión, perfil activo, empresa y rol.
2. Construir intención canónica y adquirir advisory lock de operación.
3. Resolver replay/conflicto por `(empresa_id, operation_id)`.
4. Bloquear `ra_cajas` con `FOR UPDATE` y validar empresa/sucursal/estado.
5. Agregar movimientos persistidos del turno:
   - efectivo neto;
   - Yape neto;
   - tarjeta neta;
   - transferencia neta;
   - crédito derivado de ventas, solo informativo.
6. Calcular:

```text
efectivo_esperado = monto_inicial
                   + ingresos_efectivo
                   - egresos_efectivo
diferencia = efectivo_contado - efectivo_esperado
```

7. Insertar exactamente una liquidación con snapshot y estado
   `pendiente_revision`.
8. Actualizar la caja a cerrada con `monto_final=efectivo_contado`.
9. Retornar el resultado comprometido. Cualquier error revierte pasos 7 y 8.

## Coordinación venta/cierre

`ra_confirmar_venta` y toda RPC que cree movimiento en efectivo/digital del POS
deben bloquear el mismo turno abierto antes de insertar efectos:

- si la venta obtiene el lock primero, el cierre espera y luego incluye su
  movimiento comprometido;
- si el cierre obtiene el lock primero, la venta espera, revalida y falla con
  `RA_CASHBOX_NOT_OPEN`;
- nunca se inserta un movimiento después del snapshot de cierre.

El cambio a la venta será una migración forward-only con pruebas de regresión;
no se editarán las migraciones 038–040 aplicadas.

## Hash e idempotencia

Cada RPC construye JSONB canónico en servidor con UUID, sucursal, documento,
importe normalizado, fecha, método, moneda/tipo de cambio y referencia
normalizada. El hash es SHA-256. Reglas:

- mismo `operation_id` + mismo hash: devolver resultado original con
  `replayed=true`;
- mismo `operation_id` + otro hash: `RA_IDEMPOTENCY_CONFLICT` y cero efectos;
- respuesta perdida: la UI consulta/reintenta con el mismo ID;
- la UI no genera otro ID hasta conocer un resultado definitivo.

## Resumen diario por sucursal

La vista/consulta de tesorería compone, sin duplicar:

1. snapshot del turno para efectivo y POS digital;
2. abonos CxC/CxP no ligados a caja para banco/digital backoffice;
3. cargos/ventas/compras a crédito como información.

Este resumen es lectura derivada; no crea movimientos ni cambia saldos. P0 no
implementa saldo contable bancario ni conciliación automática.

## Seguridad

Todas las firmas:

- `SECURITY DEFINER` solo cuando sea necesario;
- `search_path` fijo;
- `REVOKE ALL` a `PUBLIC` y `anon`;
- `GRANT EXECUTE` mínimo a `authenticated`;
- autorización interna admin/superadmin para apertura, cierre, revisión,
  cobros y pagos;
- errores cross-tenant indistinguibles de `not_found` y cero efectos.

## Pruebas y fault injection

Se requieren:

- replay/conflicto secuencial de cada RPC;
- dos cobros/pagos concurrentes sobre el mismo saldo;
- apertura concurrente de dos turnos en la misma sucursal;
- venta contra cierre concurrente;
- fallo después del abono y antes del movimiento de caja;
- fallo después de liquidación y antes de cerrar turno;
- matriz anon/roles/cross-tenant;
- reconciliación ledger versus saldos cache;
- resumen diario sin doble conteo.

Los hooks de fallo existirán solo en pruebas transitorias, no como bypass
desplegable.

## Despliegue

1. Preflight remoto read-only y decisión sobre datos legacy.
2. Seguridad RPC P0 en verde.
3. Pruebas schema/RPC escritas antes del DDL funcional.
4. Migración aditiva en TEST con autorización.
5. Adaptadores UI manteniendo un único `operationId`.
6. E2E autenticado y concurrencia real.
7. Advisors, ledger y `verify-report.md`.
8. Producción solo con aprobación separada y preflight repetido.

## Rollback

Rollback forward-only: mantener columnas/tables aditivas, revocar la firma nueva
si fuera necesario y restaurar mediante otra migración únicamente un consumidor
autenticado seguro. Nunca se reactivará el cierre directo de dos escrituras ni
se reabrirán permisos anónimos.
