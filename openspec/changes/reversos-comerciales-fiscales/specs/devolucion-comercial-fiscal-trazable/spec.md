# Especificación: devolución comercial y fiscal trazable

## Propósito

Una devolución compensa una venta previamente confirmada sin borrar ni mutar
sus registros históricos. Toda liquidación se realiza mediante una operación
nueva, idempotente y autorizada.

## Requisito: solicitud y segregación de funciones

El sistema DEBE permitir que un vendedor registrado solicite una devolución de
una venta de su empresa y sucursal emisora, con líneas, cantidades y motivo.
Solo `administrador` o `superadmin` puede aprobar, recibir, liquidar y disparar
el efecto fiscal. En esta entrega esos efectos ocurren en un único acto atómico
cuando la pieza se encuentra físicamente en el mostrador.

### Scenario: vendedor solicita sin liberar dinero

- GIVEN una venta confirmada de la sucursal activa
- WHEN un vendedor registra una solicitud con cantidades válidas
- THEN la solicitud queda trazable sin cambios de stock, caja, CxC ni fiscalidad
- AND el vendedor no puede aprobar ni liquidar esa solicitud

### Scenario: antigüedad sin vencimiento automático

- GIVEN una solicitud sobre una venta antigua de la misma sucursal
- WHEN el administrador revisa la devolución
- THEN el sistema muestra y audita la antigüedad y el motivo
- AND no rechaza automáticamente por una regla de días no configurada
- AND la decisión explícita del administrador queda atribuida

### Scenario: acceso fuera de empresa o sucursal

- GIVEN una venta de otra empresa o de otra sucursal
- WHEN un usuario intenta consultar o solicitar su devolución
- THEN la operación falla sin revelar datos ni generar efectos

## Requisito: devolución parcial idempotente y concurrente

El sistema DEBE limitar cada línea a la cantidad neta vendida menos las
devoluciones ya liquidadas. Esta regla DEBE sostenerse bajo reintentos y
solicitudes concurrentes.

### Scenario: devolución parcial válida

- GIVEN una venta de 5 unidades de una línea sin devoluciones previas
- WHEN un administrador liquida la devolución de 2 unidades recibidas y aptas
- THEN se registra una devolución de 2 unidades
- AND quedan como máximo 3 unidades disponibles para devoluciones posteriores

### Scenario: dos devoluciones concurrentes exceden la venta

- GIVEN una venta de 5 unidades sin devoluciones previas
- WHEN dos operaciones intentan liquidar 3 unidades cada una al mismo tiempo
- THEN solo una operación puede confirmar la cantidad que mantenga el máximo 5
- AND la otra falla sin efectos parciales

### Scenario: replay idempotente

- GIVEN una liquidación confirmada con una `operation_id`
- WHEN el mismo administrador repite exactamente el mismo payload
- THEN recibe el resultado original marcado como replay
- AND no se duplica devolución, stock, kardex, caja, CxC ni outbox

## Requisito: recepción e inventario

El sistema DEBE registrar entrada a stock y kardex únicamente por una unidad
físicamente recibida y autorizada para volver a disponibilidad en la sucursal
emisora.

### Scenario: pieza recibida apta

- GIVEN una devolución aprobada de una pieza vendida por la sucursal emisora
- WHEN el administrador la recibe como apta para reingreso
- THEN aumenta el stock de ese producto en esa sucursal
- AND se inserta un kardex de entrada con motivo `devolucion` vinculado a la
  devolución, no se altera el kardex de venta original

### Scenario: pieza no recibida o no apta

- WHEN no existe recepción física apta
- THEN no se incrementa stock disponible
- AND el flujo de garantía/cuarentena se mantiene fuera de esta capacidad

## Requisito: liquidación económica

El sistema DEBE liquidar una devolución por los medios que financiaron la venta.
Los montos de caja y cuentas corrientes se agregan como movimientos
compensatorios positivos y trazables; no se modifican registros históricos.

### Scenario: devolución con efectivo

- GIVEN una venta pagada con efectivo
- WHEN un administrador liquida una devolución válida
- THEN se crea un egreso desde una caja abierta de la sucursal emisora
- AND el monto no excede el efectivo atribuible a las líneas devueltas

### Scenario: devolución de crédito

- GIVEN una venta con saldo a crédito pendiente
- WHEN un administrador liquida una devolución válida
- THEN se registra un ajuste compensatorio de CxC vinculado a la venta y devolución
- AND no se genera movimiento de caja
- AND la reducción no excede el saldo atribuible a la venta

### Scenario: pago mixto

- GIVEN una venta pagada por más de un medio
- WHEN se liquida una devolución parcial
- THEN el importe se distribuye proporcionalmente entre los medios originales
- AND los medios digitales guardan la referencia de devolución obligatoria

## Requisito: efecto fiscal desacoplado y seguro

El sistema DEBE separar la confirmación comercial local de la comunicación con
OSE/SUNAT, usando una outbox durable exclusiva para notas de crédito.

### Scenario: comprobante original aceptado

- GIVEN una boleta o factura original con estado fiscal `accepted`
- WHEN un administrador liquida una devolución válida
- THEN se confirman de inmediato los efectos comerciales locales
- AND se crea en la misma transacción una única outbox de nota de crédito con
  identidad propia, documento original, moneda coincidente y clave idempotente
- AND la respuesta OSE no bloquea el reembolso

### Scenario: motivo fiscal determinado por las líneas

- GIVEN una devolución sobre una boleta o factura originalmente aceptada
- WHEN la devolución cubre todas las líneas y cantidades de ese comprobante
- THEN la outbox registra el motivo SUNAT `06` (devolución total)
- AND en cualquier otro caso registra el motivo `07` (devolución por ítem)
- AND ningún cliente puede elegir ni alterar ese código fiscal

### Scenario: fallo posterior de OSE

- GIVEN una devolución comercial ya confirmada y nota de crédito `pending` o
  `retry`
- WHEN OSE no responde o devuelve un error temporal
- THEN no se revierten caja, CxC, stock ni kardex
- AND la outbox conserva error, intento y programación de conciliación/reintento

### Scenario: estado fiscal original incierto

- GIVEN una boleta o factura original con outbox `pending`, `retry`, `processing`,
  `submitted` o `dead_letter`
- WHEN un administrador intenta liquidar la devolución automáticamente
- THEN la operación se bloquea sin efectos económicos ni de inventario
- AND se requiere conciliación fiscal explícita

### Scenario: comprobante original rechazado

- GIVEN una boleta o factura con rechazo fiscal final
- WHEN un administrador liquida la devolución
- THEN puede completar el reverso comercial sin crear nota de crédito
- AND el resultado indica que no existe documento fiscal emitido que modificar

## Requisito: preservación de evidencia

El sistema DEBE poder explicar una devolución desde la venta original, sus
líneas, los movimientos compensatorios y, si corresponde, la nota de crédito.

### Scenario: auditoría de una devolución

- GIVEN una devolución liquidada
- WHEN un administrador consulta su detalle
- THEN puede identificar venta, líneas, cantidades, motivo, solicitante,
  aprobador, receptor, liquidador, movimientos económicos, kardex y estado fiscal
- AND los registros originales de venta y pago permanecen sin edición
