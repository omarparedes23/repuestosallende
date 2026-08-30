-- Dos conexiones psql. Variables: SES=A|B, SCN=1|2, RUN_ID, ADMIN_EMAIL.
\set ON_ERROR_STOP on

BEGIN;
SELECT set_config('test.ses', :'SES', true);
SELECT set_config('test.scn', :'SCN', true);
SELECT set_config('test.run', :'RUN_ID', true);
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true);

DO $$
DECLARE
  v_ses text:=current_setting('test.ses');
  v_scn text:=current_setting('test.scn');
  v_run text:=current_setting('test.run');
  v_admin uuid; v_empresa uuid; v_sucursal uuid; v_caja uuid;
  v_op uuid; v_result jsonb; v_outcome text:='OK'; v_replayed text:='-';
BEGIN
  SELECT p.id,p.empresa_id INTO v_admin,v_empresa
  FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email'))
    AND p.activo AND p.rol IN ('administrador','superadmin') LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);
  v_sucursal:=md5('tesoreria-branch-'||v_run)::uuid;

  IF v_scn='1' THEN
    v_op:=md5('tesoreria-open-'||v_run)::uuid;
    v_result:=public.ra_abrir_caja_v1(v_op,v_sucursal,100.00,'CONC:'||v_run);
    v_replayed:=v_result->>'replayed';
  ELSE
    SELECT id INTO v_caja FROM public.ra_cajas
    WHERE empresa_id=v_empresa AND sucursal_id=v_sucursal AND estado='abierta';
    IF v_ses='A' THEN
      v_op:=md5('tesoreria-close-'||v_run)::uuid;
      v_result:=public.ra_cerrar_caja_v1(v_op,v_caja,100.00,'CONC:'||v_run);
    ELSE
      v_op:=md5('tesoreria-move-'||v_run)::uuid;
      BEGIN
        v_result:=public.ra_registrar_movimiento_caja_v1(
          v_op,v_sucursal,'ingreso','Movimiento concurrente',10.00,'CONC:'||v_run);
      EXCEPTION WHEN OTHERS THEN
        IF SQLERRM='RA_CASHBOX_NOT_OPEN' THEN v_outcome:='RA_CASHBOX_NOT_OPEN';
        ELSE RAISE; END IF;
      END;
    END IF;
    IF v_result IS NOT NULL THEN v_replayed:=v_result->>'replayed'; END IF;
  END IF;
  -- Retiene locks para demostrar solapamiento, igual que la suite de compras.
  PERFORM pg_sleep(0.40);
  RAISE NOTICE 'RESULT:%:%:%:%:%:%',v_scn,v_ses,pg_backend_pid(),v_outcome,v_op,v_replayed;
END $$;
COMMIT;
