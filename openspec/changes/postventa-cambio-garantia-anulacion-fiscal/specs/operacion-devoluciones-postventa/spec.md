# Especificación: operación de devoluciones postventa

## Propósito

La devolución compensa una venta confirmada mediante registros nuevos,
autorizados e idempotentes. La venta, pagos y libros originales permanecen
append-only. Esta capacidad formaliza recepción operativa, aprobación
documental y liquidación en actos distinguibles.

## Requisito: máquina de estados y migración compatible

La migración DEBE ser `058` o posterior y DEBE preservar sin modificación las
filas creadas por 055. El enum de devolución DEBE añadir `recibida` y
`aprobada`, manteniendo `solicitada`, `liquidada` y `rechazada`.

Las transiciones permitidas son:

```text
solicitada --recepción recibido=true--> recibida --aprobación--> aprobada --liquidación--> liquidada
solicitada|recibida|aprobada --rechazo--> rechazada
solicitada --recepción recibido=false--> solicitada
```

Una constancia con `recibido=false` queda auditada, pero no habilita
liquidación. No existe transición desde `liquidada` o `rechazada`.

### Scenario: solicitudes existentes de 055

- GIVEN una devolución histórica en estado `solicitada` sin constancia de
  recepción
- WHEN se habilita la migración 058+
- THEN la fila no recibe backfill sintético ni se liquida por una ruta de gracia
- AND el vendedor puede registrar una recepción real con la nueva RPC
- AND el administrador puede rechazarla con motivo si ya no procede

### Scenario: transición inválida

- GIVEN una devolución en estado `solicitada`
- WHEN un administrador intenta liquidarla sin recepción y aprobación válidas
- THEN la RPC falla sin efectos de stock, kardex, caja, CxC ni outbox

## Requisito: solicitud y recepción operativa separadas

El vendedor de la sucursal emisora DEBE poder solicitar una devolución con
líneas, cantidades y motivo mediante `ra_solicitar_devolucion_v1`. Esa acción
NO DEBE decidir ni persistir el reingreso a stock como autoridad de negocio.

La nueva RPC `ra_registrar_recepcion_devolucion_v1` DEBE ser accesible al
vendedor autorizado de la sucursal emisora. DEBE registrar, con
`operation_id` y hash idempotente, los campos `recibido`,
`condicion_declarada`, `observacion`, usuario y fecha.

`condicion_declarada` DEBE admitir exclusivamente `apto_reventa`, `dañado`,
`incompleto` y `no_recibido`. `observacion` DEBE ser no vacía cuando la
condición no sea `apto_reventa`. Si `recibido=false`, la condición DEBE ser
`no_recibido`.

### Scenario: solicitud sin efectos comerciales

- GIVEN una venta válida de la sucursal activa
- WHEN un vendedor solicita una devolución con líneas y cantidades válidas
- THEN se crea una devolución `solicitada` y su auditoría
- AND no cambia stock, kardex, caja, CxC ni outbox

### Scenario: vendedor registra recepción apta

- GIVEN una devolución `solicitada` de la sucursal activa
- WHEN el vendedor registra `recibido=true` y `condicion_declarada=apto_reventa`
- THEN la devolución pasa a `recibida`
- AND se guarda su identidad y momento como receptor operativo
- AND el administrador no es asignado automáticamente como receptor

### Scenario: recepción no recibida

- GIVEN una devolución `solicitada`
- WHEN el vendedor registra `recibido=false`, `condicion_declarada=no_recibido`
  y una observación
- THEN el evento queda auditado y la devolución permanece `solicitada`
- AND no se habilita aprobación ni liquidación

## Requisito: aprobación y decisión de reingreso

Solo `administrador` o `superadmin` DEBE poder aprobar, rechazar o liquidar, incluso si opera globalmente sin `sucursal_id`. La recepción física permanece reservada al vendedor de la sucursal emisora.
La nueva RPC idempotente `ra_aprobar_devolucion_v1` DEBE realizar la aprobación
después de una recepción con `recibido=true` y antes de liquidar.

El reingreso a stock DEBE derivarse de la recepción y aprobación, nunca del
payload de solicitud:

- `apto_reventa` aprobado => reingreso permitido;
- `dañado` o `incompleto` => no reingreso por defecto;
- `no_recibido` => liquidación bloqueada.

El administrador PUEDE decidir el resultado conservador de no reingreso aunque
la condición sea `apto_reventa`. Solo PUEDE permitir reingreso de `dañado` o
`incompleto` con `override_motivo` no vacío, guardado en auditoría junto con su
usuario y fecha.

### Scenario: aprobación de pieza apta

- GIVEN una devolución `recibida` con condición `apto_reventa`
- WHEN un administrador la aprueba sin override
- THEN pasa a `aprobada` con reingreso permitido
- AND la aprobación no mueve stock ni dinero todavía

### Scenario: administrador fuerza resultado conservador

- GIVEN una devolución `recibida` como `apto_reventa`
- WHEN el administrador la aprueba con no reingreso
- THEN pasa a `aprobada` y la decisión queda auditada
- AND la liquidación posterior no incrementará stock vendible

### Scenario: override hacia reingreso

