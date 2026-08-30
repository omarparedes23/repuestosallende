-- 045_seguridad_rpc_multitenant.sql
-- P0: autorizacion server-side para RPC mutables y cierre de exposicion legacy.
-- Forward-only: no modifica datos ni reescribe migraciones historicas.

CREATE OR REPLACE FUNCTION public.ra_recibir_guia(p_guia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_rol public.ra_rol;
  v_guia public.ra_guias_remision%ROWTYPE;
  v_item public.ra_guia_items%ROWTYPE;
  v_prod_origen_id uuid;
  v_prod_destino_id uuid;
  v_stock_origen numeric;
  v_stock_destino numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador', 'superadmin') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;

  SELECT * INTO v_guia
  FROM public.ra_guias_remision
  WHERE id = p_guia_id AND empresa_id = v_empresa
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_NOT_FOUND'; END IF;
  IF v_guia.estado <> 'en_transito' THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_INVALID_STATE';
  END IF;

  FOR v_item IN SELECT * FROM public.ra_guia_items WHERE guia_id = p_guia_id LOOP
    SELECT id, stock_actual INTO v_prod_origen_id, v_stock_origen
    FROM public.ra_productos
    WHERE empresa_id = v_empresa AND sucursal_id = v_guia.sucursal_origen_id
      AND catalogo_id = v_item.catalogo_id
    FOR UPDATE;
    IF v_prod_origen_id IS NOT NULL THEN
      UPDATE public.ra_productos SET stock_actual = stock_actual - v_item.cantidad
      WHERE id = v_prod_origen_id;
      INSERT INTO public.ra_kardex (
        empresa_id, sucursal_id, catalogo_id, tipo, motivo, cantidad,
        stock_anterior, stock_nuevo, referencia_id, usuario_id
      ) VALUES (
        v_empresa, v_guia.sucursal_origen_id, v_item.catalogo_id,
        'salida', 'ajuste_manual', v_item.cantidad, v_stock_origen,
        v_stock_origen - v_item.cantidad, p_guia_id, v_user
      );
    END IF;

    SELECT id, stock_actual INTO v_prod_destino_id, v_stock_destino
    FROM public.ra_productos
    WHERE empresa_id = v_empresa AND sucursal_id = v_guia.sucursal_destino_id
      AND catalogo_id = v_item.catalogo_id
    FOR UPDATE;
    IF v_prod_destino_id IS NOT NULL THEN
      UPDATE public.ra_productos SET stock_actual = stock_actual + v_item.cantidad
      WHERE id = v_prod_destino_id;
      INSERT INTO public.ra_kardex (
        empresa_id, sucursal_id, catalogo_id, tipo, motivo, cantidad,
        stock_anterior, stock_nuevo, referencia_id, usuario_id
      ) VALUES (
        v_empresa, v_guia.sucursal_destino_id, v_item.catalogo_id,
        'entrada', 'ajuste_manual', v_item.cantidad, v_stock_destino,
        v_stock_destino + v_item.cantidad, p_guia_id, v_user
      );
    END IF;
  END LOOP;

  UPDATE public.ra_guias_remision
  SET estado = 'recibida', fecha_recepcion = now()
  WHERE id = p_guia_id AND empresa_id = v_empresa;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_confirmar_orden_compra(p_orden_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_rol public.ra_rol;
  v_oc public.ra_ordenes_compra%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador', 'superadmin') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;
  SELECT * INTO v_oc FROM public.ra_ordenes_compra
  WHERE id = p_orden_compra_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_ORDER_NOT_FOUND'; END IF;
  IF v_oc.estado <> 'borrador' THEN RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_ORDER_INVALID_STATE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_orden_compra_items WHERE orden_compra_id = v_oc.id) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_ORDER_EMPTY';
  END IF;
  UPDATE public.ra_ordenes_compra SET estado = 'confirmada'
  WHERE id = v_oc.id AND empresa_id = v_empresa;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_anular_orden_compra(p_orden_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_rol public.ra_rol;
  v_oc public.ra_ordenes_compra%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador', 'superadmin') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;
  SELECT * INTO v_oc FROM public.ra_ordenes_compra
  WHERE id = p_orden_compra_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_ORDER_NOT_FOUND'; END IF;
  IF v_oc.estado IN ('recibida', 'anulada') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_ORDER_INVALID_STATE';
  END IF;
  UPDATE public.ra_ordenes_compra SET estado = 'anulada'
  WHERE id = v_oc.id AND empresa_id = v_empresa;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_anular_compra(p_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_rol public.ra_rol;
  v_compra public.ra_compras%ROWTYPE;
  v_item public.ra_compra_items%ROWTYPE;
  v_producto_id uuid;
  v_stock_actual numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador', 'superadmin') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;
  SELECT * INTO v_compra FROM public.ra_compras
  WHERE id = p_compra_id AND empresa_id = v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_NOT_FOUND'; END IF;
  IF v_compra.estado <> 'confirmada' THEN RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_INVALID_STATE'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.ra_cuentas_por_pagar_movimientos
    WHERE compra_id = p_compra_id AND empresa_id = v_empresa AND tipo = 'cargo'
  ) THEN RAISE EXCEPTION USING MESSAGE = 'RA_PURCHASE_HAS_LEDGER'; END IF;

  FOR v_item IN SELECT * FROM public.ra_compra_items WHERE compra_id = p_compra_id LOOP
    SELECT id, stock_actual INTO v_producto_id, v_stock_actual
    FROM public.ra_productos
    WHERE empresa_id = v_empresa AND sucursal_id = v_compra.sucursal_id
      AND catalogo_id = v_item.catalogo_id
    FOR UPDATE;
    IF v_producto_id IS NOT NULL THEN
      IF v_stock_actual - v_item.cantidad < 0 THEN
        RAISE EXCEPTION USING MESSAGE = 'RA_STOCK_INSUFFICIENT_TO_REVERSE';
      END IF;
      UPDATE public.ra_productos SET stock_actual = stock_actual - v_item.cantidad
      WHERE id = v_producto_id;
      INSERT INTO public.ra_kardex (
        empresa_id, sucursal_id, catalogo_id, tipo, motivo, cantidad,
        stock_anterior, stock_nuevo, referencia_id, usuario_id
      ) VALUES (
        v_empresa, v_compra.sucursal_id, v_item.catalogo_id, 'salida',
        'ajuste_manual', v_item.cantidad, v_stock_actual,
        v_stock_actual - v_item.cantidad, p_compra_id, v_user
      );
    END IF;
  END LOOP;
  UPDATE public.ra_compras SET estado = 'anulada'
  WHERE id = p_compra_id AND empresa_id = v_empresa;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_contar_stock_bajo(p_empresa_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;
  SELECT empresa_id INTO v_empresa FROM public.ra_perfiles
  WHERE id = auth.uid() AND activo = true;
  IF v_empresa IS NULL OR p_empresa_id IS DISTINCT FROM v_empresa THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;
  RETURN (SELECT count(*) FROM public.ra_productos
    WHERE empresa_id = v_empresa AND stock_actual < stock_minimo);
END;
$$;

-- Funciones publicas que continuan siendo consumidas: ACL explicita.
REVOKE ALL ON FUNCTION public.ra_recibir_guia(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ra_confirmar_orden_compra(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ra_anular_orden_compra(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ra_anular_compra(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ra_contar_stock_bajo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ra_recibir_guia(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_confirmar_orden_compra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_anular_orden_compra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_anular_compra(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_contar_stock_bajo(uuid) TO authenticated;

-- RPC legacy mutables: el codigo de aplicacion debe usar sus reemplazos seguros.
REVOKE ALL ON FUNCTION public.ra_registrar_compra(uuid,uuid,uuid,text,text,jsonb,uuid,character,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_registrar_cargo_credito(uuid,date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_registrar_cobro(uuid,numeric,date,public.ra_metodo_pago,character,numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_registrar_cargo_compra(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_registrar_pago_proveedor(uuid,numeric,date,public.ra_metodo_pago,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_confirmar_venta_v1(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date) FROM PUBLIC, anon, authenticated, service_role;

-- Workers, triggers y helpers: nunca invocables por roles cliente.
REVOKE ALL ON FUNCTION public.ra_clasificacion_bulk_upsert(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ra_clasificacion_bulk_upsert(jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ra_claim_sunat_outbox(text,integer,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_finish_sunat_outbox(uuid,uuid,text,text,integer,text,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ra_claim_sunat_outbox(text,integer,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ra_finish_sunat_outbox(uuid,uuid,text,text,integer,text,text,jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ra_siguiente_correlativo(uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_estado_pago_proyectado(uuid,numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_preflight_compras_duplicadas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_sync_estado_pago_compras(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_guard_estado_pago() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_cxp_sync_desde_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_cxp_sync_desde_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_cxp_sync_desde_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_error_compra(text,text) FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.ra_recibir_guia(uuid) IS 'P0: recepcion multitenant autorizada dentro de la transaccion.';
COMMENT ON FUNCTION public.ra_contar_stock_bajo(uuid) IS 'Lectura autenticada; p_empresa_id debe coincidir con el perfil activo.';
