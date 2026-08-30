-- ============================================================
-- 047_tesoreria_idempotente_rpc.sql
-- RPC transaccionales e idempotentes para caja, CxC, CxP y liquidacion.
-- Forward-only; requiere el schema aditivo de 046.
-- ============================================================

BEGIN;

-- Compatibilidad defensiva con instalaciones donde 046 fue aplicado antes de
-- incorporar el snapshot estable de respuesta.
ALTER TABLE public.ra_cuenta_corriente_movimientos
  ADD COLUMN IF NOT EXISTS result_snapshot jsonb;
ALTER TABLE public.ra_cuentas_por_pagar_movimientos
  ADD COLUMN IF NOT EXISTS result_snapshot jsonb;

-- La revision necesita su propia identidad idempotente: operation_id de la
-- liquidacion identifica el cierre y no puede reutilizarse para la revision.
ALTER TABLE public.ra_liquidaciones
  ADD COLUMN IF NOT EXISTS review_operation_id uuid,
  ADD COLUMN IF NOT EXISTS review_request_hash text,
  ADD COLUMN IF NOT EXISTS review_result_snapshot jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS uq_liquidaciones_empresa_review_operation
  ON public.ra_liquidaciones (empresa_id, review_operation_id)
  WHERE review_operation_id IS NOT NULL;

ALTER TABLE public.ra_liquidaciones
  DROP CONSTRAINT IF EXISTS ra_liquidaciones_review_operation_check;
ALTER TABLE public.ra_liquidaciones
  ADD CONSTRAINT ra_liquidaciones_review_operation_check CHECK (
    review_operation_id IS NULL
    OR (
      review_request_hash IS NOT NULL
      AND review_request_hash ~ '^[0-9a-f]{64}$'
      AND review_result_snapshot IS NOT NULL
      AND jsonb_typeof(review_result_snapshot) = 'object'
    )
  );

