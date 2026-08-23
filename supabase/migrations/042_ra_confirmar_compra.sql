-- ============================================================
-- 042_ra_confirmar_compra.sql  (rev.3)
-- Change: compra-cuenta-por-pagar-atomica (Fase 2)
--
-- Moneda base v1: PEN.
--   - ra_compras conserva importes en moneda original (subtotal/
--     igv/total) y agrega total_pen (base) forward-only.
--   - CxP (cargo/abono), saldo_deudor del proveedor y costeo de
--     producto operan SIEMPRE en PEN base:
--       PEN => importe original; USD => ROUND(importe * tc, 2).
--   - estado_pago compara movimientos base contra total base.
--   - La RPC NUNCA escribe estado_pago (triggers de 041).
--
-- Sin hooks de fault injection desplegables: las suites inyectan
-- fallos con triggers TRANSITORIOS dentro de BEGIN/ROLLBACK.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Columna base PEN (forward-only, historico compatible)
-- ------------------------------------------------------------
ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS total_pen numeric(12, 2);

COMMENT ON COLUMN public.ra_compras.total_pen IS
  'Total en moneda base PEN (12,2 para tolerar historico amplio). PEN=total; USD=ROUND(total*tipo_cambio,2). Fuente de cargo CxP, saldo_deudor y proyeccion de estado_pago. La RPC rechaza con RA_AMOUNT_OVERFLOW cualquier total base que no quepa en CxP/saldo_deudor numeric(10,2).';

UPDATE public.ra_compras
   SET total_pen = CASE
         WHEN moneda = 'USD' AND tipo_cambio IS NOT NULL
           THEN ROUND(total * tipo_cambio, 2)
         ELSE total END;

