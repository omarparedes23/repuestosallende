-- Behavioral contract for return request/liquidation.
-- TEST only. Requires ADMIN_EMAIL and VENTA_ID. All effects roll back.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true) AS ignored \gset
SELECT set_config('test.venta_id', :'VENTA_ID', true) AS ignored \gset

DO $$
DECLARE
  v_admin uuid; v_sale public.ra_ventas%ROWTYPE; v_item public.ra_venta_items%ROWTYPE;
  v_request jsonb; v_result jsonb; v_replay jsonb; v_return uuid;
  v_request_op uuid:=gen_random_uuid(); v_liquidate_op uuid:=gen_random_uuid();
  v_expected_nc boolean; v_total numeric(10,2); v_count integer;
  v_nc_job uuid; v_nc_lease uuid; v_nc_finished boolean; v_nc_status text; v_nc_audit_count integer;
BEGIN
  SELECT p.id INTO v_admin
  FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email'))
    AND p.activo AND p.rol IN ('administrador','superadmin')
  LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);

  SELECT * INTO v_sale FROM public.ra_ventas
  WHERE id=current_setting('test.venta_id')::uuid
  FOR SHARE;
  IF NOT FOUND OR COALESCE(v_sale.estado::text,'') NOT IN ('completada','pendiente','error_sunat') THEN
    RAISE EXCEPTION 'VENTA_ID no es una venta devoluble';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ra_venta_pagos p WHERE p.venta_id=v_sale.id AND p.metodo_pago<>'credito')
     AND NOT EXISTS (SELECT 1 FROM public.ra_cajas c WHERE c.empresa_id=v_sale.empresa_id AND c.sucursal_id=v_sale.sucursal_id AND c.estado='abierta') THEN
    RAISE EXCEPTION 'VENTA_ID requiere una caja abierta para probar reembolso';
  END IF;
  SELECT * INTO v_item FROM public.ra_venta_items vi
  WHERE vi.venta_id=v_sale.id
    AND (vi.cantidad>1 OR EXISTS (SELECT 1 FROM public.ra_venta_items other WHERE other.venta_id=v_sale.id AND other.id<>vi.id))
  ORDER BY vi.id LIMIT 1;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'VENTA_ID no permite una devolución parcial de prueba'; END IF;

  v_request:=public.ra_solicitar_devolucion_v1(
    v_request_op,v_sale.id,
    jsonb_build_array(jsonb_build_object('ventaItemId',v_item.id,'cantidad',CASE WHEN v_item.cantidad>1 THEN 1 ELSE v_item.cantidad END,'reingresaStock',false)),
    'Prueba transaccional de devolución'
  );
  v_return:=(v_request->>'devolucionId')::uuid;
  v_result:=public.ra_liquidar_devolucion_v1(
    v_liquidate_op,v_return,
    jsonb_build_object('yape','TEST-YAPE','tarjeta','TEST-POS','transferencia','TEST-TRANSFERENCIA')
  );
  v_replay:=public.ra_liquidar_devolucion_v1(
    v_liquidate_op,v_return,
    jsonb_build_object('yape','TEST-YAPE','tarjeta','TEST-POS','transferencia','TEST-TRANSFERENCIA')
  );
  IF (v_result->>'status')<>'liquidated' OR coalesce((v_replay->>'replayed')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'FALLO: liquidación o replay no retornó resultado estable';
  END IF;
  SELECT coalesce(sum(monto),0),count(*) INTO v_total,v_count
  FROM public.ra_devolucion_liquidaciones WHERE devolucion_id=v_return;
  IF v_count=0 OR v_total<>(v_result->>'total')::numeric
     OR EXISTS (SELECT 1 FROM public.ra_devolucion_liquidaciones l
       WHERE l.devolucion_id=v_return AND ((l.metodo_pago='credito' AND l.movimiento_cuenta_corriente_id IS NULL)
       OR (l.metodo_pago<>'credito' AND l.movimiento_caja_id IS NULL))) THEN
    RAISE EXCEPTION 'FALLO: efectos económicos incompletos o no vinculados';
  END IF;

  v_expected_nc:=v_sale.tipo_comprobante IN ('boleta','factura')
    AND EXISTS (SELECT 1 FROM public.ra_sunat_outbox o WHERE o.venta_id=v_sale.id AND o.status='accepted');
  IF v_expected_nc AND NOT EXISTS (SELECT 1 FROM public.ra_sunat_nota_credito_outbox n
      WHERE n.devolucion_id=v_return AND n.status='pending' AND n.motivo_codigo='07') THEN
    RAISE EXCEPTION 'FALLO: no se creó la outbox NC parcial durable';
  END IF;
  IF v_expected_nc THEN
    SELECT id,lease_token INTO v_nc_job,v_nc_lease
    FROM public.ra_claim_sunat_nota_credito_outbox_for_devolucion('test-nc',v_return,120);
    IF v_nc_job IS NULL OR v_nc_lease IS NULL THEN RAISE EXCEPTION 'FALLO: claim NC no obtuvo lease'; END IF;
    v_nc_finished:=public.ra_finish_sunat_nota_credito_outbox(v_nc_job,v_nc_lease,'temporary_error',NULL,503,'TEST_TEMP','Fallo temporal','{}'::jsonb);
    IF NOT v_nc_finished OR NOT EXISTS (SELECT 1 FROM public.ra_sunat_nota_credito_outbox n WHERE n.id=v_nc_job AND n.status='retry' AND n.next_attempt_at>now()) THEN
      RAISE EXCEPTION 'FALLO: backoff temporal NC no quedó programado';
    END IF;
    SELECT id,lease_token INTO v_nc_job,v_nc_lease
    FROM public.ra_claim_sunat_nota_credito_outbox_for_devolucion('test-nc-force',v_return,120,true);
    IF v_nc_job IS NULL OR v_nc_lease IS NULL THEN RAISE EXCEPTION 'FALLO: reintento manual NC no adelantó retry'; END IF;
    v_nc_finished:=public.ra_finish_sunat_nota_credito_outbox(v_nc_job,v_nc_lease,'accepted','TEST-NC',201,NULL,NULL,'{}'::jsonb);
    IF NOT v_nc_finished THEN RAISE EXCEPTION 'FALLO: finish NC rechazó lease manual vigente'; END IF;
    SELECT status INTO v_nc_status FROM public.ra_sunat_nota_credito_outbox WHERE id=v_nc_job;
    SELECT count(*) INTO v_nc_audit_count FROM public.ra_auditoria_devoluciones WHERE devolucion_id=v_return AND evento='fiscal_accepted';
    IF v_nc_status<>'accepted' THEN RAISE EXCEPTION 'FALLO: estado NC después de finish es %',v_nc_status; END IF;
    IF v_nc_audit_count<>1 THEN RAISE EXCEPTION 'FALLO: auditoría fiscal NC esperada=1 actual=%',v_nc_audit_count; END IF;
  END IF;
  IF NOT v_expected_nc AND EXISTS (SELECT 1 FROM public.ra_sunat_nota_credito_outbox n WHERE n.devolucion_id=v_return) THEN
    RAISE EXCEPTION 'FALLO: se creó NC sin comprobante original aceptado';
  END IF;
  RAISE NOTICE 'OK: solicitud, liquidación, replay y outbox fiscal verificados';
END $$;
ROLLBACK;
