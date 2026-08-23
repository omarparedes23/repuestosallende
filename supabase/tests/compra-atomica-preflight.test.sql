-- ============================================================
-- supabase/tests/compra-atomica-preflight.test.sql
-- Prueba del preflight abortante y de la unicidad de factura
-- para 041_compra_cuenta_pagar_atomica.sql
--
-- Ejecutar con psql como postgres CONTRA SUPABASE TEST despues de
-- aplicar la migracion:
--   PGPASSWORD=... psql "host=... user=postgres.axcrubvtpqcyscizgoee ..." \
--     -v ON_ERROR_STOP=1 -f supabase/tests/compra-atomica-preflight.test.sql
--
-- Todo corre en transacciones con ROLLBACK: no deja datos.
-- ============================================================

\set ON_ERROR_STOP on

-- ------------------------------------------------------------
-- 1. Preflight helper existe y pasa con datos limpios
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
      AND proname='ra_preflight_compras_duplicadas'
  ) THEN RAISE EXCEPTION 'FALLO: ra_preflight_compras_duplicadas no existe'; END IF;

  PERFORM public.ra_preflight_compras_duplicadas(); -- no debe lanzar
  RAISE NOTICE 'OK 1: preflight existe y pasa sin duplicados';
END $$;

-- ------------------------------------------------------------
-- 2. Preflight aborta ante duplicado sembrado
--    Post-migracion el indice unico impide sembrar duplicados por
--    INSERT; para probar el helper en aislado se elimina el indice
--    dentro de una transaccion (DDL transaccional) y ROLLBACK lo
--    restaura al final.
-- ------------------------------------------------------------
BEGIN;
DROP INDEX IF EXISTS public.uq_compras_factura_proveedor;

DO $$
DECLARE
  v_empresa uuid; v_sucursal uuid; v_proveedor uuid; v_usuario uuid;
BEGIN
  SELECT e.id INTO v_empresa FROM ra_empresas e ORDER BY e.created_at LIMIT 1;
  SELECT s.id INTO v_sucursal FROM ra_sucursales s WHERE s.empresa_id=v_empresa ORDER BY s.created_at LIMIT 1;
  SELECT p.id INTO v_proveedor FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.created_at LIMIT 1;
  SELECT u.id INTO v_usuario FROM auth.users u LIMIT 1;

  INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                          nro_documento, total, estado_pago, estado)
  VALUES (v_empresa, v_sucursal, v_proveedor, v_usuario, 'F001-DUPTEST', 118, 'pendiente', 'confirmada'),
         (v_empresa, v_sucursal, v_proveedor, v_usuario, 'f001-dupTest ', 118, 'pendiente', 'confirmada'); -- normaliza igual

  BEGIN
    PERFORM public.ra_preflight_compras_duplicadas();
    RAISE EXCEPTION 'FALLO: preflight NO aborto con duplicado sembrado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%PREFLIGHT_DUPLICADOS%' THEN
      RAISE EXCEPTION 'FALLO: preflight aborto con mensaje inesperado: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE 'OK 2: preflight aborta ante duplicados (normalizacion upper/btrim verificada)';
END $$;

ROLLBACK; -- restaura el indice y descarta los duplicados sembrados

-- ------------------------------------------------------------
-- 3. Unicidad documental post-migracion:
--    a) duplicado normalizado -> unique_violation
--    b) mismo doc en otro proveedor -> permitido
--    c) compra ANULADA tambien bloquea el numero (sin exclusion de estado)
-- ------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  v_empresa uuid; v_sucursal uuid; v_proveedor1 uuid; v_proveedor2 uuid; v_usuario uuid;
BEGIN
  SELECT e.id INTO v_empresa FROM ra_empresas e ORDER BY e.created_at LIMIT 1;
  SELECT s.id INTO v_sucursal FROM ra_sucursales s WHERE s.empresa_id=v_empresa ORDER BY s.created_at LIMIT 1;
  SELECT p.id INTO v_proveedor1 FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.created_at LIMIT 1;
  SELECT p.id INTO v_proveedor2 FROM ra_proveedores p WHERE p.empresa_id=v_empresa AND p.id<>v_proveedor1 ORDER BY p.created_at LIMIT 1;
  SELECT u.id INTO v_usuario FROM auth.users u LIMIT 1;

  IF v_proveedor2 IS NULL THEN
    RAISE EXCEPTION 'FALLO: se necesita un segundo proveedor TEST para esta prueba';
  END IF;

  INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                          nro_documento, total, estado_pago, estado)
  VALUES (v_empresa, v_sucursal, v_proveedor1, v_usuario, 'F001-UQ', 118, 'pendiente', 'confirmada');

  -- a) duplicado exacto (distinto casing/espacios) -> violacion de unicidad
  BEGIN
    INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                            nro_documento, total, estado_pago, estado)
    VALUES (v_empresa, v_sucursal, v_proveedor1, v_usuario, ' f001-uq ', 118, 'pendiente', 'confirmada');
    RAISE EXCEPTION 'FALLO: duplicado de factura fue aceptado por el indice unico';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- esperado
  END;

  -- b) mismo numero, proveedor distinto -> permitido
  INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                          nro_documento, total, estado_pago, estado)
  VALUES (v_empresa, v_sucursal, v_proveedor2, v_usuario, 'F001-UQ', 200, 'pendiente', 'confirmada');

  -- c) anular la primera NO libera el numero (unicidad sin exclusion de anuladas)
  UPDATE ra_compras SET estado='anulada'
  WHERE empresa_id=v_empresa AND proveedor_id=v_proveedor1 AND nro_doc_norm='F001-UQ';

  BEGIN
    INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                            nro_documento, total, estado_pago, estado)
    VALUES (v_empresa, v_sucursal, v_proveedor1, v_usuario, 'F001-UQ', 300, 'pendiente', 'confirmada');
    RAISE EXCEPTION 'FALLO: una compra anulada libero el numero documental (no debe)';
  EXCEPTION WHEN unique_violation THEN
    NULL; -- esperado: anulada conserva identidad del documento
  END;

  RAISE NOTICE 'OK 3: unicidad documental correcta (duplicado rechazado, otro proveedor ok, anulada conserva identidad)';
END $$;

ROLLBACK;

-- ------------------------------------------------------------
-- RESUMEN
-- ------------------------------------------------------------
SELECT 'PREFLIGHT TESTS OK' AS resultado;
