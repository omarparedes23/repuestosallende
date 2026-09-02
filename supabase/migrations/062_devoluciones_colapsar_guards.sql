-- 062: un único guard de sucursal condicional en cada RPC pública.
BEGIN;

CREATE OR REPLACE FUNCTION public.ra_aprobar_devolucion_v1_059(p_operation_id uuid,p_devolucion_id uuid,p_reingreso_aprobado boolean,p_reingreso_override_motivo text default null)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE v_user uuid:=auth.uid(); v_empresa uuid; v_rol public.ra_rol; v_d public.ra_devoluciones%ROWTYPE; v_hash text; v_canonical jsonb; v_override text:=nullif(btrim(p_reingreso_override_motivo),'');
BEGIN
  IF v_user IS NULL OR p_operation_id IS NULL OR p_devolucion_id IS NULL OR p_reingreso_aprobado IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_APPROVAL_INPUT_INVALID'; END IF;
  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND OR v_rol NOT IN ('administrador','superadmin') THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  v_canonical:=jsonb_build_object('devolucionId',p_devolucion_id,'reingresoAprobado',p_reingreso_aprobado,'overrideMotivo',v_override); v_hash:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':devolucion:aprobar:'||p_operation_id::text,0));
  SELECT * INTO v_d FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_d.estado='aprobada' THEN IF v_d.aprobacion_operation_id=p_operation_id AND v_d.aprobacion_request_hash=v_hash THEN RETURN jsonb_build_object('status','aprobada','replayed',true,'devolucionId',v_d.id); END IF; RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT'; END IF;
  IF v_d.estado<>'recibida' OR v_d.recepcion_recibido IS DISTINCT FROM true THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_STATE_INVALID'; END IF;
  IF p_reingreso_aprobado AND v_d.condicion_declarada IN ('dañado','incompleto') AND v_override IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_OVERRIDE_MOTIVE_REQUIRED'; END IF;
  UPDATE public.ra_devoluciones SET estado='aprobada',aprobador_id=v_user,approved_at=now(),reingreso_aprobado=p_reingreso_aprobado,reingreso_override_motivo=v_override,aprobacion_operation_id=p_operation_id,aprobacion_request_hash=v_hash,updated_at=now() WHERE id=v_d.id;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'aprobada',v_user,v_d.motivo,jsonb_build_object('reingresoAprobado',p_reingreso_aprobado));
  IF v_override IS NOT NULL THEN INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'reingreso_override',v_user,v_override,'{}'::jsonb); END IF;
  RETURN jsonb_build_object('status','aprobada','replayed',false,'devolucionId',v_d.id);
END $$;

CREATE OR REPLACE FUNCTION public.ra_solicitar_devolucion_v1(p_operation_id uuid,p_venta_id uuid,p_items jsonb,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE v_user uuid:=auth.uid(); v_empresa uuid; v_sucursal uuid; v_venta_sucursal uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id,sucursal_id INTO v_empresa,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF v_empresa IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  SELECT sucursal_id INTO v_venta_sucursal FROM public.ra_ventas WHERE id=p_venta_id AND empresa_id=v_empresa FOR SHARE;
  IF v_venta_sucursal IS NULL OR (v_sucursal IS NOT NULL AND v_venta_sucursal IS DISTINCT FROM v_sucursal) THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  RETURN public.ra_solicitar_devolucion_v1_055(p_operation_id,p_venta_id,p_items,p_motivo);
END $$;

CREATE OR REPLACE FUNCTION public.ra_liquidar_devolucion_v1(p_operation_id uuid,p_devolucion_id uuid,p_referencias jsonb default '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE v_user uuid:=auth.uid(); v_empresa uuid; v_sucursal uuid; v_devolucion_sucursal uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id,sucursal_id INTO v_empresa,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF v_empresa IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  SELECT sucursal_id INTO v_devolucion_sucursal FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR SHARE;
  IF v_devolucion_sucursal IS NULL OR (v_sucursal IS NOT NULL AND v_devolucion_sucursal IS DISTINCT FROM v_sucursal) THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  RETURN public.ra_liquidar_devolucion_v1_059(p_operation_id,p_devolucion_id,p_referencias);
END $$;

DROP FUNCTION public.ra_solicitar_devolucion_v1_060(uuid,uuid,jsonb,text);
DROP FUNCTION public.ra_liquidar_devolucion_v1_060(uuid,uuid,jsonb);
COMMIT;
