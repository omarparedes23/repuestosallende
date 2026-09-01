-- Fault injection for return liquidation. TEST only; every object/effect rolls back.
-- Requires ADMIN_EMAIL and VENTA_ID (a sale with a non-credit payment and open cashbox).
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true) AS ignored \gset
SELECT set_config('test.venta_id', :'VENTA_ID', true) AS ignored \gset

CREATE OR REPLACE FUNCTION public.ra_test_fail_return_cash_effect()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.origen='devolucion' AND current_setting('test.ra_fail_return_cash',true)='on' THEN
    RAISE EXCEPTION 'RA_TEST_FAIL_RETURN_CASH';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ra_test_fail_return_cash
  AFTER INSERT ON public.ra_movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION public.ra_test_fail_return_cash_effect();

DO $$
DECLARE
  v_admin uuid; v_sale public.ra_ventas%ROWTYPE; v_item public.ra_venta_items%ROWTYPE;
  v_return uuid; v_product uuid; v_stock_before numeric; v_failed boolean:=false;
BEGIN
  SELECT p.id INTO v_admin FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email')) AND p.activo
    AND p.rol IN ('administrador','superadmin') LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);
  SELECT * INTO v_sale FROM public.ra_ventas WHERE id=current_setting('test.venta_id')::uuid FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'VENTA_ID no encontrada'; END IF;
  SELECT * INTO v_item FROM public.ra_venta_items vi WHERE vi.venta_id=v_sale.id ORDER BY vi.id LIMIT 1;
  SELECT id,stock_actual INTO v_product,v_stock_before FROM public.ra_productos
  WHERE empresa_id=v_sale.empresa_id AND sucursal_id=v_sale.sucursal_id AND catalogo_id=v_item.catalogo_id FOR SHARE;
  IF v_product IS NULL THEN RAISE EXCEPTION 'producto de sucursal ausente'; END IF;
  v_return:=(public.ra_solicitar_devolucion_v1(gen_random_uuid(),v_sale.id,
    jsonb_build_array(jsonb_build_object('ventaItemId',v_item.id,'cantidad',least(v_item.cantidad,1),'reingresaStock',true)),
    'Prueba de rollback de liquidación') ->> 'devolucionId')::uuid;
  PERFORM set_config('test.ra_fail_return_cash','on',true);
  BEGIN
    PERFORM public.ra_liquidar_devolucion_v1(gen_random_uuid(),v_return,
      jsonb_build_object('yape','TEST-YAPE','tarjeta','TEST-POS','transferencia','TEST-TRANSFERENCIA'));
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='RA_TEST_FAIL_RETURN_CASH' THEN v_failed:=true; ELSE RAISE; END IF;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FALLO: no se inyectó el error'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_devoluciones d WHERE d.id=v_return AND d.estado='solicitada' AND d.operation_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.ra_movimientos_caja m WHERE m.devolucion_id=v_return)
     OR EXISTS (SELECT 1 FROM public.ra_kardex k WHERE k.referencia_id=v_return)
     OR EXISTS (SELECT 1 FROM public.ra_sunat_nota_credito_outbox n WHERE n.devolucion_id=v_return)
     OR (SELECT stock_actual FROM public.ra_productos WHERE id=v_product)<>v_stock_before THEN
    RAISE EXCEPTION 'FALLO: liquidación dejó efectos parciales después del error';
  END IF;
  RAISE NOTICE 'OK: fallo inyectado revierte stock, kardex, caja y outbox';
END $$;
ROLLBACK;
