-- ============================================================
-- supabase/tests/compra-atomica-e2e-fase5.test.sql
-- Fase 5 - Suite autenticada E2E contra Supabase TEST.
--
-- Uso:
--   psql "<conn>" -v ON_ERROR_STOP=1 -v RUN_ID=<guid> \
--     -f supabase/tests/compra-atomica-e2e-fase5.test.sql
--
-- Contratos:
--   * UNA sola base (Supabase TEST). Cero DDL de negocio.
--   * Solo INSERTA filas de prueba etiquetadas con el marcador
--     'F5E2E:<RUN_ID>' (notas / referencia / nombre) en tablas
--     existentes. La limpieza corre en compra-atomica-fase5-cleanup.sql
--     y borra EXCLUSIVAMENTE las filas con ese marcador.
--   * No modifica migraciones 041-044 ni datos preexistentes.
--   * Cada escenario queda COMMITADO (E2E real), salvo S5 que
--     demuestra ROLLBACK total y revierte su trigger transitorio.
-- ============================================================

\set ON_ERROR_STOP on

SELECT set_config('test.run_id', :'RUN_ID', false);

-- ============================================================
-- S0 - Semilla de fixtures etiquetados (COMMIT)
-- ============================================================
DO $$
DECLARE
  v_run  text := current_setting('test.run_id');
  v_admin uuid; v_empresa uuid; v_suc uuid;
  v_prov uuid; v_oc uuid; v_cat1 uuid; v_cat2 uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'FALLO S0: usuario admin de pruebas inexistente'; END IF;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;

  SELECT s.id INTO v_suc FROM ra_sucursales s
   WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  IF v_suc IS NULL THEN RAISE EXCEPTION 'FALLO S0: sin sucursal activa'; END IF;

  INSERT INTO ra_proveedores (empresa_id, nombre)
  VALUES (v_empresa, 'F5E2E:' || v_run || ':PROV')
  RETURNING id INTO v_prov;

  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;
  SELECT catalogo_id INTO v_cat2 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id DESC LIMIT 1;
  IF v_cat1 IS NULL OR v_cat1 = v_cat2 THEN
    RAISE EXCEPTION 'FALLO S0: se requieren >=2 productos distintos en la empresa TEST';
  END IF;

  INSERT INTO ra_ordenes_compra (empresa_id, sucursal_id, proveedor_id, usuario_id,
                                 referencia, estado, notas)
  VALUES (v_empresa, v_suc, v_prov, v_admin,
          'F5E2E:' || v_run || ':OC', 'confirmada', 'F5E2E:' || v_run)
  RETURNING id INTO v_oc;
  INSERT INTO ra_orden_compra_items (orden_compra_id, catalogo_id, nombre_producto,
                                     cantidad, precio_unitario, subtotal)
  VALUES
    (v_oc, v_cat1, 'F5E2E OC L1', 5, 10, 50),
    (v_oc, v_cat2, 'F5E2E OC L2', 3, 20, 60);

  RAISE NOTICE 'OK S0 seed run=% admin=% suc=% prov=% oc=% cat1=% cat2=%',
    v_run, v_admin, v_suc, v_prov, v_oc, v_cat1, v_cat2;
END $$;

