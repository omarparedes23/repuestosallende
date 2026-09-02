-- Contrato canónico 058-063 para postventa. TEST únicamente y sin persistencia.
-- La concurrencia de dos sesiones vive en devoluciones-postventa-concurrencia-runner.ps1.
\set ON_ERROR_STOP on
BEGIN;
-- El permiso se prueba con el rol SQL efectivo: auth.uid() no interviene aquí.
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.ra_aprobar_devolucion_v1_059(
      '90000000-0000-4000-8000-000000000090'::uuid,
      '90000000-0000-4000-8000-000000000091'::uuid,
      true, null
    );
    RAISE EXCEPTION 'shim interno ejecutable por authenticated';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;
RESET ROLE;
DO $$
DECLARE
  v_empresa uuid := '10101010-1010-4010-8010-101010101010';
  v_venta uuid := '90000000-0000-4000-8000-000000000010';
  v_item uuid := '90000000-0000-4000-8000-000000000011';
  v_vendedor uuid; v_admin uuid; v_otro_vendedor uuid; v_sucursal uuid;
  v_sucursal_ajena uuid := '90000000-0000-4000-8000-000000000099';
  v_d_happy uuid; v_d_global uuid; v_d_rechazo uuid; v_d_guardia uuid; v_d_no_recibido uuid; v_d_fiscal uuid;
  v_result jsonb; v_stock numeric; v_before_kardex integer; v_before_caja integer; v_before_nc integer;
