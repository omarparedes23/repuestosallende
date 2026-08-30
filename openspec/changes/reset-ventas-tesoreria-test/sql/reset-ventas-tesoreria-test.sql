-- Reset limitado de ventas y tesorería para Supabase TEST.
-- NO ejecutar en producción ni en SQL Server histórico.
-- Conserva por diseño: productos (incluye stock/precios), catálogo, kardex,
-- compras, órdenes, CxP, proveedores, clientes, empresas y sucursales.
--
-- Dry-run (obligatorio primero):
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v CONFIRM_TEST_RESET=on -v DRY_RUN=on \
--   -f reset-ventas-tesoreria-test.sql
-- Ejecución real, solo tras revisar el dry-run:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -v CONFIRM_TEST_RESET=on -v DRY_RUN=off \
--   -f reset-ventas-tesoreria-test.sql

\set ON_ERROR_STOP on
\pset pager off

\if :{?CONFIRM_TEST_RESET}
\else
  \echo 'FALLO: falta -v CONFIRM_TEST_RESET=on. No se inició el reset.'
  \quit
\endif

\if :{?DRY_RUN}
\else
  \echo 'FALLO: declara -v DRY_RUN=on u off. No se inició el reset.'
  \quit
\endif

BEGIN;

-- Evita una mezcla de nuevas ventas/cobranzas durante la operación y protege
-- la invariancia de productos mientras se comprueba el snapshot.
LOCK TABLE
  public.ra_sunat_outbox,
  public.ra_cuenta_corriente_movimientos,
  public.ra_liquidaciones,
  public.ra_movimientos_caja,
  public.ra_venta_pagos,
  public.ra_venta_items,
  public.ra_ventas,
  public.ra_cajas,
  public.ra_clientes,
  public.ra_productos
IN ACCESS EXCLUSIVE MODE;

CREATE TEMP TABLE _productos_antes AS
SELECT id, to_jsonb(p) AS fila
FROM public.ra_productos p;

\echo '=== OBJETIVO ==='
SELECT current_database() AS base_conectada, current_user AS usuario_ejecutor;

\echo '=== CONTEOS PRE ==='
SELECT 'sunat_outbox' AS tabla, count(*) AS filas FROM public.ra_sunat_outbox
UNION ALL SELECT 'cuenta_corriente', count(*) FROM public.ra_cuenta_corriente_movimientos
UNION ALL SELECT 'liquidaciones', count(*) FROM public.ra_liquidaciones
UNION ALL SELECT 'movimientos_caja', count(*) FROM public.ra_movimientos_caja
UNION ALL SELECT 'venta_pagos', count(*) FROM public.ra_venta_pagos
UNION ALL SELECT 'venta_items', count(*) FROM public.ra_venta_items
UNION ALL SELECT 'ventas', count(*) FROM public.ra_ventas
UNION ALL SELECT 'cajas', count(*) FROM public.ra_cajas;

-- Estas protecciones se desactivan solamente dentro de esta transacción
-- administrativa y se validan restauradas antes de COMMIT.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relname = 'ra_movimientos_caja'
    AND t.tgname = 'trg_movimientos_caja_append_only'
    AND NOT t.tgisinternal AND t.tgenabled = 'O';
  IF n <> 1 THEN RAISE EXCEPTION 'PRE: trigger de movimientos de caja no está habilitado'; END IF;

  SELECT count(*) INTO n
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace ns ON ns.oid = c.relnamespace
  WHERE ns.nspname = 'public' AND c.relname = 'ra_liquidaciones'
    AND t.tgname = 'trg_liquidaciones_proteger_snapshot'
    AND NOT t.tgisinternal AND t.tgenabled = 'O';
  IF n <> 1 THEN RAISE EXCEPTION 'PRE: trigger de liquidaciones no está habilitado'; END IF;
END $$;

ALTER TABLE public.ra_movimientos_caja DISABLE TRIGGER trg_movimientos_caja_append_only;
ALTER TABLE public.ra_liquidaciones DISABLE TRIGGER trg_liquidaciones_proteger_snapshot;

-- Dependientes de ventas y caja, siempre antes de sus cabeceras.
DELETE FROM public.ra_sunat_outbox;
DELETE FROM public.ra_cuenta_corriente_movimientos;
DELETE FROM public.ra_liquidaciones;
DELETE FROM public.ra_movimientos_caja;
DELETE FROM public.ra_venta_pagos;
DELETE FROM public.ra_venta_items;
DELETE FROM public.ra_ventas;
DELETE FROM public.ra_cajas;

ALTER TABLE public.ra_liquidaciones ENABLE TRIGGER trg_liquidaciones_proteger_snapshot;
ALTER TABLE public.ra_movimientos_caja ENABLE TRIGGER trg_movimientos_caja_append_only;

-- Tras vaciar toda CxC, el cache materializado de clientes también debe quedar cero.
UPDATE public.ra_clientes
SET saldo_deudor = 0
WHERE saldo_deudor IS DISTINCT FROM 0;

DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n
  FROM (
    SELECT 1 FROM public.ra_sunat_outbox
    UNION ALL SELECT 1 FROM public.ra_cuenta_corriente_movimientos
    UNION ALL SELECT 1 FROM public.ra_liquidaciones
    UNION ALL SELECT 1 FROM public.ra_movimientos_caja
    UNION ALL SELECT 1 FROM public.ra_venta_pagos
    UNION ALL SELECT 1 FROM public.ra_venta_items
    UNION ALL SELECT 1 FROM public.ra_ventas
    UNION ALL SELECT 1 FROM public.ra_cajas
  ) pendientes;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: quedan % filas de ventas/tesorería', n; END IF;

  SELECT count(*) INTO n
  FROM _productos_antes a
  FULL JOIN (SELECT id, to_jsonb(p) AS fila FROM public.ra_productos p) d USING (id)
  WHERE a.id IS NULL OR d.id IS NULL OR a.fila IS DISTINCT FROM d.fila;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: % productos fueron alterados', n; END IF;

  SELECT count(*) INTO n FROM public.ra_clientes WHERE saldo_deudor IS DISTINCT FROM 0;
  IF n <> 0 THEN RAISE EXCEPTION 'POST: % clientes mantienen saldo deudor', n; END IF;

  SELECT count(*) INTO n
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='public' AND c.relname='ra_movimientos_caja'
    AND t.tgname='trg_movimientos_caja_append_only' AND NOT t.tgisinternal AND t.tgenabled='O';
  IF n <> 1 THEN RAISE EXCEPTION 'POST: trigger de movimientos de caja no fue restaurado'; END IF;

  SELECT count(*) INTO n
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace
  WHERE ns.nspname='public' AND c.relname='ra_liquidaciones'
    AND t.tgname='trg_liquidaciones_proteger_snapshot' AND NOT t.tgisinternal AND t.tgenabled='O';
  IF n <> 1 THEN RAISE EXCEPTION 'POST: trigger de liquidaciones no fue restaurado'; END IF;
END $$;

\echo '=== VERIFICACIÓN POST OK ==='
\if :DRY_RUN
  ROLLBACK;
  \echo 'DRY_RUN=on: cambios revertidos; no se modificó TEST.'
\else
  COMMIT;
  \echo 'RESET APLICADO: ventas y tesorería vacías; productos sin cambios.'
\endif
