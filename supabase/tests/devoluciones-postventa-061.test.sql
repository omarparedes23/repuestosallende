-- Contrato post-061. TEST únicamente; no persiste devoluciones.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE v uuid; a uuid; sale uuid:='90000000-0000-4000-8000-000000000010'; item uuid:='90000000-0000-4000-8000-000000000011'; d uuid; r jsonb;
BEGIN
  SELECT id INTO v FROM public.ra_perfiles WHERE empresa_id='10101010-1010-4010-8010-101010101010'::uuid AND rol='vendedor' LIMIT 1;
  SELECT id INTO a FROM public.ra_perfiles WHERE empresa_id='10101010-1010-4010-8010-101010101010'::uuid AND rol='administrador' LIMIT 1;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v,'role','authenticated')::text,true);
  d:=(public.ra_solicitar_devolucion_v1(gen_random_uuid(),sale,jsonb_build_array(jsonb_build_object('ventaItemId',item,'cantidad',1,'reingresaStock',true)),'TEST 061')->>'devolucionId')::uuid;
  IF (SELECT reingresa_stock FROM public.ra_devolucion_items WHERE devolucion_id=d LIMIT 1) THEN RAISE EXCEPTION 'FALLO reingresaStock no fue ignorado'; END IF;
  r:=public.ra_registrar_recepcion_devolucion_v1(gen_random_uuid(),d,true,'apto_reventa',NULL);
  IF r->>'status'<>'recibida' THEN RAISE EXCEPTION 'FALLO recepción'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  PERFORM public.ra_aprobar_devolucion_v1(gen_random_uuid(),d,true,NULL);
  r:=public.ra_liquidar_devolucion_v1(gen_random_uuid(),d,'{}'::jsonb);
  IF r->>'status'<>'liquidated' THEN RAISE EXCEPTION 'FALLO liquidación'; END IF;
  -- Admin global (sucursal NULL) conserva acceso dentro de su empresa.
  UPDATE public.ra_perfiles SET sucursal_id=NULL WHERE id=a;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v,'role','authenticated')::text,true);
  d:=(public.ra_solicitar_devolucion_v1(gen_random_uuid(),sale,jsonb_build_array(jsonb_build_object('ventaItemId',item,'cantidad',1)),'TEST global')->>'devolucionId')::uuid;
  PERFORM public.ra_registrar_recepcion_devolucion_v1(gen_random_uuid(),d,true,'apto_reventa',NULL);
  PERFORM set_config('request.jwt.claims',json_build_object('sub',a,'role','authenticated')::text,true);
  PERFORM public.ra_aprobar_devolucion_v1(gen_random_uuid(),d,true,NULL);
  r:=public.ra_liquidar_devolucion_v1(gen_random_uuid(),d,'{}'::jsonb);
  IF r->>'status'<>'liquidated' THEN RAISE EXCEPTION 'FALLO admin global'; END IF;
  RAISE NOTICE 'PASS flujo postventa 061';
END $$;
ROLLBACK;
