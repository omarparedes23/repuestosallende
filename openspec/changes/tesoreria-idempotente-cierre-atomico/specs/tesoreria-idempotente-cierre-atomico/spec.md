# Especificación — tesorería idempotente y cierre atómico

## Requisito: cobro exactamente una vez

Cada intento lógico de cobro MUST identificarse con un `operation_id` y MUST
crear como máximo un abono. El resultado MUST poder recuperarse.

### Scenario: replay idéntico de cobro

- GIVEN una venta con saldo pendiente
- WHEN se registra el cobro con operación A
- AND se repite A con el mismo payload
- THEN existe un solo abono
- AND el saldo se descuenta una sola vez
- AND la segunda respuesta indica replay

### Scenario: conflicto de cobro

- GIVEN una operación A ya confirmada
- WHEN A se reutiliza con otro monto, método, fecha o documento
- THEN se rechaza por conflicto
- AND no cambia ledger, saldo ni caja

### Scenario: cobros concurrentes

- GIVEN una venta con saldo 100
- WHEN dos transacciones intentan cobrar 80 simultáneamente
- THEN como máximo una confirma
- AND el saldo nunca es negativo

## Requisito: pago a proveedor exactamente una vez

Cada pago de CxP MUST ser idempotente, derivar empresa/usuario desde la sesión y
calcular el saldo desde el ledger bloqueado.

### Scenario: replay de pago

- GIVEN una compra pendiente
- WHEN el mismo pago se reintenta después de una respuesta perdida
- THEN existe un solo abono
- AND `saldo_deudor` y `estado_pago` coinciden con el ledger

### Scenario: moneda base

- GIVEN una compra USD con `total_pen`
- WHEN se registra un pago posterior
- THEN el saldo y el abono se expresan en PEN base según el contrato vigente
- AND no se mezclan montos USD con saldos PEN

## Requisito: autorización de tesorería

Cobros, pagos, apertura y cierre MUST validar `auth.uid()`, perfil activo,
empresa, sucursal aplicable y rol dentro de PostgreSQL.

### Scenario: acceso directo no autorizado

- GIVEN `anon`, rol lectura, vendedor sin capacidad o usuario de otra empresa
- WHEN invoca una RPC de tesorería directamente
- THEN recibe un error estable
- AND no se revela existencia cross-tenant
- AND no existe efecto parcial

## Requisito: caja como turno POS, no requisito global

La caja MUST representar un turno operativo de la única caja física de cada
sucursal. MUST existir como máximo un turno abierto por sucursal y MUST NOT
existir una caja independiente por usuario. El ERP MUST NOT asumir que compras,
pagos bancarios u otros canales futuros requieren turno de caja. El POS actual
MUST seguir validando un turno abierto hasta que exista una especificación
aprobada para otro canal de venta.

### Scenario: tres tiendas de la misma empresa

- GIVEN una empresa con tres sucursales físicas
- WHEN las tres abren su operación diaria
- THEN existe como máximo un turno abierto en cada sucursal
- AND los movimientos y liquidaciones permanecen separados por sucursal
- AND la empresa puede obtener un consolidado sin mezclar los arqueos

### Scenario: venta Tablet POS

- GIVEN una venta iniciada desde el Tablet POS
- WHEN no existe turno autorizado abierto
- THEN la venta se rechaza
- AND no se selecciona otra caja como fallback

### Scenario: operación no POS

- GIVEN un pago a proveedor mediante transferencia
- WHEN se confirma desde tesorería
- THEN su validez no depende de una caja física abierta
- AND conserva trazabilidad del método y usuario

### Scenario: varios usuarios en una tienda

- GIVEN una sucursal con un turno abierto
- WHEN distintos usuarios realizan ventas o movimientos autorizados
- THEN todos usan el mismo turno de la sucursal
- AND cada movimiento conserva el usuario que lo ejecutó

## Requisito: cierre atómico e idempotente

