# Spec — limpieza-prepromocion-datos-test

## REQ-1 Reset completo

- **GIVEN** que las operaciones actuales son pruebas
- **WHEN** termina la ejecución real
- **THEN** quedan vacías ventas, compras, órdenes, kardex, tesorería, cajas y auditorías

## REQ-2 Productos sin cambios

- **GIVEN** el snapshot inicial
- **WHEN** se ejecutan las guardas
- **THEN** permanecen los mismos IDs y valores de stock, costo y precios, comparados de
  forma null-safe

## REQ-3 Maestros conservados

- **GIVEN** clientes, proveedores, catálogo, empresas y sucursales
- **WHEN** termina el reset
- **THEN** sus conteos permanecen iguales
- **AND** clientes y proveedores tienen `saldo_deudor=0`

## REQ-4 Auditoría restaurada

- **GIVEN** `trg_aud_epc_immutable` habilitado antes del reset
- **WHEN** se eliminan auditorías
- **THEN** se deshabilita solo dentro de la transacción y queda nuevamente en estado `O`
- **AND** cualquier fallo revierte trigger y datos

## REQ-5 Usuarios TEST

- **WHEN** termina el reset
- **THEN** los perfiles `@test.local` quedan inactivos y `auth.users` permanece intacto

## REQ-6 Concurrencia

- **GIVEN** la aplicación en mantenimiento
- **WHEN** inicia el script
- **THEN** locks exclusivos impiden mezclar nuevas operaciones con el reset

## REQ-7 Modos

- **GIVEN** `DRY_RUN=on`
- **THEN** se ejecuta rollback y no quedan cambios persistentes
- **GIVEN** `DRY_RUN=off` y todas las guardas PASS
- **THEN** se ejecuta commit

## REQ-8 Promoción

- **WHEN** falta backup, mantenimiento o dry-run PASS
- **THEN** no se autoriza la ejecución real
- **AND** el sistema no se habilita antes de cargar stock/costos iniciales
