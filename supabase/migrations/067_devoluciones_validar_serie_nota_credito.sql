-- 067: OSE acepta series NC de cuatro caracteres, p.ej. FC01 o BC01.
-- Se bloquea antes de cualquier efecto comercial; no se reinterpreta una NC histórica.
BEGIN;

CREATE OR REPLACE FUNCTION public.ra_liquidar_devolucion_v1(
  p_operation_id uuid,p_devolucion_id uuid,p_referencias jsonb default '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions,pg_temp AS $$
DECLARE
  v_user uuid:=auth.uid(); v_empresa uuid; v_sucursal uuid; v_devolucion_sucursal uuid;
  v_estado public.ra_estado_devolucion; v_tipo public.ra_tipo_comprobante; v_serie text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id,sucursal_id INTO v_empresa,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF v_empresa IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  SELECT d.sucursal_id,d.estado,v.tipo_comprobante
    INTO v_devolucion_sucursal,v_estado,v_tipo
  FROM public.ra_devoluciones d JOIN public.ra_ventas v ON v.id=d.venta_id
  WHERE d.id=p_devolucion_id AND d.empresa_id=v_empresa FOR SHARE;
  IF v_devolucion_sucursal IS NULL OR (v_sucursal IS NOT NULL AND v_devolucion_sucursal IS DISTINCT FROM v_sucursal) THEN
    RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND';
  END IF;
  -- No romper el replay idempotente de devoluciones ya liquidadas.
  IF v_estado='aprobada' AND v_tipo IN ('boleta','factura') THEN
    SELECT serie INTO v_serie FROM public.ra_series_documento
    WHERE empresa_id=v_empresa AND sucursal_id=v_devolucion_sucursal
      AND tipo_documento=CASE WHEN v_tipo='factura' THEN 'nota_credito_factura' ELSE 'nota_credito_boleta' END
      AND activo AND es_predeterminada
    FOR UPDATE;
    IF v_serie IS NOT NULL AND v_serie !~ '^[BF][A-Z0-9]{3}$' THEN
      RAISE EXCEPTION USING MESSAGE='RA_CREDIT_NOTE_SERIES_INVALID';
    END IF;
  END IF;
  RETURN public.ra_liquidar_devolucion_v1_059(p_operation_id,p_devolucion_id,p_referencias);
END $$;

REVOKE ALL ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) TO authenticated;
COMMIT;