-- ============================================================
-- S1 - Exito integral contado, abono total => pagado (COMMIT)
-- subtotal=120, igv=21.60, total=141.60
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_op uuid := md5('f5-s1-' || v_run)::uuid;
  v_admin uuid; v_empresa uuid; v_suc uuid; v_prov uuid;
  v_cat1 uuid; v_cat2 uuid; v_items jsonb;
  v_res jsonb; v_cid uuid; n int;
  v_sa numeric; v_pa numeric; v_sb numeric; v_pb numeric;
  v_ca_esperado numeric; v_cb_esperado numeric;
  v_saldo_antes numeric; v_saldo_despues numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;
  SELECT catalogo_id INTO v_cat2 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id DESC LIMIT 1;

  SELECT stock_actual, COALESCE(precio_compra,0) INTO v_sa, v_pa
    FROM ra_productos WHERE empresa_id=v_empresa AND catalogo_id=v_cat1;
  SELECT stock_actual, COALESCE(precio_compra,0) INTO v_sb, v_pb
    FROM ra_productos WHERE empresa_id=v_empresa AND catalogo_id=v_cat2;
  SELECT saldo_deudor INTO v_saldo_antes FROM ra_proveedores WHERE id=v_prov;

  v_items := jsonb_build_array(
    jsonb_build_object('catalogo_id', v_cat1, 'cantidad', 2, 'precio_unitario', 50),
    jsonb_build_object('catalogo_id', v_cat2, 'cantidad', 1, 'precio_unitario', 20));

  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => 'F5-' || left(v_run,8), p_notas => 'F5E2E:' || v_run || ':S1',
    p_items => v_items,
    p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',141.60,'referencia','f5s1'));

  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S1 status: %', v_res; END IF;
  IF (v_res->>'replayed')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FALLO S1 replayed: %', v_res; END IF;
  IF (v_res->'compra'->>'total_pen')::numeric <> 141.60 THEN RAISE EXCEPTION 'FALLO S1 total: %', v_res; END IF;
  IF (v_res->'compra'->>'estado_pago') <> 'pagado' THEN RAISE EXCEPTION 'FALLO S1 estado_pago: %', v_res; END IF;
  v_cid := (v_res->'compra'->>'id')::uuid;

  SELECT count(*) INTO n FROM ra_compra_items WHERE compra_id=v_cid;
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO S1 items: %', n; END IF;

  SELECT count(*) INTO n FROM ra_kardex WHERE referencia_id=v_cid AND tipo='entrada';
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO S1 kardex: %', n; END IF;

  SELECT count(*) INTO n FROM ra_cuentas_por_pagar_movimientos WHERE compra_id=v_cid;
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO S1 movimientos cxp: %', n; END IF;

  -- stock exacto + costeo promedio ponderado redondeado a 2 decimales
  IF (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND catalogo_id=v_cat1)
     <> v_sa + 2 THEN RAISE EXCEPTION 'FALLO S1 stock cat1'; END IF;
  IF (SELECT stock_actual FROM ra_productos WHERE empresa_id=v_empresa AND catalogo_id=v_cat2)
     <> v_sb + 1 THEN RAISE EXCEPTION 'FALLO S1 stock cat2'; END IF;

  v_ca_esperado := ROUND((v_sa * v_pa + 2 * 50) / NULLIF(v_sa + 2, 0), 2);
  v_cb_esperado := ROUND((v_sb * v_pb + 1 * 20) / NULLIF(v_sb + 1, 0), 2);
  IF (SELECT precio_compra FROM ra_productos WHERE empresa_id=v_empresa AND catalogo_id=v_cat1)
     IS DISTINCT FROM v_ca_esperado THEN RAISE EXCEPTION 'FALLO S1 costeo cat1: esp %',
     v_ca_esperado; END IF;
  IF (SELECT precio_compra FROM ra_productos WHERE empresa_id=v_empresa AND catalogo_id=v_cat2)
     IS DISTINCT FROM v_cb_esperado THEN RAISE EXCEPTION 'FALLO S1 costeo cat2: esp %',
     v_cb_esperado; END IF;

  -- contado con abono total: saldo del proveedor neto intacto (+cargo -abono)
  SELECT saldo_deudor INTO v_saldo_despues FROM ra_proveedores WHERE id=v_prov;
  IF v_saldo_despues <> v_saldo_antes THEN
    RAISE EXCEPTION 'FALLO S1 saldo proveedor: antes % despues %', v_saldo_antes, v_saldo_despues;
  END IF;

  RAISE NOTICE 'OK S1 exito integral contado compra=% total=141.60 pagado costeo ok', v_cid;
END $$;

