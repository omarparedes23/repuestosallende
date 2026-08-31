-- ============================================================
-- 051_numeracion_series.test.sql
-- TDD contra ra_series_documento / ra_obtener_preview_serie_guia /
--            ra_crear_guia (firma 051).
--
-- REQUIERE: 050 aplicada + 051 aplicada.
-- Ejecutar como postgres en SUPABASE TEST:
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/numeracion-series-guias/sql/tests/051_numeracion_series.test.sql
--
-- Sesión simulada con set_config('request.jwt.claims', json{sub}, true).
-- Cada sección corre en BEGIN ... ROLLBACK: cero residuos.
-- Fixtures: empresa 10101010 (admin/vendedor/lectura, 2 sucursales).
-- Catálogos elegidos SIN producto previo en la empresa.
-- Concurrencia: guia-numeracion-concurrencia-runner.ps1
-- ============================================================
\set ON_ERROR_STOP on

-- ============================================================
\echo '== A. Autorización =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_vend uuid; v_lect uuid; v_empresa uuid;
  v_o uuid; v_d uuid; v_cat uuid; v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT p.id INTO v_vend  FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.vendedor.idempotencia@test.local' AND p.activo;
  SELECT p.id INTO v_lect  FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.lectura.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES
    (v_empresa,v_o,v_cat,100,true),(v_empresa,v_d,v_cat,0,true);
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);

  -- A.1 crear_guia sin sesión -> RA_UNAUTHENTICATED
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO A1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_UNAUTHENTICATED%' THEN RAISE EXCEPTION 'FALLO A1: %', SQLERRM; END IF; END;

  -- A.2 preview sin sesión -> RA_UNAUTHENTICATED
  BEGIN
    v_res := public.ra_obtener_preview_serie_guia(v_o);
    RAISE EXCEPTION 'FALLO A2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_UNAUTHENTICATED%' THEN RAISE EXCEPTION 'FALLO A2: %', SQLERRM; END IF; END;

  -- A.3 crear_guia vendedor -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_vend)::text, true);
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO A3';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO A3: %', SQLERRM; END IF; END;

  -- A.4 preview vendedor (empresa OK, sin gate de rol) -> devuelve preview
  v_res := public.ra_obtener_preview_serie_guia(v_o);
  IF (v_res->>'numero_preview') <> '001-00000006' THEN RAISE EXCEPTION 'FALLO A4: %', v_res; END IF;

  -- A.5 crear_guia lectura -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_lect)::text, true);
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO A5';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO A5: %', SQLERRM; END IF; END;

  -- A.6 admin crea OK
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);
  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
  IF (v_res->>'status') <> 'created' THEN RAISE EXCEPTION 'FALLO A6: %', v_res; END IF;

  RAISE NOTICE 'A OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== B. Preview =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_res jsonb; v_sig1 int; v_sig2 int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  -- B.1 origen sin serie -> RA_GUIDE_SERIES_NOT_CONFIGURED
  BEGIN
    v_res := public.ra_obtener_preview_serie_guia(v_o);
    RAISE EXCEPTION 'FALLO B1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_SERIES_NOT_CONFIGURED%' THEN RAISE EXCEPTION 'FALLO B1: %', SQLERRM; END IF; END;

  -- B.2 sucursal ajena -> RA_GUIDE_INVALID_BRANCH
  BEGIN
    v_res := public.ra_obtener_preview_serie_guia((SELECT id FROM ra_sucursales WHERE empresa_id<>v_empresa LIMIT 1));
    RAISE EXCEPTION 'FALLO B2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_INVALID_BRANCH%' THEN RAISE EXCEPTION 'FALLO B2: %', SQLERRM; END IF; END;

  -- B.3 con serie -> formato y valores
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  v_res := public.ra_obtener_preview_serie_guia(v_o);
  IF (v_res->>'serie') <> '001' THEN RAISE EXCEPTION 'FALLO B3 serie: %', v_res; END IF;
  IF (v_res->>'siguiente_correlativo')::int <> 6 THEN RAISE EXCEPTION 'FALLO B3 sig: %', v_res; END IF;
  IF (v_res->>'numero_preview') <> '001-00000006' THEN RAISE EXCEPTION 'FALLO B3 numero: %', v_res; END IF;

  -- B.4 preview NO reserva
  v_sig1 := (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision');
  PERFORM public.ra_obtener_preview_serie_guia(v_o);
  PERFORM public.ra_obtener_preview_serie_guia(v_o);
  v_sig2 := (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision');
  IF v_sig1 <> 6 OR v_sig2 <> 6 THEN RAISE EXCEPTION 'FALLO B4: preview reservó (% -> %)', v_sig1, v_sig2; END IF;

  RAISE NOTICE 'B OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== C. ra_crear_guia — asignación atómica =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid;
  v_res jsonb; v_gid uuid; v_sig int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES
    (v_empresa,v_o,v_cat,100,true),(v_empresa,v_d,v_cat,0,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  -- C.1 origen sin serie -> RA_GUIDE_SERIES_NOT_CONFIGURED, sin efectos
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',2)));
    RAISE EXCEPTION 'FALLO C1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_SERIES_NOT_CONFIGURED%' THEN RAISE EXCEPTION 'FALLO C1: %', SQLERRM; END IF; END;
  IF (SELECT count(*) FROM ra_guias_remision WHERE empresa_id=v_empresa) <> 0
     OR (SELECT count(*) FROM ra_guia_items i JOIN ra_guias_remision g ON g.id=i.guia_id WHERE g.empresa_id=v_empresa) <> 0 THEN
    RAISE EXCEPTION 'FALLO C1: se insertó algo';
  END IF;

  -- C.2 con serie (001, sig=6) -> guía nace numerada, sig -> 7
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  v_res := public.ra_crear_guia(v_o, v_d, '  nota ', jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',3)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  IF (v_res->'guia'->>'serie') <> '001' THEN RAISE EXCEPTION 'FALLO C2 serie: %', v_res; END IF;
  IF (v_res->'guia'->>'correlativo')::int <> 6 THEN RAISE EXCEPTION 'FALLO C2 corr: %', v_res; END IF;
  IF (v_res->'guia'->>'numero') <> '001-00000006' THEN RAISE EXCEPTION 'FALLO C2 numero: %', v_res; END IF;
  IF (SELECT serie||'-'||correlativo FROM ra_guias_remision WHERE id=v_gid) <> '001-6' THEN RAISE EXCEPTION 'FALLO C2 fila'; END IF;
  IF (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'borrador' THEN RAISE EXCEPTION 'FALLO C2 estado'; END IF;
  IF (SELECT fecha_emision FROM ra_guias_remision WHERE id=v_gid) IS NOT NULL THEN RAISE EXCEPTION 'FALLO C2 fecha_emision debe ser NULL'; END IF;
  IF (SELECT notas FROM ra_guias_remision WHERE id=v_gid) <> 'nota' THEN RAISE EXCEPTION 'FALLO C2 notas'; END IF;
  v_sig := (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision');
  IF v_sig <> 7 THEN RAISE EXCEPTION 'FALLO C2: siguiente_correlativo quedó en % (esperado 7)', v_sig; END IF;

  -- C.3 segunda guía -> correlativo 7, sig -> 8
  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
  IF (v_res->'guia'->>'numero') <> '001-00000007' THEN RAISE EXCEPTION 'FALLO C3: %', v_res; END IF;
  IF (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision') <> 8 THEN
    RAISE EXCEPTION 'FALLO C3: sig no llegó a 8';
  END IF;

  RAISE NOTICE 'C OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== D. Validaciones de 050 preservadas (no consumen correlativo) =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid;
  v_cat uuid; v_cat2 uuid; v_cat3 uuid; v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat  FROM ra_catalogo_repuestos c WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  SELECT id INTO v_cat2 FROM ra_catalogo_repuestos c WHERE c.id<>v_cat AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  SELECT id INTO v_cat3 FROM ra_catalogo_repuestos c WHERE c.id NOT IN (v_cat,v_cat2) AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES
    (v_empresa,v_o,v_cat,100,true),(v_empresa,v_d,v_cat,0,true),
    (v_empresa,v_o,v_cat3,100,true);  -- v_cat3 solo en origen
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  BEGIN v_res := public.ra_crear_guia(v_o, v_o, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO D1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_SAME_BRANCH%' THEN RAISE EXCEPTION 'FALLO D1: %', SQLERRM; END IF; END;

  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, '[]'::jsonb);
    RAISE EXCEPTION 'FALLO D2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_EMPTY%' THEN RAISE EXCEPTION 'FALLO D2: %', SQLERRM; END IF; END;

  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(
             jsonb_build_object('catalogo_id',v_cat,'cantidad',1), jsonb_build_object('catalogo_id',v_cat,'cantidad',2)));
    RAISE EXCEPTION 'FALLO D3';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_DUPLICATE_ITEM%' THEN RAISE EXCEPTION 'FALLO D3: %', SQLERRM; END IF; END;

  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat2,'cantidad',1)));
    RAISE EXCEPTION 'FALLO D4';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_ORIGIN%' THEN RAISE EXCEPTION 'FALLO D4: %', SQLERRM; END IF; END;

  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat3,'cantidad',1)));
    RAISE EXCEPTION 'FALLO D5';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_DESTINATION%' THEN RAISE EXCEPTION 'FALLO D5: %', SQLERRM; END IF; END;

  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',0)));
    RAISE EXCEPTION 'FALLO D6';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_ITEM_INVALID%' THEN RAISE EXCEPTION 'FALLO D6: %', SQLERRM; END IF; END;

  -- Ningún fallo consumió el correlativo
  IF (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision') <> 6 THEN
    RAISE EXCEPTION 'FALLO D: una validación consumió el correlativo';
  END IF;
  IF (SELECT count(*) FROM ra_guias_remision WHERE empresa_id=v_empresa) <> 0 THEN
    RAISE EXCEPTION 'FALLO D: se creó una guía en un caso de error';
  END IF;

  RAISE NOTICE 'D OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== E. Restricciones de ra_series_documento =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;

  -- E.1 dos predeterminadas activas para (empresa,sucursal,tipo)
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',1,true,true);
  BEGIN
    INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
    VALUES (v_empresa,v_o,'guia_remision','002',1,true,true);
    RAISE EXCEPTION 'FALLO E1: permitió dos predeterminadas activas';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- E.2 misma serie en dos sucursales de la empresa
  BEGIN
    INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
    VALUES (v_empresa,v_d,'guia_remision','001',1,true,false);
    RAISE EXCEPTION 'FALLO E2: permitió la misma serie en dos sucursales';
  EXCEPTION WHEN unique_violation THEN NULL; END;

  -- E.3 siguiente_correlativo <= 0
  BEGIN
    INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
    VALUES (v_empresa,v_d,'guia_remision','003',0,true,false);
    RAISE EXCEPTION 'FALLO E3: permitió siguiente_correlativo 0';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- E.4 tipo_documento fuera de alcance
  BEGIN
    INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
    VALUES (v_empresa,v_d,'factura','F001',1,true,false);
    RAISE EXCEPTION 'FALLO E4: permitió tipo_documento factura';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- E.5 dos predeterminadas: una inactiva no cuenta
  UPDATE ra_series_documento SET activo=false WHERE empresa_id=v_empresa AND sucursal_id=v_o AND serie='001';
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','002',1,true,true);  -- OK: la '001' quedó inactiva

  RAISE NOTICE 'E OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== F. Pipeline completo con firma 051 (crear -> emitir -> transito -> recibir) =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid;
  v_res jsonb; v_gid uuid; v_so numeric; v_sd numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES
    (v_empresa,v_o,v_cat,50,true),(v_empresa,v_d,v_cat,10,true);
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',8)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  IF (v_res->'guia'->>'numero') <> '001-00000006' THEN RAISE EXCEPTION 'FALLO F numero'; END IF;

  PERFORM public.ra_avanzar_estado_guia(v_gid,'emitida');
  IF (SELECT fecha_emision FROM ra_guias_remision WHERE id=v_gid) IS NULL THEN RAISE EXCEPTION 'FALLO F fecha_emision'; END IF;
  PERFORM public.ra_avanzar_estado_guia(v_gid,'en_transito');
  v_res := public.ra_recibir_guia(v_gid);
  IF (v_res->>'status') <> 'received' THEN RAISE EXCEPTION 'FALLO F recibir: %', v_res; END IF;

  SELECT stock_actual INTO v_so FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_cat;
  SELECT stock_actual INTO v_sd FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat;
  IF v_so <> 42 OR v_sd <> 18 THEN RAISE EXCEPTION 'FALLO F stock: %/% (esperado 42/18)', v_so, v_sd; END IF;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid AND motivo='traslado') <> 2 THEN RAISE EXCEPTION 'FALLO F kardex'; END IF;

  RAISE NOTICE 'F OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== G. Fecha legible (guía nace sin fecha_emision) =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid; v_res jsonb; v_gid uuid;
  v_fecha date; v_created timestamptz;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES
    (v_empresa,v_o,v_cat,10,true),(v_empresa,v_d,v_cat,0,true);
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  SELECT fecha_emision, created_at INTO v_fecha, v_created FROM ra_guias_remision WHERE id=v_gid;
  IF v_fecha IS NOT NULL THEN RAISE EXCEPTION 'FALLO G: fecha_emision no es NULL al crear'; END IF;
  IF COALESCE(v_fecha, v_created::date) < CURRENT_DATE - 1 THEN RAISE EXCEPTION 'FALLO G: COALESCE dio fecha vieja (%)', COALESCE(v_fecha, v_created::date); END IF;

  RAISE NOTICE 'G OK';
END $$;
ROLLBACK;

\echo '== TODAS LAS SECCIONES PASARON =='
