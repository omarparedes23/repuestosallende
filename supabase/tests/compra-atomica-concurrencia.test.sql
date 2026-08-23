-- ============================================================
-- supabase/tests/compra-atomica-concurrencia.test.sql  (rev.5)
-- Parametros (runner): -v SES=A|B -v SCN=1|2|3|4|5 -v RUN_ID=<guid>
--
-- Escenarios:
--   1 Docs distintos, mismos productos orden inverso -> ambos OK.
--   2 MISMA factura, op distintos -> 1 OK + 1 RA_INVOICE_DUPLICATE.
--   3 MISMO operation_id + payload identico -> misma compra, una
--     confirmed y una replayed:true; 1 compra/1 cargo/1 kardex.
--   4 MISMO operation_id + payload distinto -> 1 OK +
--     1 RA_IDEMPOTENCY_CONFLICT; cero efectos del perdedor.
--   5 REPARACION concurrente (ra_recalcular_estado_pago): mismo
--     repair operation_id, misma compra y motivo -> una ejecuta
--     (changed:true, replayed:false) y la otra hace replay
--     (changed:true, replayed:true); UNA sola fila de auditoria. El replay
--     conserva el resultado original, incluido changed.
--
-- Salida parseable por el runner:
-- RESULT:<SES>:<pid>:<t0>:<t1>:<t2>:<outcome>:<op>:<cid|->:<rep|->:<changed|->
-- ============================================================

\set ON_ERROR_STOP on

SELECT set_config('test.ses', :'SES', false);
SELECT set_config('test.scn', :'SCN', false);
SELECT set_config('test.run_id', :'RUN_ID', false);

-- ============================================================
-- SCN5 fase 1: siembra (solo sesion A, statements autocommit para que
-- la divergencia sea visible a B) / espera (sesion B)
-- ============================================================
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_ses text; v_run text; v_scn text;
  v_setup_op uuid;
  v_res jsonb;
  v_total numeric;
  i int;
