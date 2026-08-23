-- Venta transaccional e idempotente + outbox fiscal durable.
-- Aditiva: las ventas historicas conservan operation_id/request_hash NULL.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.ra_ventas
  ADD COLUMN IF NOT EXISTS operation_id UUID,
  ADD COLUMN IF NOT EXISTS request_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_empresa_operation
  ON public.ra_ventas (empresa_id, operation_id)
  WHERE operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_serie_correlativo
  ON public.ra_ventas (empresa_id, serie, correlativo)
  WHERE serie IS NOT NULL AND correlativo IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ra_sunat_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.ra_empresas(id) ON DELETE RESTRICT,
  venta_id UUID NOT NULL REFERENCES public.ra_ventas(id) ON DELETE RESTRICT,
  document_key TEXT NOT NULL CHECK (length(document_key) BETWEEN 1 AND 255),
  tipo_comprobante public.ra_tipo_comprobante NOT NULL,
  serie TEXT NOT NULL,
  correlativo INTEGER NOT NULL CHECK (correlativo > 0),
  request_payload JSONB NOT NULL CHECK (jsonb_typeof(request_payload) = 'object'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','retry','submitted','accepted','rejected','dead_letter')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at TIMESTAMPTZ,
  lease_token UUID,
  lease_expires_at TIMESTAMPTZ,
  worker_id TEXT,
  external_id TEXT,
  http_status INTEGER,
  error_code TEXT,
  error_message TEXT CHECK (error_message IS NULL OR length(error_message) <= 2000),
  response_payload JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ra_sunat_outbox_venta_key UNIQUE (venta_id),
  CONSTRAINT ra_sunat_outbox_document_key UNIQUE (document_key),
  CONSTRAINT ra_sunat_outbox_document_identity UNIQUE (empresa_id, tipo_comprobante, serie, correlativo),
  CONSTRAINT ra_sunat_outbox_lease_shape CHECK (
    (status = 'processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (status <> 'processing')
  )
);

CREATE INDEX IF NOT EXISTS idx_sunat_outbox_ready
  ON public.ra_sunat_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending','retry');

CREATE INDEX IF NOT EXISTS idx_sunat_outbox_status_created
  ON public.ra_sunat_outbox (status, created_at);

ALTER TABLE public.ra_sunat_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ra_sunat_outbox FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ra_venta_resultado(p_venta_id UUID, p_replayed BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'status', 'confirmed',
    'replayed', p_replayed,
    'operationId', v.operation_id,
    'sale', jsonb_build_object(
      'id', v.id, 'total', v.total, 'tipoComprobante', v.tipo_comprobante,
      'moneda', trim(v.moneda), 'serie', v.serie, 'correlativo', v.correlativo,
      'numeroCompleto', v.numero_completo
    ),
    'empresa', jsonb_build_object(
      'razonSocial', e.razon_social, 'ruc', e.ruc, 'direccion', e.direccion, 'telefono', e.telefono
    ),
    'sucursal', jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion),
    'warnings', jsonb_build_object(
      'creditLimitExceeded', COALESCE((
        SELECT c.saldo_deudor > c.limite_credito FROM public.ra_clientes c WHERE c.id = v.cliente_id
      ), false)
    ),
    'fiscal', jsonb_build_object(
      'required', v.tipo_comprobante IN ('boleta','factura'),
      'status', o.status
    )
  )
  FROM public.ra_ventas v
  JOIN public.ra_empresas e ON e.id = v.empresa_id
  JOIN public.ra_sucursales s ON s.id = v.sucursal_id
  LEFT JOIN public.ra_sunat_outbox o ON o.venta_id = v.id
  WHERE v.id = p_venta_id;
$$;

