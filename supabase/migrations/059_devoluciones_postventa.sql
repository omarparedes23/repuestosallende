-- 059: recepción operativa, aprobación documental y concurrencia segura.
-- Requiere que 058 haya confirmado los valores nuevos del enum.
BEGIN;

ALTER TABLE public.ra_devoluciones
  ADD COLUMN IF NOT EXISTS recepcion_operativa_por uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS recepcion_operativa_at timestamptz,
  ADD COLUMN IF NOT EXISTS recepcion_recibido boolean,
  ADD COLUMN IF NOT EXISTS condicion_declarada text,
  ADD COLUMN IF NOT EXISTS recepcion_observacion text,
  ADD COLUMN IF NOT EXISTS recepcion_operation_id uuid,
  ADD COLUMN IF NOT EXISTS recepcion_request_hash text,
  ADD COLUMN IF NOT EXISTS aprobacion_operation_id uuid,
  ADD COLUMN IF NOT EXISTS aprobacion_request_hash text,
  ADD COLUMN IF NOT EXISTS rechazo_operation_id uuid,
  ADD COLUMN IF NOT EXISTS rechazo_request_hash text,
  ADD COLUMN IF NOT EXISTS rechazo_motivo text,
  ADD COLUMN IF NOT EXISTS reingreso_aprobado boolean,
  ADD COLUMN IF NOT EXISTS reingreso_override_motivo text;

ALTER TABLE public.ra_devoluciones
  DROP CONSTRAINT IF EXISTS ra_devoluciones_recepcion_shape_check,
  DROP CONSTRAINT IF EXISTS ra_devoluciones_estado_postventa_shape_check;

ALTER TABLE public.ra_devoluciones
  ADD CONSTRAINT ra_devoluciones_recepcion_shape_check CHECK (
    (recepcion_recibido IS NULL AND condicion_declarada IS NULL AND recepcion_operativa_por IS NULL
      AND recepcion_operativa_at IS NULL AND recepcion_operation_id IS NULL AND recepcion_request_hash IS NULL)
    OR (
      recepcion_recibido = false AND condicion_declarada = 'no_recibido'
      AND recepcion_operativa_por IS NOT NULL AND recepcion_operativa_at IS NOT NULL
      AND recepcion_operation_id IS NOT NULL AND recepcion_request_hash ~ '^[0-9a-f]{64}$'
      AND nullif(btrim(coalesce(recepcion_observacion,'')), '') IS NOT NULL
    )
    OR (
      recepcion_recibido = true AND condicion_declarada IN ('apto_reventa','dañado','incompleto')
      AND recepcion_operativa_por IS NOT NULL AND recepcion_operativa_at IS NOT NULL
      AND recepcion_operation_id IS NOT NULL AND recepcion_request_hash ~ '^[0-9a-f]{64}$'
      AND (condicion_declarada = 'apto_reventa' OR nullif(btrim(coalesce(recepcion_observacion,'')), '') IS NOT NULL)
    )
  ),
  ADD CONSTRAINT ra_devoluciones_estado_postventa_shape_check CHECK (
    estado NOT IN ('recibida','aprobada')
    OR (recepcion_recibido = true AND condicion_declarada IN ('apto_reventa','dañado','incompleto'))
  );

