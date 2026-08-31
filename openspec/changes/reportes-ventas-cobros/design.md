# Diseño — reportes de ventas y cobros

## Arquitectura de lectura

Las consultas serán Server Actions o loaders de servidor, usando la sesión
actual y el cliente Supabase de servidor. No se expondrá service role al
navegador ni se aceptarán empresa, rol o sucursal como autoridad del cliente.

```text
Panel → Ventas
  ra_ventas
    ├─ ra_venta_pagos              pagos originales
    └─ ra_cuenta_corriente_movimientos
         ├─ cargo                  crédito original
         └─ abonos                 cobros posteriores

Tesorería → Cobros registrados
  ra_cuenta_corriente_movimientos (solo tipo=abono)
    ├─ ra_ventas
    ├─ ra_clientes
    ├─ ra_sucursales               receptora
    └─ perfil/usuario y caja       si existen
```

## Contratos de lectura

### Ventas

Cada resultado representa una sola `ra_ventas.id` y contiene, como mínimo:

- identidad, fecha, moneda, tipo/número de comprobante;
- cliente y sucursal de venta;
- `total_venta` persistido;
- pagos al emitir, agrupados por método desde `ra_venta_pagos`;
- crédito original y saldo derivado desde CxC cuando exista;
- total de abonos posteriores calculado desde CxC;
- estado comercial y estado SUNAT separados.

El agregado por venta debe impedir la multiplicación cartesiana entre pagos y
abonos. Se puede resolver mediante consultas independientes por página de IDs y
agrupación en servidor, o una RPC read-only con agregados preagrupados. La
elección se decidirá tras revisar el plan de consulta y el tipado.

Fórmulas por documento, sin convertir monedas:

```text
total_venta             = ra_ventas.total
cobrado_al_emitir       = SUM(ra_venta_pagos no crédito)
credito_original        = cargo CxC o SUM(pagos crédito), según contrato validado
cobrado_posteriormente  = SUM(abonos CxC)
saldo_credito           = credito_original - cobrado_posteriormente
```

`cobrado_posteriormente` es contexto de cobranza; no se agrega sobre
`total_venta` en el KPI de ventas.

### Cobros registrados

Cada resultado representa exactamente un movimiento CxC con `tipo='abono'`.
El monto del KPI es el monto del abono y nunca se complementa con
`ra_movimientos_caja`. Si es efectivo, el movimiento de caja es evidencia de
arqueo, no otra entrada de ingreso para este reporte.

El contrato expone `sucursal_receptora` desde el abono; para filas con valor
nulo se devuelve una etiqueta estable `Sin sucursal / histórico`.

## Filtros y paginación

- Fechas inclusivas, validadas con Zod, usando la fecha relevante: emisión para
  Ventas y fecha de abono para Cobros.
- Límite con máximo seguro y cursor/offset documentado; nunca cargar todos los
  movimientos en el navegador para filtrar localmente.
- Las opciones de sucursal se limitan a las visibles para el actor.
- Por defecto, Ventas excluye anuladas del KPI pero permite encontrarlas con un
  filtro explícito. Los estados fiscal pendiente/error permanecen consultables
  e identificados; no se convierten automáticamente en aceptados.

## UI propuesta

1. Añadir `Ventas` al menú de operaciones del panel.
2. Crear una cabecera con filtros y KPIs por moneda, seguida por una tabla con
   vínculo al detalle del comprobante.
3. En Tesorería, usar pestañas `Por cobrar` y `Cobros registrados`; la primera
   conserva la semántica y flujo actual de registro de cobro.
4. Etiquetar con claridad `Sucursal de venta` versus `Sucursal que recibe el
   cobro` para impedir interpretaciones erróneas.

## Seguridad

- Validar sesión y rol en cada consulta de servidor.
- Derivar empresa desde perfil/sesión.
- Aplicar RLS y verificar que no exista bypass desde parámetros de URL.
- No mostrar referencias ni datos de clientes de otra empresa/sucursal.
- No efectuar mutaciones como efecto secundario de cargar un reporte.

## Datos y migraciones

La primera implementación no incorpora migración. Antes de construir, se hará
un preflight read-only de esquema, índices, RLS y volumen real. Si el plan de
consulta evidencia falta de índice, se propondrá una migración aditiva separada
con medición, rollback y autorización explícita.

## Rollback

El cambio de código es aislado y reversible: retirar el enlace de menú y las
rutas/acciones de lectura no altera ventas, abonos, cajas ni datos fiscales.