CREATE OR REPLACE FUNCTION public.ra_obtener_resultado_venta(p_operation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_empresa UUID;
  v_rol public.ra_rol;
  v_venta UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED';
  END IF;
  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles
   WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;
  SELECT id INTO v_venta FROM public.ra_ventas
   WHERE empresa_id = v_empresa AND operation_id = p_operation_id
     AND (usuario_id=v_user OR v_rol='administrador');
  IF v_venta IS NULL THEN
    RETURN jsonb_build_object('status','not_found','operationId',p_operation_id);
  END IF;
  RETURN public.ra_venta_resultado(v_venta, true);
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_confirmar_venta(
  p_operation_id UUID,
  p_sucursal_id UUID,
  p_tipo_comprobante public.ra_tipo_comprobante,
  p_cliente_id UUID,
  p_items JSONB,
  p_pagos JSONB,
  p_moneda CHAR(3),
  p_tipo_cambio NUMERIC,
  p_fecha_vencimiento DATE
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
  v_canonical JSONB;
  v_fiscal JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT: operation_id'; END IF;

  SELECT empresa_id, rol, sucursal_id INTO v_empresa, v_rol, v_perfil_sucursal
  FROM public.ra_perfiles WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','vendedor') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales s WHERE s.id=p_sucursal_id AND s.empresa_id=v_empresa AND s.activo=true)
     OR (v_rol='vendedor' AND v_perfil_sucursal IS DISTINCT FROM p_sucursal_id) THEN
    RAISE EXCEPTION USING MESSAGE='RA_BRANCH_INVALID';
  END IF;
  SELECT id INTO v_caja FROM public.ra_cajas
   WHERE empresa_id=v_empresa AND sucursal_id=p_sucursal_id AND estado='abierta'
     AND (usuario_id=v_user OR v_rol='administrador')
   ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE;
  IF v_caja IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF;

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
    'fechaVencimiento',p_fecha_vencimiento,
    'items',(SELECT jsonb_agg(jsonb_build_object('productoId',x->>'productoId','cantidad',(x->>'cantidad')::numeric,'descuento',COALESCE((x->>'descuento')::numeric,0)) ORDER BY x->>'productoId') FROM jsonb_array_elements(p_items) x),
    'pagos',(SELECT jsonb_agg(jsonb_build_object('metodoPago',x->>'metodoPago','monto',(x->>'monto')::numeric,'referencia',NULLIF(trim(x->>'referencia'),'')) ORDER BY x->>'metodoPago',(x->>'monto')::numeric,COALESCE(x->>'referencia','')) FROM jsonb_array_elements(p_pagos) x)
  );
  v_hash := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':'||p_operation_id::text,0));
  SELECT id,request_hash,usuario_id INTO v_venta,v_existing_hash,v_existing_user FROM public.ra_ventas
   WHERE empresa_id=v_empresa AND operation_id=p_operation_id;
  IF v_venta IS NOT NULL THEN
    IF v_existing_user<>v_user AND v_rol<>'administrador' THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
    IF v_existing_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN public.ra_venta_resultado(v_venta,true);
  END IF;

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
    v_subtotal := v_subtotal+v_linea;
  END LOOP;
  v_subtotal:=round(v_subtotal,2);
  v_igv:=CASE WHEN p_tipo_comprobante='ticket' THEN 0 ELSE round(v_subtotal*0.18,2) END;
  v_total:=v_subtotal+v_igv;

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

  INSERT INTO public.ra_ventas(empresa_id,sucursal_id,caja_id,cliente_id,usuario_id,tipo_comprobante,subtotal,igv,total,estado,serie,correlativo,moneda,tipo_cambio,operation_id,request_hash)
  VALUES(v_empresa,p_sucursal_id,v_caja,p_cliente_id,v_user,p_tipo_comprobante,v_subtotal,v_igv,v_total,CASE WHEN p_tipo_comprobante='ticket' THEN 'completada'::public.ra_estado_venta ELSE 'pendiente'::public.ra_estado_venta END,v_serie,v_correlativo,trim(p_moneda),p_tipo_cambio,p_operation_id,v_hash)
  RETURNING id INTO v_venta;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'productoId' LOOP
    v_cantidad := (v_item->>'cantidad')::numeric;
    v_descuento := COALESCE((v_item->>'descuento')::numeric,0);
    SELECT p.id,p.catalogo_id,p.stock_actual,p.precio_venta,p.precio_venta_dolar,c.nombre,c.codigo_oem
      INTO v_prod FROM public.ra_productos p JOIN public.ra_catalogo_repuestos c ON c.id=p.catalogo_id
     WHERE p.id=(v_item->>'productoId')::uuid;
    v_precio := CASE WHEN trim(p_moneda)='USD' THEN v_prod.precio_venta_dolar ELSE v_prod.precio_venta END;
    v_linea := round(v_precio*v_cantidad-v_descuento,2);
    INSERT INTO public.ra_venta_items(venta_id,catalogo_id,cantidad,precio_unitario,descuento,subtotal,nombre_producto,codigo_oem)
    VALUES(v_venta,v_prod.catalogo_id,v_cantidad,v_precio,v_descuento,v_linea,v_prod.nombre,v_prod.codigo_oem);
    UPDATE public.ra_productos SET stock_actual=stock_actual-v_cantidad WHERE id=v_prod.id;
    INSERT INTO public.ra_kardex(empresa_id,sucursal_id,catalogo_id,tipo,motivo,cantidad,stock_anterior,stock_nuevo,referencia_id,usuario_id)
    VALUES(v_empresa,p_sucursal_id,v_prod.catalogo_id,'salida','venta',v_cantidad,v_prod.stock_actual,v_prod.stock_actual-v_cantidad,v_venta,v_user);
  END LOOP;
  INSERT INTO public.ra_venta_pagos(venta_id,metodo_pago,monto,referencia)
  SELECT v_venta,(x->>'metodoPago')::public.ra_metodo_pago,round((x->>'monto')::numeric,2),NULLIF(trim(x->>'referencia'),'') FROM jsonb_array_elements(p_pagos)x;
  INSERT INTO public.ra_movimientos_caja(caja_id,tipo,concepto,monto,metodo_pago,referencia_id)
  SELECT v_caja,'ingreso','Venta '||upper(left(v_venta::text,8)),round((x->>'monto')::numeric,2),(x->>'metodoPago')::public.ra_metodo_pago,v_venta
   FROM jsonb_array_elements(p_pagos)x WHERE x->>'metodoPago'<>'credito';
  IF v_credito>0 THEN
    INSERT INTO public.ra_cuenta_corriente_movimientos(empresa_id,cliente_id,venta_id,tipo,monto,fecha_vencimiento,usuario_id)
    VALUES(v_empresa,p_cliente_id,v_venta,'cargo',v_credito,p_fecha_vencimiento,v_user);
    UPDATE public.ra_clientes SET saldo_deudor=saldo_deudor+v_credito WHERE id=p_cliente_id RETURNING saldo_deudor INTO v_saldo_nuevo;
  END IF;
  IF p_tipo_comprobante IN ('boleta','factura') THEN
    SELECT jsonb_build_object(
      'tipo',upper(p_tipo_comprobante::text),'serie',v_serie,'correlativo',v_correlativo,
      'rucEmisor',e.ruc,'razonSocial',COALESCE(e.razon_social,e.nombre),'fechaEmision',current_date,
      'cliente',jsonb_build_object('nombre',COALESCE(c.nombre,'Consumidor Final'),'tipoDocumento',c.tipo_documento,'nroDocumento',c.nro_documento),
      'items',(SELECT jsonb_agg(jsonb_build_object('descripcion',i.nombre_producto,'cantidad',i.cantidad,'valorUnitario',i.precio_unitario,'subtotalBase',i.subtotal) ORDER BY i.catalogo_id) FROM public.ra_venta_items i WHERE i.venta_id=v_venta),
      'subtotal',v_subtotal,'igv',v_igv,'total',v_total,'moneda',trim(p_moneda),'tipoCambio',p_tipo_cambio
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

CREATE OR REPLACE FUNCTION public.ra_claim_sunat_outbox(p_worker_id TEXT,p_limit INTEGER DEFAULT 10,p_lease_seconds INTEGER DEFAULT 120)
RETURNS SETOF public.ra_sunat_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
BEGIN
  IF COALESCE(p_limit,0) NOT BETWEEN 1 AND 10 OR COALESCE(p_lease_seconds,0) NOT BETWEEN 30 AND 900 THEN RAISE EXCEPTION 'RA_INVALID_INPUT'; END IF;
  UPDATE public.ra_sunat_outbox SET status='retry',lease_token=NULL,lease_expires_at=NULL,worker_id=NULL,updated_at=now()
   WHERE status='processing' AND lease_expires_at<now();
  RETURN QUERY WITH picked AS (
    SELECT id FROM public.ra_sunat_outbox WHERE status IN ('pending','retry') AND next_attempt_at<=now()
    ORDER BY next_attempt_at,created_at FOR UPDATE SKIP LOCKED LIMIT p_limit
  ) UPDATE public.ra_sunat_outbox o SET status='processing',attempt_count=attempt_count+1,last_attempt_at=now(),
      lease_token=gen_random_uuid(),lease_expires_at=now()+make_interval(secs=>p_lease_seconds),worker_id=p_worker_id,updated_at=now()
    FROM picked WHERE o.id=picked.id RETURNING o.*;
END; $$;

CREATE OR REPLACE FUNCTION public.ra_finish_sunat_outbox(p_job_id UUID,p_lease_token UUID,p_outcome TEXT,p_external_id TEXT DEFAULT NULL,p_http_status INTEGER DEFAULT NULL,p_error_code TEXT DEFAULT NULL,p_error_message TEXT DEFAULT NULL,p_response_payload JSONB DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_job public.ra_sunat_outbox; v_status TEXT; v_delay INTEGER;
BEGIN
  SELECT * INTO v_job FROM public.ra_sunat_outbox WHERE id=p_job_id AND status='processing' AND lease_token=p_lease_token AND lease_expires_at>=now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_status:=CASE p_outcome WHEN 'accepted' THEN 'accepted' WHEN 'rejected' THEN 'rejected' WHEN 'submitted' THEN 'submitted' WHEN 'uncertain' THEN 'submitted' WHEN 'temporary_error' THEN CASE WHEN v_job.attempt_count>=10 THEN 'dead_letter' ELSE 'retry' END ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION 'RA_INVALID_INPUT'; END IF;
  v_delay:=LEAST(300*power(2,GREATEST(v_job.attempt_count-1,0))::integer,21600);
  UPDATE public.ra_sunat_outbox SET status=v_status,external_id=COALESCE(p_external_id,external_id),http_status=p_http_status,error_code=p_error_code,
    error_message=left(p_error_message,2000),response_payload=p_response_payload,next_attempt_at=CASE WHEN v_status='retry' THEN now()+make_interval(secs=>v_delay) ELSE next_attempt_at END,
    completed_at=CASE WHEN v_status IN ('accepted','rejected','dead_letter') THEN now() ELSE NULL END,lease_token=NULL,lease_expires_at=NULL,worker_id=NULL,updated_at=now()
   WHERE id=p_job_id;
  UPDATE public.ra_ventas SET estado=CASE WHEN v_status='accepted' THEN 'completada'::public.ra_estado_venta WHEN v_status='rejected' THEN 'error_sunat'::public.ra_estado_venta ELSE estado END,
    sunat_estado=CASE WHEN v_status='accepted' THEN 'aceptada' WHEN v_status='rejected' THEN 'rechazado' ELSE 'pendiente' END,id_externo=COALESCE(p_external_id,id_externo)
   WHERE id=v_job.venta_id;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.ra_venta_resultado(UUID,BOOLEAN) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_confirmar_venta(UUID,UUID,public.ra_tipo_comprobante,UUID,JSONB,JSONB,CHAR,NUMERIC,DATE) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ra_obtener_resultado_venta(UUID) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.ra_claim_sunat_outbox(TEXT,INTEGER,INTEGER) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_finish_sunat_outbox(UUID,UUID,TEXT,TEXT,INTEGER,TEXT,TEXT,JSONB) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ra_confirmar_venta(UUID,UUID,public.ra_tipo_comprobante,UUID,JSONB,JSONB,CHAR,NUMERIC,DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_obtener_resultado_venta(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_claim_sunat_outbox(TEXT,INTEGER,INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.ra_finish_sunat_outbox(UUID,UUID,TEXT,TEXT,INTEGER,TEXT,TEXT,JSONB) TO service_role;

COMMENT ON TABLE public.ra_sunat_outbox IS 'Outbox fiscal durable; sin acceso directo desde el POS.';
COMMENT ON FUNCTION public.ra_confirmar_venta(UUID,UUID,public.ra_tipo_comprobante,UUID,JSONB,JSONB,CHAR,NUMERIC,DATE) IS 'Confirma todo el agregado de venta en una sola transaccion idempotente.';
