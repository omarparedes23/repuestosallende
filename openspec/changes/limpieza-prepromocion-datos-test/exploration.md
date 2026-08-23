# Exploration — limpieza-prepromocion-datos-test

Fecha: 2026-08-23. El mismo proyecto Supabase de pruebas será promovido para uso real.

## Decisión del propietario

Todo el contenido operativo actual de ventas, compras y tesorería es dato de prueba y
puede eliminarse. Se conservan productos, clientes, proveedores, catálogo, empresas y
sucursales. Los productos no se corrigen durante este change: stock y costos se cargarán
de forma autoritativa antes de habilitar operaciones reales.

## Inventario read-only de referencia

| Tabla o conjunto | Filas observadas |
|---|---:|
| Ventas / items / pagos | 19 / 19 / 19 |
| Compras / items | 50 / 91 |
| Outbox SUNAT | 7 |
| Kardex | 110 reportadas en la última revisión |
| Movimientos de caja / cajas | 21 / 3 |
| Cuenta corriente / CxP | 2 / 53 |
| Liquidaciones / órdenes de compra | 0 / 0 |
| Auditorías estado de pago | 3 |
| Usuarios `@test.local` | 8 |

Los conteos son evidencia orientativa, no una allowlist ni una condición. El script
elimina todo lo presente en las tablas operativas declaradas al ejecutarse.

## Restricciones comprobadas

- Outbox, cuenta corriente, CxP y auditoría usan FK `RESTRICT`.
- `ra_compras.orden_compra_id` referencia órdenes de compra.
- `ra_cajas` representa turnos operativos; no es una tabla maestra.
- La migración 043 crea el trigger `trg_aud_epc_immutable`, que ejecuta la función
  `ra_aud_epc_append_only()`.

## Riesgos y límites

1. La operación exige backup y ventana de mantenimiento.
2. El trigger se deshabilita solo dentro de la transacción y debe quedar habilitado antes
   del commit; cualquier fallo produce rollback.
3. El dry-run ejecuta cambios y locks dentro de una transacción, pero hace rollback y no
   deja cambios persistentes.
4. Guías de remisión y dominios no mencionados no forman parte de este reset.
5. La carga inicial autoritativa de stock/costos es obligatoria antes de operar.