- GIVEN una devolución `recibida` como `dañado` o `incompleto`
- WHEN el administrador intenta permitir reingreso sin `override_motivo`
- THEN la operación falla sin cambiar el estado
- WHEN lo hace con un motivo no vacío
- THEN la decisión queda atribuida y auditada antes de liquidar

## Requisito: liquidación económica y stock atómicos

La liquidación DEBE requerir una devolución `aprobada` y una recepción
`recibido=true`. En una única transacción PostgreSQL DEBE crear los efectos
compensatorios autorizados de stock, kardex, caja/CxC, auditoría y outbox NC.
Un fallo revierte todos esos efectos y conserva la devolución en su estado
anterior a la liquidación.

Una pieza con reingreso permitido incrementa solo el producto de la sucursal
emisora y agrega kardex `entrada`/`devolucion`. Una pieza sin reingreso no
incrementa stock vendible, pero la liquidación económica permitida queda
auditada.

### Scenario: caja y crédito

- GIVEN una devolución `aprobada` de una venta con efectivo, medio digital o
  crédito
- WHEN un administrador la liquida con referencias requeridas
- THEN efectivo/digital crea un egreso positivo único desde caja abierta
- AND crédito crea solo un abono compensatorio hasta la deuda atribuible
- AND medios mixtos se distribuyen proporcionalmente con redondeo determinista

### Scenario: caja cerrada o crédito excedido

- GIVEN una devolución `aprobada` que requiere efectivo o reducción de CxC
- WHEN no existe caja abierta o la reducción excede la deuda atribuible
- THEN la liquidación falla sin persistir efectos parciales

## Requisito: idempotencia y concurrencia entre devoluciones distintas

Cada RPC DEBE usar una `operation_id` por acto y rechazar el mismo identificador
con payload materialmente distinto. El lock asesor solo serializa reintentos de
la misma operación; la protección contra sobre-devolución DEBE bloquear y
comprobar las líneas de venta durante liquidaciones de devoluciones distintas.

### Scenario: replay por la misma operación

- GIVEN una solicitud, recepción, aprobación o liquidación confirmada
- WHEN se repite exactamente su `operation_id` y payload
- THEN se devuelve el resultado original marcado como replay
- AND no se duplican auditorías, movimientos, stock ni outbox

### Scenario: dos devoluciones distintas compiten por una línea

- GIVEN una venta de 5 unidades sin devoluciones liquidadas
- AND dos devoluciones diferentes, cada una aprobada por 3 unidades de la misma
  línea de venta
- WHEN ambas liquidaciones usan `operation_id` distintas y se ejecutan a la vez
- THEN solo una puede confirmar la cantidad que no excede 5
- AND la otra recibe `RA_RETURN_QUANTITY_EXCEEDED` sin efectos parciales

## Requisito: aislamiento por empresa y sucursal

RLS DEBE limitar las lecturas al contexto de empresa. Cada RPC DEBE derivar
usuario, empresa, rol y sucursal desde la sesión; no DEBE aceptar esos valores
como autoridad desde tablet o panel. La solicitud, recepción, aprobación,
liquidación y reintento fiscal DEBEN exigir la sucursal emisora.

### Scenario: acceso cruzado

- GIVEN una devolución de otra empresa o una sucursal distinta
- WHEN un usuario intenta leerla o invocar cualquier RPC con su UUID conocido
- THEN no recibe datos ni produce cambios

## Requisito: gate y bandeja fiscal manual

La regla existente `RA_RETURN_FISCAL_RECONCILIATION_REQUIRED` DEBE mantenerse:
una boleta o factura cuya outbox original no sea `accepted` o `rejected` no se
liquida. La UI administrativa DEBE mostrar que el bloqueo proviene del estado
fiscal original y que requiere conciliación, no de un error genérico.

La bandeja manual DEBE presentar estado, último error y acción permitida de la
NC. Solo un administrador autorizado puede reintentar estados que la RPC de
outbox permita. Estados `submitted`, `accepted` y conciliación requerida NO
DEBEN exponer acción de reemisión.

### Scenario: bloqueo fiscal visible

- GIVEN una devolución aprobada cuya venta original tiene outbox `pending`,
  `processing`, `retry`, `submitted` o `dead_letter`
- WHEN un administrador abre el detalle o intenta liquidarla
- THEN ve que requiere conciliación fiscal del comprobante original
- AND la liquidación falla sin dinero, stock, kardex ni nueva NC

### Scenario: nota de crédito aceptada en TEST

- GIVEN una devolución fiscalmente elegible en tenant TEST
- WHEN se emite una NC y se repite el mismo `Idempotency-Key`
- THEN OSE devuelve la misma emisión sin duplicado
- WHEN el payload cambia con la misma clave
- THEN OSE devuelve conflicto y no genera otra NC

## Requisito: límites fiscales de fase 1

La nota de crédito DEBE usar exclusivamente motivo `06` para devolución total
y `07` para devolución por ítem, determinado por las líneas, nunca por la UI.
La capacidad NO DEBE usar `/comprobantes/{id}/anular`, resumen de bajas,
resumen de boletas ni reversión fiscal.