BEGIN
  v_ses := current_setting('test.ses');
  v_scn := current_setting('test.scn');
  v_run := current_setting('test.run_id');
  IF v_scn <> '5' THEN RETURN; END IF;

  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa,'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ORDER BY rp.id LIMIT 1;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  v_setup_op := md5('conc5-setup-' || v_run)::uuid;

  IF v_ses = 'A' THEN
    -- Siembra: compra pendiente + abono total con sync INSERT deshabilitado
    -- => divergencia real (stored pendiente, proyeccion pagado).
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', v_admin)::text, true);

    v_res := public.ra_confirmar_compra(
      p_operation_id => v_setup_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'CONC5-' || v_run, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object(
        'catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
    v_total := (v_res->'compra'->>'total_pen')::numeric;

    ALTER TABLE ra_cuentas_por_pagar_movimientos
      DISABLE TRIGGER trg_cxp_sync_estado_pago_ins;
    INSERT INTO ra_cuentas_por_pagar_movimientos (
      empresa_id, proveedor_id, compra_id, tipo, monto, fecha,
      metodo_pago, referencia, usuario_id)
    VALUES (v_empresa, v_prov,
            (SELECT id FROM ra_compras WHERE operation_id = v_setup_op),
            'abono', v_total, CURRENT_DATE, 'efectivo', 'seed-scns', v_admin);
    ALTER TABLE ra_cuentas_por_pagar_movimientos
      ENABLE TRIGGER trg_cxp_sync_estado_pago_ins;

    PERFORM set_config('request.jwt.claims', '', true);
    RAISE NOTICE 'SEED SCN5 completado por A';
  ELSE
    -- B espera hasta ver la compra sembrada (visible tras commit de A)
    FOR i IN 1 .. 300 LOOP
      IF EXISTS (SELECT 1 FROM ra_compras WHERE operation_id = v_setup_op) THEN
        EXIT;
      END IF;
      PERFORM pg_sleep(0.1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM ra_compras WHERE operation_id = v_setup_op) THEN
      RAISE EXCEPTION 'FALLO SCN5: compra sembrada por A nunca visible';
    END IF;
  END IF;
END $$;

-- ============================================================
-- Fase 2: handshake + operacion concurrente medida
-- ============================================================
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid;
  v_cat1 uuid; v_cat2 uuid; v_suc uuid;
  v_ses text; v_scn text; v_run text;
  v_op uuid; v_doc text;
  v_setup_op uuid; v_cid_setup uuid;
  v_motivo text;
  v_items jsonb;
  v_role text := NULL;
  t0 timestamptz; t1 timestamptz; t2 timestamptz;
  v_outcome text;
  v_res jsonb;
  v_cid text := '-';
  v_rep text := '-';
  v_changed text := '-';
  i int;
BEGIN
  v_ses := current_setting('test.ses');
  v_scn := current_setting('test.scn');
  v_run := current_setting('test.run_id');

  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa,'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat1 FROM ra_productos rp WHERE rp.empresa_id=v_empresa ORDER BY rp.id LIMIT 1;
  SELECT rp.catalogo_id INTO v_cat2 FROM ra_productos rp
   WHERE rp.empresa_id=v_empresa AND rp.catalogo_id<>v_cat1 ORDER BY rp.id LIMIT 1;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  -- ===== Handshake simetrico =====
  FOR i IN 1 .. 600 LOOP
    IF pg_try_advisory_lock(hashtext('conc-first-' || v_scn || '-' || v_run)) THEN
      v_role := 'FIRST'; EXIT;
    ELSIF pg_try_advisory_lock(hashtext('conc-second-' || v_scn || '-' || v_run)) THEN
      v_role := 'SECOND'; EXIT;
    END IF;
    PERFORM pg_sleep(0.05);
  END LOOP;
  IF v_role IS NULL THEN RAISE EXCEPTION 'handshake timeout sin marcador'; END IF;

  DECLARE
    v_peer_key text := 'conc-' ||
      CASE WHEN v_role='FIRST' THEN 'second' ELSE 'first' END || '-' || v_scn || '-' || v_run;
    v_peer boolean := false;
  BEGIN
    FOR i IN 1 .. 600 LOOP
      IF NOT pg_try_advisory_lock(hashtext(v_peer_key)) THEN
        v_peer := true; EXIT;
      END IF;
      PERFORM pg_advisory_unlock(hashtext(v_peer_key));
      PERFORM pg_sleep(0.05);
    END LOOP;
    IF NOT v_peer THEN
      RAISE EXCEPTION 'HANDSHAKE_TIMEOUT: peer nunca registro su marcador';
    END IF;
  END;

  -- ===== Operacion por escenario =====
  IF v_scn = '1' THEN
    v_op := md5('conc1-' || v_ses || '-' || v_run)::uuid;
    v_doc := 'CONC1-' || v_ses || '-' || v_run;
  ELSIF v_scn = '2' THEN
    v_op := md5('conc2-' || v_ses || '-' || v_run)::uuid;
    v_doc := 'CONC2-' || v_run;
  ELSIF v_scn = '3' THEN
    v_op := md5('conc3-' || v_run)::uuid;
    v_doc := 'CONC3-' || v_run;
  ELSIF v_scn = '4' THEN
    v_op := md5('conc4-' || v_run)::uuid;
    v_doc := 'CONC4-' || v_run;
  ELSE
    v_op := md5('conc5-repair-' || v_run)::uuid;
    v_doc := '-';
  END IF;

  IF v_scn IN ('1','2') THEN
    IF v_ses = 'A' THEN
      v_items := jsonb_build_array(
        jsonb_build_object('catalogo_id', v_cat2, 'cantidad', 1, 'precio_unitario', 10),
        jsonb_build_object('catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 20));
    ELSE
      v_items := jsonb_build_array(
        jsonb_build_object('catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 20),
        jsonb_build_object('catalogo_id', v_cat2, 'cantidad', 1, 'precio_unitario', 10));
    END IF;
  ELSIF v_scn IN ('3','4') THEN
    v_items := jsonb_build_array(
      jsonb_build_object('catalogo_id', v_cat1,
                         'cantidad', CASE WHEN v_scn='4' AND v_ses='B' THEN 9 ELSE 1 END,
                         'precio_unitario', 20));
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  t0 := clock_timestamp();
  BEGIN
    IF v_scn = '5' THEN
      -- Reparacion concurrente sobre la compra sembrada.
      v_setup_op := md5('conc5-setup-' || v_run)::uuid;
      SELECT id INTO v_cid_setup
        FROM ra_compras
       WHERE operation_id = v_setup_op;
      IF v_cid_setup IS NULL THEN
        RAISE EXCEPTION 'FALLO SCN5: compra sembrada no encontrada';
      END IF;

      v_motivo := 'conc5-' || v_run;
      v_res := public.ra_recalcular_estado_pago(
        p_operation_id => v_op,
        p_compra_id => v_cid_setup,
        p_motivo => v_motivo);
      v_outcome := 'OK';
      v_cid := v_cid_setup::text;
      v_rep := COALESCE(v_res->>'replayed', '-');
      v_changed := COALESCE(v_res->>'changed', '-');
    ELSE
      v_res := public.ra_confirmar_compra(
        p_operation_id => v_op,
        p_sucursal_id => v_suc,
        p_proveedor_id => v_prov,
        p_nro_documento => v_doc,
        p_notas => NULL,
        p_items => v_items);
      v_outcome := 'OK';
      v_cid := COALESCE(v_res->'compra'->>'id', '-');
      v_rep := COALESCE(v_res->>'replayed', '-');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_outcome := split_part(SQLERRM, ':', 1);
  END;
  t1 := clock_timestamp();

  PERFORM pg_sleep(2);
  t2 := clock_timestamp();
  PERFORM pg_advisory_unlock(hashtext(
    'conc-' || CASE WHEN v_role='FIRST' THEN 'first' ELSE 'second' END || '-' || v_scn || '-' || v_run));

  RAISE NOTICE 'RESULT:%:%:%:%:%:%:%:%:%:%',
    v_ses, pg_backend_pid(),
    to_char(t0,'YYYY-MM-DD HH24:MI:SS.US'), to_char(t1,'YYYY-MM-DD HH24:MI:SS.US'),
    to_char(t2,'YYYY-MM-DD HH24:MI:SS.US'),
    v_outcome, v_op, v_cid, v_rep, v_changed;

  PERFORM set_config('request.jwt.claims', '', false);
  PERFORM set_config('test.ses', NULL, false);
  PERFORM set_config('test.scn', NULL, false);
  PERFORM set_config('test.run_id', NULL, false);
END $$;