-- ------------------------------------------------------------
-- 2. Helper interno de error de dominio (sin contrato publico)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_error_compra(p_codigo text, p_detalle text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION '%: %', p_codigo, COALESCE(p_detalle, 'error de compra');
END;
$$;

REVOKE ALL ON FUNCTION public.ra_error_compra(text, text) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Evolucion de proteccion estado_pago a moneda base PEN
--    (mismas firmas de 041; ahora usan COALESCE(total_pen, total))
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_sync_estado_pago_compras(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.ra_compras c
     SET estado_pago = public.ra_estado_pago_proyectado(
           c.id, COALESCE(c.total_pen, c.total))
   WHERE c.id = ANY(p_ids)
     AND c.estado = 'confirmada';
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_guard_estado_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_esperado public.ra_estado_pago_compra;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.estado_pago IS NOT DISTINCT FROM OLD.estado_pago THEN
    RETURN NEW;
  END IF;

  IF NEW.estado <> 'confirmada' THEN
    RETURN NEW;
  END IF;

  v_esperado := public.ra_estado_pago_proyectado(
    NEW.id, COALESCE(NEW.total_pen, NEW.total));

  IF NEW.estado_pago IS DISTINCT FROM v_esperado THEN
    RAISE EXCEPTION 'RA_ESTADO_PAGO_INCONSISTENTE: estado_pago (%) no coincide con el ledger (proyeccion %)',
                    NEW.estado_pago, v_esperado;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 4. RPC principal (rev.3)
--    Orden: auth -> estructura -> idempotencia/replay -> estado
--    mutable (proveedor/OC/factura) -> efectos. El replay ocurre
--    ANTES de validar proveedor activo/OC/productos.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_confirmar_compra(
  p_operation_id    uuid,
  p_sucursal_id     uuid,
  p_proveedor_id    uuid,
  p_nro_documento   text,
  p_notas           text,
  p_items           jsonb,
  p_orden_compra_id uuid DEFAULT NULL,
  p_moneda          CHAR(3) DEFAULT 'PEN',
  p_tipo_cambio     NUMERIC DEFAULT NULL,
  p_tipo_documento  TEXT DEFAULT 'FACTURA',
  p_abono_inicial   JSONB DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid;
  v_empresa    uuid;
  v_rol        text;
  v_doc        text;
  v_tipo_doc   text;
  v_notas      text;
  v_moneda     text;
  v_tc         numeric;
  v_items_ok   jsonb;
  v_item       jsonb;
  v_cat        uuid;
  v_cant       numeric;
  v_prec       numeric;
  v_prec_pen   numeric;
  v_nombre     text;
  v_subtotal   numeric := 0;
  v_igv        numeric;
  v_total      numeric;
  v_hash_input text;
  v_hash       text;
  v_previo     record;
  v_compra_id  uuid;
  v_oc         public.ra_ordenes_compra%ROWTYPE;
  v_prod_id    uuid;
  v_stock_ant  numeric;
  v_precio_ant numeric;
  v_precio_new numeric;
  v_ab_metodo  ra_metodo_pago;
  v_ab_monto   numeric;
  v_ab_ref     text;
  v_estado     public.ra_estado_pago_compra;
  -- numeric SIN precision durante el calculo: el limite se compara
  -- con v_limite ANTES de persistir en total_pen numeric(12,2).
  -- Asi RA_AMOUNT_OVERFLOW siempre precede a cualquier
  -- numeric_value_out_of_range crudo.
  v_total_base numeric;
  v_saldo_prov numeric;
  v_limite     numeric := 99999999.99; -- techo numeric(10,2) de CxP y saldo_deudor
  i            int;
  n            int;
BEGIN
  -- ===== 1. Autorizacion desde auth.uid() =====
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.ra_error_compra('RA_UNAUTHENTICATED', 'sesion requerida');
  END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM ra_perfiles WHERE id = v_uid AND activo;
  IF NOT FOUND THEN
    PERFORM public.ra_error_compra('RA_UNAUTHENTICATED', 'perfil inexistente o inactivo');
  END IF;

  IF v_rol NOT IN ('administrador', 'superadmin') THEN
    PERFORM public.ra_error_compra('RA_FORBIDDEN', 'rol sin permiso de compras');
  END IF;

  -- Sucursal: solo presencia antes del replay (el replay debe ser
  -- estable aunque la sucursal se desactive despues de confirmar).
  -- La validez (activa + empresa) se valida en el paso 6.
  IF p_sucursal_id IS NULL THEN
    PERFORM public.ra_error_compra('RA_BRANCH_INVALID', 'sucursal requerida');
  END IF;

  -- ===== 2. Estructura =====
  IF p_operation_id IS NULL THEN
    PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'operation_id requerido');
  END IF;

  v_doc := NULLIF(upper(btrim(COALESCE(p_nro_documento, ''))), '');
  IF char_length(v_doc) > 60 THEN
    PERFORM public.ra_error_compra('RA_INVOICE_INVALID', 'nro_documento excede 60 caracteres');
  END IF;

  v_tipo_doc := upper(btrim(COALESCE(p_tipo_documento, 'FACTURA')));
  IF v_tipo_doc NOT IN ('FACTURA', 'BOLETA', 'OTROS') THEN
    PERFORM public.ra_error_compra('RA_INVOICE_INVALID', 'tipo_documento fuera de dominio');
  END IF;

  v_notas := NULLIF(btrim(COALESCE(p_notas, '')), '');
  IF char_length(v_notas) > 500 THEN
    PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'notas excede 500 caracteres');
  END IF;

  v_moneda := upper(btrim(COALESCE(p_moneda, 'PEN')));
  IF v_moneda NOT IN ('PEN', 'USD') THEN
    PERFORM public.ra_error_compra('RA_CURRENCY_INVALID', 'moneda no soportada');
  END IF;

  v_tc := p_tipo_cambio;
  IF v_tc IS NOT NULL AND v_tc <> ROUND(v_tc, 4) THEN
    PERFORM public.ra_error_compra('RA_CURRENCY_INVALID', 'tipo_cambio excede escala 4');
  END IF;
  IF v_moneda = 'USD' AND COALESCE(v_tc, 0) <= 0 THEN
    PERFORM public.ra_error_compra('RA_CURRENCY_INVALID', 'USD requiere tipo de cambio mayor a 0');
  END IF;
  IF v_moneda = 'PEN' THEN
    v_tc := NULL; -- PEN no usa conversion; hash determinista
  END IF;

  IF jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) < 1
     OR jsonb_array_length(p_items) > 200 THEN
    PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'items fuera de limite (1..200)');
  END IF;

  -- ===== 3. Validacion de items: dominio, escalas, duplicados, overflow =====
  -- El subtotal y el total base se calculan AQUI, antes de insertar
  -- cabecera o afectar stock: ningun overflow llega a SQL crudo.
  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
                       'catalogo_id', j->>'catalogo_id',
                       'cantidad',    j->>'cantidad',
                       'precio',      j->>'precio_unitario'
                     ) ORDER BY j->>'catalogo_id')
      INTO v_items_ok
    FROM jsonb_array_elements(p_items) j;

    n := jsonb_array_length(v_items_ok);
    FOR i IN 0 .. n - 1 LOOP
      v_item := v_items_ok -> i;
      v_cat  := (v_item->>'catalogo_id')::uuid;
      v_cant := (v_item->>'cantidad')::numeric;
      v_prec := (v_item->>'precio')::numeric;

      IF v_cant IS NULL OR v_prec IS NULL OR v_cant <= 0 OR v_prec < 0 THEN
        PERFORM public.ra_error_compra('RA_ITEMS_INVALID',
          format('linea %s: cantidad/precio invalidos', i));
      END IF;
      IF v_cant <> ROUND(v_cant, 3) THEN
        PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'cantidad excede escala 3');
      END IF;
      IF v_cant > 99999.999 THEN
        PERFORM public.ra_error_compra('RA_AMOUNT_OVERFLOW', 'cantidad fuera de rango');
      END IF;
      IF v_prec <> ROUND(v_prec, 2) THEN
        PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'precio excede escala 2');
      END IF;
      IF v_prec > v_limite THEN
        PERFORM public.ra_error_compra('RA_AMOUNT_OVERFLOW', 'precio fuera de rango');
      END IF;

      -- Precio convertido a PEN dentro de rango (antes de tocar stock)
      v_prec_pen := CASE WHEN v_moneda = 'USD' THEN ROUND(v_prec * v_tc, 2) ELSE v_prec END;
      IF v_prec_pen > v_limite THEN
        PERFORM public.ra_error_compra('RA_AMOUNT_OVERFLOW',
          format('precio convertido a PEN (%s) fuera de rango', v_prec_pen));
      END IF;

      v_subtotal := v_subtotal + ROUND(v_cant * v_prec, 2);
      -- Lineas repetidas del mismo catalogo: rechazadas en v1 (costeo ambiguo)
      IF i > 0 AND (v_items_ok -> (i - 1) ->> 'catalogo_id') = (v_item->>'catalogo_id') THEN
        PERFORM public.ra_error_compra('RA_ITEMS_INVALID',
          format('catalogo duplicado %s: consolidar lineas', v_cat));
      END IF;
    END LOOP;
  EXCEPTION
    WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'payload numerico/uuid invalido');
  END;

  -- Totales originales y base PEN, validados ANTES de cualquier efecto
  v_igv := ROUND(v_subtotal * 0.18, 2);
  v_total := v_subtotal + v_igv;
  v_total_base := CASE WHEN v_moneda = 'USD'
                       THEN ROUND(v_total * v_tc, 2) ELSE v_total END;

  IF v_total_base > v_limite THEN
    PERFORM public.ra_error_compra('RA_AMOUNT_OVERFLOW',
      format('total base %s excede numeric(10,2) de CxP/saldo', v_total_base));
  END IF;

  -- ===== 4. Abono inicial opcional (monto SIEMPRE en PEN base) =====
  IF p_abono_inicial IS NOT NULL THEN
    IF jsonb_typeof(p_abono_inicial) <> 'object' THEN
      PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'abono inicial debe ser objeto');
    END IF;

    BEGIN
      v_ab_metodo := (p_abono_inicial->>'metodoPago')::ra_metodo_pago;
    EXCEPTION WHEN invalid_text_representation THEN
      PERFORM public.ra_error_compra('RA_PAYMENT_METHOD_INVALID',
        COALESCE(p_abono_inicial->>'metodoPago', '(nulo)'));
    END;
    IF v_ab_metodo = 'credito' THEN
      PERFORM public.ra_error_compra('RA_PAYMENT_METHOD_INVALID', 'credito no permitido en abono');
    END IF;

    BEGIN
      v_ab_monto := (p_abono_inicial->>'monto')::numeric;
    EXCEPTION WHEN OTHERS THEN
      PERFORM public.ra_error_compra('RA_PAYMENT_AMOUNT_INVALID', 'monto no numerico');
    END;
    IF v_ab_monto IS NULL OR v_ab_monto <= 0 THEN
      PERFORM public.ra_error_compra('RA_PAYMENT_AMOUNT_INVALID', 'monto debe ser mayor a 0');
    END IF;
    IF v_ab_monto <> ROUND(v_ab_monto, 2) THEN
      PERFORM public.ra_error_compra('RA_PAYMENT_AMOUNT_INVALID', 'monto excede escala 2');
    END IF;
    IF v_ab_monto > 99999999.99 THEN
      PERFORM public.ra_error_compra('RA_AMOUNT_OVERFLOW', 'monto de abono fuera de rango');
    END IF;

    v_ab_ref := COALESCE(p_abono_inicial->>'referencia', '');
    IF char_length(v_ab_ref) > 120 THEN
      PERFORM public.ra_error_compra('RA_PAYMENT_REFERENCE_TOO_LONG', 'referencia excede 120');
    END IF;
  END IF;

  -- ===== 5. Idempotencia ANTES de estados mutables =====
  -- (replay devuelve la compra original aunque el proveedor se haya
  --  desactivado o la OC haya cambiado despues del intento original)
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_empresa::text || ':' || p_operation_id::text, 0));

  v_hash_input := jsonb_build_object(
    'empresa',  v_empresa,
    'sucursal', p_sucursal_id,
    'proveedor', p_proveedor_id,
    'doc',      COALESCE(v_doc, ''),
    'tipo_doc', v_tipo_doc,
    'oc',       COALESCE(p_orden_compra_id::text, ''),
    'moneda',   v_moneda,
    'tc',       CASE WHEN v_tc IS NULL THEN '' ELSE trim_scale(v_tc)::text END,
    'notas',    COALESCE(v_notas, ''),
    'items',    (
      SELECT jsonb_agg(jsonb_build_object(
               'c', j->>'catalogo_id',
               'q', trim_scale((j->>'cantidad')::numeric)::text,
               'p', trim_scale((j->>'precio')::numeric)::text
             ) ORDER BY j->>'catalogo_id')
      FROM jsonb_array_elements(v_items_ok) j),
    'abono',    CASE WHEN p_abono_inicial IS NULL THEN jsonb_build_object()
                     ELSE jsonb_build_object(
                       'm', v_ab_metodo::text,
                       'm2', trim_scale(v_ab_monto)::text,
                       'r', v_ab_ref)
                END
  )::text;

  v_hash := encode(sha256(convert_to(v_hash_input, 'UTF8')), 'hex');

  SELECT * INTO v_previo FROM ra_compras
   WHERE empresa_id = v_empresa AND operation_id = p_operation_id;

  IF FOUND THEN
    IF v_previo.request_hash = v_hash THEN
      RETURN jsonb_build_object(
        'status', 'confirmed',
        'replayed', true,
        'compra', jsonb_build_object(
          'id', v_previo.id,
          'total', v_previo.total,
          'total_pen', COALESCE(v_previo.total_pen, v_previo.total),
          'estado_pago', v_previo.estado_pago::text));
    END IF;
    PERFORM public.ra_error_compra('RA_IDEMPOTENCY_CONFLICT',
      'mismo operation_id con payload distinto');
  END IF;

  -- ===== 6. Estados mutables (post-replay) =====
  -- Sucursal: ahora si, activa y de la empresa autenticada
  IF NOT EXISTS (SELECT 1 FROM ra_sucursales
                  WHERE id = p_sucursal_id AND empresa_id = v_empresa AND activo) THEN
    PERFORM public.ra_error_compra('RA_BRANCH_INVALID', 'sucursal inexistente, ajena o inactiva');
  END IF;

  -- FOR UPDATE TEMPRANO del proveedor: ademas de validar activo/empresa,
  -- elimina el deadlock clasico (INSERT cabecera toma FOR KEY SHARE por
  -- la FK; un FOR UPDATE tardio del mismo row crearia un ciclo entre
  -- transacciones con cabeceras ya insertadas) y serializa el saldo.
  SELECT saldo_deudor INTO v_saldo_prov
  FROM ra_proveedores
   WHERE id = p_proveedor_id AND empresa_id = v_empresa AND activo
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM public.ra_error_compra('RA_PROVIDER_INVALID', 'proveedor inexistente, ajeno o inactivo');
  END IF;

  IF v_doc IS NOT NULL AND EXISTS (
    SELECT 1 FROM ra_compras
     WHERE empresa_id = v_empresa
       AND proveedor_id = p_proveedor_id
       AND tipo_documento = v_tipo_doc
       AND nro_doc_norm = v_doc
  ) THEN
    PERFORM public.ra_error_compra('RA_INVOICE_DUPLICATE',
      format('%s ya registrado para este proveedor', v_doc));
  END IF;

  IF p_orden_compra_id IS NOT NULL THEN
    -- Filtro por empresa EN el SELECT: no bloquear ordenes ajenas
    SELECT * INTO v_oc FROM ra_ordenes_compra
     WHERE id = p_orden_compra_id AND empresa_id = v_empresa
     FOR UPDATE;
    IF NOT FOUND THEN
      PERFORM public.ra_error_compra('RA_ORDER_INVALID', 'orden inexistente o ajena');
    ELSIF v_oc.estado <> 'confirmada' THEN
      PERFORM public.ra_error_compra('RA_ORDER_INVALID', format('estado %s no admite recepcion', v_oc.estado));
    ELSIF v_oc.proveedor_id IS DISTINCT FROM p_proveedor_id THEN
      PERFORM public.ra_error_compra('RA_ORDER_INVALID', 'proveedor distinto al de la orden');
    END IF;
  END IF;

  -- ===== 7. Cabecera (unique_violation de factura -> RA_INVOICE_DUPLICATE) =====
  BEGIN
    INSERT INTO ra_compras (
      empresa_id, sucursal_id, proveedor_id, usuario_id, nro_documento,
      notas, subtotal, igv, total, estado_pago,
      orden_compra_id, moneda, tipo_cambio, estado,
      operation_id, request_hash, tipo_documento
    )
    VALUES (
      v_empresa, p_sucursal_id, p_proveedor_id, v_uid, COALESCE(v_doc, p_nro_documento),
      v_notas, 0, 0, 0, 'pendiente',
      p_orden_compra_id, v_moneda::char(3), v_tc, 'confirmada',
      p_operation_id, v_hash, v_tipo_doc
    )
    RETURNING id INTO v_compra_id;
  EXCEPTION
    WHEN unique_violation THEN
      PERFORM public.ra_error_compra('RA_INVOICE_DUPLICATE',
        'factura registrada concurrentemente para este proveedor');
  END;

  -- ===== 8. Items + conciliacion OC =====
  FOR i IN 0 .. n - 1 LOOP
    v_item := v_items_ok -> i;
    v_cat  := (v_item->>'catalogo_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_prec := ROUND((v_item->>'precio')::numeric, 2);

    -- Nombre autoritativo desde el catalogo; existencia validada AQUI
    -- (post-replay, pre-insert) para no romper estabilidad de replay.
    SELECT c.nombre INTO v_nombre FROM ra_catalogo_repuestos c WHERE c.id = v_cat;
    IF v_nombre IS NULL THEN
      PERFORM public.ra_error_compra('RA_PRODUCT_INVALID',
        format('catalogo %s inexistente', v_cat));
    END IF;

    INSERT INTO ra_compra_items (compra_id, catalogo_id, nombre_producto,
                                 cantidad, precio_unitario, subtotal)
    VALUES (v_compra_id, v_cat, v_nombre, v_cant, v_prec, ROUND(v_cant * v_prec, 2));

    IF p_orden_compra_id IS NOT NULL THEN
      DECLARE
        v_pend numeric;
      BEGIN
        SELECT (o.cantidad - o.cantidad_recibida) INTO v_pend
        FROM ra_orden_compra_items o
         WHERE o.orden_compra_id = p_orden_compra_id AND o.catalogo_id = v_cat
         FOR UPDATE OF o;

        IF v_pend IS NULL THEN
          PERFORM public.ra_error_compra('RA_ORDER_INVALID',
            format('articulo %s no pertenece a la orden', v_cat));
        END IF;
        IF v_cant > v_pend THEN
          PERFORM public.ra_error_compra('RA_ORDER_INVALID',
            format('recibe %s pero pendiente %s', v_cant, v_pend));
        END IF;

        UPDATE ra_orden_compra_items
           SET cantidad_recibida = cantidad_recibida + v_cant
         WHERE orden_compra_id = p_orden_compra_id AND catalogo_id = v_cat;
      END;
    END IF;
  END LOOP;

  -- ===== 9. Stock + costeo + kardex en PEN base, orden ascendente =====
  FOR i IN 0 .. n - 1 LOOP
    v_item := v_items_ok -> i;
    v_cat  := (v_item->>'catalogo_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_prec := ROUND((v_item->>'precio')::numeric, 2);
    v_prec_pen := CASE WHEN v_moneda = 'USD' THEN ROUND(v_prec * v_tc, 2) ELSE v_prec END;

    SELECT id, stock_actual, precio_compra INTO v_prod_id, v_stock_ant, v_precio_ant
    FROM ra_productos
     WHERE empresa_id = v_empresa AND sucursal_id = p_sucursal_id AND catalogo_id = v_cat
     FOR UPDATE;

    IF v_prod_id IS NULL THEN
      PERFORM public.ra_error_compra('RA_PRODUCT_INVALID', format('producto %s inexistente en esta sucursal', v_cat));
    END IF;

    v_precio_new := ROUND(
      (v_stock_ant * COALESCE(v_precio_ant, 0) + v_cant * v_prec_pen)
        / NULLIF(v_stock_ant + v_cant, 0), 2);
    IF v_precio_new IS NULL THEN
      v_precio_new := v_prec_pen;
    END IF;

    UPDATE ra_productos
       SET stock_actual = stock_actual + v_cant,
           precio_compra = v_precio_new
     WHERE id = v_prod_id;

    INSERT INTO ra_kardex (empresa_id, sucursal_id, catalogo_id, tipo, motivo,
                           cantidad, stock_anterior, stock_nuevo,
                           referencia_id, usuario_id)
    VALUES (v_empresa, p_sucursal_id, v_cat, 'entrada', 'compra',
            v_cant, v_stock_ant, v_stock_ant + v_cant,
            v_compra_id, v_uid);
  END LOOP;

  -- ===== 10. Totales (ya validados en paso 3; solo persistencia) =====
  UPDATE ra_compras
     SET subtotal = v_subtotal, igv = v_igv, total = v_total,
         total_pen = v_total_base
   WHERE id = v_compra_id;

  -- ===== 11. Cargo CxP + saldo proveedor SIEMPRE en PEN base =====
  -- El proveedor ya esta BLOQUEADO desde el paso 6 (orden canonico de
  -- locks); el overflow del saldo se validaba alli con ese mismo valor.
  IF COALESCE(v_saldo_prov, 0) + v_total_base > v_limite THEN
    PERFORM public.ra_error_compra('RA_AMOUNT_OVERFLOW',
      format('saldo_deudor resultante (%s) excede numeric(10,2)',
             COALESCE(v_saldo_prov, 0) + v_total_base));
  END IF;

  INSERT INTO ra_cuentas_por_pagar_movimientos (
    empresa_id, proveedor_id, compra_id, tipo, monto, fecha, usuario_id)
  VALUES (v_empresa, p_proveedor_id, v_compra_id, 'cargo', v_total_base, CURRENT_DATE, v_uid);

  UPDATE ra_proveedores
     SET saldo_deudor = saldo_deudor + v_total_base
   WHERE id = p_proveedor_id;

  -- ===== 12. Abono inicial opcional (monto en PEN base) =====
  IF p_abono_inicial IS NOT NULL THEN
    IF v_ab_monto > v_total_base THEN
      PERFORM public.ra_error_compra('RA_PAYMENT_EXCEEDS_TOTAL',
        format('abono %s supera total base %s', v_ab_monto, v_total_base));
    END IF;

    INSERT INTO ra_cuentas_por_pagar_movimientos (
      empresa_id, proveedor_id, compra_id, tipo, monto, fecha,
      metodo_pago, referencia, usuario_id)
    VALUES (v_empresa, p_proveedor_id, v_compra_id, 'abono', v_ab_monto,
            CURRENT_DATE, v_ab_metodo, v_ab_ref, v_uid);

    UPDATE ra_proveedores
       SET saldo_deudor = saldo_deudor - v_ab_monto
     WHERE id = p_proveedor_id;
  END IF;

  -- ===== 13. Cierre OC =====
  IF p_orden_compra_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM ra_orden_compra_items
                    WHERE orden_compra_id = p_orden_compra_id
                      AND cantidad_recibida < cantidad) THEN
      UPDATE ra_ordenes_compra SET estado = 'recibida' WHERE id = p_orden_compra_id;
    END IF;
  END IF;

  SELECT estado_pago INTO v_estado FROM ra_compras WHERE id = v_compra_id;

  RETURN jsonb_build_object(
    'status', 'confirmed',
    'replayed', false,
    'compra', jsonb_build_object(
      'id', v_compra_id,
      'total', v_total,
      'total_pen', v_total_base,
      'estado_pago', v_estado::text));
END;
$$;

-- ------------------------------------------------------------
-- Consulta de resultado (recuperacion tras timeout), sin fuga cross-tenant
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_obtener_resultado_compra(
  p_operation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid;
  v_empresa uuid;
  v_rol     text;
  v_previo  record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.ra_error_compra('RA_UNAUTHENTICATED', 'sesion requerida');
  END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM ra_perfiles WHERE id = v_uid AND activo;
  IF NOT FOUND THEN
    PERFORM public.ra_error_compra('RA_UNAUTHENTICATED', 'perfil inexistente o inactivo');
  END IF;
  IF v_rol NOT IN ('administrador', 'superadmin') THEN
    PERFORM public.ra_error_compra('RA_FORBIDDEN', 'rol sin permiso de compras');
  END IF;

  SELECT id, total, total_pen, estado_pago INTO v_previo
  FROM ra_compras
   WHERE empresa_id = v_empresa AND operation_id = p_operation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'status', 'confirmed',
    'replayed', true,
    'compra', jsonb_build_object(
      'id', v_previo.id,
      'total', v_previo.total,
      'total_pen', COALESCE(v_previo.total_pen, v_previo.total),
      'estado_pago', v_previo.estado_pago::text));
END;
$$;

-- ------------------------------------------------------------
-- Privilegios: solo authenticated; helpers sin contrato publico
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ra_confirmar_compra(uuid, uuid, uuid, text, text, jsonb, uuid, CHAR, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ra_confirmar_compra(uuid, uuid, uuid, text, text, jsonb, uuid, CHAR, NUMERIC, TEXT, JSONB) TO authenticated;

REVOKE ALL ON FUNCTION public.ra_obtener_resultado_compra(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ra_obtener_resultado_compra(uuid) TO authenticated;

COMMIT;

-- ============================================================
-- Verificacion post-aplicacion:
--   psql -f supabase/tests/compra-atomica-rpc.test.sql
--   psql -f supabase/tests/compra-atomica-concurrencia.test.sql
-- Registro en ledger SOLO si ambas suites pasan:
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('042','ra_confirmar_compra');
-- ============================================================
