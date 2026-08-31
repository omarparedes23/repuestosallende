-- ============================================================
-- 052_alta_automatica_destino.test.sql
-- TDD contra ra_recibir_guia (052): alta automática de la fila
-- ra_productos en destino cuando falta.
--
-- REQUIERE: 050 + 051 + 052 aplicadas.
-- Ejecutar como postgres en SUPABASE TEST:
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/alta-automatica-producto-destino-guia/sql/tests/052_alta_automatica_destino.test.sql
--
-- Nota: 051 exige que el catálogo exista en origen Y destino al CREAR la guía.
-- El escenario "destino ausente al recibir" se produce cuando la fila destino
-- se elimina/pierde ENTRE la creación y la recepción (la config puede cambiar).
-- Los tests lo simulan: crean la guía con la fila destino presente, la
-- ponen en_transito y luego BORRAN la fila destino antes de recibir.
--
-- Cada sección corre en BEGIN ... ROLLBACK: cero residuos.
-- ============================================================
\set ON_ERROR_STOP on

-- ============================================================
\echo '== A. Destino borrado tras crear -> 052 lo re-habilita copiando atributos de origen =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid;
  v_res jsonb; v_gid uuid;
  v_new ra_productos%ROWTYPE; v_orig ra_productos%ROWTYPE; v_dest_count int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;

  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,codigo_interno,precio_venta,precio_venta_dolar,precio_compra,stock_minimo,moneda,stock_actual,activo)
  VALUES (v_empresa,v_o,v_cat,'ORIG-COD-A',123.45,40.10,80.00,5,'USD',50,true);
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo)
  VALUES (v_empresa,v_d,v_cat,0,true);   -- destino presente al CREAR
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','A01',1,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',8)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  PERFORM public.ra_avanzar_estado_guia(v_gid,'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid,'en_transito');

  DELETE FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat;  -- destino se pierde

  v_res := public.ra_recibir_guia(v_gid);
  IF (v_res->>'status') <> 'received' THEN RAISE EXCEPTION 'FALLO A: %', v_res; END IF;

  SELECT count(*) INTO v_dest_count FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat;
  IF v_dest_count <> 1 THEN RAISE EXCEPTION 'FALLO A: % filas en destino', v_dest_count; END IF;

  SELECT * INTO v_orig FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_cat;
  SELECT * INTO v_new  FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat;
  IF v_new.stock_actual <> 8 THEN RAISE EXCEPTION 'FALLO A stock destino: % (esperado 8)', v_new.stock_actual; END IF;
  IF v_orig.stock_actual <> 42 THEN RAISE EXCEPTION 'FALLO A stock origen: %', v_orig.stock_actual; END IF;
  IF v_new.activo <> true THEN RAISE EXCEPTION 'FALLO A: destino no activo'; END IF;
  IF v_new.codigo_interno IS DISTINCT FROM 'ORIG-COD-A' THEN RAISE EXCEPTION 'FALLO A codigo_interno: %', v_new.codigo_interno; END IF;
  IF v_new.precio_venta <> 123.45 THEN RAISE EXCEPTION 'FALLO A precio_venta: %', v_new.precio_venta; END IF;
  IF v_new.precio_venta_dolar <> 40.10 THEN RAISE EXCEPTION 'FALLO A precio_venta_dolar: %', v_new.precio_venta_dolar; END IF;
  IF v_new.precio_compra <> 80.00 THEN RAISE EXCEPTION 'FALLO A precio_compra: %', v_new.precio_compra; END IF;
  IF v_new.stock_minimo <> 5 THEN RAISE EXCEPTION 'FALLO A stock_minimo: %', v_new.stock_minimo; END IF;
  IF btrim(v_new.moneda) <> 'USD' THEN RAISE EXCEPTION 'FALLO A moneda: %', v_new.moneda; END IF;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid AND motivo='traslado') <> 2 THEN RAISE EXCEPTION 'FALLO A kardex'; END IF;
  IF (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'recibida' THEN RAISE EXCEPTION 'FALLO A estado'; END IF;

  RAISE NOTICE 'A OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== B. Destino existente -> NO sobrescribe atributos locales, solo suma stock =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid;
  v_res jsonb; v_gid uuid; v_dest ra_productos%ROWTYPE;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;

  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,codigo_interno,precio_venta,precio_compra,stock_minimo,moneda,stock_actual,activo)
  VALUES (v_empresa,v_o,v_cat,'ORIG',10.00,7.00,5,'PEN',50,true);
  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,codigo_interno,precio_venta,precio_compra,stock_minimo,moneda,stock_actual,activo)
  VALUES (v_empresa,v_d,v_cat,'LOCAL-DEST',999.00,555.00,50,'USD',10,true);
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','B01',1,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',6)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  PERFORM public.ra_avanzar_estado_guia(v_gid,'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid,'en_transito');
  PERFORM public.ra_recibir_guia(v_gid);

  SELECT * INTO v_dest FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat;
  IF v_dest.stock_actual <> 16 THEN RAISE EXCEPTION 'FALLO B stock destino: % (esperado 16)', v_dest.stock_actual; END IF;
  IF v_dest.codigo_interno <> 'LOCAL-DEST' THEN RAISE EXCEPTION 'FALLO B codigo_interno sobrescrito: %', v_dest.codigo_interno; END IF;
  IF v_dest.precio_venta <> 999.00 THEN RAISE EXCEPTION 'FALLO B precio_venta sobrescrito: %', v_dest.precio_venta; END IF;
  IF v_dest.precio_compra <> 555.00 THEN RAISE EXCEPTION 'FALLO B precio_compra sobrescrito: %', v_dest.precio_compra; END IF;
  IF v_dest.stock_minimo <> 50 THEN RAISE EXCEPTION 'FALLO B stock_minimo sobrescrito: %', v_dest.stock_minimo; END IF;
  IF btrim(v_dest.moneda) <> 'USD' THEN RAISE EXCEPTION 'FALLO B moneda sobrescrita: %', v_dest.moneda; END IF;
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat) <> 1 THEN RAISE EXCEPTION 'FALLO B: fila destino duplicada'; END IF;

  RAISE NOTICE 'B OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== C. Fallos sin efecto parcial (ni fila destino ni stock/kardex/estado) =='
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

  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,stock_actual,activo) VALUES
    (v_empresa,v_o,v_cat,5,true), (v_empresa,v_d,v_cat,0,true);
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','C01',1,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(jsonb_build_object('catalogo_id',v_cat,'cantidad',2)));
  v_gid := (v_res->'guia'->>'id')::uuid;

  -- C.1 estado != en_transito (con destino borrado) -> RA_GUIDE_INVALID_STATE, sin crear fila destino
  DELETE FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat;
  BEGIN PERFORM public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO C1';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_GUIDE_INVALID_STATE%' THEN RAISE EXCEPTION 'FALLO C1: %', SQLERRM; END IF; END;
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat) <> 0 THEN
    RAISE EXCEPTION 'FALLO C1: se creó fila destino';
  END IF;

  PERFORM public.ra_avanzar_estado_guia(v_gid,'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid,'en_transito');

  -- C.2 stock insuficiente (pide 10, hay 5), destino ausente -> el upsert de destino se revierte
  UPDATE ra_guia_items SET cantidad = 10 WHERE guia_id = v_gid;
  BEGIN PERFORM public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO C2';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_STOCK_INSUFFICIENT%' THEN RAISE EXCEPTION 'FALLO C2: %', SQLERRM; END IF; END;
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat) <> 0
     OR (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid) <> 0
     OR (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_cat) <> 5
     OR (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'en_transito' THEN
    RAISE EXCEPTION 'FALLO C2: efecto parcial (fila destino / kardex / stock / estado)';
  END IF;

  -- C.3 producto ausente en origen (y destino) -> RA_PRODUCT_NOT_FOUND_AT_ORIGIN antes del upsert
  UPDATE ra_guia_items SET cantidad = 2 WHERE guia_id = v_gid;
  DELETE FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_cat;
  BEGIN PERFORM public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO C3';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_ORIGIN%' THEN RAISE EXCEPTION 'FALLO C3: %', SQLERRM; END IF; END;
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_cat) <> 0
     OR (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid) <> 0
     OR (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'en_transito' THEN
    RAISE EXCEPTION 'FALLO C3: efecto parcial';
  END IF;

  RAISE NOTICE 'C OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== D. Multi-ítem: uno con destino existente, otro con destino borrado tras crear =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_c1 uuid; v_c2 uuid;
  v_res jsonb; v_gid uuid; v_dest1 ra_productos%ROWTYPE;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_c1 FROM ra_catalogo_repuestos c WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  SELECT id INTO v_c2 FROM ra_catalogo_repuestos c WHERE c.id<>v_c1 AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;

  INSERT INTO ra_productos (empresa_id,sucursal_id,catalogo_id,codigo_interno,precio_venta,stock_minimo,moneda,stock_actual,activo) VALUES
    (v_empresa,v_o,v_c1,'O1',10,5,'PEN',30,true),
    (v_empresa,v_d,v_c1,'DEST-LOCAL',777,9,'USD',4,true),
    (v_empresa,v_o,v_c2,'O2',20,5,'PEN',30,true),
    (v_empresa,v_d,v_c2,NULL,NULL,0,'PEN',0,true);   -- destino c2 presente al CREAR
  INSERT INTO ra_series_documento (empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
  VALUES (v_empresa,v_o,'guia_remision','D01',1,true,true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, jsonb_build_array(
    jsonb_build_object('catalogo_id',v_c1,'cantidad',3),
    jsonb_build_object('catalogo_id',v_c2,'cantidad',7)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  PERFORM public.ra_avanzar_estado_guia(v_gid,'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid,'en_transito');

  DELETE FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c2;  -- c2 destino se pierde

  PERFORM public.ra_recibir_guia(v_gid);

  SELECT * INTO v_dest1 FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c1;
  IF v_dest1.stock_actual <> 7 OR v_dest1.codigo_interno <> 'DEST-LOCAL' OR v_dest1.precio_venta <> 777 OR btrim(v_dest1.moneda) <> 'USD' THEN
    RAISE EXCEPTION 'FALLO D c1: % / % / % / %', v_dest1.stock_actual, v_dest1.codigo_interno, v_dest1.precio_venta, v_dest1.moneda;
  END IF;
  IF (SELECT count(*) FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c2) <> 1 THEN RAISE EXCEPTION 'FALLO D c2 count'; END IF;
  IF (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c2) <> 7 THEN RAISE EXCEPTION 'FALLO D c2 stock'; END IF;
  IF (SELECT codigo_interno FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c2) <> 'O2' THEN RAISE EXCEPTION 'FALLO D c2 codigo copiado'; END IF;
  IF (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c1) <> 27
     OR (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c2) <> 23 THEN
    RAISE EXCEPTION 'FALLO D origen';
  END IF;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid AND motivo='traslado') <> 4 THEN RAISE EXCEPTION 'FALLO D kardex'; END IF;

  RAISE NOTICE 'D OK';
END $$;
ROLLBACK;

\echo '== TODAS LAS SECCIONES PASARON =='
