-- Una sesion de la prueba real venta-vs-cierre.
-- Variables: SES=SALE|CLOSE, RUN_ID, BRANCH_ID, PRODUCT_ID, CAJA_ID, DELAY_MS,
-- HOLD_MS, ADMIN_EMAIL. La sucursal DEBE llamarse TESORERIA-VENTA-CIERRE:<RUN_ID>.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.ses', :'SES', true);
SELECT set_config('test.run', :'RUN_ID', true);
SELECT set_config('test.branch', :'BRANCH_ID', true);
SELECT set_config('test.product', :'PRODUCT_ID', true);
SELECT set_config('test.caja', :'CAJA_ID', true);
SELECT set_config('test.delay_ms', :'DELAY_MS', true);
SELECT set_config('test.hold_ms', :'HOLD_MS', true);
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true);
-- application_name tiene max_identifier_length=63 (Supavisor/Postgres). El
-- MD5 conserva identidad estable RUN+sucursal+sesion sin depender de truncado.
SELECT set_config('application_name', 'ra-vc:'||md5(:'RUN_ID'||':'||:'BRANCH_ID'||':'||:'SES'), true);

DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_branch uuid:=current_setting('test.branch')::uuid;
  v_product uuid:=current_setting('test.product')::uuid; v_caja uuid:=current_setting('test.caja')::uuid;
  v_ses text:=current_setting('test.ses'); v_price numeric; v_result jsonb;
  v_outcome text:='OK'; v_op uuid:=md5('tesoreria-venta-cierre:'||current_setting('test.run')||':'||current_setting('test.branch')||':'||v_ses)::uuid;
BEGIN
  SELECT p.id,p.empresa_id INTO v_admin,v_empresa FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email')) AND p.activo AND p.rol IN ('administrador','superadmin') LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);
  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales WHERE id=v_branch AND empresa_id=v_empresa
      AND activo AND nombre='TESORERIA-VENTA-CIERRE:'||current_setting('test.run')) THEN
    RAISE EXCEPTION 'fixture de sucursal invalido';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_cajas WHERE id=v_caja AND sucursal_id=v_branch AND empresa_id=v_empresa AND estado='abierta') THEN
    RAISE EXCEPTION 'fixture requiere caja abierta';
  END IF;
  PERFORM pg_sleep(current_setting('test.delay_ms')::numeric/1000);
  IF v_ses='SALE' THEN
    SELECT precio_venta INTO v_price FROM public.ra_productos
    WHERE id=v_product AND empresa_id=v_empresa AND sucursal_id=v_branch AND activo AND stock_actual>=1 FOR UPDATE;
    IF v_price IS NULL OR v_price<=0 THEN RAISE EXCEPTION 'fixture requiere producto con stock/precio PEN'; END IF;
    BEGIN
      v_result:=public.ra_confirmar_venta(v_op,v_branch,'ticket',NULL,
        jsonb_build_array(jsonb_build_object('productoId',v_product,'cantidad',1,'descuento',0)),
        jsonb_build_array(jsonb_build_object('metodoPago','efectivo','monto',v_price)), 'PEN',NULL,NULL);
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM='RA_CASHBOX_NOT_OPEN' THEN v_outcome:='RA_CASHBOX_NOT_OPEN'; ELSE RAISE; END IF;
    END;
  ELSIF v_ses='CLOSE' THEN
    BEGIN
      -- El conteo no es relevante: se comprueba la serializacion, no diferencia cero.
      v_result:=public.ra_cerrar_caja_v1(v_op,v_caja,0,'TEST venta-cierre');
    EXCEPTION WHEN OTHERS THEN RAISE; END;
  ELSE RAISE EXCEPTION 'SES invalida'; END IF;
  -- El runner espera este estado de espera en pg_stat_activity antes de
  -- iniciar la otra sesion. Asi demuestra el orden real de locks, no solo un
  -- orden probable por scheduling del sistema operativo.
  PERFORM pg_sleep(current_setting('test.hold_ms')::numeric/1000);
  RAISE NOTICE 'RESULT:VC:%:%:%:%:%',v_ses,pg_backend_pid(),v_outcome,v_op,coalesce(v_result->'sale'->>'id',v_result->>'liquidacionId','-');
END $$;
COMMIT;