CREATE OR REPLACE FUNCTION public.ra_abrir_caja_v1(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_monto_inicial numeric,
  p_notas text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_rol public.ra_rol;
  v_hash text;
  v_canonical jsonb;
  v_previa public.ra_cajas%ROWTYPE;
  v_caja_id uuid := gen_random_uuid();
  v_fecha timestamptz := clock_timestamp();
  v_notas text := NULLIF(btrim(p_notas), '');
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_sucursal_id IS NULL
     OR p_monto_inicial IS NULL OR p_monto_inicial < 0
     OR p_monto_inicial <> round(p_monto_inicial, 2)
     OR p_monto_inicial > 99999999.99
     OR length(COALESCE(v_notas, '')) > 500 THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT';
  END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;

  v_canonical := jsonb_build_object(
    'operationId',p_operation_id,'sucursalId',p_sucursal_id,
    'montoInicial',p_monto_inicial,'notas',v_notas);
  v_hash := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':tesoreria:abrir-caja:v1:'||p_operation_id::text,0));

  SELECT * INTO v_previa FROM public.ra_cajas
  WHERE empresa_id=v_empresa AND operation_id=p_operation_id;
  IF FOUND THEN
    IF v_previa.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_build_object(
      'status','confirmed','replayed',true,'operationId',p_operation_id,
      'caja',jsonb_build_object('id',v_previa.id,'sucursalId',v_previa.sucursal_id,
        'estado','abierta','montoInicial',v_previa.monto_inicial,
        'fechaApertura',v_previa.fecha_apertura));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales
    WHERE id=p_sucursal_id AND empresa_id=v_empresa AND activo=true) THEN
    RAISE EXCEPTION USING MESSAGE='RA_BRANCH_NOT_FOUND';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':tesoreria:sucursal-caja:'||p_sucursal_id::text,0));
  IF EXISTS (SELECT 1 FROM public.ra_cajas
    WHERE empresa_id=v_empresa AND sucursal_id=p_sucursal_id AND estado='abierta') THEN
    RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_ALREADY_OPEN';
  END IF;

  INSERT INTO public.ra_cajas(
    id,empresa_id,sucursal_id,usuario_id,estado,monto_inicial,
    fecha_apertura,notas,operation_id,request_hash)
  VALUES(v_caja_id,v_empresa,p_sucursal_id,v_user,'abierta',p_monto_inicial,
    v_fecha,v_notas,p_operation_id,v_hash);

  v_result := jsonb_build_object(
    'status','confirmed','replayed',false,'operationId',p_operation_id,
    'caja',jsonb_build_object('id',v_caja_id,'sucursalId',p_sucursal_id,
      'estado','abierta','montoInicial',p_monto_inicial,'fechaApertura',v_fecha));
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_registrar_cobro_v2(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_venta_id uuid,
  p_monto numeric,
  p_fecha date,
  p_metodo_pago public.ra_metodo_pago,
  p_moneda_cobro char(3),
  p_tipo_cambio_cobro numeric DEFAULT NULL,
  p_referencia text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_rol public.ra_rol;
  v_hash text;
  v_canonical jsonb;
  v_previo public.ra_cuenta_corriente_movimientos%ROWTYPE;
  v_venta public.ra_ventas%ROWTYPE;
  v_caja_id uuid;
  v_cliente_saldo numeric;
  v_saldo_documento numeric;
  v_saldo_documento_nuevo numeric;
  v_saldo_cliente_nuevo numeric;
  v_mov_id uuid := gen_random_uuid();
  v_caja_mov_id uuid;
  v_referencia text := NULLIF(btrim(p_referencia), '');
  v_moneda text := upper(btrim(p_moneda_cobro::text));
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_sucursal_id IS NULL OR p_venta_id IS NULL
     OR p_monto IS NULL OR p_monto <= 0 OR p_monto <> round(p_monto,2)
     OR p_monto > 99999999.99 OR p_fecha IS NULL
     OR p_metodo_pago IS NULL OR p_metodo_pago='credito'
     OR v_moneda NOT IN ('PEN','USD')
     OR (p_tipo_cambio_cobro IS NOT NULL AND p_tipo_cambio_cobro <= 0)
     OR length(COALESCE(v_referencia,'')) > 120 THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT';
  END IF;

  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles
  WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;

  v_canonical := jsonb_build_object(
    'operationId',p_operation_id,'sucursalId',p_sucursal_id,'ventaId',p_venta_id,
    'monto',p_monto,'fecha',p_fecha,'metodoPago',p_metodo_pago,
    'monedaCobro',v_moneda,'tipoCambioCobro',p_tipo_cambio_cobro,
    'referencia',v_referencia);
  v_hash := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':tesoreria:cobro:v2:'||p_operation_id::text,0));

  SELECT * INTO v_previo FROM public.ra_cuenta_corriente_movimientos
  WHERE empresa_id=v_empresa AND tipo='abono' AND operation_id=p_operation_id;
  IF FOUND THEN
    IF v_previo.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_previo.result_snapshot,'{replayed}','true'::jsonb,true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales
    WHERE id=p_sucursal_id AND empresa_id=v_empresa AND activo=true) THEN
    RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND';
  END IF;

  IF p_metodo_pago='efectivo' THEN
    SELECT id INTO v_caja_id FROM public.ra_cajas
    WHERE empresa_id=v_empresa AND sucursal_id=p_sucursal_id AND estado='abierta'
    ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE;
    IF v_caja_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF;
    v_caja_mov_id := gen_random_uuid();
  END IF;

  SELECT * INTO v_venta FROM public.ra_ventas
  WHERE id=p_venta_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND OR v_venta.cliente_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND';
  END IF;
  IF btrim(v_venta.moneda::text) IS DISTINCT FROM v_moneda THEN
    RAISE EXCEPTION USING MESSAGE='RA_CURRENCY_MISMATCH';
  END IF;

  SELECT saldo_deudor INTO v_cliente_saldo FROM public.ra_clientes
  WHERE id=v_venta.cliente_id AND empresa_id=v_empresa AND activo=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;

  SELECT COALESCE(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0)
  INTO v_saldo_documento FROM public.ra_cuenta_corriente_movimientos
  WHERE empresa_id=v_empresa AND venta_id=p_venta_id;
  IF v_saldo_documento <= 0 THEN RAISE EXCEPTION USING MESSAGE='RA_RECEIVABLE_SETTLED'; END IF;
  IF p_monto > v_saldo_documento THEN RAISE EXCEPTION USING MESSAGE='RA_PAYMENT_EXCEEDS_BALANCE'; END IF;
  v_saldo_documento_nuevo := v_saldo_documento-p_monto;

  SELECT COALESCE(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0)-p_monto
  INTO v_saldo_cliente_nuevo FROM public.ra_cuenta_corriente_movimientos
  WHERE empresa_id=v_empresa AND cliente_id=v_venta.cliente_id;

  v_result := jsonb_build_object(
    'status','confirmed','replayed',false,'operationId',p_operation_id,
    'movimientoId',v_mov_id,'movimientoCajaId',v_caja_mov_id,'cajaId',v_caja_id,
    'ventaId',p_venta_id,'saldoVentaNuevo',v_saldo_documento_nuevo,
    'saldoDeudorNuevo',v_saldo_cliente_nuevo);

  INSERT INTO public.ra_cuenta_corriente_movimientos(
    id,empresa_id,cliente_id,venta_id,tipo,monto,fecha,moneda_cobro,
    tipo_cambio_cobro,metodo_pago,referencia,usuario_id,
    operation_id,request_hash,sucursal_id,caja_id,result_snapshot)
  VALUES(v_mov_id,v_empresa,v_venta.cliente_id,p_venta_id,'abono',p_monto,p_fecha,
    v_moneda::char(3),p_tipo_cambio_cobro,p_metodo_pago,v_referencia,v_user,
    p_operation_id,v_hash,p_sucursal_id,v_caja_id,v_result);

  UPDATE public.ra_clientes SET saldo_deudor=v_saldo_cliente_nuevo
  WHERE id=v_venta.cliente_id;

  IF v_caja_id IS NOT NULL THEN
    INSERT INTO public.ra_movimientos_caja(
      id,caja_id,tipo,concepto,monto,metodo_pago,referencia_id,
      usuario_id,operation_id,request_hash,origen,notas)
    VALUES(v_caja_mov_id,v_caja_id,'ingreso','Cobro de cliente',p_monto,'efectivo',
      v_mov_id,v_user,p_operation_id,v_hash,'cobro',v_referencia);
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_registrar_pago_proveedor_v2(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_compra_id uuid,
  p_monto numeric,
  p_fecha date,
  p_metodo_pago public.ra_metodo_pago,
  p_referencia text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_empresa uuid;
  v_rol public.ra_rol;
  v_hash text;
  v_canonical jsonb;
  v_previo public.ra_cuentas_por_pagar_movimientos%ROWTYPE;
  v_compra public.ra_compras%ROWTYPE;
  v_caja_id uuid;
  v_proveedor_saldo numeric;
  v_saldo_documento numeric;
  v_saldo_documento_nuevo numeric;
  v_saldo_proveedor_nuevo numeric;
  v_estado_pago public.ra_estado_pago_compra;
  v_mov_id uuid := gen_random_uuid();
  v_caja_mov_id uuid;
  v_referencia text := NULLIF(btrim(p_referencia), '');
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_sucursal_id IS NULL OR p_compra_id IS NULL
     OR p_monto IS NULL OR p_monto <= 0 OR p_monto <> round(p_monto,2)
     OR p_monto > 99999999.99 OR p_fecha IS NULL
     OR p_metodo_pago IS NULL OR p_metodo_pago='credito'
     OR length(COALESCE(v_referencia,'')) > 120 THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT';
  END IF;

  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles
  WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;

  v_canonical := jsonb_build_object(
    'operationId',p_operation_id,'sucursalId',p_sucursal_id,'compraId',p_compra_id,
    'monto',p_monto,'fecha',p_fecha,'metodoPago',p_metodo_pago,
    'referencia',v_referencia);
  v_hash := encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':tesoreria:pago-proveedor:v2:'||p_operation_id::text,0));

  SELECT * INTO v_previo FROM public.ra_cuentas_por_pagar_movimientos
  WHERE empresa_id=v_empresa AND tipo='abono' AND operation_id=p_operation_id;
  IF FOUND THEN
    IF v_previo.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_previo.result_snapshot,'{replayed}','true'::jsonb,true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales
    WHERE id=p_sucursal_id AND empresa_id=v_empresa AND activo=true) THEN
    RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND';
  END IF;

  IF p_metodo_pago='efectivo' THEN
    SELECT id INTO v_caja_id FROM public.ra_cajas
    WHERE empresa_id=v_empresa AND sucursal_id=p_sucursal_id AND estado='abierta'
    ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE;
    IF v_caja_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF;
    v_caja_mov_id := gen_random_uuid();
  END IF;

  SELECT * INTO v_compra FROM public.ra_compras
  WHERE id=p_compra_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND OR v_compra.proveedor_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND';
  END IF;

  SELECT saldo_deudor INTO v_proveedor_saldo FROM public.ra_proveedores
  WHERE id=v_compra.proveedor_id AND empresa_id=v_empresa AND activo=true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;

  SELECT COALESCE(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0)
  INTO v_saldo_documento FROM public.ra_cuentas_por_pagar_movimientos
  WHERE empresa_id=v_empresa AND compra_id=p_compra_id;
  IF v_saldo_documento <= 0 THEN RAISE EXCEPTION USING MESSAGE='RA_PAYABLE_SETTLED'; END IF;
  IF p_monto > v_saldo_documento THEN RAISE EXCEPTION USING MESSAGE='RA_PAYMENT_EXCEEDS_BALANCE'; END IF;
  v_saldo_documento_nuevo := v_saldo_documento-p_monto;

  SELECT COALESCE(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0)-p_monto
  INTO v_saldo_proveedor_nuevo FROM public.ra_cuentas_por_pagar_movimientos
  WHERE empresa_id=v_empresa AND proveedor_id=v_compra.proveedor_id;
  v_estado_pago := CASE WHEN v_saldo_documento_nuevo<=0 THEN 'pagado'::public.ra_estado_pago_compra
    WHEN v_saldo_documento_nuevo<COALESCE(v_compra.total_pen,v_compra.total)
      THEN 'parcial'::public.ra_estado_pago_compra
    ELSE 'pendiente'::public.ra_estado_pago_compra END;

  v_result := jsonb_build_object(
    'status','confirmed','replayed',false,'operationId',p_operation_id,
    'movimientoId',v_mov_id,'movimientoCajaId',v_caja_mov_id,'cajaId',v_caja_id,
    'compraId',p_compra_id,'saldoCompraNuevo',v_saldo_documento_nuevo,
    'saldoDeudorNuevo',v_saldo_proveedor_nuevo,'estadoPago',v_estado_pago);

  INSERT INTO public.ra_cuentas_por_pagar_movimientos(
    id,empresa_id,proveedor_id,compra_id,tipo,monto,fecha,metodo_pago,
    referencia,usuario_id,operation_id,request_hash,sucursal_id,caja_id,result_snapshot)
  VALUES(v_mov_id,v_empresa,v_compra.proveedor_id,p_compra_id,'abono',p_monto,p_fecha,
    p_metodo_pago,v_referencia,v_user,p_operation_id,v_hash,p_sucursal_id,v_caja_id,v_result);

  UPDATE public.ra_proveedores SET saldo_deudor=v_saldo_proveedor_nuevo
  WHERE id=v_compra.proveedor_id;

  IF v_caja_id IS NOT NULL THEN
    INSERT INTO public.ra_movimientos_caja(
      id,caja_id,tipo,concepto,monto,metodo_pago,referencia_id,
      usuario_id,operation_id,request_hash,origen,notas)
    VALUES(v_caja_mov_id,v_caja_id,'egreso','Pago a proveedor',p_monto,'efectivo',
      v_mov_id,v_user,p_operation_id,v_hash,'pago_proveedor',v_referencia);
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_registrar_movimiento_caja_v1(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_tipo text,
  p_concepto text,
  p_monto numeric,
  p_notas text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid(); v_empresa uuid; v_rol public.ra_rol;
  v_hash text; v_canonical jsonb; v_caja_id uuid; v_mov_id uuid := gen_random_uuid();
  v_previo public.ra_movimientos_caja%ROWTYPE;
  v_tipo text := lower(btrim(p_tipo));
  v_concepto text := btrim(p_concepto);
  v_notas text := NULLIF(btrim(p_notas),'');
  v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_sucursal_id IS NULL OR p_tipo IS NULL
     OR v_tipo NOT IN ('ingreso','egreso')
     OR COALESCE(v_concepto,'')='' OR length(v_concepto)>200
     OR p_monto IS NULL OR p_monto<=0 OR p_monto<>round(p_monto,2)
     OR p_monto>99999999.99 OR length(COALESCE(v_notas,''))>500 THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT';
  END IF;
  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles
  WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;
  v_canonical:=jsonb_build_object('operationId',p_operation_id,'sucursalId',p_sucursal_id,
    'tipo',v_tipo,'concepto',v_concepto,'monto',p_monto,'notas',v_notas);
  v_hash:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':tesoreria:movimiento-caja:v1:'||p_operation_id::text,0));
  SELECT m.* INTO v_previo FROM public.ra_movimientos_caja m
  JOIN public.ra_cajas c ON c.id=m.caja_id
  WHERE c.empresa_id=v_empresa AND m.operation_id=p_operation_id AND m.origen='manual';
  IF FOUND THEN
    IF v_previo.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_build_object('status','confirmed','replayed',true,
      'operationId',p_operation_id,'movimientoId',v_previo.id,'cajaId',v_previo.caja_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales
    WHERE id=p_sucursal_id AND empresa_id=v_empresa AND activo=true) THEN
    RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND';
  END IF;
  SELECT id INTO v_caja_id FROM public.ra_cajas
  WHERE empresa_id=v_empresa AND sucursal_id=p_sucursal_id AND estado='abierta'
  ORDER BY fecha_apertura DESC LIMIT 1 FOR UPDATE;
  IF v_caja_id IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF;
  INSERT INTO public.ra_movimientos_caja(
    id,caja_id,tipo,concepto,monto,metodo_pago,usuario_id,
    operation_id,request_hash,origen,notas)
  VALUES(v_mov_id,v_caja_id,v_tipo::public.ra_tipo_movimiento,v_concepto,p_monto,
    'efectivo',v_user,p_operation_id,v_hash,'manual',v_notas);
  v_result:=jsonb_build_object('status','confirmed','replayed',false,
    'operationId',p_operation_id,'movimientoId',v_mov_id,'cajaId',v_caja_id);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_cerrar_caja_v1(
  p_operation_id uuid,
  p_caja_id uuid,
  p_efectivo_contado numeric,
  p_notas text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid(); v_empresa uuid; v_rol public.ra_rol;
  v_hash text; v_canonical jsonb; v_caja public.ra_cajas%ROWTYPE;
  v_previa public.ra_liquidaciones%ROWTYPE; v_liq_id uuid:=gen_random_uuid();
  v_notas text:=NULLIF(btrim(p_notas),''); v_fecha timestamptz:=clock_timestamp();
  v_efectivo numeric(12,2); v_yape numeric(12,2); v_tarjeta numeric(12,2);
  v_transferencia numeric(12,2); v_credito numeric(12,2); v_result jsonb;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_caja_id IS NULL OR p_efectivo_contado IS NULL
     OR p_efectivo_contado<0 OR p_efectivo_contado<>round(p_efectivo_contado,2)
     OR p_efectivo_contado>99999999.99 OR length(COALESCE(v_notas,''))>1000 THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT';
  END IF;
  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles
  WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;
  v_canonical:=jsonb_build_object('operationId',p_operation_id,'cajaId',p_caja_id,
    'efectivoContado',p_efectivo_contado,'notas',v_notas);
  v_hash:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':tesoreria:cerrar-caja:v1:'||p_operation_id::text,0));
  SELECT * INTO v_previa FROM public.ra_liquidaciones
  WHERE empresa_id=v_empresa AND operation_id=p_operation_id;
  IF FOUND THEN
    IF v_previa.request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_build_object('status','confirmed','replayed',true,'operationId',p_operation_id,
      'liquidacionId',v_previa.id,'cajaId',v_previa.caja_id,
      'efectivoEsperado',v_previa.sistema_efectivo,'efectivoContado',v_previa.conteo_efectivo,
      'diferencia',v_previa.diff_efectivo,'estadoRevision',v_previa.estado_revision,
      'fechaCierre',v_previa.created_at);
  END IF;
  SELECT * INTO v_caja FROM public.ra_cajas
  WHERE id=p_caja_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_caja.estado<>'abierta' THEN RAISE EXCEPTION USING MESSAGE='RA_CASHBOX_NOT_OPEN'; END IF;

  SELECT
    v_caja.monto_inicial+COALESCE(sum(CASE WHEN metodo_pago='efectivo' THEN CASE WHEN tipo='ingreso' THEN monto ELSE -monto END ELSE 0 END),0),
    COALESCE(sum(CASE WHEN metodo_pago='yape' THEN CASE WHEN tipo='ingreso' THEN monto ELSE -monto END ELSE 0 END),0),
    COALESCE(sum(CASE WHEN metodo_pago='tarjeta' THEN CASE WHEN tipo='ingreso' THEN monto ELSE -monto END ELSE 0 END),0),
    COALESCE(sum(CASE WHEN metodo_pago='transferencia' THEN CASE WHEN tipo='ingreso' THEN monto ELSE -monto END ELSE 0 END),0)
  INTO v_efectivo,v_yape,v_tarjeta,v_transferencia
  FROM public.ra_movimientos_caja WHERE caja_id=p_caja_id;
  SELECT COALESCE(sum(p.monto),0) INTO v_credito
  FROM public.ra_venta_pagos p JOIN public.ra_ventas v ON v.id=p.venta_id
  WHERE v.caja_id=p_caja_id AND p.metodo_pago='credito';

  INSERT INTO public.ra_liquidaciones(
    id,caja_id,empresa_id,usuario_id,sistema_efectivo,sistema_yape,sistema_tarjeta,
    sistema_transferencia,sistema_credito,conteo_efectivo,conteo_yape,conteo_tarjeta,
    conteo_transferencia,conteo_credito,notas,created_at,operation_id,request_hash,
    estado_revision)
  VALUES(v_liq_id,p_caja_id,v_empresa,v_user,v_efectivo,v_yape,v_tarjeta,
    v_transferencia,v_credito,p_efectivo_contado,v_yape,v_tarjeta,v_transferencia,
    v_credito,v_notas,v_fecha,p_operation_id,v_hash,'pendiente_revision');

  UPDATE public.ra_cajas SET estado='cerrada',monto_final=p_efectivo_contado,
    fecha_cierre=v_fecha WHERE id=p_caja_id;
  v_result:=jsonb_build_object('status','confirmed','replayed',false,'operationId',p_operation_id,
    'liquidacionId',v_liq_id,'cajaId',p_caja_id,'efectivoEsperado',v_efectivo,
    'efectivoContado',p_efectivo_contado,'diferencia',p_efectivo_contado-v_efectivo,
    'yape',v_yape,'tarjeta',v_tarjeta,'transferencia',v_transferencia,
    'credito',v_credito,'estadoRevision','pendiente_revision','fechaCierre',v_fecha);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_revisar_liquidacion_v1(
  p_operation_id uuid,
  p_liquidacion_id uuid,
  p_decision text,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_user uuid:=auth.uid(); v_empresa uuid; v_rol public.ra_rol;
  v_hash text; v_canonical jsonb; v_liq public.ra_liquidaciones%ROWTYPE;
  v_decision text:=lower(btrim(p_decision)); v_motivo text:=btrim(p_motivo);
  v_result jsonb; v_fecha timestamptz:=clock_timestamp();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_UNAUTHENTICATED'; END IF;
  IF p_operation_id IS NULL OR p_liquidacion_id IS NULL OR p_decision IS NULL
     OR v_decision NOT IN ('validada','observada') OR COALESCE(v_motivo,'')=''
     OR length(v_motivo)>1000 THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT'; END IF;
  SELECT empresa_id,rol INTO v_empresa,v_rol FROM public.ra_perfiles
  WHERE id=v_user AND activo=true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE='RA_FORBIDDEN';
  END IF;
  v_canonical:=jsonb_build_object('operationId',p_operation_id,
    'liquidacionId',p_liquidacion_id,'decision',v_decision,'motivo',v_motivo);
  v_hash:=encode(extensions.digest(convert_to(v_canonical::text,'UTF8'),'sha256'),'hex');
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text||':tesoreria:revisar-liquidacion:v1:'||p_operation_id::text,0));
  SELECT * INTO v_liq FROM public.ra_liquidaciones
  WHERE empresa_id=v_empresa AND review_operation_id=p_operation_id;
  IF FOUND THEN
    IF v_liq.review_request_hash IS DISTINCT FROM v_hash THEN
      RAISE EXCEPTION USING MESSAGE='RA_IDEMPOTENCY_CONFLICT';
    END IF;
    RETURN jsonb_set(v_liq.review_result_snapshot,'{replayed}','true'::jsonb,true);
  END IF;
  SELECT * INTO v_liq FROM public.ra_liquidaciones
  WHERE id=p_liquidacion_id AND empresa_id=v_empresa FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE='RA_NOT_FOUND'; END IF;
  IF v_liq.estado_revision<>'pendiente_revision' THEN
    RAISE EXCEPTION USING MESSAGE='RA_LIQUIDATION_REVIEW_INVALID';
  END IF;
  v_result:=jsonb_build_object('status','confirmed','replayed',false,
    'operationId',p_operation_id,'liquidacionId',p_liquidacion_id,
    'decision',v_decision,'motivo',v_motivo,'revisadoPor',v_user,'revisadoAt',v_fecha);
  PERFORM set_config('app.ra_liquidacion_revision','v1',true);
  UPDATE public.ra_liquidaciones SET estado_revision=v_decision,revisado_por=v_user,
    revisado_at=v_fecha,motivo_revision=v_motivo,review_operation_id=p_operation_id,
    review_request_hash=v_hash,review_result_snapshot=v_result
  WHERE id=p_liquidacion_id;
  RETURN v_result;
