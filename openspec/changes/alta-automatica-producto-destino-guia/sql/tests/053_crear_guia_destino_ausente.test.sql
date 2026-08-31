-- ============================================================
-- 053_crear_guia_destino_ausente.test.sql
-- TDD contra ra_crear_guia (053): crear guía cuando el producto existe
-- en origen pero NO en destino. + regresión de numeración/estados/auth
-- + flujo end-to-end con ra_recibir_guia (052).
--
-- REQUIERE: 050 + 051 + 052 + 053 aplicadas.
-- Ejecutar como postgres en SUPABASE TEST:
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/alta-automatica-producto-destino-guia/sql/tests/053_crear_guia_destino_ausente.test.sql
--
-- Cada sección corre en BEGIN ... ROLLBACK: cero residuos.
-- Fixtures: empresa 10101010. Catálogos SIN producto previo en la empresa.
-- Concurrencia: guia-crear-sin-destino-concurrencia-runner.ps1
-- ============================================================
\set ON_ERROR_STOP on

-- ============================================================
\echo '== A. Producto en origen, ausente en destino -> crear guía OK, sin fila destino =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid;
  v_res jsonb; v_gid uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;

  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES (v_empresa,v_o,v_cat,30,true);  -- solo origen
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',5)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  IF (v_res->>'status') <> 'created' THEN RAISE EXCEPTION 'FALLO A status: %', v_res; END IF;
  IF (v_res->'guia'->>'numero') <> '001-00000006' THEN RAISE EXCEPTION 'FALLO A numero: %', v_res; END IF;
  IF (SELECT count(*) FROM ra_guia_items WHERE guia_id=v_gid) <> 1 THEN RAISE EXCEPTION 'FALLO A items'; END IF;

  -- NO se creó fila en destino
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat) <> 0 THEN
    RAISE EXCEPTION 'FALLO A: se creó fila destino en la creación';
  END IF;
  -- correlativo consumido
  IF (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision') <> 7 THEN
    RAISE EXCEPTION 'FALLO A: siguiente_correlativo no avanzó a 7';
  END IF;

  RAISE NOTICE 'A OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== B. End-to-end: crear (destino ausente) -> emitir -> en_transito -> recibir (052 crea destino) =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid;
  v_res jsonb; v_gid uuid; v_new ra_productos%ROWTYPE;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;

  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,codigo_interno,precio_venta,precio_venta_dolar,precio_compra,stock_minimo,moneda,stock_actual,activo)
  VALUES (v_empresa,v_o,v_cat,'ORIG-E2E',55.50,18.00,33.00,7,'USD',40,true);   -- solo origen
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',9)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  PERFORM public.ra_avanzar_estado_guia(v_gid,'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid,'en_transito');
  v_res := public.ra_recibir_guia(v_gid);
  IF (v_res->>'status') <> 'received' THEN RAISE EXCEPTION 'FALLO B recibir: %', v_res; END IF;

  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat) <> 1 THEN RAISE EXCEPTION 'FALLO B: filas destino'; END IF;
  SELECT * INTO v_new FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat;
  IF v_new.stock_actual <> 9 THEN RAISE EXCEPTION 'FALLO B stock destino: %', v_new.stock_actual; END IF;
  IF v_new.activo <> true THEN RAISE EXCEPTION 'FALLO B activo'; END IF;
  IF v_new.codigo_interno IS DISTINCT FROM 'ORIG-E2E' THEN RAISE EXCEPTION 'FALLO B codigo: %', v_new.codigo_interno; END IF;
  IF v_new.precio_venta <> 55.50 OR v_new.precio_venta_dolar <> 18.00 OR v_new.precio_compra <> 33.00 OR v_new.stock_minimo <> 7 OR btrim(v_new.moneda) <> 'USD' THEN
    RAISE EXCEPTION 'FALLO B atributos no copiados: % / % / % / % / %', v_new.precio_venta, v_new.precio_venta_dolar, v_new.precio_compra, v_new.stock_minimo, v_new.moneda;
  END IF;
  IF (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_cat) <> 31 THEN RAISE EXCEPTION 'FALLO B stock origen'; END IF;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid AND motivo='traslado') <> 2 THEN RAISE EXCEPTION 'FALLO B kardex'; END IF;
  IF (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'recibida' THEN RAISE EXCEPTION 'FALLO B estado'; END IF;

  RAISE NOTICE 'B OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== C. Producto inexistente en origen -> rechazo, sin guía ni fila destino =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid; v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  -- SIN producto en origen ni en destino
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',3)));
    RAISE EXCEPTION 'FALLO C: no rechazó';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_ORIGIN%' THEN RAISE EXCEPTION 'FALLO C: %', SQLERRM; END IF;
  END;

  IF (SELECT count(*) FROM ra_guias_remision WHERE empresa_id=v_empresa) <> 0 THEN RAISE EXCEPTION 'FALLO C: creó guía'; END IF;
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat) <> 0 THEN RAISE EXCEPTION 'FALLO C: creó fila destino'; END IF;
  IF (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision') <> 6 THEN
    RAISE EXCEPTION 'FALLO C: consumió correlativo';
  END IF;

  RAISE NOTICE 'C OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== D. Regresión: auth, estados, numeración (todo con destino ausente) =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_vend uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid; v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT p.id INTO v_vend  FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.vendedor.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES (v_empresa,v_o,v_cat,50,true);  -- solo origen

  -- D.1 sin serie -> RA_GUIDE_SERIES_NOT_CONFIGURED
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);
  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO D1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_SERIES_NOT_CONFIGURED%' THEN RAISE EXCEPTION 'FALLO D1: %', SQLERRM; END IF; END;

  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','001',6,true,true);

  -- D.2 sin sesión -> RA_UNAUTHENTICATED
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO D2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_UNAUTHENTICATED%' THEN RAISE EXCEPTION 'FALLO D2: %', SQLERRM; END IF; END;

  -- D.3 vendedor -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_vend)::text, true);
  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO D3';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO D3: %', SQLERRM; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  -- D.4 same branch
  BEGIN v_res := public.ra_crear_guia(v_o, v_o, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
    RAISE EXCEPTION 'FALLO D4';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_SAME_BRANCH%' THEN RAISE EXCEPTION 'FALLO D4: %', SQLERRM; END IF; END;

  -- D.5 items vacío
  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, '[]'::jsonb);
    RAISE EXCEPTION 'FALLO D5';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_EMPTY%' THEN RAISE EXCEPTION 'FALLO D5: %', SQLERRM; END IF; END;

  -- D.6 catálogo duplicado
  BEGIN v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(
             jsonb_build_object('catalogo_id',v_cat,'cantidad',1), jsonb_build_object('catalogo_id',v_cat,'cantidad',2)));
    RAISE EXCEPTION 'FALLO D6';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_DUPLICATE_ITEM%' THEN RAISE EXCEPTION 'FALLO D6: %', SQLERRM; END IF; END;

  -- D.7 numeración: 6 -> 7 -> 8, destino ausente todo el tiempo
  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
  IF (v_res->'guia'->>'numero') <> '001-00000006' THEN RAISE EXCEPTION 'FALLO D7 n1: %', v_res; END IF;
  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',1)));
  IF (v_res->'guia'->>'numero') <> '001-00000007' THEN RAISE EXCEPTION 'FALLO D7 n2: %', v_res; END IF;
  IF (SELECT siguiente_correlativo FROM ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_o AND tipo_documento='guia_remision') <> 8 THEN
    RAISE EXCEPTION 'FALLO D7: sig no llegó a 8';
  END IF;
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d) <> 0 THEN
    RAISE EXCEPTION 'FALLO D7: se creó fila destino en alguna creación';
  END IF;

  RAISE NOTICE 'D OK';
END $$;
ROLLBACK;

\echo '== TODAS LAS SECCIONES PASARON =='
