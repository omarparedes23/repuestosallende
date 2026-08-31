# Propuesta — reportes de ventas y cobros

## Problema

Una venta a crédito desaparece de la bandeja de Tesorería al quedar pagada, lo
cual es correcto para una cola de pendientes, pero deja sin un listado global
de los cobros recibidos. Tampoco existe en el panel un historial administrativo
de ventas con sus pagos, crédito, sucursal y estado fiscal.

## Objetivo

Proveer visibilidad administrativa y auditable de:

1. todas las ventas comerciales, con desglose financiero por documento; y
2. todos los abonos posteriores a crédito, incluso cuando la deuda ya esté
   saldada.

## Alcance

### Panel → Ventas

- Nueva ruta administrativa de historial de ventas.
- Filtros por rango de fechas, sucursal de venta, cliente, tipo de comprobante
  y estados comercial/fiscal.
- KPIs y resultados agrupados por moneda.
- Una fila por venta con total, pagos registrados al emitir, crédito, cobros
  posteriores, saldo derivado y estados visibles.
- Acceso al detalle existente del comprobante cuando el usuario esté autorizado.

### Tesorería → Cobros registrados

- Conservar la bandeja actual como pestaña `Por cobrar`.
- Añadir pestaña `Cobros registrados` basada exclusivamente en abonos de CxC.
- Filtros por fecha de cobro, sucursal receptora, método, cliente, comprobante
  y referencia.
- Mostrar fecha, comprobante, cliente, sucursal receptora, método, monto,
  referencia, caja y usuario cuando estén disponibles.
- KPIs por moneda y resultados paginados.

### Reglas transversales

- Nunca sumar `ra_movimientos_caja` junto al abono CxC para totalizar cobros.
- Distinguir en etiquetas y filtros sucursal de venta de sucursal receptora.
- Mantener PEN/USD separados.
- Mostrar datos históricos sin sucursal como `Sin sucursal / histórico`.
- Aplicar autorización de empresa/sucursal en servidor y respetar RLS.

## Fuera de alcance

- Registrar, editar, anular o revertir ventas, abonos o caja desde estas vistas.
- Conciliación bancaria, contabilidad o conversión monetaria consolidada.
- Cambiar el flujo POS de `/tablet/ventas`.
- Reparar o completar datos históricos.
- Cambiar estados OSE/SUNAT, reintentar emisión o resolver rechazos fiscales.
- Crear una tabla de reporting o vista materializada sin evidencia de necesidad.

## Criterios de aceptación

1. Una venta aparece una sola vez en el historial, independientemente de cuántos
   pagos o abonos tenga.
2. El total de ventas no incluye nuevamente los abonos posteriores de crédito.
3. Un cobro posterior en efectivo aparece una sola vez en `Cobros registrados`.
4. Un documento totalmente pagado deja `Por cobrar` pero permanece en `Cobros
   registrados` mediante sus abonos.
5. Los filtros de venta usan sucursal de emisión y los filtros de cobro usan
   sucursal receptora, sin intercambiarlas.
6. Los totales PEN y USD se muestran separados.
7. Estados comercial y SUNAT son distinguibles; ningún estado fiscal se infiere
   como aceptado si no lo está.
8. Datos y acciones de detalle quedan limitados a la empresa/sucursales y rol
   del usuario autenticado.

## Capacidades

### Nuevas

- `reportes-ventas-cobros`: consulta paginada de ventas financieras e historial
  de abonos CxC, con filtros administrativos y prevención de doble conteo.

### Modificadas

- `tesoreria`: la pantalla deja explícito que `Por cobrar` es una bandeja de
  deuda vigente y obtiene una pestaña independiente de historial de cobros.
