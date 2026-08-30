# Exploración — tesorería idempotente y cierre atómico

Fecha: 2026-08-30
Estado: exploración de solo lectura; no se aplicaron cambios remotos

## Objetivo de la exploración

Definir un modelo profesional para cobros, pagos y control de caja sin asumir
que todo ERP necesita obligatoriamente abrir una caja antes de cualquier
operación.

## Estado actual de Repuestos Allende

### Cobros y pagos posteriores

`registrarCobro()` y `registrarPagoProveedor()` llaman RPC transaccionales, pero:

- no reciben `operation_id`;
- no conservan un hash canónico del intento;
- no pueden recuperar una respuesta perdida;
- un reintento puede insertar un segundo abono si todavía existe saldo;
- su autorización interna y aislamiento multitenant son insuficientes;
- no generan una trazabilidad uniforme hacia una sesión o cuenta de tesorería.

Las tablas de cuenta corriente y CxP son ledgers append-only con cargo único por
venta/compra, lo cual es una buena base. La debilidad está en el comando de
abono posterior.

### Caja y liquidación

`cerrarConLiquidacion()` realiza dos escrituras independientes:

1. Inserta `ra_liquidaciones` con totales recibidos desde el cliente.
2. Actualiza `ra_cajas` a cerrada.

Un fallo entre ambos pasos deja liquidación creada y caja abierta. Además:

- los totales del sistema no se recalculan bajo lock en PostgreSQL;
- el monto inicial no forma parte claramente del efectivo esperado;
- `credito` aparece como importe a contar, aunque no representa fondos en caja;
- abrir/cerrar mediante tabla directa dispersa reglas entre UI, RLS e índices;
- no existe idempotencia para apertura o cierre.

La venta POS actual exige una caja abierta dentro de `ra_confirmar_venta_v1` y
asocia los pagos no crediticios a `ra_movimientos_caja`.

## Comparación con los sistemas de referencia

### `D:\tempo\claudecode\w3sicad`

El código contiene un módulo explícito de tesorería y liquidación:

- `crudTreasuryIO.jsp` permite saldo inicial, movimientos y saldo final por
  tienda/punto de venta;
- ofrece reportes de liquidación vertical, resumida y horizontal;
- `frmTreaIOcierre.jspf` registra el saldo final;
- `daoTreasury.java` calcula saldos por empresa, punto de venta y rango de fecha.

No se encontró en el alcance revisado una entidad equivalente a una sesión
`abierta/cerrada` obligatoria antes de cada venta. Su enfoque es un ledger de
tesorería por punto de venta y una liquidación por período.

### SmartERP / FastERP / ILSpy

`D:\software\allende`, `D:\software\allende\ilspy` y
`D:\software\smarterp` corresponden al mismo sistema de referencia en sus
variantes desplegada, decompilada y modernizada.

FastERP sí tiene un subsistema amplio de liquidación de caja:

- resumen diario por fecha y área;
- ingresos/egresos en PEN y USD;
- efectivo físico declarado;
- depósitos bancarios;
- comparación de tarjetas y Yape registrados/importados;
- facturas a crédito separadas;
- autorización, validación y desautorización;
- procedimientos almacenados específicos de tesorería.

La pantalla de Liquidación de Caja funciona además como centro diario de
tesorería: permite abrir cobros a clientes, pagos a proveedores y pagos varios,
y presenta bancos, depósitos, tarjetas, Yape y facturas a crédito. Esas
operaciones aparecen en la liquidación, pero SmartERP distingue el efectivo
físico de los fondos bancarios/digitales y de la deuda informativa.

Tampoco se observó que toda operación del ERP dependa de una fila de sesión de
caja abierta. El control aparece orientado a conciliación diaria por área/fecha.

### Decisión aprobada para Repuestos Allende

Repuestos Allende es una empresa con varias tiendas físicas y una sola caja
física por tienda. En el modelo del proyecto:

