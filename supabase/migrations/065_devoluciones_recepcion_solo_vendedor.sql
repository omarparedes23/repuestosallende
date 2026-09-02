-- 065: la recepción física pertenece exclusivamente al vendedor de sucursal.
BEGIN;

ALTER FUNCTION public.ra_registrar_recepcion_devolucion_v1(uuid,uuid,boolean,text,text)
  RENAME TO ra_registrar_recepcion_devolucion_v1_059;

REVOKE ALL ON FUNCTION public.ra_registrar_recepcion_devolucion_v1_059(uuid,uuid,boolean,text,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.ra_registrar_recepcion_devolucion_v1(
  p_operation_id uuid, p_devolucion_id uuid, p_recibido boolean,
  p_condicion_declarada text, p_observacion text default null
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE
  v_user uuid:=auth.uid(); v_empresa uuid; v_rol public.ra_rol; v_sucursal uuid;
  v_devolucion_sucursal uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id,rol,sucursal_id INTO v_empresa,v_rol,v_sucursal
  FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  IF v_rol <> 'vendedor' OR v_sucursal IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  SELECT sucursal_id INTO v_devolucion_sucursal
  FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR SHARE;
  IF v_devolucion_sucursal IS NULL OR v_devolucion_sucursal IS DISTINCT FROM v_sucursal THEN
    RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND';
  END IF;
  RETURN public.ra_registrar_recepcion_devolucion_v1_059(
    p_operation_id,p_devolucion_id,p_recibido,p_condicion_declarada,p_observacion
  );
END $$;

REVOKE ALL ON FUNCTION public.ra_registrar_recepcion_devolucion_v1(uuid,uuid,boolean,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_registrar_recepcion_devolucion_v1(uuid,uuid,boolean,text,text)
  TO authenticated;

COMMIT;
