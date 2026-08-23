# Design — limpieza-prepromocion-datos-test

## Estrategia

`sql/reset-operativo.sql` ejecuta el reset en una sola transacción psql con
`ON_ERROR_STOP=1`. No usa UUID ni conteos históricos: todo el contenido de las tablas
operativas declaradas pertenece a pruebas. Toma locks exclusivos, que complementan la
ventana de mantenimiento.

## Orden

1. Validar y deshabilitar temporalmente `trg_aud_epc_immutable`.
2. Eliminar auditoría, outbox, cuenta corriente, liquidaciones y movimientos de caja.
3. Eliminar pagos, items y ventas.
4. Eliminar kardex, CxP, items y compras.
5. Eliminar items/cabeceras de órdenes de compra y turnos de caja.
6. Rehabilitar el trigger.
7. Poner saldos en cero, desactivar perfiles TEST y ejecutar guardas.

## Auditoría

La migración 043 define el trigger `trg_aud_epc_immutable` y la función
`ra_aud_epc_append_only()`. El script valida el trigger antes y después. DDL y datos se
revierten juntos si falla cualquier sentencia o guarda.

## Conservación

La instantánea de productos guarda IDs, stock, costo y precios. La comparación usa
`FULL JOIN` e `IS DISTINCT FROM`. Otra instantánea conserva conteos de clientes,
proveedores, catálogo, empresas, sucursales y productos. Solo `saldo_deudor` cambia en
clientes/proveedores.

## Modos y puertas

- `DRY_RUN=on`: ejecuta el procedimiento y hace rollback; cero cambios persistentes.
- `DRY_RUN=off`: hace commit solo después de todas las guardas.

Puertas: backup, mantenimiento, dry-run PASS, ejecución real, verificación read-only y
carga inicial autoritativa de stock/costos antes de abrir operaciones.
