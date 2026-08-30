-- Smoke E2E reversible para CxC y CxP. Solo Supabase TEST.
-- Requiere: -v ADMIN_EMAIL=<admin TEST activo>. No deja datos: ROLLBACK.
-- Selecciona documentos pendientes de la empresa del admin y usa un medio
-- digital para comprobar que no se exija ni se mueva efectivo de caja.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('test.admin_email', :'ADMIN_EMAIL', true);

DO $$
DECLARE
  v_admin uuid; v_empresa uuid;
  v_venta uuid; v_sucursal_cxc uuid; v_saldo_cxc numeric; v_cxc_op uuid:=gen_random_uuid();
  v_compra uuid; v_sucursal_cxp uuid; v_saldo_cxp numeric; v_cxp_op uuid:=gen_random_uuid();
  v_a jsonb; v_b jsonb; v_caja_movs integer;
BEGIN
  SELECT p.id,p.empresa_id INTO v_admin,v_empresa
  FROM public.ra_perfiles p JOIN auth.users u ON u.id=p.id
  WHERE lower(u.email)=lower(current_setting('test.admin_email'))
    AND p.activo AND p.rol IN ('administrador','superadmin') LIMIT 1;
  IF v_admin IS NULL THEN RAISE EXCEPTION 'admin TEST no encontrado'; END IF;
  PERFORM set_config('request.jwt.claims',json_build_object('sub',v_admin,'role','authenticated')::text,true);

  SELECT v.id,v.sucursal_id,sum(CASE WHEN m.tipo='cargo' THEN m.monto ELSE -m.monto END)
    INTO v_venta,v_sucursal_cxc,v_saldo_cxc
  FROM public.ra_ventas v
  JOIN public.ra_clientes c ON c.id=v.cliente_id AND c.empresa_id=v_empresa AND c.activo
  JOIN public.ra_sucursales s ON s.id=v.sucursal_id AND s.empresa_id=v_empresa AND s.activo
  JOIN public.ra_cuenta_corriente_movimientos m ON m.venta_id=v.id AND m.empresa_id=v_empresa
  WHERE v.empresa_id=v_empresa
  GROUP BY v.id,v.sucursal_id
  HAVING sum(CASE WHEN m.tipo='cargo' THEN m.monto ELSE -m.monto END)>0
  ORDER BY v.id LIMIT 1;
  IF v_venta IS NULL THEN RAISE EXCEPTION 'TEST_FIXTURE_CXC_PENDING_REQUIRED'; END IF;

  v_a:=public.ra_registrar_cobro_v2(v_cxc_op,v_sucursal_cxc,v_venta,1.00,current_date,'yape','PEN',NULL,'E2E-CXC');
  v_b:=public.ra_registrar_cobro_v2(v_cxc_op,v_sucursal_cxc,v_venta,1.00,current_date,'yape','PEN',NULL,'E2E-CXC');
  IF (v_a->>'replayed')::boolean OR NOT (v_b->>'replayed')::boolean
     OR (v_a->>'saldoVentaNuevo')::numeric<>v_saldo_cxc-1.00 THEN
    RAISE EXCEPTION 'FALLO CxC E2E/replay: % / %',v_a,v_b;
  END IF;
  SELECT count(*) INTO v_caja_movs FROM public.ra_movimientos_caja WHERE operation_id=v_cxc_op;
  IF v_caja_movs<>0 THEN RAISE EXCEPTION 'FALLO CxC digital movio caja'; END IF;

  SELECT c.id,c.sucursal_id,sum(CASE WHEN m.tipo='cargo' THEN m.monto ELSE -m.monto END)
    INTO v_compra,v_sucursal_cxp,v_saldo_cxp
  FROM public.ra_compras c
  JOIN public.ra_proveedores p ON p.id=c.proveedor_id AND p.empresa_id=v_empresa AND p.activo
  JOIN public.ra_sucursales s ON s.id=c.sucursal_id AND s.empresa_id=v_empresa AND s.activo
  JOIN public.ra_cuentas_por_pagar_movimientos m ON m.compra_id=c.id AND m.empresa_id=v_empresa
  WHERE c.empresa_id=v_empresa
  GROUP BY c.id,c.sucursal_id
  HAVING sum(CASE WHEN m.tipo='cargo' THEN m.monto ELSE -m.monto END)>0
  ORDER BY c.id LIMIT 1;
  IF v_compra IS NULL THEN RAISE EXCEPTION 'TEST_FIXTURE_CXP_PENDING_REQUIRED'; END IF;

  v_a:=public.ra_registrar_pago_proveedor_v2(v_cxp_op,v_sucursal_cxp,v_compra,1.00,current_date,'transferencia','E2E-CXP');
  v_b:=public.ra_registrar_pago_proveedor_v2(v_cxp_op,v_sucursal_cxp,v_compra,1.00,current_date,'transferencia','E2E-CXP');
  IF (v_a->>'replayed')::boolean OR NOT (v_b->>'replayed')::boolean
     OR (v_a->>'saldoCompraNuevo')::numeric<>v_saldo_cxp-1.00 THEN
    RAISE EXCEPTION 'FALLO CxP E2E/replay: % / %',v_a,v_b;
  END IF;
  SELECT count(*) INTO v_caja_movs FROM public.ra_movimientos_caja WHERE operation_id=v_cxp_op;
  IF v_caja_movs<>0 THEN RAISE EXCEPTION 'FALLO CxP digital movio caja'; END IF;
  RAISE NOTICE 'OK: CxC y CxP E2E/replay digital (ROLLBACK)';
END $$;
ROLLBACK;