-- ============================================================
-- S2 - Replay secuencial identico => replayed:true, cero efectos (COMMIT)
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_op uuid := md5('f5-s1-' || v_run)::uuid;
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat1 uuid; v_cat2 uuid;
  v_suc uuid; v_items jsonb; v_res jsonb; v_cid uuid;
  n_compras int; n_cxp int; n_kardex int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;
  SELECT catalogo_id INTO v_cat2 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id DESC LIMIT 1;
  SELECT id INTO v_cid FROM ra_compras WHERE operation_id=v_op;

  SELECT count(*) INTO n_compras FROM ra_compras WHERE operation_id=v_op;
  SELECT count(*) INTO n_cxp FROM ra_cuentas_por_pagar_movimientos m
    JOIN ra_compras c ON c.id=m.compra_id WHERE c.operation_id=v_op;
  SELECT count(*) INTO n_kardex FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id
    WHERE c.operation_id=v_op;

  -- mismo payload pero items en otro orden: el hash canonico los ordena
  v_items := jsonb_build_array(
    jsonb_build_object('catalogo_id', v_cat2, 'cantidad', 1, 'precio_unitario', 20),
    jsonb_build_object('catalogo_id', v_cat1, 'cantidad', 2, 'precio_unitario', 50));

  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => 'F5-' || left(v_run,8), p_notas => 'F5E2E:' || v_run || ':S1',
    p_items => v_items,
    p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',141.60,'referencia','f5s1'));

  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S2 status: %', v_res; END IF;
  IF (v_res->>'replayed')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'FALLO S2 replayed: %', v_res; END IF;
  IF (v_res->'compra'->>'id')::uuid <> v_cid THEN RAISE EXCEPTION 'FALLO S2 id distinto'; END IF;

  IF (SELECT count(*) FROM ra_compras WHERE operation_id=v_op) <> n_compras THEN
    RAISE EXCEPTION 'FALLO S2 nuevas compras'; END IF;
  IF (SELECT count(*) FROM ra_cuentas_por_pagar_movimientos m
        JOIN ra_compras c ON c.id=m.compra_id WHERE c.operation_id=v_op) <> n_cxp THEN
    RAISE EXCEPTION 'FALLO S2 nuevos cargos/abonos'; END IF;
  IF (SELECT count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id
        WHERE c.operation_id=v_op) <> n_kardex THEN
    RAISE EXCEPTION 'FALLO S2 nuevo kardex'; END IF;

  RAISE NOTICE 'OK S2 replay idempotente misma compra=% cero efectos', v_cid;
END $$;

-- ============================================================
-- S3 - Conflicto de hash => RA_IDEMPOTENCY_CONFLICT, cero efectos (COMMIT)
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_op uuid := md5('f5-s1-' || v_run)::uuid;
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat1 uuid;
  v_suc uuid; v_res jsonb; n int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;

  BEGIN
    v_res := public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'F5-' || left(v_run,8), p_notas => 'F5E2E:' || v_run || ':S3',
      p_items => jsonb_build_array(jsonb_build_object(
        'catalogo_id', v_cat1, 'cantidad', 9, 'precio_unitario', 50)));
    RAISE EXCEPTION 'FALLO S3: conflicto no detectado: %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_IDEMPOTENCY_CONFLICT%' THEN
      RAISE EXCEPTION 'FALLO S3 error inesperado: %', SQLERRM;
    END IF;
  END;

  SELECT count(*) INTO n FROM ra_compras WHERE notas LIKE 'F5E2E:'||v_run||':S3%';
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO S3 efectos del perdedor: % compras', n; END IF;

  RAISE NOTICE 'OK S3 conflicto idempotente sin efectos';
END $$;

