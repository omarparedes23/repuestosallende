-- 073: el precio de venta YA incluye IGV (dbo.Precio.IB_IncIGV = 1 en el ERP). Antes el sistema
-- sumaba 18% encima en boleta/factura. Ahora, igual que el sistema legacy (SalesDraftTotals):
--   * ticket:          total = suma de lineas (precio final), IGV 0.
--   * boleta/factura:  base_linea = round(linea_con_igv / 1.18, 2); subtotal = suma de bases;
--                      total = suma de lineas con IGV; igv = total - subtotal (garantiza base + igv = total).
-- ra_venta_items guarda en boleta/factura el valor SIN IGV (precio_unitario, descuento, subtotal),
-- que es lo que espera lib/facturacion/ose.ts (valorUnitario/subtotalBase) y las notas de credito
-- (ra_devolucion_items.importe sobre base * 0.18). Para no perder precision del valor unitario
-- (el legacy envia 6 decimales) se ensancha precio_unitario a NUMERIC(14,6).
-- Solo cambia el cuerpo de ra_confirmar_venta_v1; firma, permisos y wrapper quedan igual.

ALTER TABLE public.ra_venta_items ALTER COLUMN precio_unitario TYPE NUMERIC(14,6);

CREATE OR REPLACE FUNCTION public.ra_confirmar_venta_v1(
  p_operation_id UUID,
  p_sucursal_id UUID,
  p_tipo_comprobante public.ra_tipo_comprobante,
  p_cliente_id UUID,
  p_items JSONB,
  p_pagos JSONB,
  p_moneda CHAR(3),
  p_tipo_cambio NUMERIC,
  p_fecha_vencimiento DATE,
  p_numero_placa TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_empresa UUID;
  v_rol public.ra_rol;
  v_perfil_sucursal UUID;
  v_caja UUID;
  v_venta UUID;
  v_existing_hash TEXT;
  v_existing_user UUID;
  v_hash TEXT;
  v_serie TEXT;
  v_correlativo INTEGER;
  v_subtotal NUMERIC(10,2) := 0;
  v_igv NUMERIC(10,2) := 0;
  v_total NUMERIC(10,2) := 0;
  v_pagado NUMERIC(10,2) := 0;
  v_credito NUMERIC(10,2) := 0;
  v_saldo_nuevo NUMERIC(10,2);
  v_limite NUMERIC(10,2);
  v_item JSONB;
  v_pago JSONB;
  v_prod RECORD;
  v_cantidad NUMERIC(10,3);
  v_descuento NUMERIC(10,2);
  v_precio NUMERIC(10,2);
  v_linea NUMERIC(10,2);
  v_total_bruto NUMERIC(10,2) := 0;
  v_base NUMERIC(10,2);
  v_canonical JSONB;
  v_fiscal JSONB;
  v_numero_placa TEXT := NULLIF(trim(upper(p_numero_placa)),'');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT: operation_id'; END IF;

  SELECT empresa_id, rol, sucursal_id INTO v_empresa, v_rol, v_perfil_sucursal
  FROM public.ra_perfiles WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin','vendedor') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales s WHERE s.id=p_sucursal_id AND s.empresa_id=v_empresa AND s.activo=true)
     OR (v_rol='vendedor' AND v_perfil_sucursal IS DISTINCT FROM p_sucursal_id) THEN
    RAISE EXCEPTION USING MESSAGE='RA_BRANCH_INVALID';
  END IF;

  IF jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 200
     OR jsonb_typeof(p_pagos)<>'array' OR jsonb_array_length(p_pagos) NOT BETWEEN 1 AND 20
     OR trim(p_moneda) NOT IN ('PEN','USD')
     OR (trim(p_moneda)='USD' AND COALESCE(p_tipo_cambio,0)<=0)
     OR (trim(p_moneda)='PEN' AND p_tipo_cambio IS NOT NULL) THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT';
  END IF;
  IF (SELECT count(*) FROM (SELECT x->>'productoId' FROM jsonb_array_elements(p_items) x GROUP BY 1) d)
     <> jsonb_array_length(p_items) THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT: duplicate_product';
  END IF;

  v_canonical := jsonb_build_object(
    'operationId',p_operation_id,'sucursalId',p_sucursal_id,'tipoComprobante',p_tipo_comprobante,
    'clienteId',p_cliente_id,'moneda',trim(p_moneda),'tipoCambio',p_tipo_cambio,
    'fechaVencimiento',p_fecha_vencimiento,'numeroPlaca',v_numero_placa,
    'items',(SELECT jsonb_agg(jsonb_build_object('productoId',x->>'productoId','cantidad',(x->>'cantidad')::numeric,'descuento',COALESCE((x->>'descuento')::numeric,0)) ORDER BY x->>'productoId') FROM jsonb_array_elements(p_items) x),
    'pagos',(SELECT jsonb_agg(jsonb_build_object('metodoPago',x->>'metodoPago','monto',(x->>'monto')::numeric,'referencia',NULLIF(trim(x->>'referencia'),'')) ORDER BY x->>'metodoPago',(x->>'monto')::numeric,COALESCE(x->>'referencia','')) FROM jsonb_array_elements(p_pagos) x)
  );
  v_hash := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':venta:v1:'||p_operation_id::text,0));
  SELECT id,request_hash,usuario_id INTO v_venta,v_existing_hash,v_existing_user FROM public.ra_ventas
   WHERE empresa_id=v_empresa AND operation_id=p_operation_id;
  IF v_venta IS NOT NULL THEN
    IF v_existing_user<>v_user AND v_rol NOT IN ('administrador','superadmin') THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
    IF v_existing_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN public.ra_venta_resultado(v_venta,true);
  END IF;

  -- Barrera comun venta/cierre. No filtra por usuario: el turno pertenece a
  -- la sucursal. Al despertar de un cierre concurrente, estado='abierta' se
  -- reevalua y la venta falla sin efectos.
  SELECT id INTO v_caja FROM public.ra_cajas
   WHERE empresa_id=v_empresa AND sucursal_id=p_sucursal_id AND estado='abierta'
   ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE;
  IF v_caja IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF;

  IF p_cliente_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ra_clientes WHERE id=p_cliente_id AND empresa_id=v_empresa AND activo=true
  ) THEN RAISE EXCEPTION USING MESSAGE='RA_CUSTOMER_INVALID'; END IF;
  IF p_tipo_comprobante='factura' AND NOT EXISTS (
    SELECT 1 FROM public.ra_clientes WHERE id=p_cliente_id AND empresa_id=v_empresa AND tipo_documento='RUC' AND nro_documento IS NOT NULL
  ) THEN RAISE EXCEPTION USING MESSAGE='RA_CUSTOMER_INVALID'; END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'productoId' LOOP
    BEGIN
      v_cantidad := (v_item->>'cantidad')::numeric;
      v_descuento := COALESCE((v_item->>'descuento')::numeric,0);
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT'; END;
    IF v_cantidad<=0 OR v_descuento<0 THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT'; END IF;
    SELECT p.id,p.catalogo_id,p.stock_actual,p.precio_venta,p.precio_venta_dolar,c.nombre,c.codigo_oem
      INTO v_prod FROM public.ra_productos p JOIN public.ra_catalogo_repuestos c ON c.id=p.catalogo_id
     WHERE p.id=(v_item->>'productoId')::uuid AND p.empresa_id=v_empresa AND p.sucursal_id=p_sucursal_id
       AND p.activo=true AND c.activo=true FOR UPDATE OF p;
    IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_PRODUCT_INVALID'; END IF;
    v_precio := CASE WHEN trim(p_moneda)='USD' THEN v_prod.precio_venta_dolar ELSE v_prod.precio_venta END;
    IF v_precio IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_PRICE_MISSING'; END IF;
    v_linea := round(v_precio*v_cantidad-v_descuento,2);
    IF v_linea<0 THEN RAISE EXCEPTION USING MESSAGE='RA_DISCOUNT_INVALID'; END IF;
    IF v_prod.stock_actual<v_cantidad THEN RAISE EXCEPTION USING MESSAGE='RA_STOCK_INSUFFICIENT'; END IF;
    v_total_bruto := v_total_bruto+v_linea;
    v_subtotal := v_subtotal+CASE WHEN p_tipo_comprobante='ticket' THEN v_linea ELSE round(v_linea/1.18,2) END;
  END LOOP;
  v_subtotal:=round(v_subtotal,2);
  v_total:=round(v_total_bruto,2);
  v_igv:=v_total-v_subtotal;

  FOR v_pago IN SELECT value FROM jsonb_array_elements(p_pagos) LOOP
    BEGIN v_linea:=round((v_pago->>'monto')::numeric,2); EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT'; END;
    IF v_linea<=0 OR (v_pago->>'metodoPago') NOT IN ('efectivo','yape','tarjeta','transferencia','credito')
      THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT'; END IF;
    v_pagado:=v_pagado+v_linea;
    IF v_pago->>'metodoPago'='credito' THEN v_credito:=v_credito+v_linea; END IF;
  END LOOP;
  IF v_pagado < v_total-0.01 THEN RAISE EXCEPTION USING MESSAGE='RA_PAYMENT_INSUFFICIENT'; END IF;
  IF v_credito>0 THEN
    IF p_cliente_id IS NULL OR p_fecha_vencimiento IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CUSTOMER_CREDIT_DISABLED'; END IF;
    SELECT limite_credito INTO v_limite FROM public.ra_clientes
     WHERE id=p_cliente_id AND empresa_id=v_empresa AND activo=true AND tiene_credito=true FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_CUSTOMER_CREDIT_DISABLED'; END IF;
  END IF;

  SELECT CASE p_tipo_comprobante WHEN 'ticket' THEN COALESCE(serie_ticket,'T001') WHEN 'factura' THEN COALESCE(serie_factura,'F001') ELSE COALESCE(serie_boleta,'B001') END
    INTO v_serie FROM public.ra_empresas WHERE id=v_empresa;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':'||v_serie,0));
  SELECT COALESCE(max(correlativo),0)+1 INTO v_correlativo FROM public.ra_ventas WHERE empresa_id=v_empresa AND serie=v_serie;

  INSERT INTO public.ra_ventas(empresa_id,sucursal_id,caja_id,cliente_id,usuario_id,tipo_comprobante,subtotal,igv,total,estado,serie,correlativo,moneda,tipo_cambio,operation_id,request_hash,numero_placa)
  VALUES(v_empresa,p_sucursal_id,v_caja,p_cliente_id,v_user,p_tipo_comprobante,v_subtotal,v_igv,v_total,CASE WHEN p_tipo_comprobante='ticket' THEN 'completada'::public.ra_estado_venta ELSE 'pendiente'::public.ra_estado_venta END,v_serie,v_correlativo,trim(p_moneda),p_tipo_cambio,p_operation_id,v_hash,v_numero_placa)
  RETURNING id INTO v_venta;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'productoId' LOOP
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_descuento := COALESCE((v_item->>'descuento')::numeric,0);
    SELECT p.id,p.catalogo_id,p.stock_actual,p.precio_venta,p.precio_venta_dolar,c.nombre,c.codigo_oem
      INTO v_prod FROM public.ra_productos p JOIN public.ra_catalogo_repuestos c ON c.id=p.catalogo_id
     WHERE p.id=(v_item->>'productoId')::uuid;
    v_precio := CASE WHEN trim(p_moneda)='USD' THEN v_prod.precio_venta_dolar ELSE v_prod.precio_venta END;
    v_linea := round(v_precio*v_cantidad-v_descuento,2);
    v_base := CASE WHEN p_tipo_comprobante='ticket' THEN v_linea ELSE round(v_linea/1.18,2) END;
    INSERT INTO public.ra_venta_items(venta_id,catalogo_id,cantidad,precio_unitario,descuento,subtotal,nombre_producto,codigo_oem)
    VALUES(v_venta,v_prod.catalogo_id,v_cantidad,
      CASE WHEN p_tipo_comprobante='ticket' THEN v_precio ELSE round(v_precio/1.18,6) END,
      CASE WHEN p_tipo_comprobante='ticket' THEN v_descuento ELSE round(v_descuento/1.18,2) END,
      v_base,v_prod.nombre,v_prod.codigo_oem);
    UPDATE public.ra_productos SET stock_actual=stock_actual-v_cantidad WHERE id=v_prod.id;
    INSERT INTO public.ra_kardex(empresa_id,sucursal_id,catalogo_id,tipo,motivo,cantidad,stock_anterior,stock_nuevo,referencia_id,usuario_id)
    VALUES(v_empresa,p_sucursal_id,v_prod.catalogo_id,'salida','venta',v_cantidad,v_prod.stock_actual,v_prod.stock_actual-v_cantidad,v_venta,v_user);
  END LOOP;
  INSERT INTO public.ra_venta_pagos(venta_id,metodo_pago,monto,referencia)
  SELECT v_venta,(x->>'metodoPago')::public.ra_metodo_pago,round((x->>'monto')::numeric,2),NULLIF(trim(x->>'referencia'),'') FROM jsonb_array_elements(p_pagos)x;
  INSERT INTO public.ra_movimientos_caja(
    caja_id,tipo,concepto,monto,metodo_pago,referencia_id,usuario_id,origen)
  SELECT v_caja,'ingreso','Venta '||upper(left(v_venta::text,8)),
    round((x->>'monto')::numeric,2),(x->>'metodoPago')::public.ra_metodo_pago,
    v_venta,v_user,'venta'
   FROM jsonb_array_elements(p_pagos)x WHERE x->>'metodoPago'<>'credito';
  IF v_credito>0 THEN
    INSERT INTO public.ra_cuenta_corriente_movimientos(empresa_id,cliente_id,venta_id,tipo,monto,fecha_vencimiento,usuario_id)
    VALUES(v_empresa,p_cliente_id,v_venta,'cargo',v_credito,p_fecha_vencimiento,v_user);
    UPDATE public.ra_clientes SET saldo_deudor=saldo_deudor+v_credito WHERE id=p_cliente_id RETURNING saldo_deudor INTO v_saldo_nuevo;
  END IF;
  IF p_tipo_comprobante IN ('boleta','factura') THEN
    -- Sin rucEmisor/razonSocial: osesunat los resuelve por su cuenta desde el
    -- tenant del X-Api-Key. formaPago/montoCredito/fechaVencimiento solo
    -- aplican a factura (alcance de osesunat, ver API.md). numeroPlaca es
    -- opcional y se replica igual en todos los ítems de la venta.
    SELECT jsonb_build_object(
      'tipo',upper(p_tipo_comprobante::text),'serie',v_serie,'correlativo',v_correlativo,
      'fechaEmision',current_date,
      'cliente',jsonb_build_object('nombre',COALESCE(c.nombre,'Consumidor Final'),'tipoDocumento',c.tipo_documento,'nroDocumento',c.nro_documento),
      'items',(SELECT jsonb_agg(jsonb_build_object('descripcion',i.nombre_producto,'cantidad',i.cantidad,'valorUnitario',i.precio_unitario,'subtotalBase',i.subtotal,'numeroPlaca',v_numero_placa) ORDER BY i.catalogo_id) FROM public.ra_venta_items i WHERE i.venta_id=v_venta),
      'subtotal',v_subtotal,'igv',v_igv,'total',v_total,'moneda',trim(p_moneda),'tipoCambio',p_tipo_cambio,
      'formaPago',CASE WHEN p_tipo_comprobante='factura' THEN (CASE WHEN v_credito>0 THEN 'CREDITO' ELSE 'CONTADO' END) END,
      'montoCredito',CASE WHEN p_tipo_comprobante='factura' AND v_credito>0 THEN v_credito END,
      'fechaVencimiento',CASE WHEN p_tipo_comprobante='factura' AND v_credito>0 THEN p_fecha_vencimiento END
    ) INTO v_fiscal FROM public.ra_empresas e LEFT JOIN public.ra_clientes c ON c.id=p_cliente_id WHERE e.id=v_empresa;
    INSERT INTO public.ra_sunat_outbox(empresa_id,venta_id,document_key,tipo_comprobante,serie,correlativo,request_payload)
    VALUES(v_empresa,v_venta,v_venta::text,p_tipo_comprobante,v_serie,v_correlativo,v_fiscal);
  END IF;
  RETURN public.ra_venta_resultado(v_venta,false);
EXCEPTION
  WHEN unique_violation THEN
    SELECT id,request_hash INTO v_venta,v_existing_hash FROM public.ra_ventas WHERE empresa_id=v_empresa AND operation_id=p_operation_id;
    IF v_venta IS NOT NULL AND v_existing_hash=v_hash THEN RETURN public.ra_venta_resultado(v_venta,true); END IF;
    RAISE;
END;
$$;
