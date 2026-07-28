-- ============================================================
-- wipe_test_data.sql
-- Borra datos transaccionales de PRUEBA en Supabase (ventas,
-- facturas/boletas, pagos, cuentas corrientes/por pagar, compras,
-- ordenes de compra, clientes y proveedores) para arrancar en limpio
-- con datos reales importados desde FastERP.
--
-- NO toca stock_actual del catalogo (decision explicita: se deja como esta).
-- NO toca FastERP / ERP_ALLENDE (SQL Server) - esto es SOLO Supabase.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor (corre como `postgres`,
-- necesario porque ra_cuenta_corriente_movimientos y
-- ra_cuentas_por_pagar_movimientos solo tienen policy de SELECT -
-- un DELETE desde el cliente normal de la app seria bloqueado por RLS).
--
-- Orden obligatorio por FKs: ledgers -> detalle de ventas -> ventas ->
-- detalle de compras -> compras -> ordenes de compra -> clientes -> proveedores.
-- ============================================================

BEGIN;

-- 1. Ledgers (referencian ventas/compras y clientes/proveedores)
DELETE FROM ra_cuenta_corriente_movimientos;
DELETE FROM ra_cuentas_por_pagar_movimientos;

-- 2. Ventas (facturas/boletas/tickets) y su detalle
DELETE FROM ra_venta_pagos;
DELETE FROM ra_venta_items;
DELETE FROM ra_ventas;

-- 3. Compras y ordenes de compra
DELETE FROM ra_compra_items;
DELETE FROM ra_compras;
DELETE FROM ra_orden_compra_items;
DELETE FROM ra_ordenes_compra;

-- 4. Maestros
DELETE FROM ra_clientes;
DELETE FROM ra_proveedores;

COMMIT;

-- ============================================================
-- OPCIONAL - NO INCLUIDO POR DEFECTO
-- No referencian clientes/proveedores, no fueron confirmados en el
-- alcance. Descomentar solo si tambien son datos de prueba a limpiar.
-- ============================================================

-- BEGIN;
-- DELETE FROM ra_guia_items;
-- DELETE FROM ra_guias_remision;
-- DELETE FROM ra_liquidaciones;
-- DELETE FROM ra_movimientos_caja;
-- COMMIT;