-- ============================================================
-- S4 - Recuperacion tras timeout: found / not_found / cross-tenant (COMMIT)
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_op uuid := md5('f5-s1-' || v_run)::uuid;
  v_admin uuid; v_empresa uuid; v_cid uuid;
  v_uid2 uuid; v_emp2 uuid; v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- found
  v_res := public.ra_obtener_resultado_compra(v_op);
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S4 found status: %', v_res; END IF;
  SELECT id INTO v_cid FROM ra_compras WHERE operation_id=v_op;
  IF (v_res->'compra'->>'id')::uuid <> v_cid THEN RAISE EXCEPTION 'FALLO S4 found id'; END IF;

  -- not_found (operacion inexistente)
  v_res := public.ra_obtener_resultado_compra(md5('f5-inexistente-'||v_run)::uuid);
  IF (v_res->>'status') <> 'not_found' THEN RAISE EXCEPTION 'FALLO S4 not_found: %', v_res; END IF;

  -- cross-tenant: usuario admin de OTRA empresa consulta el op => not_found sin fuga
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  v_uid2 := md5('f5-user2-'||v_run)::uuid;
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at,
                          raw_app_meta_data, raw_user_meta_data,
                          confirmation_token, recovery_token,
                          email_change_token_new, email_change)
  VALUES ('00000000-0000-0000-0000-000000000000', v_uid2, 'authenticated', 'authenticated',
          'fase5e2e+'||v_run||'@example.invalid', 'x', now(), now(), now(),
          '{"provider":"email","providers":["email"]}', '{}', '', '', '', '');
  INSERT INTO ra_empresas (nombre, slug) VALUES ('F5E2E:'||v_run, 'f5e2e-'||left(v_run,12))
  RETURNING id INTO v_emp2;
  -- ra_handle_new_user (trigger en auth.users) ya creo el perfil: se actualiza
  UPDATE ra_perfiles
     SET empresa_id=v_emp2, nombre='F5E2E OTRO ADMIN', rol='administrador', activo=true
   WHERE id=v_uid2;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_uid2)::text, true);
  BEGIN
    v_res := public.ra_obtener_resultado_compra(v_op);
    IF (v_res->>'status') IS DISTINCT FROM 'not_found' THEN
      RAISE EXCEPTION 'FALLO S4 cross-tenant expuso datos: %', v_res;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- rechazo sin filtrar existencia tambien es aceptable
    IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' AND SQLERRM NOT LIKE '%RA_BRANCH_INVALID%'
       AND SQLERRM NOT LIKE '%RA_NOT_FOUND%' THEN
      RAISE EXCEPTION 'FALLO S4 cross-tenant error inesperado: %', SQLERRM;
    END IF;
  END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  RAISE NOTICE 'OK S4 found/not_found/cross-tenant user2=% emp2=% cid=%', v_uid2, v_emp2, v_cid;
END $$;

-- ============================================================
-- S5 - Rollback total por fallo inyectado (ROLLBACK final)
-- Trigger transitorio pg_temp sobre ra_kardex; el propio ROLLBACK
-- revierte tambien el DDL del trigger.
-- ============================================================
BEGIN;

CREATE FUNCTION pg_temp.f5_fault_raise() RETURNS trigger
LANGUAGE plpgsql AS $fn$ BEGIN RAISE EXCEPTION 'F5_FAULT_INYECTADO'; END $fn$;

CREATE TRIGGER f5_fault_trigger
  BEFORE INSERT ON public.ra_kardex
  FOR EACH ROW EXECUTE FUNCTION pg_temp.f5_fault_raise();

DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_op uuid := md5('f5-s5-' || v_run)::uuid;
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat1 uuid; v_suc uuid;
  v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;

  BEGIN
    v_res := public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => 'F5E2E:' || v_run || ':S5',
      p_items => jsonb_build_array(jsonb_build_object(
        'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 10)));
    RAISE EXCEPTION 'FALLO S5: RPC tuvo exito sin pasar por kardex';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%F5_FAULT_INYECTADO%' THEN
      RAISE EXCEPTION 'FALLO S5 error inesperado: %', SQLERRM;
    END IF;
  END;

  -- dentro de la misma transaccion abortada: NINGUN efecto parcial visible
  IF EXISTS (SELECT 1 FROM ra_compras WHERE operation_id=v_op) THEN
    RAISE EXCEPTION 'FALLO S5: cabecera persistida tras fallo';
  END IF;
  IF EXISTS (SELECT 1 FROM ra_cuentas_por_pagar_movimientos WHERE referencia LIKE 'f5s5%') THEN
    RAISE EXCEPTION 'FALLO S5: cxp persistida tras fallo';
  END IF;
  RAISE NOTICE 'OK S5 rollback intra-transaccion verificado';
END $$;

ROLLBACK;

-- post-check autocommit: nada de S5 sobrevivio
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  n int;
BEGIN
  SELECT count(*) INTO n FROM ra_compras
   WHERE operation_id = md5('f5-s5-' || v_run)::uuid
      OR notas LIKE 'F5E2E:'||v_run||':S5%';
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO S5 post: % residuos', n; END IF;
  IF TO_REGCLASS('pg_temp.f5_fault_raise') IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO S5 post: trigger temporal sobrevivio';
  END IF;
  RAISE NOTICE 'OK S5 rollback total confirmado post-transaccion';
END $$;

-- ============================================================
-- S6 - Recepcion parcial de OC hasta cierre recibida (COMMIT)
-- L1: 5 uds cat1; L2: 3 uds cat2
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_admin uuid; v_empresa uuid; v_prov uuid; v_suc uuid;
  v_oc uuid; v_l1 uuid; v_l2 uuid; v_cat1 uuid; v_cat2 uuid;
  v_res jsonb; v_estado text; v_recibida numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;
  SELECT catalogo_id INTO v_cat2 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id DESC LIMIT 1;
  SELECT id INTO v_oc FROM ra_ordenes_compra WHERE referencia='F5E2E:'||v_run||':OC';

  -- A: recibe TODA la linea 1
  v_res := public.ra_confirmar_compra(
    p_operation_id => md5('f5-s6a-'||v_run)::uuid,
    p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':S6A',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat1, 'cantidad', 5, 'precio_unitario', 12)),
    p_orden_compra_id => v_oc);
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S6A: %', v_res; END IF;

  SELECT estado, cantidad_recibida INTO v_estado, v_recibida
    FROM ra_ordenes_compra o JOIN ra_orden_compra_items i ON i.orden_compra_id=o.id
   WHERE o.id=v_oc AND i.catalogo_id=v_cat1;
  IF v_estado <> 'confirmada' THEN RAISE EXCEPTION 'FALLO S6A OC cerro antes de tiempo: %', v_estado; END IF;
  IF v_recibida <> 5 THEN RAISE EXCEPTION 'FALLO S6A recibida L1: %', v_recibida; END IF;

  -- B: recibe PARCIAL la linea 2 (2 de 3)
  v_res := public.ra_confirmar_compra(
    p_operation_id => md5('f5-s6b-'||v_run)::uuid,
    p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':S6B',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat2, 'cantidad', 2, 'precio_unitario', 22)),
    p_orden_compra_id => v_oc);
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S6B: %', v_res; END IF;

  SELECT estado INTO v_estado FROM ra_ordenes_compra WHERE id=v_oc;
  IF v_estado <> 'confirmada' THEN RAISE EXCEPTION 'FALLO S6B cerro con linea pendiente'; END IF;
  SELECT cantidad_recibida INTO v_recibida FROM ra_orden_compra_items
   WHERE orden_compra_id=v_oc AND catalogo_id=v_cat2;
  IF v_recibida <> 2 THEN RAISE EXCEPTION 'FALLO S6B recibida L2: %', v_recibida; END IF;

  -- C: completa la linea 2 => OC recibida
  v_res := public.ra_confirmar_compra(
    p_operation_id => md5('f5-s6c-'||v_run)::uuid,
    p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':S6C',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat2, 'cantidad', 1, 'precio_unitario', 25)),
    p_orden_compra_id => v_oc);
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S6C: %', v_res; END IF;

  SELECT estado INTO v_estado FROM ra_ordenes_compra WHERE id=v_oc;
  IF v_estado <> 'recibida' THEN RAISE EXCEPTION 'FALLO S6C OC no cerro recibida: %', v_estado; END IF;

  RAISE NOTICE 'OK S6 recepcion parcial A/B y cierre recibida en C oc=%', v_oc;
END $$;

