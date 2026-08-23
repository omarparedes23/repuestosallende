-- Reset operativo prepromocion (NO EJECUTAR sin backup y mantenimiento)
-- Uso:
-- psql "<conn>" -v ON_ERROR_STOP=1 -v DRY_RUN=on  -f reset-operativo.sql
-- psql "<conn>" -v ON_ERROR_STOP=1 -v DRY_RUN=off -f reset-operativo.sql

\set ON_ERROR_STOP on
\pset pager off

BEGIN;

-- Impide escrituras concurrentes durante el reset. La ventana de
-- mantenimiento sigue siendo obligatoria para evitar escrituras tras COMMIT.
LOCK TABLE
  public.ra_auditoria_estado_pago_compras,
  public.ra_sunat_outbox,
  public.ra_cuenta_corriente_movimientos,
  public.ra_liquidaciones,
  public.ra_movimientos_caja,
  public.ra_venta_pagos,
  public.ra_venta_items,
  public.ra_ventas,
  public.ra_kardex,
  public.ra_cuentas_por_pagar_movimientos,
  public.ra_compra_items,
  public.ra_compras,
  public.ra_orden_compra_items,
  public.ra_ordenes_compra,
  public.ra_cajas,
  public.ra_clientes,
  public.ra_proveedores,
  public.ra_productos,
  public.ra_catalogo_repuestos,
  public.ra_empresas,
  public.ra_sucursales,
  public.ra_perfiles
IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE _prod_antes AS
SELECT id, stock_actual, precio_compra, precio_venta, precio_mayorista
FROM public.ra_productos;

CREATE TEMP TABLE _maestros_antes AS
SELECT
  (SELECT count(*) FROM public.ra_clientes) AS clientes,
  (SELECT count(*) FROM public.ra_proveedores) AS proveedores,
  (SELECT count(*) FROM public.ra_catalogo_repuestos) AS catalogo,
  (SELECT count(*) FROM public.ra_empresas) AS empresas,
  (SELECT count(*) FROM public.ra_sucursales) AS sucursales,
  (SELECT count(*) FROM public.ra_productos) AS productos;

CREATE TEMP TABLE _test_auth_antes AS
SELECT id FROM auth.users WHERE email LIKE '%@test.local';

\echo '=== CONTEOS PRE ==='
SELECT 'ventas' AS tabla, count(*) AS filas FROM public.ra_ventas
UNION ALL SELECT 'venta_items', count(*) FROM public.ra_venta_items
UNION ALL SELECT 'venta_pagos', count(*) FROM public.ra_venta_pagos
UNION ALL SELECT 'compras', count(*) FROM public.ra_compras
UNION ALL SELECT 'compra_items', count(*) FROM public.ra_compra_items
UNION ALL SELECT 'ordenes_compra', count(*) FROM public.ra_ordenes_compra
UNION ALL SELECT 'orden_compra_items', count(*) FROM public.ra_orden_compra_items
UNION ALL SELECT 'outbox', count(*) FROM public.ra_sunat_outbox
UNION ALL SELECT 'kardex', count(*) FROM public.ra_kardex
UNION ALL SELECT 'movimientos_caja', count(*) FROM public.ra_movimientos_caja
UNION ALL SELECT 'cajas', count(*) FROM public.ra_cajas
UNION ALL SELECT 'liquidaciones', count(*) FROM public.ra_liquidaciones
UNION ALL SELECT 'cuenta_corriente', count(*) FROM public.ra_cuenta_corriente_movimientos
UNION ALL SELECT 'cuentas_por_pagar', count(*) FROM public.ra_cuentas_por_pagar_movimientos
UNION ALL SELECT 'auditorias', count(*) FROM public.ra_auditoria_estado_pago_compras;

-- 043 crea el trigger trg_aud_epc_immutable, que ejecuta la funcion
-- ra_aud_epc_append_only(). Validar el trigger real antes de tocarlo.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname = 'ra_auditoria_estado_pago_compras'
    AND t.tgname = 'trg_aud_epc_immutable'
    AND NOT t.tgisinternal
    AND t.tgenabled = 'O';
  IF n <> 1 THEN
    RAISE EXCEPTION 'PRE: trg_aud_epc_immutable no existe o no esta habilitado';
  END IF;
END $$;

-- Excepcion transaccional de preproduccion. Un fallo revierte DDL y datos.
ALTER TABLE public.ra_auditoria_estado_pago_compras
  DISABLE TRIGGER trg_aud_epc_immutable;
DELETE FROM public.ra_auditoria_estado_pago_compras;

-- Venta y tesoreria.
DELETE FROM public.ra_sunat_outbox;
DELETE FROM public.ra_cuenta_corriente_movimientos;
DELETE FROM public.ra_liquidaciones;
DELETE FROM public.ra_movimientos_caja;
DELETE FROM public.ra_venta_pagos;
DELETE FROM public.ra_venta_items;
DELETE FROM public.ra_ventas;

-- Compra e inventario historico.
DELETE FROM public.ra_kardex;
DELETE FROM public.ra_cuentas_por_pagar_movimientos;
DELETE FROM public.ra_compra_items;
DELETE FROM public.ra_compras;
DELETE FROM public.ra_orden_compra_items;
DELETE FROM public.ra_ordenes_compra;

-- Las cajas son turnos operativos, no maestros.
DELETE FROM public.ra_cajas;

