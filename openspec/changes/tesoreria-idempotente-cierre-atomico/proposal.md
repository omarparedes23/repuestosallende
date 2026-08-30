# Propuesta — tesorería idempotente y cierre atómico

## Problema

Los abonos posteriores de clientes y proveedores no son idempotentes, y el
cierre de caja confía en totales del cliente y se ejecuta mediante dos
escrituras. A la vez, la caja está acoplada al POS sin una definición explícita
de si representa un requisito del ERP o un turno operativo.

## Objetivo

Garantizar que cada cobro, pago y cierre se confirme como máximo una vez, con
autorización multitenant, saldos derivados del ledger y cierre atómico. Mantener
una sola caja física por sucursal y una liquidación integral que separe efectivo,
medios digitales, bancos y crédito, sin convertir la caja en requisito universal
del ERP.

## Alcance

### Cobro idempotente

- Nueva RPC versionada para registrar un abono de cliente.
- `operation_id` único por empresa y hash canónico del intento.
- `sucursal_id` de la operación validada contra la empresa y el perfil.
- Bloqueo de venta/cliente y cálculo del saldo desde el ledger.
- Rechazo de sobrepago, moneda/método inválido y conflicto de idempotencia.
- Resultado recuperable después de timeout o recarga.
- Actualización de `saldo_deudor` en la misma transacción.

### Pago a proveedor idempotente

- Mismo contrato para abonos de CxP.
- La compra no afecta caja por sí misma; el método del abono determina su destino.
- Bloqueo de compra/proveedor.
- Importe en PEN base coherente con `total_pen`.
- Proyección de `estado_pago` desde el ledger dentro de la transacción.

### Turno y cierre de caja

- Mantener una sola caja física y un solo turno abierto por sucursal.
- Conservar `ra_cajas` como historial de turnos; no crear `ra_puntos_caja`.
- Mantener caja obligatoria para la confirmación desde el Tablet POS actual.
- Apertura y cierre mediante RPC, no mutación directa desde la UI.
- Cierre con `operation_id`, lock de caja y replay seguro.
- Totales del sistema calculados desde movimientos persistidos.
- Efectivo esperado = monto inicial + ingresos en efectivo - egresos en efectivo.
- Pagos digitales conciliados por separado; crédito solo informativo.
- Inserción de liquidación y cambio a estado cerrada en una transacción.
- Diferencias, usuario, fecha, motivo y eventual autorización auditables.
- Cerrar el turno sin impedir que la liquidación sea revisada posteriormente.

### Clasificación financiera y resumen de sucursal

- Efectivo de tienda: exige turno abierto y crea movimiento de caja.
- Yape/tarjeta/transferencia POS: queda asociado al turno y conciliado por
  separado, sin modificar el efectivo físico esperado.
- Cobro o pago bancario de backoffice: no exige caja; conserva sucursal, método,
  referencia y usuario en el ledger correspondiente.
- Crédito: se muestra como información CxC/CxP y no se suma a fondos recibidos.
- El resumen diario por sucursal compone estas secciones sin mezclarlas.

### Adaptadores UI

- Conservar un solo `operationId` durante reintentos.
- Consultar el resultado antes de crear un intento nuevo tras estado incierto.
- No enviar totales del sistema como autoridad.
- Mensajes sanitizados y estados de replay visibles de forma no disruptiva.

## No alcance

- Núcleo contable completo y asientos de partida doble.
- Conciliación bancaria automática.
- Maestro de cuentas bancarias y saldos bancarios contables.
- Más de una caja física por sucursal.
- Canal de ventas backoffice/ecommerce sin caja.
- Devoluciones, notas de crédito o reversos.
- Cambiar la atomicidad ya verificada de ventas/compras.
- Reparar saldos históricos sin un preflight y autorización separados.

## Criterios de éxito

- Repetir el mismo cobro/pago/cierre devuelve el resultado original sin duplicar.
- Reusar un `operation_id` con otro payload falla sin efectos.
- Dos abonos concurrentes no sobrepagan ni vuelven negativo el saldo.
- Usuario anónimo, rol no autorizado y otra empresa producen cero efectos.
- Un fault injection en cualquier paso revierte ledger, saldo cache, estado,
  liquidación y caja.
- El cierre ignora totales manipulados por cliente y usa únicamente datos de DB.
- No puede existir una liquidación confirmada con su caja todavía abierta.
- `credito` no se suma a fondos esperados ni contados.
- El Tablet POS conserva su operación con turno abierto.
- Nunca existen dos turnos abiertos en la misma sucursal.
- Un pago bancario puede confirmarse sin caja y jamás altera el efectivo físico.
- Un pago en efectivo exige caja abierta y deja un movimiento enlazado al abono.
- El resumen diario explica efectivo, POS digital, bancos y crédito por separado.

## Secuencia propuesta

1. Preflight read-only de saldos, duplicados, cajas y liquidaciones.
2. Especificar contratos exactos y estrategia de migración aditiva.
3. Escribir primero pruebas SQL de esquema, comportamiento y concurrencia.
4. Aplicar en Supabase TEST solo con autorización explícita.
5. Adaptar Server Actions y formularios.
6. Ejecutar E2E autenticado, fault injection y verificación del ledger.
7. Promover sin reactivar silenciosamente rutas legacy inseguras.