-- ============================================================
-- S7 - Credito con abono parcial => parcial; metodo credito rechazado (COMMIT)
-- subtotal=100, igv=18, total=118, abono=40 => saldo proveedor +78
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_op uuid := md5('f5-s7-' || v_run)::uuid;
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat1 uuid; v_suc uuid;
  v_res jsonb; v_cid uuid; n int;
  v_saldo_antes numeric; v_saldo_despues numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;
  SELECT saldo_deudor INTO v_saldo_antes FROM ra_proveedores WHERE id=v_prov;

  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':S7',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 100)),
    p_tipo_documento => 'BOLETA',
    p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',40,'referencia','f5s7'));

  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S7 status: %', v_res; END IF;
  IF (v_res->'compra'->>'estado_pago') <> 'parcial' THEN RAISE EXCEPTION 'FALLO S7 estado: %', v_res; END IF;
  v_cid := (v_res->'compra'->>'id')::uuid;

  SELECT count(*) INTO n FROM ra_cuentas_por_pagar_movimientos WHERE compra_id=v_cid;
  IF n <> 2 THEN RAISE EXCEPTION 'FALLO S7 movimientos: %', n; END IF;
  IF NOT EXISTS (SELECT 1 FROM ra_cuentas_por_pagar_movimientos
                  WHERE compra_id=v_cid AND tipo='cargo' AND monto=118)
  OR NOT EXISTS (SELECT 1 FROM ra_cuentas_por_pagar_movimientos
                  WHERE compra_id=v_cid AND tipo='abono' AND monto=40) THEN
    RAISE EXCEPTION 'FALLO S7 montos ledger incorrectos';
  END IF;

  SELECT saldo_deudor INTO v_saldo_despues FROM ra_proveedores WHERE id=v_prov;
  IF ROUND(v_saldo_despues - v_saldo_antes, 2) <> 78 THEN
    RAISE EXCEPTION 'FALLO S7 saldo delta: antes % despues %', v_saldo_antes, v_saldo_despues;
  END IF;

  -- abono con metodo credito => RA_PAYMENT_METHOD_INVALID, sin efectos
  BEGIN
    v_res := public.ra_confirmar_compra(
      p_operation_id => md5('f5-s7bad-'||v_run)::uuid,
      p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':S7BAD',
      p_items => jsonb_build_array(jsonb_build_object(
        'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 10)),
      p_abono_inicial => jsonb_build_object('metodoPago','credito','monto',5));
    RAISE EXCEPTION 'FALLO S7: credito aceptado como abono: %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PAYMENT_METHOD_INVALID%' THEN
      RAISE EXCEPTION 'FALLO S7 error inesperado: %', SQLERRM;
    END IF;
  END;

  SELECT count(*) INTO n FROM ra_compras WHERE notas LIKE 'F5E2E:'||v_run||':S7BAD%';
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO S7BAD efectos residuales: %', n; END IF;

  RAISE NOTICE 'OK S7 credito parcial compra=% delta saldo=78 y credito rechazado', v_cid;
END $$;

-- ============================================================
-- S8 - Unicidad de factura (COMMIT)
-- uq (empresa_id, proveedor_id, tipo_documento, nro_doc_norm)
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_doc text := 'F5D-' || left(v_run,8);
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat1 uuid; v_suc uuid;
  v_res jsonb; n int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;

  -- FACTURA doc D -> OK
  v_res := public.ra_confirmar_compra(
    p_operation_id => md5('f5-s8a-'||v_run)::uuid,
    p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => v_doc, p_notas => 'F5E2E:'||v_run||':S8A',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 11)),
    p_tipo_documento => 'FACTURA');
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S8A: %', v_res; END IF;

  -- FACTURA doc D duplicada -> RA_INVOICE_DUPLICATE
  BEGIN
    v_res := public.ra_confirmar_compra(
      p_operation_id => md5('f5-s8dup-'||v_run)::uuid,
      p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => ' ' || upper(v_doc) || ' ',  -- normalizacion btrim/upper
      p_notas => 'F5E2E:'||v_run||':S8DUP',
      p_items => jsonb_build_array(jsonb_build_object(
        'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 11)),
      p_tipo_documento => 'FACTURA');
    RAISE EXCEPTION 'FALLO S8DUP duplicado aceptado: %', v_res;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_INVOICE_DUPLICATE%' THEN
      RAISE EXCEPTION 'FALLO S8DUP error inesperado: %', SQLERRM;
    END IF;
  END;

  -- BOLETA mismo numero -> permitido
  v_res := public.ra_confirmar_compra(
    p_operation_id => md5('f5-s8b-'||v_run)::uuid,
    p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => lower(v_doc), p_notas => 'F5E2E:'||v_run||':S8B',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 11)),
    p_tipo_documento => 'BOLETA');
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO S8B: %', v_res; END IF;

  -- NULL dos veces -> permitido
  v_res := public.ra_confirmar_compra(
    p_operation_id => md5('f5-s8n1-'||v_run)::uuid,
    p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':S8N1',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 11)));
  v_res := public.ra_confirmar_compra(
    p_operation_id => md5('f5-s8n2-'||v_run)::uuid,
    p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':S8N2',
    p_items => jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 11)));

  SELECT count(*) INTO n FROM ra_compras WHERE notas LIKE 'F5E2E:'||v_run||':S8DUP%';
  IF n <> 0 THEN RAISE EXCEPTION 'FALLO S8DUP residuos: %', n; END IF;

  RAISE NOTICE 'OK S8 unicidad factura (duplicado rechazado, boleta/null permitidos)';