BEGIN
  SELECT sucursal_id,usuario_id INTO v_sucursal,v_vendedor FROM public.ra_ventas WHERE id=v_venta;
  SELECT id INTO v_admin FROM public.ra_perfiles
  WHERE empresa_id=v_empresa AND sucursal_id=v_sucursal AND activo AND rol IN ('administrador','superadmin') LIMIT 1;
  SELECT id INTO v_otro_vendedor FROM public.ra_perfiles
  WHERE empresa_id <> v_empresa AND activo AND rol='vendedor' LIMIT 1;
  IF v_sucursal IS NULL OR v_vendedor IS NULL OR v_admin IS NULL OR v_otro_vendedor IS NULL THEN
    RAISE EXCEPTION 'Fixture postventa incompleto';
  END IF;
  SELECT stock_actual INTO v_stock FROM public.ra_productos WHERE id='90000000-0000-4000-8000-000000000001'::uuid;
  SELECT count(*) INTO v_before_kardex FROM public.ra_kardex;
  SELECT count(*) INTO v_before_caja FROM public.ra_movimientos_caja;
  SELECT count(*) INTO v_before_nc FROM public.ra_sunat_nota_credito_outbox;

  -- Solicitud no confía en reingresaStock, recepción separada y flujo feliz completo.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_vendedor,'role','authenticated')::text,true);
  v_d_happy := (public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',1,'reingresaStock',true)),'TEST contrato happy')->>'devolucionId')::uuid;
  IF (SELECT reingresa_stock FROM public.ra_devolucion_items WHERE devolucion_id=v_d_happy LIMIT 1) THEN RAISE EXCEPTION 'reingresaStock no fue ignorado'; END IF;
  PERFORM public.ra_registrar_recepcion_devolucion_v1(extensions.gen_random_uuid(),v_d_happy,true,'apto_reventa',null);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM public.ra_aprobar_devolucion_v1(extensions.gen_random_uuid(),v_d_happy,true,null);
  v_result := public.ra_liquidar_devolucion_v1(extensions.gen_random_uuid(),v_d_happy,'{}'::jsonb);
  IF v_result->>'status' <> 'liquidated' OR (SELECT receptor_id FROM public.ra_devoluciones WHERE id=v_d_happy) <> v_vendedor
    OR (SELECT aprobador_id FROM public.ra_devoluciones WHERE id=v_d_happy) <> v_admin
    OR (SELECT liquidador_id FROM public.ra_devoluciones WHERE id=v_d_happy) <> v_admin THEN RAISE EXCEPTION 'flujo feliz o atribución incorrectos'; END IF;
  IF (SELECT stock_actual FROM public.ra_productos WHERE id='90000000-0000-4000-8000-000000000001'::uuid) <> v_stock + 1
    OR (SELECT count(*) FROM public.ra_kardex) <> v_before_kardex + 1
    OR (SELECT count(*) FROM public.ra_movimientos_caja) <> v_before_caja + 1
    OR (SELECT count(*) FROM public.ra_sunat_nota_credito_outbox) <> v_before_nc + 1 THEN RAISE EXCEPTION 'efectos atómicos incompletos'; END IF;

  -- Replay y conflicto de idempotencia de liquidación.
  v_result := public.ra_liquidar_devolucion_v1((SELECT operation_id FROM public.ra_devoluciones WHERE id=v_d_happy),v_d_happy,'{}'::jsonb);
  IF (v_result->>'replayed')::boolean IS DISTINCT FROM true THEN RAISE EXCEPTION 'replay no reconocido'; END IF;
  BEGIN
    PERFORM public.ra_liquidar_devolucion_v1((SELECT operation_id FROM public.ra_devoluciones WHERE id=v_d_happy),v_d_happy,jsonb_build_object('efectivo','otro'));
    RAISE EXCEPTION 'debió fallar conflicto de idempotencia';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_IDEMPOTENCY_CONFLICT' THEN RAISE; END IF; END;

  -- Global admin aprueba/liquida dentro de empresa, pero no registra recepción física.
  UPDATE public.ra_perfiles SET sucursal_id=null WHERE id=v_admin;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_vendedor,'role','authenticated')::text,true);
  v_d_global := (public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',1)),'TEST admin global')->>'devolucionId')::uuid;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  BEGIN
    PERFORM public.ra_registrar_recepcion_devolucion_v1(extensions.gen_random_uuid(),v_d_global,true,'apto_reventa',null);
    RAISE EXCEPTION 'admin global no debe registrar recepción';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_FORBIDDEN' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_vendedor,'role','authenticated')::text,true);
  PERFORM public.ra_registrar_recepcion_devolucion_v1(extensions.gen_random_uuid(),v_d_global,true,'apto_reventa',null);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM public.ra_aprobar_devolucion_v1(extensions.gen_random_uuid(),v_d_global,true,null);
  v_result:=public.ra_liquidar_devolucion_v1(extensions.gen_random_uuid(),v_d_global,'{}'::jsonb);
  IF v_result->>'status'<>'liquidated' THEN RAISE EXCEPTION 'admin global no liquidó'; END IF;

  -- Scope de sucursal: mismo administrador, asignado a otra sucursal, no aprueba/rechaza/liquida.
  INSERT INTO public.ra_sucursales(id,empresa_id,nombre,activo) VALUES(v_sucursal_ajena,v_empresa,'TEST SCOPE POSTVENTA',true);
  UPDATE public.ra_perfiles SET sucursal_id=v_sucursal_ajena WHERE id=v_admin;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_vendedor,'role','authenticated')::text,true);
  v_d_rechazo := (public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',1)),'TEST scope')->>'devolucionId')::uuid;
  PERFORM public.ra_registrar_recepcion_devolucion_v1(extensions.gen_random_uuid(),v_d_rechazo,true,'apto_reventa',null);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  BEGIN PERFORM public.ra_aprobar_devolucion_v1(extensions.gen_random_uuid(),v_d_rechazo,true,null); RAISE EXCEPTION 'aprobar cruzado debió fallar'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_NOT_FOUND' THEN RAISE; END IF; END;
  BEGIN PERFORM public.ra_rechazar_devolucion_v1(extensions.gen_random_uuid(),v_d_rechazo,'scope'); RAISE EXCEPTION 'rechazar cruzado debió fallar'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_NOT_FOUND' THEN RAISE; END IF; END;
  BEGIN PERFORM public.ra_liquidar_devolucion_v1(extensions.gen_random_uuid(),v_d_rechazo,'{}'::jsonb); RAISE EXCEPTION 'liquidar cruzado debió fallar'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_NOT_FOUND' THEN RAISE; END IF; END;

  -- Vendedor de otra sucursal y usuario de otra empresa no pueden solicitar esta venta.
  UPDATE public.ra_perfiles SET sucursal_id=v_sucursal_ajena WHERE id=v_vendedor;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_vendedor,'role','authenticated')::text,true);
  BEGIN PERFORM public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',1)),'TEST vendedor cruzado'); RAISE EXCEPTION 'vendedor cruzado debió fallar'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_NOT_FOUND' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_otro_vendedor,'role','authenticated')::text,true);
  BEGIN PERFORM public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',1)),'TEST empresa cruzada'); RAISE EXCEPTION 'empresa cruzada debió fallar'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_NOT_FOUND' THEN RAISE; END IF; END;
  UPDATE public.ra_perfiles SET sucursal_id=v_sucursal WHERE id IN (v_vendedor,v_admin);

  -- Guardia secuencial, no_recibido y gate fiscal.
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_vendedor,'role','authenticated')::text,true);
  v_d_guardia := (public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',4)),'TEST guardia')->>'devolucionId')::uuid;
  PERFORM public.ra_registrar_recepcion_devolucion_v1(extensions.gen_random_uuid(),v_d_guardia,true,'apto_reventa',null);
  v_d_no_recibido := (public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',1)),'TEST no recibido')->>'devolucionId')::uuid;
  PERFORM public.ra_registrar_recepcion_devolucion_v1(extensions.gen_random_uuid(),v_d_no_recibido,false,'no_recibido','pieza no entregada');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM public.ra_aprobar_devolucion_v1(extensions.gen_random_uuid(),v_d_guardia,true,null);
  BEGIN PERFORM public.ra_liquidar_devolucion_v1(extensions.gen_random_uuid(),v_d_guardia,'{}'::jsonb); RAISE EXCEPTION 'guardia de cantidad debió fallar'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_RETURN_QUANTITY_EXCEEDED' THEN RAISE; END IF; END;
  BEGIN PERFORM public.ra_aprobar_devolucion_v1(extensions.gen_random_uuid(),v_d_no_recibido,false,null); RAISE EXCEPTION 'no_recibido no debe aprobarse'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_RETURN_STATE_INVALID' THEN RAISE; END IF; END;
  v_d_fiscal := (public.ra_solicitar_devolucion_v1(extensions.gen_random_uuid(),v_venta,jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',1)),'TEST fiscal')->>'devolucionId')::uuid;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_vendedor,'role','authenticated')::text,true);
  PERFORM public.ra_registrar_recepcion_devolucion_v1(extensions.gen_random_uuid(),v_d_fiscal,true,'apto_reventa',null);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
  PERFORM public.ra_aprobar_devolucion_v1(extensions.gen_random_uuid(),v_d_fiscal,true,null);
  UPDATE public.ra_sunat_outbox SET status='pending' WHERE venta_id=v_venta;
  BEGIN PERFORM public.ra_liquidar_devolucion_v1(extensions.gen_random_uuid(),v_d_fiscal,'{}'::jsonb); RAISE EXCEPTION 'gate fiscal debió fallar'; EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'RA_RETURN_FISCAL_RECONCILIATION_REQUIRED' THEN RAISE; END IF; END;
  RAISE NOTICE 'PASS contrato postventa 058-063';
END $$;
ROLLBACK;
