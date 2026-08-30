-- Smoke transaccional de apertura, movimiento, cierre y revision. TEST only.
-- Requiere -v ADMIN_EMAIL=<admin activo>. Todo se revierte al final.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true);

DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_sucursal uuid:=gen_random_uuid();
  v_open uuid:=gen_random_uuid(); v_move uuid:=gen_random_uuid();
  v_close uuid:=gen_random_uuid(); v_review uuid:=gen_random_uuid();
  v_a jsonb; v_b jsonb; v_c jsonb; v_liq uuid;
BEGIN
  SELECT p.id,p.empresa_id INTO v_admin,v_empresa
  FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email')) AND p.activo
    AND p.rol IN ('administrador','superadmin') LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);
  INSERT INTO public.ra_sucursales(id,empresa_id,nombre)
  VALUES(v_sucursal,v_empresa,'TESORERIA-SMOKE');

  v_a:=public.ra_abrir_caja_v1(v_open,v_sucursal,100.00,'smoke');
  v_b:=public.ra_abrir_caja_v1(v_open,v_sucursal,100.00,'smoke');
  IF (v_a->>'replayed')::boolean OR NOT (v_b->>'replayed')::boolean THEN
    RAISE EXCEPTION 'FALLO replay apertura';
  END IF;

  BEGIN
    PERFORM public.ra_abrir_caja_v1(v_open,v_sucursal,101.00,'smoke');
    RAISE EXCEPTION 'FALLO conflicto apertura no detectado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM<>'RA_IDEMPOTENCY_CONFLICT' THEN RAISE; END IF;
  END;

  v_a:=public.ra_registrar_movimiento_caja_v1(
    v_move,v_sucursal,'ingreso','Ingreso smoke',15.00,NULL);
  v_b:=public.ra_registrar_movimiento_caja_v1(
    v_move,v_sucursal,'ingreso','Ingreso smoke',15.00,NULL);
  IF (v_a->>'replayed')::boolean OR NOT (v_b->>'replayed')::boolean THEN
    RAISE EXCEPTION 'FALLO replay movimiento';
  END IF;

  v_c:=public.ra_cerrar_caja_v1(v_close,(v_a->>'cajaId')::uuid,115.00,'smoke');
  IF (v_c->>'efectivoEsperado')::numeric<>115.00
     OR (v_c->>'diferencia')::numeric<>0 THEN
    RAISE EXCEPTION 'FALLO calculo cierre: %',v_c;
  END IF;
  v_liq:=(v_c->>'liquidacionId')::uuid;
  v_b:=public.ra_cerrar_caja_v1(v_close,(v_a->>'cajaId')::uuid,115.00,'smoke');
  IF NOT (v_b->>'replayed')::boolean THEN RAISE EXCEPTION 'FALLO replay cierre'; END IF;

  v_a:=public.ra_revisar_liquidacion_v1(v_review,v_liq,'validada','arqueo correcto');
  v_b:=public.ra_revisar_liquidacion_v1(v_review,v_liq,'validada','arqueo correcto');
  IF (v_a->>'replayed')::boolean OR NOT (v_b->>'replayed')::boolean THEN
    RAISE EXCEPTION 'FALLO replay revision';
  END IF;
  RAISE NOTICE 'OK: smoke RPC caja/cierre/revision';
END $$;
ROLLBACK;