- empresa = Repuestos Allende;
- área/punto de venta de los sistemas de referencia = `ra_sucursales`;
- cada sucursal tiene una sola caja física;
- `ra_cajas` conserva los turnos históricos de esa caja;
- solo puede existir un turno abierto por sucursal;
- no se creará una entidad adicional de punto de caja en este P0;
- todos los usuarios de la tienda registran contra el mismo turno, pero cada
  movimiento conserva el usuario real que lo ejecutó.

La liquidación por sucursal será integral y tendrá secciones separadas:

1. efectivo físico esperado y contado;
2. medios digitales del POS (Yape/tarjeta/transferencia);
3. cobros y pagos bancarios de tesorería;
4. ventas/compras a crédito como información, sin tratarlas como fondos.

Una operación puede pertenecer al resumen diario de una sucursal sin tener
`caja_id`. El instrumento determina el vínculo:

- efectivo de tienda: `sucursal_id` y `caja_id` obligatorios;
- Yape/tarjeta/transferencia del POS: pertenecen al turno para conciliación,
  pero no al efectivo físico;
- cobro/pago bancario de backoffice: `sucursal_id`, método y referencia, sin
  exigir caja abierta;
- crédito: ledger CxC/CxP, sin caja ni banco hasta que exista un abono.

## Conclusión sobre si la caja es necesaria

Una sesión de caja no es requisito universal de un ERP. Sí es necesaria alguna
forma de control cuando existe efectivo físico, múltiples cajeros o un POS de
mostrador.

Para Repuestos Allende:

- **ERP general:** no debe exigir caja para compras a crédito, pagos bancarios,
  ventas de backoffice o movimientos puramente contables, aunque esas
  operaciones pueden aparecer separadas en el resumen diario de tesorería.
- **Tablet POS físico actual:** conviene mantener un turno de caja activo porque
  hay efectivo, Yape, tarjeta, transferencia, varios usuarios y necesidad de
  arqueo.
- **Crédito:** no constituye ingreso de caja y debe mostrarse solo como dato
  informativo de venta/CxC.
- **Futuro canal no POS:** deberá confirmar ventas sin caja mediante un contrato
  separado, no mediante fallback silencioso dentro del RPC actual.

La recomendación aprobada es conservar `ra_cajas` como **turno operativo de la
única caja física de cada sucursal**, no como caja por usuario ni como requisito
global del ERP.

## Riesgos

- Eliminar caja ahora perdería control del efectivo y rompería la RPC de venta.
- Hacerla opcional silenciosamente podría dejar pagos sin cuenta de tesorería.
- Mantener el cierre actual permite estados parciales y manipulación de totales.
- Añadir idempotencia sin un hash canónico no detectaría reuso conflictivo.
- Un pago puede concurrir con otro pago, anulación o reparación de saldo.
- Recalcular saldos cache sin el mismo lock que el ledger puede causar deriva.

## Preguntas resueltas

- La caja se conserva para el Tablet POS actual.
- Existe una sola caja física por sucursal y un solo turno abierto por sucursal.
- No se añadirá `ra_puntos_caja` en el P0.
- No se impone como requisito transversal a todo el ERP.
- El cierre debe ser una sola transacción e idempotente.
- Los totales del sistema se calculan en PostgreSQL.
- Crédito no se cuenta como efectivo ni como medio conciliable recibido.
- Los medios digitales POS pertenecen al turno, pero se concilian aparte.
- Los pagos/cobros bancarios pueden aparecer en el resumen de sucursal sin caja.
- Una compra solo afecta fondos cuando se registra su pago.
- Cobros y pagos posteriores usan idempotencia recuperable.

## Preguntas abiertas para diseño detallado

- Si el primer canal de venta sin caja será backoffice, ecommerce o venta por
  cotización/pedido.
- Umbral de diferencia que requiere autorización adicional.
- Si la primera versión exigirá revisión de todas las liquidaciones o solo de
  aquellas cuya diferencia supere el umbral configurado.