ALTER TABLE public.ra_auditoria_estado_pago_compras
  ENABLE TRIGGER trg_aud_epc_immutable;

UPDATE public.ra_clientes
SET saldo_deudor = 0
WHERE saldo_deudor IS DISTINCT FROM 0;

UPDATE public.ra_proveedores
SET saldo_deudor = 0
WHERE saldo_deudor IS DISTINCT FROM 0;

-- Cuarentena de perfiles TEST; auth.users no se modifica.
UPDATE public.ra_perfiles p
SET activo = false
FROM auth.users u
WHERE u.id = p.id AND u.email LIKE '%@test.local';

DO $$
DECLARE
  n integer;
  esperado bigint;
BEGIN
  SELECT count(*) INTO n
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public'
    AND c.relname = 'ra_auditoria_estado_pago_compras'
    AND t.tgname = 'trg_aud_epc_immutable'
    AND NOT t.tgisinternal
    AND t.tgenabled = 'O';
  IF n <> 1 THEN RAISE EXCEPTION 'POST: proteccion append-only no restaurada'; END IF;

  -- Todas las tablas operativas incluidas deben quedar vacias.
  SELECT count(*) INTO n FROM (
    SELECT 1 FROM public.ra_auditoria_estado_pago_compras
    UNION ALL SELECT 1 FROM public.ra_sunat_outbox
    UNION ALL SELECT 1 FROM public.ra_cuenta_corriente_movimientos
    UNION ALL SELECT 1 FROM public.ra_liquidaciones
    UNION ALL SELECT 1 FROM public.ra_movimientos_caja
    UNION ALL SELECT 1 FROM public.ra_venta_pagos
    UNION ALL SELECT 1 FROM public.ra_venta_items
    UNION ALL SELECT 1 FROM public.ra_ventas
    UNION ALL SELECT 1 FROM public.ra_kardex
    UNION ALL SELECT 1 FROM public.ra_cuentas_por_pagar_movimientos
    UNION ALL SELECT 1 FROM public.ra_compra_items
    UNION ALL SELECT 1 FROM public.ra_compras
    UNION ALL SELECT 1 FROM public.ra_orden_compra_items
    UNION ALL SELECT 1 FROM public.ra_ordenes_compra
    UNION ALL SELECT 1 FROM public.ra_cajas
  ) pendientes;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: quedan % filas operativas', n; END IF;

  -- Mismo conjunto de productos y valores relevantes, null-safe.
  SELECT count(*) INTO n
  FROM _prod_antes a
  FULL JOIN public.ra_productos p USING (id)
  WHERE a.id IS NULL OR p.id IS NULL
     OR p.stock_actual IS DISTINCT FROM a.stock_actual
     OR p.precio_compra IS DISTINCT FROM a.precio_compra
     OR p.precio_venta IS DISTINCT FROM a.precio_venta
     OR p.precio_mayorista IS DISTINCT FROM a.precio_mayorista;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: % productos agregados, eliminados o alterados', n; END IF;

  SELECT clientes INTO esperado FROM _maestros_antes;
  IF (SELECT count(*) FROM public.ra_clientes) <> esperado THEN RAISE EXCEPTION 'POST: clientes alterados'; END IF;
  SELECT proveedores INTO esperado FROM _maestros_antes;
  IF (SELECT count(*) FROM public.ra_proveedores) <> esperado THEN RAISE EXCEPTION 'POST: proveedores alterados'; END IF;
  SELECT catalogo INTO esperado FROM _maestros_antes;
  IF (SELECT count(*) FROM public.ra_catalogo_repuestos) <> esperado THEN RAISE EXCEPTION 'POST: catalogo alterado'; END IF;
  SELECT empresas INTO esperado FROM _maestros_antes;
  IF (SELECT count(*) FROM public.ra_empresas) <> esperado THEN RAISE EXCEPTION 'POST: empresas alteradas'; END IF;
  SELECT sucursales INTO esperado FROM _maestros_antes;
  IF (SELECT count(*) FROM public.ra_sucursales) <> esperado THEN RAISE EXCEPTION 'POST: sucursales alteradas'; END IF;
  SELECT productos INTO esperado FROM _maestros_antes;
  IF (SELECT count(*) FROM public.ra_productos) <> esperado THEN RAISE EXCEPTION 'POST: productos alterados'; END IF;

  SELECT count(*) INTO n FROM public.ra_clientes WHERE saldo_deudor IS DISTINCT FROM 0;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: % clientes con saldo', n; END IF;
  SELECT count(*) INTO n FROM public.ra_proveedores WHERE saldo_deudor IS DISTINCT FROM 0;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: % proveedores con saldo', n; END IF;

  SELECT count(*) INTO n
  FROM _test_auth_antes a
  FULL JOIN (SELECT id FROM auth.users WHERE email LIKE '%@test.local') u USING (id)
  WHERE a.id IS NULL OR u.id IS NULL;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: auth.users TEST fue alterado'; END IF;

  SELECT count(*) INTO n
  FROM public.ra_perfiles p JOIN _test_auth_antes u ON u.id = p.id
  WHERE p.activo;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: % perfiles TEST siguen activos', n; END IF;
END $$;

\echo '=== VERIFICACION POST OK ==='
\if :DRY_RUN
ROLLBACK;
\echo 'DRY_RUN=on: transaccion revertida; cero cambios persistentes.'
\else
COMMIT;
\echo 'RESET APLICADO. Proteccion append-only verificada.'
\endif
