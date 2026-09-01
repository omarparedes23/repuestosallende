-- 055: base aditiva para devoluciones comerciales y notas de crédito.
-- No contiene configuración productiva de series ni ejecuta llamadas externas.
BEGIN;

CREATE TYPE public.ra_estado_devolucion AS ENUM ('solicitada','liquidada','rechazada');

CREATE TABLE public.ra_devoluciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.ra_empresas(id) ON DELETE RESTRICT,
  venta_id uuid NOT NULL REFERENCES public.ra_ventas(id) ON DELETE RESTRICT,
  sucursal_id uuid NOT NULL REFERENCES public.ra_sucursales(id) ON DELETE RESTRICT,
  estado public.ra_estado_devolucion NOT NULL DEFAULT 'solicitada',
  motivo text NOT NULL CHECK (length(btrim(motivo)) BETWEEN 3 AND 1000),
  venta_created_at timestamptz NOT NULL,
  solicitante_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  aprobador_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  receptor_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  liquidador_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  received_at timestamptz,
  liquidated_at timestamptz,
  solicitud_operation_id uuid NOT NULL,
  solicitud_request_hash text NOT NULL CHECK (solicitud_request_hash ~ '^[0-9a-f]{64}$'),
  operation_id uuid,
  request_hash text CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$'),
  result_snapshot jsonb CHECK (result_snapshot IS NULL OR jsonb_typeof(result_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_devoluciones_liquidada_shape CHECK (
    (estado <> 'liquidada') OR (
      aprobador_id IS NOT NULL AND receptor_id IS NOT NULL AND liquidador_id IS NOT NULL
      AND approved_at IS NOT NULL AND received_at IS NOT NULL AND liquidated_at IS NOT NULL
      AND operation_id IS NOT NULL AND request_hash IS NOT NULL AND result_snapshot IS NOT NULL
    )
  )
);
CREATE UNIQUE INDEX ra_devoluciones_empresa_solicitud_operation_key
  ON public.ra_devoluciones(empresa_id, solicitud_operation_id);
CREATE UNIQUE INDEX ra_devoluciones_empresa_operation_key
  ON public.ra_devoluciones(empresa_id, operation_id) WHERE operation_id IS NOT NULL;
CREATE INDEX ra_devoluciones_venta_idx ON public.ra_devoluciones(venta_id, created_at DESC);

CREATE TABLE public.ra_devolucion_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id uuid NOT NULL REFERENCES public.ra_devoluciones(id) ON DELETE RESTRICT,
  venta_item_id uuid NOT NULL REFERENCES public.ra_venta_items(id) ON DELETE RESTRICT,
  catalogo_id uuid NOT NULL REFERENCES public.ra_catalogo_repuestos(id) ON DELETE RESTRICT,
  cantidad numeric(10,3) NOT NULL CHECK (cantidad > 0),
  importe numeric(10,2) NOT NULL CHECK (importe >= 0),
  reingresa_stock boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_devolucion_items_devolucion_linea_key UNIQUE(devolucion_id, venta_item_id)
);

CREATE TABLE public.ra_devolucion_liquidaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id uuid NOT NULL REFERENCES public.ra_devoluciones(id) ON DELETE RESTRICT,
  metodo_pago public.ra_metodo_pago NOT NULL,
  monto numeric(10,2) NOT NULL CHECK (monto > 0),
  referencia text,
  movimiento_caja_id uuid REFERENCES public.ra_movimientos_caja(id) ON DELETE RESTRICT,
  movimiento_cuenta_corriente_id uuid REFERENCES public.ra_cuenta_corriente_movimientos(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_devolucion_liquidaciones_shape CHECK (
    (metodo_pago = 'credito' AND movimiento_caja_id IS NULL AND movimiento_cuenta_corriente_id IS NOT NULL)
    OR (metodo_pago <> 'credito' AND movimiento_caja_id IS NOT NULL AND movimiento_cuenta_corriente_id IS NULL)
  )
);