END $$;

-- ============================================================
-- S9 - Proyeccion estado_pago consistente + reparacion changed:false (COMMIT)
-- ============================================================
DO $$
DECLARE
  v_run text := current_setting('test.run_id');
  v_admin uuid; v_empresa uuid; v_prov uuid;
  v_res jsonb; n int; r record;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';

  -- toda compra RUN_ID: proyeccion del ledger == almacenada
  FOR r IN
    SELECT c.id, c.total,
           COALESCE(SUM(m.monto) FILTER (WHERE m.tipo='abono'), 0) AS pagado
      FROM ra_compras c
      LEFT JOIN ra_cuentas_por_pagar_movimientos m ON m.compra_id=c.id
     WHERE c.proveedor_id=v_prov
     GROUP BY c.id, c.total
  LOOP
    IF r.pagado >= r.total AND (SELECT estado_pago FROM ra_compras WHERE id=r.id) <> 'pagado' THEN
      RAISE EXCEPTION 'FALLO S9 compra % deberia estar pagada', r.id;
    ELSIF r.pagado > 0 AND r.pagado < r.total
      AND (SELECT estado_pago FROM ra_compras WHERE id=r.id) <> 'parcial' THEN
      RAISE EXCEPTION 'FALLO S9 compra % deberia estar parcial', r.id;
    ELSIF r.pagado = 0
      AND (SELECT estado_pago FROM ra_compras WHERE id=r.id) NOT IN ('pendiente','pagado') THEN
      RAISE EXCEPTION 'FALLO S9 compra % proyeccion inconsistente', r.id;
    END IF;
  END LOOP;

  -- reparacion auditada sobre compra ya consistente => changed:false
  v_res := public.ra_recalcular_estado_pago(
    md5('f5-s9-'||v_run)::uuid,
    (SELECT id FROM ra_compras WHERE notas='F5E2E:'||v_run||':S7'),
    'f5e2e-proyeccion-'||v_run);
  IF (v_res->>'status') <> 'ok' THEN RAISE EXCEPTION 'FALLO S9 recalcular status: %', v_res; END IF;
  IF (v_res->>'changed')::boolean IS NOT FALSE THEN RAISE EXCEPTION 'FALLO S9 changed esperaba false: %', v_res; END IF;

  SELECT count(*) INTO n FROM ra_auditoria_estado_pago_compras
   WHERE motivo='f5e2e-proyeccion-'||v_run;
  IF n <> 1 THEN RAISE EXCEPTION 'FALLO S9 auditorias: %', n; END IF;

  RAISE NOTICE 'OK S9 proyeccion consistente, changed:false y auditoria no-op registrada';
END $$;

\echo 'FASE 5 SUITE COMPLETADA'