ALTER TABLE public.ra_devoluciones
  ADD CONSTRAINT ra_devoluciones_aprobada_shape_check CHECK (
    estado <> 'aprobada' OR (
      reingreso_aprobado IS NOT NULL
      AND (reingreso_aprobado = false OR condicion_declarada = 'apto_reventa'
        OR nullif(btrim(coalesce(reingreso_override_motivo,'')), '') IS NOT NULL)
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS ra_devoluciones_empresa_recepcion_operation_key
  ON public.ra_devoluciones(empresa_id, recepcion_operation_id) WHERE recepcion_operation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ra_devoluciones_empresa_aprobacion_operation_key
  ON public.ra_devoluciones(empresa_id, aprobacion_operation_id) WHERE aprobacion_operation_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ra_devoluciones_empresa_rechazo_operation_key
  ON public.ra_devoluciones(empresa_id, rechazo_operation_id) WHERE rechazo_operation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ra_devoluciones_bandeja_idx
  ON public.ra_devoluciones(empresa_id, sucursal_id, estado, created_at DESC);

ALTER TABLE public.ra_auditoria_devoluciones
  DROP CONSTRAINT IF EXISTS ra_auditoria_devoluciones_evento_check;
ALTER TABLE public.ra_auditoria_devoluciones
  ADD CONSTRAINT ra_auditoria_devoluciones_evento_check CHECK (
    evento IN ('solicitada','recepcion_registrada','recepcion_no_recibida','aprobada','rechazada','reingreso_override','liquidada','fiscal_pending','fiscal_accepted','fiscal_rejected')
  );

CREATE OR REPLACE FUNCTION public.ra_registrar_recepcion_devolucion_v1(
  p_operation_id uuid, p_devolucion_id uuid, p_recibido boolean,
  p_condicion_declarada text, p_observacion text default null
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid(); v_empresa uuid; v_rol public.ra_rol; v_sucursal uuid;
  v_d public.ra_devoluciones%ROWTYPE; v_hash text; v_canonical jsonb;
  v_condicion text := nullif(btrim(p_condicion_declarada),''); v_observacion text := nullif(btrim(p_observacion),'');
BEGIN
  IF v_user IS NULL OR p_operation_id IS NULL OR p_devolucion_id IS NULL OR p_recibido IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_RECEIPT_INPUT_INVALID'; END IF;
  SELECT empresa_id,rol,sucursal_id INTO v_empresa,v_rol,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND OR v_rol NOT IN ('vendedor','administrador','superadmin') THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  IF (p_recibido AND v_condicion NOT IN ('apto_reventa','dañado','incompleto')) OR (NOT p_recibido AND v_condicion IS DISTINCT FROM 'no_recibido') OR (v_condicion <> 'apto_reventa' AND v_observacion IS NULL) THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_RECEIPT_INPUT_INVALID'; END IF;
  v_canonical := jsonb_build_object('devolucionId',p_devolucion_id,'recibido',p_recibido,'condicionDeclarada',v_condicion,'observacion',v_observacion);
  v_hash := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':devolucion:recepcion:'||p_operation_id::text,0));
  SELECT * INTO v_d FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND OR v_d.sucursal_id IS DISTINCT FROM v_sucursal THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_d.recepcion_operation_id IS NOT NULL THEN
    IF v_d.recepcion_operation_id = p_operation_id AND v_d.recepcion_request_hash = v_hash THEN RETURN jsonb_build_object('status',v_d.estado,'replayed',true,'devolucionId',v_d.id); END IF;
    RAISE EXCEPTION USING MESSAGE='RA_RETURN_RECEIPT_ALREADY_RECORDED';
  END IF;
  IF v_d.estado <> 'solicitada' THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_STATE_INVALID'; END IF;
  UPDATE public.ra_devoluciones SET receptor_id=v_user, received_at=CASE WHEN p_recibido THEN now() ELSE NULL END, recepcion_operativa_por=v_user, recepcion_operativa_at=now(), recepcion_recibido=p_recibido, condicion_declarada=v_condicion, recepcion_observacion=v_observacion, recepcion_operation_id=p_operation_id, recepcion_request_hash=v_hash, estado=CASE WHEN p_recibido THEN 'recibida'::public.ra_estado_devolucion ELSE 'solicitada'::public.ra_estado_devolucion END, updated_at=now() WHERE id=v_d.id;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,CASE WHEN p_recibido THEN 'recepcion_registrada' ELSE 'recepcion_no_recibida' END,v_user,v_d.motivo,jsonb_build_object('condicion',v_condicion,'observacion',v_observacion));
  RETURN jsonb_build_object('status',CASE WHEN p_recibido THEN 'recibida' ELSE 'solicitada' END,'replayed',false,'devolucionId',v_d.id);
END $$;

