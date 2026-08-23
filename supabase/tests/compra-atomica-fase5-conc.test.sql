-- ============================================================
-- supabase/tests/compra-atomica-fase5-conc.test.sql
-- Fase 5 - Concurrencia real (dos conexiones psql simultaneas).
-- Parametros (runner): -v SES=A|B -v SCN=1|2 -v RUN_ID=<guid>
--
--   SCN=1 MISMO operation_id + payload identico -> una confirmed
--         y una replayed:true; misma compra; 1 cargo/1 kardex.
--   SCN=2 ops distintos, mismos productos en ORDEN INVERSO ->
--         ambos OK sin deadlock; stock final exacto.
--
-- Salida parseable por el runner:
--   RESULT:<SES>:<pid>:<t0>:<t1>:<outcome>:<op>:<cid|->:<replayed|->
-- Efectos etiquetados con 'F5E2E:<run>:C1'/'C2A'/'C2B' para limpieza.
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('test.ses', :'SES', true);
SELECT set_config('test.scn', :'SCN', true);
SELECT set_config('test.run_id', :'RUN_ID', true);

DO $$
DECLARE
  v_ses text := current_setting('test.ses');
  v_scn text := current_setting('test.scn');
  v_run text := current_setting('test.run_id');
  v_admin uuid; v_empresa uuid; v_prov uuid; v_suc uuid;
  v_cat1 uuid; v_cat2 uuid;
  v_op uuid; v_items jsonb;
  t0 timestamptz; t1 timestamptz; t2 timestamptz;
  v_res jsonb; v_cid text := '-'; v_rep text := '-';
  v_outcome text := 'OK';
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT id INTO v_prov FROM ra_proveedores WHERE nombre='F5E2E:'||v_run||':PROV';
  IF v_prov IS NULL THEN
    -- el runner de Fase 5 reutiliza la semilla de la suite principal
    INSERT INTO ra_proveedores (empresa_id, nombre)
    VALUES (v_empresa,'F5E2E:'||v_run||':PROV') RETURNING id INTO v_prov;
  END IF;
  SELECT catalogo_id INTO v_cat1 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id ASC LIMIT 1;
  SELECT catalogo_id INTO v_cat2 FROM ra_productos WHERE empresa_id=v_empresa ORDER BY catalogo_id DESC LIMIT 1;

  t0 := clock_timestamp();

  IF v_scn = '1' THEN
    v_op := md5('f5c1-'||v_run)::uuid;
    v_items := jsonb_build_array(jsonb_build_object(
      'catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 30));
    v_res := public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => 'F5E2E:'||v_run||':C1',
      p_items => v_items,
      p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',35.40));
    v_rep := COALESCE((v_res->>'replayed')::boolean::text, '-');
    v_cid := COALESCE(v_res->'compra'->>'id', '-');

  ELSE
    v_items := CASE WHEN v_ses = 'A'
      THEN jsonb_build_array(
             jsonb_build_object('catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 10),
             jsonb_build_object('catalogo_id', v_cat2, 'cantidad', 1, 'precio_unitario', 20))
      ELSE jsonb_build_array(
             jsonb_build_object('catalogo_id', v_cat2, 'cantidad', 1, 'precio_unitario', 20),
             jsonb_build_object('catalogo_id', v_cat1, 'cantidad', 1, 'precio_unitario', 10))
    END;
    v_op := md5('f5c2-'||v_ses||'-'||v_run)::uuid;
    v_res := public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL,
      p_notas => 'F5E2E:'||v_run||':C2'||v_ses,
      p_items => v_items);
    v_rep := COALESCE((v_res->>'replayed')::boolean::text, '-');
    v_cid := COALESCE(v_res->'compra'->>'id', '-');
  END IF;

  t1 := clock_timestamp();

  -- retencion breve post-commit para medir solapamiento real
  PERFORM pg_sleep(0.4);
  t2 := clock_timestamp();
  PERFORM set_config('request.jwt.claims', '', true);

  RAISE NOTICE 'RESULT:%:%:%:%:%:%:%:%:%', v_ses,
    pg_backend_pid(), t0, t1, t2, v_outcome, v_op, v_cid, v_rep;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'RESULT:%:%:%:%:%:%:%:%:%', v_ses,
    pg_backend_pid(), t0, t1, COALESCE(t2::text,'-'), SQLSTATE || ':' || left(SQLERRM, 60),
    COALESCE(v_op::text,'-'), v_cid, v_rep;
END $$;

COMMIT;
