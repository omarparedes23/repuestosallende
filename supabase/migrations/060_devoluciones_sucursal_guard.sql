-- 060: validar sucursal emisora en solicitud y liquidación sin reescribir 055/059.
BEGIN;

ALTER FUNCTION public.ra_solicitar_devolucion_v1(uuid,uuid,jsonb,text)
  RENAME TO ra_solicitar_devolucion_v1_055;

CREATE FUNCTION public.ra_solicitar_devolucion_v1(
  p_operation_id uuid, p_venta_id uuid, p_items jsonb, p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_user uuid:=auth.uid(); v_empresa uuid; v_sucursal uuid; v_venta_sucursal uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id,sucursal_id INTO v_empresa,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF v_empresa IS NULL OR v_sucursal IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  SELECT sucursal_id INTO v_venta_sucursal FROM public.ra_ventas WHERE id=p_venta_id AND empresa_id=v_empresa FOR SHARE;
  IF v_venta_sucursal IS NULL OR v_venta_sucursal IS DISTINCT FROM v_sucursal THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  RETURN public.ra_solicitar_devolucion_v1_055(p_operation_id,p_venta_id,p_items,p_motivo);
END $$;
REVOKE ALL ON FUNCTION public.ra_solicitar_devolucion_v1(uuid,uuid,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.ra_solicitar_devolucion_v1(uuid,uuid,jsonb,text) TO authenticated;

ALTER FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb)
  RENAME TO ra_liquidar_devolucion_v1_059;

CREATE FUNCTION public.ra_liquidar_devolucion_v1(
  p_operation_id uuid, p_devolucion_id uuid, p_referencias jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE v_user uuid:=auth.uid(); v_empresa uuid; v_sucursal uuid; v_devolucion_sucursal uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id,sucursal_id INTO v_empresa,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF v_empresa IS NULL OR v_sucursal IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  SELECT sucursal_id INTO v_devolucion_sucursal FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR SHARE;
  IF v_devolucion_sucursal IS NULL OR v_devolucion_sucursal IS DISTINCT FROM v_sucursal THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  RETURN public.ra_liquidar_devolucion_v1_059(p_operation_id,p_devolucion_id,p_referencias);
END $$;
REVOKE ALL ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) TO authenticated;

COMMIT;