REVOKE ALL ON FUNCTION public.ra_registrar_recepcion_devolucion_v1(uuid,uuid,boolean,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_registrar_recepcion_devolucion_v1(uuid,uuid,boolean,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ra_aprobar_devolucion_v1(
  p_operation_id uuid, p_devolucion_id uuid, p_reingreso_aprobado boolean,
  p_reingreso_override_motivo text default null
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid(); v_empresa uuid; v_rol public.ra_rol; v_sucursal uuid;
  v_d public.ra_devoluciones%ROWTYPE; v_hash text; v_canonical jsonb; v_override text := nullif(btrim(p_reingreso_override_motivo),'');
BEGIN
  IF v_user IS NULL OR p_operation_id IS NULL OR p_devolucion_id IS NULL OR p_reingreso_aprobado IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_APPROVAL_INPUT_INVALID'; END IF;
  SELECT empresa_id,rol,sucursal_id INTO v_empresa,v_rol,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND OR v_rol NOT IN ('administrador','superadmin') THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  v_canonical := jsonb_build_object('devolucionId',p_devolucion_id,'reingresoAprobado',p_reingreso_aprobado,'overrideMotivo',v_override);
  v_hash := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':devolucion:aprobar:'||p_operation_id::text,0));
  SELECT * INTO v_d FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND OR v_d.sucursal_id IS DISTINCT FROM v_sucursal THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_d.estado = 'aprobada' THEN
    IF v_d.aprobacion_operation_id = p_operation_id AND v_d.aprobacion_request_hash = v_hash THEN RETURN jsonb_build_object('status','aprobada','replayed',true,'devolucionId',v_d.id); END IF;
    RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
  END IF;
  IF v_d.estado <> 'recibida' OR v_d.recepcion_recibido IS DISTINCT FROM true THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_STATE_INVALID'; END IF;
  IF p_reingreso_aprobado AND v_d.condicion_declarada IN ('dañado','incompleto') AND v_override IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_OVERRIDE_MOTIVE_REQUIRED'; END IF;
  UPDATE public.ra_devoluciones SET estado='aprobada', aprobador_id=v_user, approved_at=now(), reingreso_aprobado=p_reingreso_aprobado, reingreso_override_motivo=v_override, aprobacion_operation_id=p_operation_id, aprobacion_request_hash=v_hash, updated_at=now() WHERE id=v_d.id;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'aprobada',v_user,v_d.motivo,jsonb_build_object('reingresoAprobado',p_reingreso_aprobado));
  IF v_override IS NOT NULL THEN INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'reingreso_override',v_user,v_override,'{}'::jsonb); END IF;
  RETURN jsonb_build_object('status','aprobada','replayed',false,'devolucionId',v_d.id);
END $$;

REVOKE ALL ON FUNCTION public.ra_aprobar_devolucion_v1(uuid,uuid,boolean,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_aprobar_devolucion_v1(uuid,uuid,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ra_rechazar_devolucion_v1(
  p_operation_id uuid, p_devolucion_id uuid, p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid(); v_empresa uuid; v_rol public.ra_rol; v_sucursal uuid;
  v_d public.ra_devoluciones%ROWTYPE; v_hash text; v_motivo text := nullif(btrim(p_motivo),'');
BEGIN
  IF v_user IS NULL OR p_operation_id IS NULL OR p_devolucion_id IS NULL OR v_motivo IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_REJECTION_INPUT_INVALID'; END IF;
  SELECT empresa_id,rol,sucursal_id INTO v_empresa,v_rol,v_sucursal FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND OR v_rol NOT IN ('administrador','superadmin') THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object('devolucionId',p_devolucion_id,'motivo',v_motivo)::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':devolucion:rechazar:'||p_operation_id::text,0));
  SELECT * INTO v_d FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND OR v_d.sucursal_id IS DISTINCT FROM v_sucursal THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_d.estado = 'rechazada' THEN
    IF v_d.rechazo_operation_id = p_operation_id AND v_d.rechazo_request_hash = v_hash THEN RETURN jsonb_build_object('status','rechazada','replayed',true,'devolucionId',v_d.id); END IF;
    RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
  END IF;
  IF v_d.estado NOT IN ('solicitada','recibida','aprobada') THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_STATE_INVALID'; END IF;
  UPDATE public.ra_devoluciones SET estado='rechazada', rechazo_operation_id=p_operation_id, rechazo_request_hash=v_hash, rechazo_motivo=v_motivo, updated_at=now() WHERE id=v_d.id;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'rechazada',v_user,v_motivo,'{}'::jsonb);
  RETURN jsonb_build_object('status','rechazada','replayed',false,'devolucionId',v_d.id);
END $$;