CREATE TABLE public.ra_auditoria_devoluciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.ra_empresas(id) ON DELETE RESTRICT,
  devolucion_id uuid NOT NULL REFERENCES public.ra_devoluciones(id) ON DELETE RESTRICT,
  evento text NOT NULL CHECK (evento IN ('solicitada','liquidada','rechazada','fiscal_pending','fiscal_accepted','fiscal_rejected')),
  usuario_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  motivo text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ra_auditoria_devoluciones_devolucion_idx ON public.ra_auditoria_devoluciones(devolucion_id, created_at);

-- 051 ya creó la fuente de verdad de series. Se amplía sin duplicarla.
ALTER TABLE public.ra_series_documento
  DROP CONSTRAINT ra_series_tipo_documento_check;
ALTER TABLE public.ra_series_documento
  ADD CONSTRAINT ra_series_tipo_documento_check
  CHECK (tipo_documento IN ('guia_remision','nota_credito_factura','nota_credito_boleta'));

CREATE TABLE public.ra_sunat_nota_credito_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.ra_empresas(id) ON DELETE RESTRICT,
  devolucion_id uuid NOT NULL REFERENCES public.ra_devoluciones(id) ON DELETE RESTRICT,
  venta_id uuid NOT NULL REFERENCES public.ra_ventas(id) ON DELETE RESTRICT,
  document_key text NOT NULL CHECK (length(document_key) BETWEEN 1 AND 255),
  tipo_referenciado public.ra_tipo_comprobante NOT NULL CHECK (tipo_referenciado IN ('factura','boleta')),
  motivo_codigo text NOT NULL CHECK (motivo_codigo IN ('06','07')),
  motivo_descripcion text NOT NULL CHECK (length(btrim(motivo_descripcion)) BETWEEN 3 AND 250),
  serie text NOT NULL,
  correlativo integer NOT NULL CHECK (correlativo > 0),
  request_payload jsonb NOT NULL CHECK (jsonb_typeof(request_payload) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','retry','submitted','accepted','rejected','dead_letter')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_attempt_at timestamptz,
  lease_token uuid,
  lease_expires_at timestamptz,
  worker_id text,
  external_id text,
  http_status integer,
  error_code text,
  error_message text CHECK (error_message IS NULL OR length(error_message) <= 2000),
  response_payload jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ra_sunat_nc_outbox_devolucion_key UNIQUE(devolucion_id),
  CONSTRAINT ra_sunat_nc_outbox_document_key UNIQUE(document_key),
  CONSTRAINT ra_sunat_nc_outbox_document_identity UNIQUE(empresa_id,serie,correlativo),
  CONSTRAINT ra_sunat_nc_outbox_lease_shape CHECK ((status='processing' AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL) OR status <> 'processing')
);
CREATE INDEX ra_sunat_nc_outbox_ready_idx ON public.ra_sunat_nota_credito_outbox(next_attempt_at,created_at) WHERE status IN ('pending','retry');

-- Libros existentes: efectos compensatorios, siempre con monto positivo.
ALTER TABLE public.ra_movimientos_caja
  ADD COLUMN IF NOT EXISTS devolucion_id uuid REFERENCES public.ra_devoluciones(id) ON DELETE RESTRICT;
ALTER TABLE public.ra_movimientos_caja
  DROP CONSTRAINT IF EXISTS ra_movimientos_caja_operacion_check;
ALTER TABLE public.ra_movimientos_caja
  ADD CONSTRAINT ra_movimientos_caja_operacion_check CHECK (
    operation_id IS NULL OR (
      request_hash IS NOT NULL AND request_hash ~ '^[0-9a-f]{64}$'
      AND usuario_id IS NOT NULL
      AND origen IN ('venta','cobro','pago_proveedor','manual','ajuste','devolucion')
      AND (origen <> 'devolucion' OR devolucion_id IS NOT NULL)
    )
  );