END;
$$;

-- ACL deny-by-default. Las tablas conservan SELECT/RLS, pero no escritura cliente.
REVOKE INSERT,UPDATE,DELETE ON public.ra_cajas FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.ra_movimientos_caja FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.ra_liquidaciones FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.ra_cuenta_corriente_movimientos FROM PUBLIC,anon,authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.ra_cuentas_por_pagar_movimientos FROM PUBLIC,anon,authenticated;

REVOKE ALL ON FUNCTION public.ra_abrir_caja_v1(uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_registrar_cobro_v2(uuid,uuid,uuid,numeric,date,public.ra_metodo_pago,character,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_registrar_pago_proveedor_v2(uuid,uuid,uuid,numeric,date,public.ra_metodo_pago,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_registrar_movimiento_caja_v1(uuid,uuid,text,text,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_cerrar_caja_v1(uuid,uuid,numeric,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_revisar_liquidacion_v1(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.ra_abrir_caja_v1(uuid,uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_registrar_cobro_v2(uuid,uuid,uuid,numeric,date,public.ra_metodo_pago,character,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_registrar_pago_proveedor_v2(uuid,uuid,uuid,numeric,date,public.ra_metodo_pago,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_registrar_movimiento_caja_v1(uuid,uuid,text,text,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_cerrar_caja_v1(uuid,uuid,numeric,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ra_revisar_liquidacion_v1(uuid,uuid,text,text) TO authenticated;

COMMIT;
