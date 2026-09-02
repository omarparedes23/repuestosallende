-- 063: rechazo administrativo global; recepción permanece operacional y scopeada.
BEGIN;
CREATE OR REPLACE FUNCTION public.ra_rechazar_devolucion_v1(p_operation_id uuid,p_devolucion_id uuid,p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE v_user uuid:=auth.uid(); v_empresa uuid; v_rol public.ra_rol; v_sucursal uuid; v_devolucion_sucursal uuid; v_d public.ra_devoluciones%ROWTYPE; v_hash text; v_motivo text:=nullif(btrim(p_motivo),'');
BEGIN
  IF v_user IS NULL OR p_operation_id IS NULL OR p_devolucion_id IS NULL OR v_motivo IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_REJECTION_INPUT_INVALID'; END IF;
  SELECT empresa_id,rol,sucursal_id INTO v_empresa,v_rol,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND OR v_rol NOT IN ('administrador','superadmin') THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  SELECT sucursal_id INTO v_devolucion_sucursal FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR SHARE;
  IF v_devolucion_sucursal IS NULL OR (v_sucursal IS NOT NULL AND v_devolucion_sucursal IS DISTINCT FROM v_sucursal) THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('devolucionId',p_devolucion_id,'motivo',v_motivo)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':devolucion:rechazar:'||p_operation_id::text,0));
  SELECT * INTO v_d FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_d.estado='rechazada' THEN IF v_d.rechazo_operation_id=p_operation_id AND v_d.rechazo_request_hash=v_hash THEN RETURN jsonb_build_object('status','rechazada','replayed',true,'devolucionId',v_d.id); END IF; RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT'; END IF;
  IF v_d.estado NOT IN ('solicitada','recibida','aprobada') THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_STATE_INVALID'; END IF;
  UPDATE public.ra_devoluciones SET estado='rechazada',rechazo_operation_id=p_operation_id,rechazo_request_hash=v_hash,rechazo_motivo=v_motivo,updated_at=now() WHERE id=v_d.id;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'rechazada',v_user,v_motivo,'{}'::jsonb);
  RETURN jsonb_build_object('status','rechazada','replayed',false,'devolucionId',v_d.id);
END $$;
REVOKE ALL ON FUNCTION public.ra_rechazar_devolucion_v1(uuid,uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.ra_rechazar_devolucion_v1(uuid,uuid,text) TO authenticated;
COMMIT;
