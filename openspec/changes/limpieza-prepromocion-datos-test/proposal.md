# Proposal — limpieza-prepromocion-datos-test

## Objetivo

Vaciar transaccionalmente todas las operaciones de prueba de ventas, compras y tesorería
antes de promover el mismo proyecto Supabase para uso real.

## Alcance

1. Eliminar ventas, items, pagos, outbox, cuenta corriente y kardex.
2. Eliminar compras, items, CxP, órdenes de compra y sus items.
3. Eliminar movimientos, liquidaciones y turnos de caja.
4. Eliminar auditorías de prueba restaurando el trigger append-only antes del commit.
5. Restablecer `saldo_deudor` a cero en clientes y proveedores.
6. Desactivar perfiles `@test.local`, sin modificar `auth.users`.
7. Conservar productos, clientes, proveedores, catálogo, empresas y sucursales.

## No alcance

- No modificar stock, costos ni precios de productos.
- No eliminar maestros ni cuentas de `auth.users`.
- No limpiar guías de remisión u otros dominios ajenos.
- No configurar OSE, scheduler, dominio o variables del hosting.
- No realizar aquí la carga inicial de stock/costos.

## Criterios de éxito

1. Backup y mantenimiento confirmados.
2. Dry-run PASS con rollback y cero cambios persistentes.
3. Cero filas en todas las tablas operativas incluidas.
4. Mismo conjunto y valores relevantes de productos antes/después.
5. Conteos de todos los maestros conservados sin cambios.
6. Saldos derivados en cero y perfiles TEST inactivos.
7. `trg_aud_epc_immutable` habilitado (`tgenabled='O'`).
