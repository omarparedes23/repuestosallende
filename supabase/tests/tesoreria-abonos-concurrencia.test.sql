-- Una sesion de concurrencia CxC/CxP. Variables: KIND=CXC|CXP, SES=A|B,
-- RUN_ID, BRANCH_ID, DOCUMENT_ID, AMOUNT, ADMIN_EMAIL. Solo fixtures TEST.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.kind', :'KIND', true);
SELECT set_config('test.ses', :'SES', true);
SELECT set_config('test.run', :'RUN_ID', true);
SELECT set_config('test.branch', :'BRANCH_ID', true);
SELECT set_config('test.document', :'DOCUMENT_ID', true);
SELECT set_config('test.amount', :'AMOUNT', true);
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true);
DO $$
DECLARE
  v_admin uuid; v_kind text:=current_setting('test.kind'); v_result jsonb;
  v_op uuid:=md5('tesoreria-abono-conc:'||current_setting('test.run')||':'||v_kind||':'||current_setting('test.ses'))::uuid;
  v_outcome text:='OK';
BEGIN
  SELECT p.id INTO v_admin FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email')) AND p.activo AND p.rol IN ('administrador','superadmin') LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);
  BEGIN
    IF v_kind='CXC' THEN
      v_result:=public.ra_registrar_cobro_v2(v_op,current_setting('test.branch')::uuid,current_setting('test.document')::uuid,current_setting('test.amount')::numeric,current_date,'yape','PEN',NULL,'TEST abono conc');
    ELSIF v_kind='CXP' THEN
      v_result:=public.ra_registrar_pago_proveedor_v2(v_op,current_setting('test.branch')::uuid,current_setting('test.document')::uuid,current_setting('test.amount')::numeric,current_date,'transferencia','TEST abono conc');
    ELSE RAISE EXCEPTION 'KIND invalido'; END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM IN ('RA_RECEIVABLE_SETTLED','RA_PAYABLE_SETTLED','RA_PAYMENT_EXCEEDS_BALANCE') THEN v_outcome:=SQLERRM; ELSE RAISE; END IF;
  END;
  PERFORM pg_sleep(0.40);
  RAISE NOTICE 'RESULT:ABONO:%:%:%:%:%',v_kind,current_setting('test.ses'),pg_backend_pid(),v_outcome,coalesce(v_result->>'movimientoId','-');
END $$;
COMMIT;
