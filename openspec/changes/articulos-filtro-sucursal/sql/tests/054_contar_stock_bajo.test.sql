-- ============================================================
-- 054_contar_stock_bajo.test.sql
-- TDD contra ra_contar_stock_bajo(uuid, uuid DEFAULT NULL) (054).
--
-- REQUIERE: 054 aplicada.
-- Ejecutar como postgres en SUPABASE TEST:
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/articulos-filtro-sucursal/sql/tests/054_contar_stock_bajo.test.sql
--
-- BEGIN ... ROLLBACK: cero residuos. Fixtures: empresa 10101010, 2 sucursales,
-- catálogos SIN producto previo en la empresa.
-- ============================================================
\set ON_ERROR_STOP on

BEGIN;
DO $$
DECLARE
  v_admin uuid; v_otro uuid; v_empresa uuid; v_o uuid; v_d uuid;
  v_c1 uuid; v_c2 uuid; v_c3 uuid;
  v_base_all int; v_base_o int; v_base_d int;
  v_all int; v_only_o int; v_only_d int; v_compat int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT p.id INTO v_otro  FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.otraempresa.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_c1 FROM ra_catalogo_repuestos c WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  SELECT id INTO v_c2 FROM ra_catalogo_repuestos c WHERE c.id<>v_c1 AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  SELECT id INTO v_c3 FROM ra_catalogo_repuestos c WHERE c.id NOT IN (v_c1,v_c2) AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;

  -- Conteos base (datos preexistentes de la empresa)
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);
  v_base_all := public.ra_contar_stock_bajo(v_empresa);
  v_base_o   := public.ra_contar_stock_bajo(v_empresa, v_o);
  v_base_d   := public.ra_contar_stock_bajo(v_empresa, v_d);

  -- Sembrar bajo stock: 2 en origen (stock<min), 1 en destino (stock<min), 1 en destino OK (no cuenta)
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,stock_minimo,activo) VALUES
    (v_empresa,v_o,v_c1, 1, 5, true),
    (v_empresa,v_o,v_c2, 0, 3, true),
    (v_empresa,v_d,v_c1, 2, 9, true),
    (v_empresa,v_d,v_c3, 50, 5, true);

  -- A. sin sesión -> RA_UNAUTHENTICATED
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    PERFORM public.ra_contar_stock_bajo(v_empresa);
    RAISE EXCEPTION 'FALLO A';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_UNAUTHENTICATED%' THEN RAISE EXCEPTION 'FALLO A: %', SQLERRM; END IF; END;

  -- B. empresa ajena -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_otro)::text, true);
  BEGIN
    PERFORM public.ra_contar_stock_bajo(v_empresa);
    RAISE EXCEPTION 'FALLO B';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO B: %', SQLERRM; END IF; END;

  -- C/D/E como admin
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);
  v_all    := public.ra_contar_stock_bajo(v_empresa, NULL);
  v_only_o := public.ra_contar_stock_bajo(v_empresa, v_o);
  v_only_d := public.ra_contar_stock_bajo(v_empresa, v_d);
  v_compat := public.ra_contar_stock_bajo(v_empresa);  -- 1 arg -> usa DEFAULT NULL

  -- Sembramos 2 en origen y 1 en destino
  IF v_only_o <> v_base_o + 2 THEN RAISE EXCEPTION 'FALLO D origen: % (base %, esperado +2)', v_only_o, v_base_o; END IF;
  IF v_only_d <> v_base_d + 1 THEN RAISE EXCEPTION 'FALLO D destino: % (base %, esperado +1)', v_only_d, v_base_d; END IF;
  IF v_all <> v_base_all + 3 THEN RAISE EXCEPTION 'FALLO C total: % (base %, esperado +3)', v_all, v_base_all; END IF;
  IF v_compat <> v_all THEN RAISE EXCEPTION 'FALLO E: la llamada de 1 arg (%) no coincide con NULL (%)', v_compat, v_all; END IF;

  RAISE NOTICE 'OK (base all/o/d = %/%/% ; con seeds all/o/d = %/%/%)', v_base_all, v_base_o, v_base_d, v_all, v_only_o, v_only_d;
END $$;
ROLLBACK;

\echo '== 054 PASS =='