REVOKE ALL ON FUNCTION public.ra_rechazar_devolucion_v1(uuid,uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_rechazar_devolucion_v1(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ra_liquidar_devolucion_v1(
  p_operation_id uuid, p_devolucion_id uuid, p_referencias jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid:=auth.uid(); v_empresa uuid; v_rol public.ra_rol; v_d public.ra_devoluciones%ROWTYPE; v_sale public.ra_ventas%ROWTYPE;
  v_hash text; v_canonical jsonb; v_subtotal numeric(10,2); v_igv numeric(10,2); v_total numeric(10,2); v_paid numeric(10,2); v_remaining numeric(10,2); v_alloc numeric(10,2); v_n integer:=0; v_i integer:=0;
  v_pay record; v_item record; v_product public.ra_productos%ROWTYPE; v_caja uuid; v_cc_balance numeric(10,2); v_ref text; v_nc_status text; v_tipo_serie text; v_serie text; v_correlativo integer; v_result jsonb; v_movimiento_caja_id uuid; v_movimiento_cc_id uuid; v_fiscal jsonb; v_original_fiscal jsonb; v_motivo_codigo text; v_motivo_descripcion text; v_total_vendido_items numeric(10,3);
BEGIN
  IF v_user IS NULL OR p_operation_id IS NULL OR p_devolucion_id IS NULL OR jsonb_typeof(p_referencias)<>'object' THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_INPUT_INVALID'; END IF;
  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND OR v_rol NOT IN ('administrador','superadmin') THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  v_canonical:=jsonb_build_object('devolucionId',p_devolucion_id,'referencias',p_referencias);
  v_hash:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':devolucion:liquidar:'||p_operation_id::text,0));
  SELECT * INTO v_d FROM public.ra_devoluciones WHERE id=p_devolucion_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_d.estado='liquidada' THEN
    IF v_d.operation_id=p_operation_id AND v_d.request_hash=v_hash THEN RETURN v_d.result_snapshot || jsonb_build_object('replayed',true); END IF;
    RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
  END IF;
  IF v_d.estado<>'aprobada' OR v_d.recepcion_recibido IS DISTINCT FROM true OR v_d.condicion_declarada='no_recibido' OR v_d.reingreso_aprobado IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_RECEIPT_APPROVAL_REQUIRED'; END IF;
  SELECT * INTO v_sale FROM public.ra_ventas WHERE id=v_d.venta_id AND empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_SALE_INVALID'; END IF;
  IF v_sale.tipo_comprobante IN ('boleta','factura') THEN
    SELECT status,request_payload INTO v_nc_status,v_original_fiscal FROM public.ra_sunat_outbox WHERE venta_id=v_sale.id FOR SHARE;
    IF v_nc_status IS NULL OR v_nc_status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_FISCAL_RECONCILIATION_REQUIRED'; END IF;
  END IF;
  PERFORM vi.id FROM public.ra_venta_items vi JOIN public.ra_devolucion_items di ON di.venta_item_id=vi.id WHERE di.devolucion_id=v_d.id ORDER BY vi.id FOR UPDATE;
  SELECT coalesce(sum(importe),0) INTO v_subtotal FROM public.ra_devolucion_items WHERE devolucion_id=v_d.id;
  v_igv:=CASE WHEN v_sale.tipo_comprobante='ticket' THEN 0 ELSE round(v_subtotal*0.18,2) END; v_total:=v_subtotal+v_igv;
  IF v_total<=0 THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_TOTAL_INVALID'; END IF;
  FOR v_item IN SELECT di.*,vi.cantidad AS vendida FROM public.ra_devolucion_items di JOIN public.ra_venta_items vi ON vi.id=di.venta_item_id WHERE di.devolucion_id=v_d.id ORDER BY di.venta_item_id FOR UPDATE LOOP
    IF v_item.cantidad + coalesce((SELECT sum(x.cantidad) FROM public.ra_devolucion_items x JOIN public.ra_devoluciones d ON d.id=x.devolucion_id WHERE x.venta_item_id=v_item.venta_item_id AND d.estado='liquidada'),0) > v_item.vendida THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_QUANTITY_EXCEEDED'; END IF;
    IF v_d.reingreso_aprobado THEN
      SELECT * INTO v_product FROM public.ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND catalogo_id=v_item.catalogo_id AND activo FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_PRODUCT_NOT_FOUND_AT_BRANCH'; END IF;
      UPDATE public.ra_productos SET stock_actual=stock_actual+v_item.cantidad WHERE id=v_product.id;
      INSERT INTO public.ra_kardex(empresa_id,sucursal_id,catalogo_id,tipo,motivo,cantidad,stock_anterior,stock_nuevo,referencia_id,usuario_id,notas) VALUES(v_empresa,v_d.sucursal_id,v_item.catalogo_id,'entrada','devolucion',v_item.cantidad,v_product.stock_actual,v_product.stock_actual+v_item.cantidad,v_d.id,v_user,'Devolucion de venta');
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.ra_venta_pagos WHERE venta_id=v_sale.id AND metodo_pago='credito') THEN
    IF v_sale.cliente_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_CREDIT_CUSTOMER_INVALID'; END IF;
    PERFORM 1 FROM public.ra_clientes WHERE id=v_sale.cliente_id AND empresa_id=v_empresa FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_CREDIT_CUSTOMER_INVALID'; END IF;
  END IF;
  SELECT coalesce(sum(monto),0),count(DISTINCT metodo_pago) INTO v_paid,v_n FROM public.ra_venta_pagos WHERE venta_id=v_sale.id;
  IF v_paid<v_total THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_PAYMENT_ALLOCATION_INVALID'; END IF;
  IF EXISTS (SELECT 1 FROM public.ra_venta_pagos WHERE venta_id=v_sale.id AND metodo_pago<>'credito') THEN SELECT id INTO v_caja FROM public.ra_cajas WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND estado='abierta' ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE; IF v_caja IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF; END IF;
  v_remaining:=v_total; v_result:=jsonb_build_object('status','liquidated','replayed',false,'devolucionId',v_d.id,'ventaId',v_sale.id,'total',v_total);
  FOR v_pay IN SELECT metodo_pago,sum(monto) AS monto FROM public.ra_venta_pagos WHERE venta_id=v_sale.id GROUP BY metodo_pago ORDER BY metodo_pago LOOP
    v_i:=v_i+1; v_alloc:=CASE WHEN v_i=v_n THEN v_remaining ELSE round(v_total*v_pay.monto/v_paid,2) END; v_remaining:=v_remaining-v_alloc; IF v_alloc<=0 THEN CONTINUE; END IF;
    v_ref:=nullif(btrim(coalesce(p_referencias->>v_pay.metodo_pago::text,'')), ''); IF v_pay.metodo_pago IN ('yape','tarjeta','transferencia') AND v_ref IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_REFERENCE_REQUIRED'; END IF;
    IF v_pay.metodo_pago='credito' THEN
      SELECT coalesce(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0) INTO v_cc_balance FROM public.ra_cuenta_corriente_movimientos WHERE empresa_id=v_empresa AND venta_id=v_sale.id; IF v_alloc>v_cc_balance THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_CREDIT_EXCEEDS_BALANCE'; END IF;
      INSERT INTO public.ra_cuenta_corriente_movimientos(empresa_id,cliente_id,venta_id,tipo,monto,fecha,moneda_cobro,metodo_pago,usuario_id,operation_id,request_hash,result_snapshot,sucursal_id,origen,devolucion_id) VALUES(v_empresa,v_sale.cliente_id,v_sale.id,'abono',v_alloc,current_date,v_sale.moneda,'credito',v_user,p_operation_id,v_hash,v_result,v_d.sucursal_id,'devolucion',v_d.id) RETURNING id INTO v_movimiento_cc_id;
      UPDATE public.ra_clientes SET saldo_deudor=saldo_deudor-v_alloc WHERE id=v_sale.cliente_id;
    ELSE
      INSERT INTO public.ra_movimientos_caja(caja_id,tipo,concepto,monto,metodo_pago,referencia_id,usuario_id,operation_id,request_hash,origen,devolucion_id,notas) VALUES(v_caja,'egreso','Devolucion de venta',v_alloc,v_pay.metodo_pago,v_d.id,v_user,p_operation_id,v_hash,'devolucion',v_d.id,v_ref) RETURNING id INTO v_movimiento_caja_id;
    END IF;
    INSERT INTO public.ra_devolucion_liquidaciones(devolucion_id,metodo_pago,monto,referencia,movimiento_caja_id,movimiento_cuenta_corriente_id) VALUES(v_d.id,v_pay.metodo_pago,v_alloc,v_ref,CASE WHEN v_pay.metodo_pago='credito' THEN NULL ELSE v_movimiento_caja_id END,CASE WHEN v_pay.metodo_pago='credito' THEN v_movimiento_cc_id ELSE NULL END);
  END LOOP;
  IF v_sale.tipo_comprobante IN ('boleta','factura') AND v_nc_status='accepted' THEN
    SELECT coalesce(sum(vi.cantidad),0) INTO v_total_vendido_items FROM public.ra_venta_items vi WHERE vi.venta_id=v_sale.id;
    IF (SELECT count(*) FROM public.ra_devolucion_items di WHERE di.devolucion_id=v_d.id)=(SELECT count(*) FROM public.ra_venta_items vi WHERE vi.venta_id=v_sale.id) AND (SELECT coalesce(sum(di.cantidad),0) FROM public.ra_devolucion_items di WHERE di.devolucion_id=v_d.id)=v_total_vendido_items THEN v_motivo_codigo:='06'; v_motivo_descripcion:='Devolucion total'; ELSE v_motivo_codigo:='07'; v_motivo_descripcion:='Devolucion por item'; END IF;
    v_tipo_serie:=CASE WHEN v_sale.tipo_comprobante='factura' THEN 'nota_credito_factura' ELSE 'nota_credito_boleta' END;
    SELECT serie,siguiente_correlativo INTO v_serie,v_correlativo FROM public.ra_series_documento WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND tipo_documento=v_tipo_serie AND activo AND es_predeterminada FOR UPDATE;
    IF v_serie IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CREDIT_NOTE_SERIES_NOT_CONFIGURED'; END IF;
    UPDATE public.ra_series_documento SET siguiente_correlativo=siguiente_correlativo+1,updated_at=now() WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND tipo_documento=v_tipo_serie AND serie=v_serie;
    v_fiscal:=jsonb_build_object('tipo','NOTA_CREDITO','serie',v_serie,'correlativo',v_correlativo,'fechaEmision',current_date,'motivoCodigo',v_motivo_codigo,'motivoDescripcion',v_motivo_descripcion,'documentoReferencia',jsonb_build_object('tipo',upper(v_sale.tipo_comprobante::text),'serie',v_sale.serie,'correlativo',v_sale.correlativo,'numeroCompleto',v_sale.numero_completo),'comprobanteOriginal',v_original_fiscal,'items',(SELECT jsonb_agg(jsonb_build_object('ventaItemId',di.venta_item_id,'descripcion',vi.nombre_producto,'cantidad',di.cantidad,'valorUnitario',vi.precio_unitario,'subtotalBase',di.importe) ORDER BY di.venta_item_id) FROM public.ra_devolucion_items di JOIN public.ra_venta_items vi ON vi.id=di.venta_item_id WHERE di.devolucion_id=v_d.id),'subtotal',v_subtotal,'igv',v_igv,'total',v_total,'moneda',trim(v_sale.moneda),'tipoCambio',v_sale.tipo_cambio);
    INSERT INTO public.ra_sunat_nota_credito_outbox(empresa_id,devolucion_id,venta_id,document_key,tipo_referenciado,motivo_codigo,motivo_descripcion,serie,correlativo,request_payload) VALUES(v_empresa,v_d.id,v_sale.id,v_d.id::text,v_sale.tipo_comprobante,v_motivo_codigo,v_motivo_descripcion,v_serie,v_correlativo,v_fiscal);
    v_result:=v_result || jsonb_build_object('notaCredito',jsonb_build_object('status','pending','serie',v_serie,'correlativo',v_correlativo,'motivoCodigo',v_motivo_codigo));
  END IF;
  UPDATE public.ra_devoluciones SET estado='liquidada', liquidador_id=v_user, liquidated_at=now(), operation_id=p_operation_id, request_hash=v_hash, result_snapshot=v_result, updated_at=now() WHERE id=v_d.id;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'liquidada',v_user,v_d.motivo,v_result);
  RETURN v_result;
END $$;

REVOKE ALL ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.ra_devolucion_items_deprecar_reingreso_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.reingresa_stock := false;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS ra_devolucion_items_deprecar_reingreso_stock_trg ON public.ra_devolucion_items;
CREATE TRIGGER ra_devolucion_items_deprecar_reingreso_stock_trg
  BEFORE INSERT ON public.ra_devolucion_items
  FOR EACH ROW EXECUTE FUNCTION public.ra_devolucion_items_deprecar_reingreso_stock();

COMMIT;