El cierre MUST bloquear la caja, recalcular fondos desde la base, insertar la
liquidación y cerrar la caja dentro de una sola transacción.

### Scenario: cierre exitoso

- GIVEN una caja abierta y conteos declarados válidos
- WHEN un administrador confirma el cierre con operación C
- THEN se crea una sola liquidación
- AND la caja queda cerrada en el mismo commit
- AND los totales del sistema proceden de movimientos persistidos

### Scenario: fallo intermedio

- GIVEN una inyección de fallo después de insertar la liquidación
- WHEN PostgreSQL aborta la operación
- THEN no queda liquidación
- AND la caja permanece abierta

### Scenario: replay de cierre

- GIVEN C ya confirmada
- WHEN se repite C con el mismo conteo
- THEN se devuelve la liquidación original
- AND no se crea otra fila ni se modifica la hora original de cierre

## Requisito: composición profesional del arqueo

El efectivo esperado MUST incluir monto inicial, ingresos y egresos en efectivo.
Yape, tarjeta y transferencia MUST mostrarse como conciliaciones separadas. El
crédito MUST NOT formar parte de fondos físicos o digitales recibidos.

### Scenario: pago a proveedor en efectivo

- GIVEN un pago a proveedor registrado como efectivo en una sucursal
- WHEN se confirma el abono
- THEN existe un turno abierto en esa sucursal
- AND el abono CxP y el egreso de caja se confirman en la misma transacción
- AND ambos quedan relacionados con la misma operación idempotente

### Scenario: pago a proveedor por banco

- GIVEN un pago a proveedor mediante transferencia
- WHEN se confirma el abono para una sucursal válida
- THEN no se exige caja abierta
- AND se conserva método, referencia, sucursal y usuario
- AND no cambia el efectivo esperado de ningún turno

### Scenario: cobro de cliente según instrumento

- GIVEN un cobro posterior de cliente
- WHEN el método es efectivo
- THEN requiere el turno abierto de la sucursal y crea un ingreso de caja
- WHEN el método es bancario o digital fuera del POS
- THEN se registra sin caja física y permanece visible en tesorería

### Scenario: venta a crédito

- GIVEN una venta pagada totalmente a crédito
- WHEN se calcula el cierre
- THEN el importe aparece como información comercial/CxC
- AND no aumenta efectivo, Yape, tarjeta ni transferencia esperados

## Requisito: liquidación integral por sucursal

El resumen diario MUST presentar por separado el efectivo físico, los medios
digitales del POS, los cobros/pagos bancarios y la actividad a crédito. La
presencia de una operación en el resumen MUST NOT implicar que afecte el cajón.

### Scenario: resumen mixto del día

- GIVEN ventas POS, un cobro bancario, un pago a proveedor en efectivo y una
  compra a crédito en la misma sucursal
- WHEN se consulta el resumen diario
- THEN el pago en efectivo afecta el arqueo físico
- AND el cobro bancario aparece en la sección bancaria
- AND la compra a crédito aparece como información CxP
- AND ningún importe se cuenta dos veces

## Requisito: cierre operativo y revisión posterior

El cierre MUST liberar la sucursal para un turno posterior en el mismo commit.
La liquidación MUST conservar un estado de revisión independiente y MUST ser
inmutable en sus totales calculados después del cierre.

### Scenario: cierre pendiente de revisión

- GIVEN un turno abierto con movimientos
- WHEN el responsable entrega su arqueo
- THEN el turno queda cerrado
- AND la liquidación queda pendiente de revisión
- AND puede abrirse el siguiente turno sin modificar la liquidación anterior

## Requisito: invariantes del ledger

Después de todo cobro o pago, el saldo cache MUST coincidir con cargos menos
abonos. Las tablas de movimientos MUST permanecer append-only para usuarios de
aplicación.

### Scenario: verificación posterior

- WHEN se comparan cuentas por cobrar y pagar con sus saldos cache
- THEN no existe divergencia atribuible a las nuevas RPC
- AND ninguna mutación directa amplia está concedida a `authenticated`