CREATE UNIQUE INDEX uq_movimientos_caja_devolucion_operation
  ON public.ra_movimientos_caja(devolucion_id, operation_id)
  WHERE devolucion_id IS NOT NULL AND operation_id IS NOT NULL;

ALTER TABLE public.ra_cuenta_corriente_movimientos
  ADD COLUMN IF NOT EXISTS origen text,
  ADD COLUMN IF NOT EXISTS devolucion_id uuid REFERENCES public.ra_devoluciones(id) ON DELETE RESTRICT;
ALTER TABLE public.ra_cuenta_corriente_movimientos
  DROP CONSTRAINT IF EXISTS ra_cc_shape_check;
ALTER TABLE public.ra_cuenta_corriente_movimientos
  ADD CONSTRAINT ra_cc_shape_check CHECK (
    (tipo='cargo' AND fecha_vencimiento IS NOT NULL
      AND moneda_cobro IS NULL AND tipo_cambio_cobro IS NULL AND metodo_pago IS NULL)
    OR
    (tipo='abono' AND fecha_vencimiento IS NULL AND moneda_cobro IS NOT NULL
      AND metodo_pago IS NOT NULL AND (
        metodo_pago <> 'credito'
        OR (origen='devolucion' AND devolucion_id IS NOT NULL)
      ))
  );
ALTER TABLE public.ra_cuenta_corriente_movimientos
  ADD CONSTRAINT ra_cc_devolucion_origen_check CHECK (
    origen IS NULL OR origen IN ('cobro','devolucion')
  );
CREATE UNIQUE INDEX uq_cc_devolucion_operation
  ON public.ra_cuenta_corriente_movimientos(devolucion_id, operation_id)
  WHERE devolucion_id IS NOT NULL AND operation_id IS NOT NULL;

ALTER TABLE public.ra_devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ra_devolucion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ra_devolucion_liquidaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ra_auditoria_devoluciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ra_sunat_nota_credito_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ra_devoluciones, public.ra_devolucion_items,
  public.ra_devolucion_liquidaciones, public.ra_auditoria_devoluciones,
  public.ra_sunat_nota_credito_outbox FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON public.ra_devoluciones, public.ra_devolucion_items,
  public.ra_devolucion_liquidaciones, public.ra_auditoria_devoluciones,
  public.ra_sunat_nota_credito_outbox FROM authenticated;
GRANT SELECT ON public.ra_devoluciones, public.ra_devolucion_items,
  public.ra_devolucion_liquidaciones, public.ra_auditoria_devoluciones TO authenticated;

CREATE POLICY ra_devoluciones_select ON public.ra_devoluciones FOR SELECT TO authenticated USING (empresa_id = public.ra_empresa_id());
CREATE POLICY ra_devolucion_items_select ON public.ra_devolucion_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ra_devoluciones d WHERE d.id=devolucion_id AND d.empresa_id=public.ra_empresa_id()));
CREATE POLICY ra_devolucion_liquidaciones_select ON public.ra_devolucion_liquidaciones FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.ra_devoluciones d WHERE d.id=devolucion_id AND d.empresa_id=public.ra_empresa_id()));
CREATE POLICY ra_auditoria_devoluciones_select ON public.ra_auditoria_devoluciones FOR SELECT TO authenticated USING (empresa_id = public.ra_empresa_id());
CREATE POLICY ra_sunat_nota_credito_outbox_select ON public.ra_sunat_nota_credito_outbox FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ra_devoluciones d WHERE d.id=devolucion_id AND d.empresa_id=public.ra_empresa_id())
);

