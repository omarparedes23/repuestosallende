-- ============================================================
-- 050_guia_traslado.test.sql
-- TDD contra ra_crear_guia / ra_avanzar_estado_guia / ra_recibir_guia (050)
--
-- REQUIERE: 045 aplicada + 050 aplicada.
-- Ejecutar como postgres en SUPABASE TEST:
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/guia-traslado-inventario-segura/sql/tests/050_guia_traslado.test.sql
--
-- Sesión simulada con set_config('request.jwt.claims', json{sub}, true).
-- Cada sección corre en BEGIN ... ROLLBACK: cero residuos.
-- Fixtures: empresa 10101010 (admin/vendedor/lectura, 2 sucursales).
-- Los catálogos se eligen SIN producto previo en la empresa para no chocar
-- con el UNIQUE (empresa, sucursal, catalogo).
-- Concurrencia (orden de locks; dos recepciones y dos creaciones que compiten):
--   openspec/changes/guia-traslado-inventario-segura/sql/tests/guia-concurrencia-runner.ps1
-- ============================================================

\set ON_ERROR_STOP on

-- ============================================================
\echo '== A. Autorización =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_vend uuid; v_lect uuid; v_empresa uuid;
  v_o uuid; v_d uuid; v_cat uuid; v_items jsonb; v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT p.id INTO v_vend FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.vendedor.idempotencia@test.local' AND p.activo;
  SELECT p.id INTO v_lect FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.lectura.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo) VALUES
    (v_empresa, v_o, v_cat, 100, true), (v_empresa, v_d, v_cat, 0, true);
  v_items := jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 2));

  IF v_admin IS NULL OR v_vend IS NULL OR v_lect IS NULL OR v_o IS NULL OR v_d IS NULL OR v_cat IS NULL THEN
    RAISE EXCEPTION 'FALLO: fixtures insuficientes';
  END IF;

  -- A.1 sin sesión -> RA_UNAUTHENTICATED
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A1: esperaba RA_UNAUTHENTICATED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_UNAUTHENTICATED%' THEN RAISE EXCEPTION 'FALLO A1: %', SQLERRM; END IF;
  END;

  -- A.2 vendedor -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_vend)::text, true);
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A2';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO A2: %', SQLERRM; END IF;
  END;

  -- A.3 lectura -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lect)::text, true);
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A3';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO A3: %', SQLERRM; END IF;
  END;

  -- A.4 admin -> OK
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  v_res := public.ra_crear_guia(v_o, v_d, 'T001', 1, 'A4', v_items);
  IF (v_res->>'status') <> 'created' THEN RAISE EXCEPTION 'FALLO A4: %', v_res; END IF;

  RAISE NOTICE 'A OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== B. ra_crear_guia — validaciones =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid;
  v_cat uuid;   -- producto en origen Y destino
  v_cat2 uuid;  -- sin producto en ningún lado
  v_cat3 uuid;  -- producto solo en origen
  v_res jsonb; v_gid uuid; v_nom text; v_nom_cat text;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;

  SELECT id INTO v_cat  FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  SELECT id INTO v_cat2 FROM ra_catalogo_repuestos c
   WHERE c.id<>v_cat AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  SELECT id INTO v_cat3 FROM ra_catalogo_repuestos c
   WHERE c.id NOT IN (v_cat, v_cat2)
     AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;

  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo) VALUES
    (v_empresa, v_o, v_cat,  100, true), (v_empresa, v_d, v_cat, 0, true),
    (v_empresa, v_o, v_cat3, 100, true);   -- v_cat3 SOLO en origen
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- B.1 origen == destino
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_o, NULL, NULL, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B1';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_SAME_BRANCH%' THEN RAISE EXCEPTION 'FALLO B1: %', SQLERRM; END IF;
  END;

  -- B.2 sucursal destino ajena
  BEGIN
    v_res := public.ra_crear_guia(v_o, (SELECT id FROM ra_sucursales WHERE empresa_id<>v_empresa LIMIT 1),
             NULL, NULL, NULL, jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B2';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_INVALID_BRANCH%' THEN RAISE EXCEPTION 'FALLO B2: %', SQLERRM; END IF;
  END;

  -- B.3 items vacío
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL, '[]'::jsonb);
    RAISE EXCEPTION 'FALLO B3';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_EMPTY%' THEN RAISE EXCEPTION 'FALLO B3: %', SQLERRM; END IF;
  END;

  -- B.4 cantidad <= 0
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 0)));
    RAISE EXCEPTION 'FALLO B4';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_ITEM_INVALID%' THEN RAISE EXCEPTION 'FALLO B4: %', SQLERRM; END IF;
  END;

  -- B.4b catalogo_id ausente
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
             jsonb_build_array(jsonb_build_object('cantidad', 1)));
    RAISE EXCEPTION 'FALLO B4b';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_ITEM_INVALID%' THEN RAISE EXCEPTION 'FALLO B4b: %', SQLERRM; END IF;
  END;

  -- B.4c catalogo_id nulo
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', NULL, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B4c';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_ITEM_INVALID%' THEN RAISE EXCEPTION 'FALLO B4c: %', SQLERRM; END IF;
  END;

  -- B.5 catálogo duplicado
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL, jsonb_build_array(
             jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1),
             jsonb_build_object('catalogo_id', v_cat, 'cantidad', 2)));
    RAISE EXCEPTION 'FALLO B5';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_DUPLICATE_ITEM%' THEN RAISE EXCEPTION 'FALLO B5: %', SQLERRM; END IF;
  END;

  -- B.6 catálogo sin fila en origen
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat2, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B6';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_ORIGIN%' THEN RAISE EXCEPTION 'FALLO B6: %', SQLERRM; END IF;
  END;

  -- B.6b catálogo con fila en origen pero NO en destino
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat3, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B6b';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_DESTINATION%' THEN RAISE EXCEPTION 'FALLO B6b: %', SQLERRM; END IF;
  END;

  -- B.7 numeración incompleta: serie sin correlativo
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, 'T001', NULL, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B7';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_NUMBER_INCOMPLETE%' THEN RAISE EXCEPTION 'FALLO B7: %', SQLERRM; END IF;
  END;

  -- B.7b numeración incompleta: correlativo sin serie
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, '   ', 5, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B7b';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_NUMBER_INCOMPLETE%' THEN RAISE EXCEPTION 'FALLO B7b: %', SQLERRM; END IF;
  END;

  -- B.7c correlativo <= 0
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, 'T001', 0, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B7c';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_NUMBER_INCOMPLETE%' THEN RAISE EXCEPTION 'FALLO B7c: %', SQLERRM; END IF;
  END;

  -- B.8 happy path: cabecera + item, nombre autoritativo, notas normalizadas
  v_res := public.ra_crear_guia(v_o, v_d, 'T001', 8, '  nota  ',
           jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 3)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  IF (v_res->'guia'->>'estado') <> 'borrador' THEN RAISE EXCEPTION 'FALLO B8 estado'; END IF;
  IF (SELECT count(*) FROM ra_guia_items WHERE guia_id=v_gid) <> 1 THEN RAISE EXCEPTION 'FALLO B8 items'; END IF;
  SELECT nombre_producto INTO v_nom FROM ra_guia_items WHERE guia_id=v_gid;
  SELECT nombre INTO v_nom_cat FROM ra_catalogo_repuestos WHERE id=v_cat;
  IF v_nom IS DISTINCT FROM v_nom_cat THEN RAISE EXCEPTION 'FALLO B8: nombre no autoritativo (% vs %)', v_nom, v_nom_cat; END IF;
  IF (SELECT notas FROM ra_guias_remision WHERE id=v_gid) <> 'nota' THEN RAISE EXCEPTION 'FALLO B8: notas sin normalizar'; END IF;

  -- B.9 numeración duplicada (T001-8 ya existe por B.8)
  BEGIN
    v_res := public.ra_crear_guia(v_o, v_d, 'T001', 8, NULL,
             jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
    RAISE EXCEPTION 'FALLO B9';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_DUPLICATE_NUMBER%' THEN RAISE EXCEPTION 'FALLO B9: %', SQLERRM; END IF;
  END;

  -- B.10 sin numeración (serie y correlativo NULL) -> OK, y se puede repetir
  v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
           jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
  IF (v_res->>'status') <> 'created' THEN RAISE EXCEPTION 'FALLO B10a'; END IF;
  v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
           jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
  IF (v_res->>'status') <> 'created' THEN RAISE EXCEPTION 'FALLO B10b (NULLs no deben chocar en el índice)'; END IF;

  RAISE NOTICE 'B OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== C. ra_avanzar_estado_guia =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_cat uuid;
  v_res jsonb; v_gid uuid; v_gid_vacia uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_cat FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo) VALUES
    (v_empresa, v_o, v_cat, 100, true), (v_empresa, v_d, v_cat, 0, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
           jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 5)));
  v_gid := (v_res->'guia'->>'id')::uuid;

  -- C.1 borrador -> en_transito (salto) rechazado
  BEGIN
    v_res := public.ra_avanzar_estado_guia(v_gid, 'en_transito');
    RAISE EXCEPTION 'FALLO C1';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_INVALID_STATE%' THEN RAISE EXCEPTION 'FALLO C1: %', SQLERRM; END IF;
  END;

  -- C.2 borrador -> emitida (fecha_emision se fija)
  v_res := public.ra_avanzar_estado_guia(v_gid, 'emitida');
  IF (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'emitida' THEN RAISE EXCEPTION 'FALLO C2 estado'; END IF;
  IF (SELECT fecha_emision FROM ra_guias_remision WHERE id=v_gid) IS NULL THEN RAISE EXCEPTION 'FALLO C2 fecha'; END IF;

  -- C.3 emitida -> en_transito
  v_res := public.ra_avanzar_estado_guia(v_gid, 'en_transito');
  IF (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'en_transito' THEN RAISE EXCEPTION 'FALLO C3'; END IF;

  -- C.4 en_transito -> emitida (retroceso) rechazado
  BEGIN
    v_res := public.ra_avanzar_estado_guia(v_gid, 'emitida');
    RAISE EXCEPTION 'FALLO C4';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_INVALID_STATE%' THEN RAISE EXCEPTION 'FALLO C4: %', SQLERRM; END IF;
  END;

  -- C.5 emitir guía vacía -> RA_GUIDE_EMPTY
  INSERT INTO ra_guias_remision (empresa_id, sucursal_origen_id, sucursal_destino_id, usuario_id, estado)
  VALUES (v_empresa, v_o, v_d, v_admin, 'borrador') RETURNING id INTO v_gid_vacia;
  BEGIN
    v_res := public.ra_avanzar_estado_guia(v_gid_vacia, 'emitida');
    RAISE EXCEPTION 'FALLO C5';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_EMPTY%' THEN RAISE EXCEPTION 'FALLO C5: %', SQLERRM; END IF;
  END;

  -- C.6 guía ajena / inexistente -> RA_GUIDE_NOT_FOUND
  BEGIN
    v_res := public.ra_avanzar_estado_guia(gen_random_uuid(), 'emitida');
    RAISE EXCEPTION 'FALLO C6';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_NOT_FOUND%' THEN RAISE EXCEPTION 'FALLO C6: %', SQLERRM; END IF;
  END;

  RAISE NOTICE 'C OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== D. ra_recibir_guia — happy path (kardex doble, estado) =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_c1 uuid; v_c2 uuid;
  v_res jsonb; v_gid uuid;
  v_so1 numeric; v_sd1 numeric; v_so2 numeric; v_sd2 numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_c1 FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  SELECT id INTO v_c2 FROM ra_catalogo_repuestos c
   WHERE c.id<>v_c1 AND NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo) VALUES
    (v_empresa, v_o, v_c1, 50, true), (v_empresa, v_d, v_c1, 10, true),
    (v_empresa, v_o, v_c2, 30, true), (v_empresa, v_d, v_c2,  0, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL, jsonb_build_array(
           jsonb_build_object('catalogo_id', v_c1, 'cantidad', 8),
           jsonb_build_object('catalogo_id', v_c2, 'cantidad', 5)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'en_transito');

  v_res := public.ra_recibir_guia(v_gid);
  IF (v_res->>'status') <> 'received' THEN RAISE EXCEPTION 'FALLO D: %', v_res; END IF;

  SELECT stock_actual INTO v_so1 FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c1;
  SELECT stock_actual INTO v_sd1 FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c1;
  SELECT stock_actual INTO v_so2 FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c2;
  SELECT stock_actual INTO v_sd2 FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c2;
  IF v_so1<>42 OR v_sd1<>18 OR v_so2<>25 OR v_sd2<>5 THEN
    RAISE EXCEPTION 'FALLO D stock: %/%/%/% (esperado 42/18/25/5)', v_so1, v_sd1, v_so2, v_sd2;
  END IF;

  IF (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'recibida' THEN RAISE EXCEPTION 'FALLO D estado'; END IF;
  IF (SELECT fecha_recepcion FROM ra_guias_remision WHERE id=v_gid) IS NULL THEN RAISE EXCEPTION 'FALLO D fecha_recepcion'; END IF;

  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid) <> 4 THEN RAISE EXCEPTION 'FALLO D kardex count'; END IF;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid AND tipo='salida'  AND sucursal_id=v_o AND motivo='traslado') <> 2 THEN RAISE EXCEPTION 'FALLO D kardex salida'; END IF;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid AND tipo='entrada' AND sucursal_id=v_d AND motivo='traslado') <> 2 THEN RAISE EXCEPTION 'FALLO D kardex entrada'; END IF;

  RAISE NOTICE 'D OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== E. ra_recibir_guia — negativos sin efectos parciales =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_c1 uuid;
  v_res jsonb; v_gid uuid; v_so_ini numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_c1 FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo) VALUES
    (v_empresa, v_o, v_c1, 5, true), (v_empresa, v_d, v_c1, 0, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- E.1 estado != en_transito -> RA_GUIDE_INVALID_STATE (sigue en borrador)
  v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
           jsonb_build_array(jsonb_build_object('catalogo_id', v_c1, 'cantidad', 2)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  BEGIN
    PERFORM public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO E1: esperaba RA_GUIDE_INVALID_STATE';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_INVALID_STATE%' THEN RAISE EXCEPTION 'FALLO E1: %', SQLERRM; END IF;
  END;

  -- E.2 stock insuficiente (pide 10, hay 5)
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'en_transito');
  UPDATE ra_guia_items SET cantidad = 10 WHERE guia_id = v_gid;
  v_so_ini := (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c1);
  BEGIN
    PERFORM public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO E2: esperaba RA_STOCK_INSUFFICIENT';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_STOCK_INSUFFICIENT%' THEN RAISE EXCEPTION 'FALLO E2: %', SQLERRM; END IF;
  END;
  IF (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c1) <> v_so_ini
     OR (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid) <> 0
     OR (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'en_transito' THEN
    RAISE EXCEPTION 'FALLO E2: efecto parcial tras RA_STOCK_INSUFFICIENT';
  END IF;

  -- E.3 producto ausente en destino
  UPDATE ra_guia_items SET cantidad = 2 WHERE guia_id = v_gid;
  DELETE FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c1;
  BEGIN
    PERFORM public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO E3: esperaba RA_PRODUCT_NOT_FOUND_AT_DESTINATION';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_DESTINATION%' THEN RAISE EXCEPTION 'FALLO E3: %', SQLERRM; END IF;
  END;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid) <> 0
     OR (SELECT estado FROM ra_guias_remision WHERE id=v_gid) <> 'en_transito' THEN
    RAISE EXCEPTION 'FALLO E3: efecto parcial';
  END IF;

  -- E.4 producto ausente en origen
  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo)
  VALUES (v_empresa, v_d, v_c1, 0, true);                                         -- repone destino
  DELETE FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c1;  -- quita origen
  BEGIN
    PERFORM public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO E4: esperaba RA_PRODUCT_NOT_FOUND_AT_ORIGIN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PRODUCT_NOT_FOUND_AT_ORIGIN%' THEN RAISE EXCEPTION 'FALLO E4: %', SQLERRM; END IF;
  END;
  IF (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid) <> 0
     OR (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d AND catalogo_id=v_c1) <> 0 THEN
    RAISE EXCEPTION 'FALLO E4: efecto parcial (stock creado en destino sin origen)';
  END IF;

  RAISE NOTICE 'E OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== F. Doble recepción =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_c1 uuid;
  v_res jsonb; v_gid uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_c1 FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo) VALUES
    (v_empresa, v_o, v_c1, 20, true), (v_empresa, v_d, v_c1, 0, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
           jsonb_build_array(jsonb_build_object('catalogo_id', v_c1, 'cantidad', 6)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'en_transito');
  PERFORM public.ra_recibir_guia(v_gid);   -- 1.ª: OK

  BEGIN
    PERFORM public.ra_recibir_guia(v_gid); -- 2.ª: rechazo
    RAISE EXCEPTION 'FALLO F';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_INVALID_STATE%' THEN RAISE EXCEPTION 'FALLO F: %', SQLERRM; END IF;
  END;

  IF (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_o AND catalogo_id=v_c1) <> 14
     OR (SELECT count(*) FROM ra_kardex WHERE referencia_id=v_gid) <> 2 THEN
    RAISE EXCEPTION 'FALLO F: la doble recepción duplicó efectos';
  END IF;

  RAISE NOTICE 'F OK';
END $$;
ROLLBACK;

-- ============================================================
\echo '== G. Cross-tenant =='
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_o uuid; v_d uuid; v_c1 uuid;
  v_otro uuid; v_res jsonb; v_gid uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.admin.idempotencia@test.local' AND p.activo;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_o FROM ra_sucursales WHERE empresa_id=v_empresa AND activo ORDER BY id LIMIT 1;
  SELECT id INTO v_d FROM ra_sucursales WHERE empresa_id=v_empresa AND activo AND id<>v_o ORDER BY id LIMIT 1;
  SELECT id INTO v_c1 FROM ra_catalogo_repuestos c
   WHERE NOT EXISTS (SELECT 1 FROM ra_productos p WHERE p.empresa_id=v_empresa AND p.catalogo_id=c.id)
   ORDER BY c.id LIMIT 1;
  INSERT INTO ra_productos (empresa_id, sucursal_id, catalogo_id, stock_actual, activo) VALUES
    (v_empresa, v_o, v_c1, 20, true), (v_empresa, v_d, v_c1, 0, true);

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  v_res := public.ra_crear_guia(v_o, v_d, NULL, NULL, NULL,
           jsonb_build_array(jsonb_build_object('catalogo_id', v_c1, 'cantidad', 3)));
  v_gid := (v_res->'guia'->>'id')::uuid;
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'emitida');
  PERFORM public.ra_avanzar_estado_guia(v_gid, 'en_transito');

  -- admin de OTRA empresa (rol elevado temporalmente dentro del ROLLBACK)
  SELECT p.id INTO v_otro FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email='test.otraempresa.idempotencia@test.local' AND p.activo;
  UPDATE ra_perfiles SET rol='administrador' WHERE id=v_otro;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_otro)::text, true);

  BEGIN
    v_res := public.ra_recibir_guia(v_gid);
    RAISE EXCEPTION 'FALLO G';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_NOT_FOUND%' THEN RAISE EXCEPTION 'FALLO G: %', SQLERRM; END IF;
  END;

  BEGIN
    v_res := public.ra_avanzar_estado_guia(v_gid, 'emitida');
    RAISE EXCEPTION 'FALLO G2';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_GUIDE_NOT_FOUND%' THEN RAISE EXCEPTION 'FALLO G2: %', SQLERRM; END IF;
  END;

  RAISE NOTICE 'G OK';
END $$;
ROLLBACK;

\echo '== TODAS LAS SECCIONES PASARON =='
