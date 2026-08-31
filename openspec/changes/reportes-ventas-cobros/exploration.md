# Exploración — reportes de ventas y cobros

Fecha: 2026-08-31  
Estado: solo lectura; sin cambios remotos ni datos modificados.

## Objetivo

Definir dos vistas administrativas que permitan consultar el historial completo
de ventas y el historial de cobros posteriores de cuentas por cobrar, sin
duplicar importes ni confundir la sucursal que vendió con la que recibió el
cobro.

## Estado actual verificado

### Tesorería

`getCuentasPorCobrarGlobal()` consulta `ra_cuenta_corriente_movimientos` y
`TesoreriaView` agrupa cada cargo con sus abonos para derivar el saldo. Después
filtra `saldoPendiente > 0`.

Por ello un documento a crédito pagado completamente desaparece de Tesorería
por diseño. La pantalla es una bandeja de trabajo de **por cobrar**, no un
historial de cobros. El estado de cuenta individual del cliente sí puede mostrar
abonos, pero obliga a buscar cliente por cliente.

### Ventas

`/tablet/ventas` usa `getVentasDelDia()` y filtra por fecha local del día y la
sucursal guardada en la sesión/cookie activa. Es apropiada para el cajero, no
para un informe administrativo histórico.

El Dashboard tiene indicadores de ventas y una lista corta de últimas ventas;
no tiene filtros ni detalle de pagos. Además, su indicador actual depende de
`estado='completada'`, por lo que no debe reutilizarse como fuente única del
reporte: una venta comercial con emisión fiscal pendiente debe poder verse con
su estado fiscal distinguido.

## Fuentes de verdad

| Concepto | Fuente | Uso en el cambio |
|---|---|---|
| Venta comercial | `ra_ventas` | Una fila por comprobante, total, moneda, sucursal de emisión, cliente y estados. |
| Pago original al emitir | `ra_venta_pagos` | Desglose de efectivo, Yape, tarjeta y transferencia ingresado en POS. |
| Deuda de una venta a crédito | Cargo en `ra_cuenta_corriente_movimientos` | Base para crédito y saldo, cuando aplica. |
| Cobro posterior | Abono en `ra_cuenta_corriente_movimientos` | Fuente exclusiva del historial de cobros posteriores. |
| Arqueo físico | `ra_movimientos_caja` | No es fuente de suma del nuevo historial de cobros. Sirve para conciliación de caja. |

`ra_registrar_cobro_v2` inserta el abono y, si es efectivo, también un
`ra_movimientos_caja` con origen `cobro`. Por tanto, sumar ambas tablas para el
mismo reporte duplicaría un cobro en efectivo.

## Dimensiones que no se deben mezclar

1. **Sucursal de venta:** `ra_ventas.sucursal_id`; responde dónde se emitió el
   comprobante.
2. **Sucursal que recibe el cobro:** `ra_cuenta_corriente_movimientos.sucursal_id`
   del abono; responde dónde ingresó posteriormente el dinero.
3. **Moneda:** las sumas se agrupan por moneda. PEN y USD no se combinan en un
   único KPI sin una regla de conversión aprobada.
4. **Estado comercial y fiscal:** deben presentarse por separado. Una venta
   pendiente o rechazada por OSE/SUNAT no debe desaparecer silenciosamente del
   historial comercial, ni presentarse como comprobante fiscal aceptado.

## Riesgos y decisiones necesarias

- Hay filas históricas previas a la trazabilidad por sucursal de cobro. La UI
  debe mostrarlas como `Sin sucursal / histórico`, no filtrarlas fuera.
- La definición de qué estados entran en el total comercial debe ser explícita:
  anuladas se excluyen por defecto; pendientes y con error fiscal se muestran
  identificadas y su inclusión en KPI debe poder filtrarse.
- Los permisos de lectura deben aplicarse en servidor/RLS: un usuario solo
  puede ver empresa y sucursales autorizadas; los administradores pueden elegir
  consolidado si su rol lo permite.
- El cambio es de consulta/UI. No autoriza alterar ventas, abonos, cajas ni
  reparar datos históricos.

## Conclusión

No se requiere migración para la primera versión. Se necesita una capa de
consultas tipada y paginada, dos vistas de panel y pruebas de cálculo/filtros.
Una futura optimización de índices o una vista materializada solo se evaluará
con métricas de volumen y plan de consulta real.
