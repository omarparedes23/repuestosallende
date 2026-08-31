# Especificación — reportes de ventas y cobros

## Propósito

El panel administrativo ofrece un historial de ventas y un historial de cobros
posteriores que preservan la trazabilidad por documento, sucursal y moneda, sin
duplicar un abono que también esté representado en el ledger de caja.

## Requisitos

### Requisito: historial administrativo de ventas

El sistema MUST proveer una vista de panel paginada con una fila por venta. La
vista MUST permitir filtrar por fecha de emisión, sucursal de venta, cliente,
tipo de comprobante y estados comercial/fiscal autorizados.

Cada fila MUST mostrar total persistido, moneda, cliente, sucursal de venta,
pagos originales, crédito, abonos posteriores, saldo derivado y estados
comercial/SUNAT separados.

#### Scenario: venta con pagos y crédito

- GIVEN una venta total PEN 100 con PEN 40 efectivo y PEN 60 a crédito
- AND posteriormente existen dos abonos de PEN 30
- WHEN un administrador consulta Ventas
- THEN la venta aparece una sola vez con total PEN 100
- AND cobrado al emitir es PEN 40
- AND cobrado posteriormente es PEN 60
- AND saldo de crédito es PEN 0
- AND los KPIs de ventas no suman PEN 160

#### Scenario: estado fiscal pendiente visible

- GIVEN una boleta comercial confirmada con estado SUNAT pendiente
- WHEN se consulta el historial de ventas
- THEN la venta permanece visible según el filtro comercial elegido
- AND la UI indica que su estado fiscal está pendiente
- AND la UI no la denomina aceptada por SUNAT

### Requisito: historial de cobros posteriores

Tesorería MUST mantener una bandeja `Por cobrar` para saldos positivos y MUST
proveer una pestaña `Cobros registrados` basada únicamente en movimientos CxC
de tipo `abono`.

La pestaña MUST filtrar por fecha de abono, sucursal receptora, método, cliente,
comprobante y referencia, y MUST mostrar monto y moneda por cada abono.

#### Scenario: deuda totalmente pagada

- GIVEN una factura a crédito con saldo inicial PEN 92
- AND existe un abono posterior PEN 92
- WHEN se actualiza Tesorería
- THEN la factura no aparece en `Por cobrar`
- AND el abono aparece en `Cobros registrados`

#### Scenario: cobro efectivo sin doble conteo

- GIVEN un abono CxC en efectivo PEN 50
- AND el mismo comando creó un movimiento de caja con origen `cobro`
- WHEN se totaliza `Cobros registrados`
- THEN el total de cobros aumenta exactamente PEN 50
- AND no aumenta PEN 100 por leer ambas tablas

### Requisito: semántica correcta de sucursal

El filtro y etiqueta de Ventas MUST usar la sucursal donde se emitió la venta.
El filtro y etiqueta de Cobros registrados MUST usar la sucursal que recibió el
abono. El sistema MUST NOT sustituir una dimensión por la otra.

#### Scenario: venta y cobro en sucursales distintas

- GIVEN una factura emitida en Sucursal A
- AND un abono posterior recibido en Sucursal B
- WHEN se filtra Ventas por Sucursal A
- THEN la factura aparece
- WHEN se filtra Cobros registrados por Sucursal B
- THEN el abono aparece

### Requisito: moneda e histórico trazables

El sistema MUST agrupar KPIs y totales por moneda. MUST NOT sumar PEN y USD sin
una conversión explícitamente aprobada. Una fila histórica sin sucursal
receptora MUST permanecer accesible y mostrarse como `Sin sucursal / histórico`.

#### Scenario: monedas mixtas

- GIVEN cobros PEN 100 y USD 20 en el rango elegido
- WHEN se presentan los KPIs de cobros
- THEN se muestran PEN 100 y USD 20 como importes independientes
- AND no se presenta un total monetario combinado

### Requisito: autorización y ausencia de efectos

Las consultas MUST derivar empresa y permisos desde la sesión del servidor y
respetar RLS. Cargar, filtrar o paginar los reportes MUST NOT crear, editar ni
reintentar ventas, abonos, cajas u operaciones fiscales.

#### Scenario: parámetro de otra empresa

- GIVEN un usuario autenticado de Empresa A
- WHEN altera un parámetro de URL para solicitar datos de Empresa B
- THEN no recibe filas de Empresa B
- AND no se produce ninguna mutación

## Fuera de alcance

Registro o reverso de cobros, conciliación bancaria, contabilidad, conversión
de moneda, reparación histórica y acciones sobre OSE/SUNAT.
