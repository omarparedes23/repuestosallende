-- Fault injection transitoria: liquidacion insertada y fallo antes de cerrar.
-- Requiere -v ADMIN_EMAIL=<admin activo>. La DDL y fixtures se revierten.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true);

CREATE OR REPLACE FUNCTION public.ra_test_fail_before_cashbox_close()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.estado='cerrada' AND OLD.estado='abierta'
     AND current_setting('test.ra_fail_close',true)='on' THEN
    RAISE EXCEPTION 'RA_TEST_FAIL_CLOSE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ra_test_fail_before_cashbox_close
  BEFORE UPDATE ON public.ra_cajas FOR EACH ROW
  EXECUTE FUNCTION public.ra_test_fail_before_cashbox_close();

DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_sucursal uuid:=gen_random_uuid();
  v_caja uuid; v_close_op uuid:=gen_random_uuid(); v_failed boolean:=false;
BEGIN
  SELECT p.id,p.empresa_id INTO v_admin,v_empresa
  FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email')) AND p.activo
    AND p.rol IN ('administrador','superadmin') LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);
  INSERT INTO public.ra_sucursales(id,empresa_id,nombre)
  VALUES(v_sucursal,v_empresa,'TESORERIA-FAULT');
  v_caja:=(public.ra_abrir_caja_v1(gen_random_uuid(),v_sucursal,20.00,NULL)->'caja'->>'id')::uuid;
  PERFORM set_config('test.ra_fail_close','on',true);
  BEGIN
    PERFORM public.ra_cerrar_caja_v1(v_close_op,v_caja,20.00,NULL);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='RA_TEST_FAIL_CLOSE' THEN v_failed:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FALLO: no se inyecto error'; END IF;
  IF EXISTS(SELECT 1 FROM public.ra_liquidaciones WHERE operation_id=v_close_op)
     OR NOT EXISTS(SELECT 1 FROM public.ra_cajas WHERE id=v_caja AND estado='abierta') THEN
    RAISE EXCEPTION 'FALLO: cierre dejo efecto parcial';
  END IF;
  RAISE NOTICE 'OK: rollback atomico despues de insertar liquidacion';
END $$;
ROLLBACK;