CREATE OR REPLACE FUNCTION public.ra_solicitar_devolucion_v1(
  p_operation_id uuid,
  p_venta_id uuid,
  p_items jsonb,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid(); v_empresa uuid; v_rol public.ra_rol;
  v_venta public.ra_ventas%ROWTYPE; v_hash text; v_canonical jsonb;
  v_prev public.ra_devoluciones%ROWTYPE; v_devolucion uuid := gen_random_uuid();
  v_item jsonb; v_venta_item public.ra_venta_items%ROWTYPE; v_cantidad numeric;
  v_motivo text := nullif(btrim(p_motivo),''); v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_venta_id IS NULL OR v_motivo IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items)=0 THEN
    RAISE EXCEPTION USING MESSAGE='RA_RETURN_INPUT_INVALID';
  END IF;
  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles WHERE id=v_user AND activo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  IF v_rol='lectura' THEN RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN'; END IF;
  v_canonical:=jsonb_build_object('ventaId',p_venta_id,'items',(SELECT jsonb_agg(value ORDER BY value->>'ventaItemId') FROM jsonb_array_elements(p_items)),'motivo',v_motivo);
  v_hash:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(v_empresa::text||':devolucion:solicitud:'||p_operation_id::text,0));
  SELECT * INTO v_prev FROM public.ra_devoluciones WHERE empresa_id=v_empresa AND solicitud_operation_id=p_operation_id;
  IF FOUND THEN
    IF v_prev.solicitud_request_hash IS DISTINCT FROM v_hash THEN RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT'; END IF;
    RETURN jsonb_build_object('status','requested','replayed',true,'devolucionId',v_prev.id);
  END IF;
  SELECT * INTO v_venta FROM public.ra_ventas WHERE id=p_venta_id AND empresa_id=v_empresa FOR SHARE;
  IF NOT FOUND OR v_venta.estado NOT IN ('completada','pendiente','error_sunat') THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_SALE_INVALID'; END IF;
  INSERT INTO public.ra_devoluciones(id,empresa_id,venta_id,sucursal_id,motivo,venta_created_at,solicitante_id,solicitud_operation_id,solicitud_request_hash)
  VALUES(v_devolucion,v_empresa,p_venta_id,v_venta.sucursal_id,v_motivo,v_venta.created_at,v_user,p_operation_id,v_hash);
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) ORDER BY value->>'ventaItemId' LOOP
    v_cantidad:=(v_item->>'cantidad')::numeric;
    IF v_cantidad IS NULL OR v_cantidad<=0 THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_QUANTITY_INVALID'; END IF;
    SELECT * INTO v_venta_item FROM public.ra_venta_items WHERE id=(v_item->>'ventaItemId')::uuid AND venta_id=p_venta_id FOR SHARE;
    IF NOT FOUND OR v_cantidad>v_venta_item.cantidad THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_ITEM_INVALID'; END IF;
    INSERT INTO public.ra_devolucion_items(devolucion_id,venta_item_id,catalogo_id,cantidad,importe,reingresa_stock)
    VALUES(v_devolucion,v_venta_item.id,v_venta_item.catalogo_id,v_cantidad,round(v_venta_item.subtotal*v_cantidad/v_venta_item.cantidad,2),coalesce((v_item->>'reingresaStock')::boolean,true));
  END LOOP;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata)
  VALUES(v_empresa,v_devolucion,'solicitada',v_user,v_motivo,jsonb_build_object('ventaId',p_venta_id));
  v_result:=jsonb_build_object('status','requested','replayed',false,'devolucionId',v_devolucion,'ventaId',p_venta_id);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.ra_solicitar_devolucion_v1(uuid,uuid,jsonb,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.ra_solicitar_devolucion_v1(uuid,uuid,jsonb,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.ra_liquidar_devolucion_v1(
  p_operation_id uuid, p_devolucion_id uuid, p_referencias jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid:=auth.uid(); v_empresa uuid; v_rol public.ra_rol;
  v_d public.ra_devoluciones%ROWTYPE; v_sale public.ra_ventas%ROWTYPE;
  v_hash text; v_canonical jsonb; v_subtotal numeric(10,2); v_igv numeric(10,2); v_total numeric(10,2); v_paid numeric(10,2);
  v_remaining numeric(10,2); v_alloc numeric(10,2); v_n integer:=0; v_i integer:=0;
  v_pay record; v_item record; v_product public.ra_productos%ROWTYPE;
  v_caja uuid; v_cc_balance numeric(10,2); v_ref text; v_nc_status text;
  v_tipo_serie text; v_serie text; v_correlativo integer; v_result jsonb;
  v_movimiento_caja_id uuid; v_movimiento_cc_id uuid; v_fiscal jsonb; v_original_fiscal jsonb;
  v_motivo_codigo text; v_motivo_descripcion text; v_total_vendido_items numeric(10,3);
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_devolucion_id IS NULL OR jsonb_typeof(p_referencias)<>'object' THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_INPUT_INVALID'; END IF;
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
  IF v_d.estado<>'solicitada' THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_STATE_INVALID'; END IF;
  SELECT * INTO v_sale FROM public.ra_ventas WHERE id=v_d.venta_id AND empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_SALE_INVALID'; END IF;
  IF v_sale.tipo_comprobante IN ('boleta','factura') THEN
    SELECT status,request_payload INTO v_nc_status,v_original_fiscal FROM public.ra_sunat_outbox WHERE venta_id=v_sale.id FOR SHARE;
    IF v_nc_status IS NULL OR v_nc_status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_FISCAL_RECONCILIATION_REQUIRED'; END IF;
  END IF;
  SELECT coalesce(sum(importe),0) INTO v_subtotal FROM public.ra_devolucion_items WHERE devolucion_id=v_d.id;
  v_igv:=CASE WHEN v_sale.tipo_comprobante='ticket' THEN 0 ELSE round(v_subtotal*0.18,2) END;
  v_total:=v_subtotal+v_igv;
  IF v_total<=0 THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_TOTAL_INVALID'; END IF;
  FOR v_item IN SELECT di.*,vi.cantidad AS vendida FROM public.ra_devolucion_items di JOIN public.ra_venta_items vi ON vi.id=di.venta_item_id WHERE di.devolucion_id=v_d.id ORDER BY di.venta_item_id FOR UPDATE LOOP
    IF v_item.cantidad + coalesce((SELECT sum(x.cantidad) FROM public.ra_devolucion_items x JOIN public.ra_devoluciones d ON d.id=x.devolucion_id WHERE x.venta_item_id=v_item.venta_item_id AND d.estado='liquidada'),0) > v_item.vendida THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_QUANTITY_EXCEEDED'; END IF;
    IF v_item.reingresa_stock THEN
      SELECT * INTO v_product FROM public.ra_productos WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND catalogo_id=v_item.catalogo_id AND activo FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_PRODUCT_NOT_FOUND_AT_BRANCH'; END IF;
      UPDATE public.ra_productos SET stock_actual=stock_actual+v_item.cantidad WHERE id=v_product.id;
      INSERT INTO public.ra_kardex(empresa_id,sucursal_id,catalogo_id,tipo,motivo,cantidad,stock_anterior,stock_nuevo,referencia_id,usuario_id,notas)
      VALUES(v_empresa,v_d.sucursal_id,v_item.catalogo_id,'entrada','devolucion',v_item.cantidad,v_product.stock_actual,v_product.stock_actual+v_item.cantidad,v_d.id,v_user,'Devolucion de venta');
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.ra_venta_pagos WHERE venta_id=v_sale.id AND metodo_pago='credito') THEN
    IF v_sale.cliente_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_CREDIT_CUSTOMER_INVALID'; END IF;
    PERFORM 1 FROM public.ra_clientes WHERE id=v_sale.cliente_id AND empresa_id=v_empresa FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_CREDIT_CUSTOMER_INVALID'; END IF;
  END IF;
  SELECT coalesce(sum(monto),0),count(DISTINCT metodo_pago) INTO v_paid,v_n FROM public.ra_venta_pagos WHERE venta_id=v_sale.id;
  IF v_paid < v_total THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_PAYMENT_ALLOCATION_INVALID'; END IF;
  IF EXISTS (SELECT 1 FROM public.ra_venta_pagos WHERE venta_id=v_sale.id AND metodo_pago<>'credito') THEN
    SELECT id INTO v_caja FROM public.ra_cajas WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND estado='abierta' ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE;
    IF v_caja IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF;
  END IF;
  v_remaining:=v_total;
  v_result:=jsonb_build_object('status','liquidated','replayed',false,'devolucionId',v_d.id,'ventaId',v_sale.id,'total',v_total);
  FOR v_pay IN SELECT metodo_pago,sum(monto) AS monto FROM public.ra_venta_pagos WHERE venta_id=v_sale.id GROUP BY metodo_pago ORDER BY metodo_pago LOOP
    v_i:=v_i+1; v_alloc:=CASE WHEN v_i=v_n THEN v_remaining ELSE round(v_total*v_pay.monto/v_paid,2) END; v_remaining:=v_remaining-v_alloc;
    IF v_alloc<=0 THEN CONTINUE; END IF;
    v_ref:=nullif(btrim(coalesce(p_referencias->>v_pay.metodo_pago::text,'')),'');
    IF v_pay.metodo_pago IN ('yape','tarjeta','transferencia') AND v_ref IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_REFERENCE_REQUIRED'; END IF;
    IF v_pay.metodo_pago='credito' THEN
      SELECT coalesce(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0) INTO v_cc_balance FROM public.ra_cuenta_corriente_movimientos WHERE empresa_id=v_empresa AND venta_id=v_sale.id;
      IF v_alloc>v_cc_balance THEN RAISE EXCEPTION USING MESSAGE='RA_RETURN_CREDIT_EXCEEDS_BALANCE'; END IF;
      INSERT INTO public.ra_cuenta_corriente_movimientos(empresa_id,cliente_id,venta_id,tipo,monto,fecha,moneda_cobro,metodo_pago,usuario_id,operation_id,request_hash,result_snapshot,sucursal_id,origen,devolucion_id)
      VALUES(v_empresa,v_sale.cliente_id,v_sale.id,'abono',v_alloc,current_date,v_sale.moneda,'credito',v_user,p_operation_id,v_hash,v_result,v_d.sucursal_id,'devolucion',v_d.id)
      RETURNING id INTO v_movimiento_cc_id;
      UPDATE public.ra_clientes SET saldo_deudor=saldo_deudor-v_alloc WHERE id=v_sale.cliente_id;
    ELSE
      INSERT INTO public.ra_movimientos_caja(caja_id,tipo,concepto,monto,metodo_pago,referencia_id,usuario_id,operation_id,request_hash,origen,devolucion_id,notas)
      VALUES(v_caja,'egreso','Devolucion de venta',v_alloc,v_pay.metodo_pago,v_d.id,v_user,p_operation_id,v_hash,'devolucion',v_d.id,v_ref)
      RETURNING id INTO v_movimiento_caja_id;
    END IF;
    INSERT INTO public.ra_devolucion_liquidaciones(devolucion_id,metodo_pago,monto,referencia,movimiento_caja_id,movimiento_cuenta_corriente_id)
    VALUES(v_d.id,v_pay.metodo_pago,v_alloc,v_ref,
      CASE WHEN v_pay.metodo_pago='credito' THEN NULL ELSE v_movimiento_caja_id END,
      CASE WHEN v_pay.metodo_pago='credito' THEN v_movimiento_cc_id ELSE NULL END);
  END LOOP;
  IF v_sale.tipo_comprobante IN ('boleta','factura') AND v_nc_status='accepted' THEN
    SELECT coalesce(sum(vi.cantidad),0) INTO v_total_vendido_items FROM public.ra_venta_items vi WHERE vi.venta_id=v_sale.id;
    IF (SELECT count(*) FROM public.ra_devolucion_items di WHERE di.devolucion_id=v_d.id) = (SELECT count(*) FROM public.ra_venta_items vi WHERE vi.venta_id=v_sale.id)
       AND (SELECT coalesce(sum(di.cantidad),0) FROM public.ra_devolucion_items di WHERE di.devolucion_id=v_d.id)=v_total_vendido_items THEN
      v_motivo_codigo:='06'; v_motivo_descripcion:='Devolucion total';
    ELSE
      v_motivo_codigo:='07'; v_motivo_descripcion:='Devolucion por item';
    END IF;
    v_tipo_serie:=CASE WHEN v_sale.tipo_comprobante='factura' THEN 'nota_credito_factura' ELSE 'nota_credito_boleta' END;
    SELECT serie,siguiente_correlativo INTO v_serie,v_correlativo FROM public.ra_series_documento
      WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND tipo_documento=v_tipo_serie AND activo AND es_predeterminada
      FOR UPDATE;
    IF v_serie IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CREDIT_NOTE_SERIES_NOT_CONFIGURED'; END IF;
    UPDATE public.ra_series_documento SET siguiente_correlativo=siguiente_correlativo+1,updated_at=now()
      WHERE empresa_id=v_empresa AND sucursal_id=v_d.sucursal_id AND tipo_documento=v_tipo_serie AND serie=v_serie;
    v_fiscal:=jsonb_build_object(
      'tipo','NOTA_CREDITO','serie',v_serie,'correlativo',v_correlativo,'fechaEmision',current_date,
      'motivoCodigo',v_motivo_codigo,'motivoDescripcion',v_motivo_descripcion,
      'documentoReferencia',jsonb_build_object('tipo',upper(v_sale.tipo_comprobante::text),'serie',v_sale.serie,'correlativo',v_sale.correlativo,'numeroCompleto',v_sale.numero_completo),
      'comprobanteOriginal',v_original_fiscal,
      'items',(SELECT jsonb_agg(jsonb_build_object('ventaItemId',di.venta_item_id,'descripcion',vi.nombre_producto,'cantidad',di.cantidad,'valorUnitario',vi.precio_unitario,'subtotalBase',di.importe) ORDER BY di.venta_item_id) FROM public.ra_devolucion_items di JOIN public.ra_venta_items vi ON vi.id=di.venta_item_id WHERE di.devolucion_id=v_d.id),
      'subtotal',v_subtotal,'igv',v_igv,'total',v_total,'moneda',trim(v_sale.moneda),'tipoCambio',v_sale.tipo_cambio
    );
    INSERT INTO public.ra_sunat_nota_credito_outbox(empresa_id,devolucion_id,venta_id,document_key,tipo_referenciado,motivo_codigo,motivo_descripcion,serie,correlativo,request_payload)
    VALUES(v_empresa,v_d.id,v_sale.id,v_d.id::text,v_sale.tipo_comprobante,v_motivo_codigo,v_motivo_descripcion,v_serie,v_correlativo,v_fiscal);
    v_result:=v_result || jsonb_build_object('notaCredito',jsonb_build_object('status','pending','serie',v_serie,'correlativo',v_correlativo,'motivoCodigo',v_motivo_codigo));
  END IF;
  UPDATE public.ra_devoluciones SET estado='liquidada',aprobador_id=v_user,receptor_id=v_user,liquidador_id=v_user,approved_at=now(),received_at=now(),liquidated_at=now(),operation_id=p_operation_id,request_hash=v_hash,result_snapshot=v_result WHERE id=v_d.id;
  INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,usuario_id,motivo,metadata) VALUES(v_empresa,v_d.id,'liquidada',v_user,v_d.motivo,v_result);
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb) TO authenticated;

COMMIT;
