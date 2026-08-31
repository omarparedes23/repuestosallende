-- ============================================================
-- 050_guia_traslado_inventario_segura.sql
-- Change: guia-traslado-inventario-segura
--
-- Forward-only. NO modifica migraciones históricas (009, 045) ni datos.
-- Agrega:
--   - valor de enum ra_motivo_kardex 'traslado'
--   - CHECKs + índice único de numeración en ra_guias_remision
--   - public.ra_crear_guia(...)
--   - public.ra_avanzar_estado_guia(uuid, ra_estado_guia)
--   - reescritura de public.ra_recibir_guia(uuid) (void -> jsonb)
--
-- EJECUCIÓN: NO envolver el archivo entero en una única transacción
-- (`psql -1` / `--single-transaction` NO). El ALTER TYPE ADD VALUE se
-- deja fuera de la transacción por convención de la casa.
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/guia-traslado-inventario-segura/sql/050_guia_traslado_inventario_segura.sql
--
-- Registrar en el ledger SOLO si la suite + el runner de concurrencia pasan:
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('050','guia_traslado_inventario_segura');
-- ============================================================

\set ON_ERROR_STOP on

-- ------------------------------------------------------------
-- PARTE A — enum (autocommit; fuera de transacción explícita)
-- ------------------------------------------------------------
ALTER TYPE public.ra_motivo_kardex ADD VALUE IF NOT EXISTS 'traslado';

-- ------------------------------------------------------------
-- PARTE B — esquema + funciones (transacción única)
-- ------------------------------------------------------------
BEGIN;

-- ===== 0. Numeración de guía: completa, positiva y única ======
ALTER TABLE public.ra_guias_remision
  DROP CONSTRAINT IF EXISTS ra_guias_numeracion_completa,
  ADD  CONSTRAINT ra_guias_numeracion_completa
       CHECK ((serie IS NULL) = (correlativo IS NULL));

ALTER TABLE public.ra_guias_remision
  DROP CONSTRAINT IF EXISTS ra_guias_correlativo_positivo,
  ADD  CONSTRAINT ra_guias_correlativo_positivo
       CHECK (correlativo IS NULL OR correlativo > 0);

CREATE UNIQUE INDEX IF NOT EXISTS ra_guias_numeracion_unica
  ON public.ra_guias_remision (empresa_id, serie, correlativo)
  WHERE serie IS NOT NULL AND correlativo IS NOT NULL;

-- ===== 1. ra_crear_guia ======================================
CREATE OR REPLACE FUNCTION public.ra_crear_guia(
  p_sucursal_origen_id  uuid,
  p_sucursal_destino_id uuid,
  p_serie               text,
  p_correlativo         integer,
  p_notas               text,
  p_items               jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_empresa uuid;
  v_rol     public.ra_rol;
  v_serie   text;
  v_notas   text;
  v_items   jsonb;
  v_count   int;
  v_guia_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;

  -- Sucursales
  IF p_sucursal_origen_id IS NULL OR p_sucursal_destino_id IS NULL THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_INVALID_BRANCH';
  END IF;
  IF p_sucursal_origen_id = p_sucursal_destino_id THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_SAME_BRANCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales
                  WHERE id = p_sucursal_origen_id AND empresa_id = v_empresa AND activo) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_INVALID_BRANCH';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ra_sucursales
                  WHERE id = p_sucursal_destino_id AND empresa_id = v_empresa AND activo) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_INVALID_BRANCH';
  END IF;

  -- Numeración: ambos informados o ambos NULL; correlativo positivo
  v_serie := NULLIF(btrim(coalesce(p_serie, '')), '');
  IF (v_serie IS NULL) <> (p_correlativo IS NULL) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_NUMBER_INCOMPLETE';
  END IF;
  IF p_correlativo IS NOT NULL AND p_correlativo <= 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_NUMBER_INCOMPLETE';
  END IF;
  IF v_serie IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.ra_guias_remision
     WHERE empresa_id = v_empresa AND serie = v_serie AND correlativo = p_correlativo
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_DUPLICATE_NUMBER';
  END IF;

  -- Items
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_EMPTY';
  END IF;

  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
             'catalogo_id', (j->>'catalogo_id')::uuid,
             'cantidad',    (j->>'cantidad')::numeric
           ) ORDER BY (j->>'catalogo_id')::uuid)
      INTO v_items
    FROM jsonb_array_elements(p_items) j;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_ITEM_INVALID';
  END;

  -- catalogo_id nulo/ausente, cantidad no positiva / escala / rango
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) j
     WHERE NULLIF(j->>'catalogo_id','') IS NULL
        OR (j->>'cantidad') IS NULL
        OR (j->>'cantidad')::numeric <= 0
        OR (j->>'cantidad')::numeric <> round((j->>'cantidad')::numeric, 3)
        OR (j->>'cantidad')::numeric > 99999.999
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_ITEM_INVALID';
  END IF;

  v_count := jsonb_array_length(v_items);

  -- catálogo duplicado
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) j
    GROUP BY (j->>'catalogo_id')
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_DUPLICATE_ITEM';
  END IF;

  -- Existencia en ORIGEN
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) j
    LEFT JOIN public.ra_productos p
      ON p.empresa_id  = v_empresa
     AND p.sucursal_id = p_sucursal_origen_id
     AND p.catalogo_id = (j->>'catalogo_id')::uuid
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_PRODUCT_NOT_FOUND_AT_ORIGIN';
  END IF;

  -- Existencia en DESTINO (no se auto-crea la fila)
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) j
    LEFT JOIN public.ra_productos p
      ON p.empresa_id  = v_empresa
     AND p.sucursal_id = p_sucursal_destino_id
     AND p.catalogo_id = (j->>'catalogo_id')::uuid
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_PRODUCT_NOT_FOUND_AT_DESTINATION';
  END IF;

  v_notas := NULLIF(btrim(coalesce(p_notas, '')), '');

  BEGIN
    INSERT INTO public.ra_guias_remision (
      empresa_id, sucursal_origen_id, sucursal_destino_id, usuario_id,
      estado, serie, correlativo, notas
    ) VALUES (
      v_empresa, p_sucursal_origen_id, p_sucursal_destino_id, v_user,
      'borrador', v_serie, p_correlativo, v_notas
    )
    RETURNING id INTO v_guia_id;
  EXCEPTION WHEN unique_violation THEN
    -- carrera: otra creación tomó la misma numeración entre el chequeo y el INSERT
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_DUPLICATE_NUMBER';
  END;

  INSERT INTO public.ra_guia_items (guia_id, catalogo_id, nombre_producto, cantidad)
  SELECT v_guia_id,
         (j->>'catalogo_id')::uuid,
         c.nombre,
         (j->>'cantidad')::numeric
  FROM jsonb_array_elements(v_items) j
  JOIN public.ra_catalogo_repuestos c ON c.id = (j->>'catalogo_id')::uuid;

  RETURN jsonb_build_object(
    'status', 'created',
    'guia', jsonb_build_object('id', v_guia_id, 'estado', 'borrador', 'items', v_count));
END;
$$;

REVOKE ALL ON FUNCTION public.ra_crear_guia(uuid, uuid, text, integer, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_crear_guia(uuid, uuid, text, integer, text, jsonb) TO authenticated;
COMMENT ON FUNCTION public.ra_crear_guia(uuid, uuid, text, integer, text, jsonb) IS
  '050: creación atómica de guía + ítems. Multitenant, admin/superadmin. Valida numeración, existencia en origen y destino; nombre autoritativo desde catálogo.';

-- ===== 2. ra_avanzar_estado_guia ============================
CREATE OR REPLACE FUNCTION public.ra_avanzar_estado_guia(
  p_guia_id      uuid,
  p_nuevo_estado public.ra_estado_guia
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_empresa uuid;
  v_rol     public.ra_rol;
  v_guia    public.ra_guias_remision%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;

  IF p_nuevo_estado NOT IN ('emitida','en_transito') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_INVALID_STATE';
  END IF;

  SELECT * INTO v_guia
  FROM public.ra_guias_remision
  WHERE id = p_guia_id AND empresa_id = v_empresa
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_NOT_FOUND'; END IF;

  IF NOT (
       (v_guia.estado = 'borrador' AND p_nuevo_estado = 'emitida')
    OR (v_guia.estado = 'emitida'  AND p_nuevo_estado = 'en_transito')
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_INVALID_STATE';
  END IF;

  IF p_nuevo_estado = 'emitida'
     AND NOT EXISTS (SELECT 1 FROM public.ra_guia_items WHERE guia_id = p_guia_id) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_EMPTY';
  END IF;

  UPDATE public.ra_guias_remision
     SET estado = p_nuevo_estado,
         fecha_emision = CASE
           WHEN p_nuevo_estado = 'emitida' AND fecha_emision IS NULL THEN CURRENT_DATE
           ELSE fecha_emision END
   WHERE id = p_guia_id AND empresa_id = v_empresa;

  RETURN jsonb_build_object(
    'status', 'ok',
    'guia', jsonb_build_object('id', p_guia_id, 'estado', p_nuevo_estado));
END;
$$;

REVOKE ALL ON FUNCTION public.ra_avanzar_estado_guia(uuid, public.ra_estado_guia) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_avanzar_estado_guia(uuid, public.ra_estado_guia) TO authenticated;
COMMENT ON FUNCTION public.ra_avanzar_estado_guia(uuid, public.ra_estado_guia) IS
  '050: transición borrador->emitida->en_transito. No mueve stock.';

-- ===== 3. ra_recibir_guia (reescritura: void -> jsonb) ======
DROP FUNCTION IF EXISTS public.ra_recibir_guia(uuid);

CREATE FUNCTION public.ra_recibir_guia(p_guia_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_empresa  uuid;
  v_rol      public.ra_rol;
  v_guia     public.ra_guias_remision%ROWTYPE;
  v_n_items  int;
  r          record;
  v_po_id    uuid;  v_so numeric;   -- producto/stock origen
  v_pd_id    uuid;  v_sd numeric;   -- producto/stock destino
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
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

  SELECT count(*) INTO v_n_items FROM public.ra_guia_items WHERE guia_id = p_guia_id;
  IF v_n_items = 0 THEN RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_EMPTY'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.ra_guia_items WHERE guia_id = p_guia_id
    GROUP BY catalogo_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_DUPLICATE_ITEM';
  END IF;

  -- ---- Paso 1: bloquear y validar TODO (orden canónico: catalogo_id asc) ----
  FOR r IN
    SELECT catalogo_id, cantidad
    FROM public.ra_guia_items
    WHERE guia_id = p_guia_id
    ORDER BY catalogo_id
  LOOP
    SELECT id, stock_actual INTO v_po_id, v_so
    FROM public.ra_productos
    WHERE empresa_id = v_empresa
      AND sucursal_id = v_guia.sucursal_origen_id
      AND catalogo_id = r.catalogo_id
    FOR UPDATE;
    IF v_po_id IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'RA_PRODUCT_NOT_FOUND_AT_ORIGIN';
    END IF;

    SELECT id, stock_actual INTO v_pd_id, v_sd
    FROM public.ra_productos
    WHERE empresa_id = v_empresa
      AND sucursal_id = v_guia.sucursal_destino_id
      AND catalogo_id = r.catalogo_id
    FOR UPDATE;
    IF v_pd_id IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'RA_PRODUCT_NOT_FOUND_AT_DESTINATION';
    END IF;

    IF v_so < r.cantidad THEN
      RAISE EXCEPTION USING MESSAGE = 'RA_STOCK_INSUFFICIENT';
    END IF;
  END LOOP;

  -- ---- Paso 2: aplicar (locks del paso 1 retenidos) ----
  FOR r IN
    SELECT catalogo_id, cantidad
    FROM public.ra_guia_items
    WHERE guia_id = p_guia_id
    ORDER BY catalogo_id
  LOOP
    SELECT id, stock_actual INTO v_po_id, v_so
    FROM public.ra_productos
    WHERE empresa_id = v_empresa
      AND sucursal_id = v_guia.sucursal_origen_id
      AND catalogo_id = r.catalogo_id;

    UPDATE public.ra_productos SET stock_actual = stock_actual - r.cantidad WHERE id = v_po_id;

    INSERT INTO public.ra_kardex (
      empresa_id, sucursal_id, catalogo_id, tipo, motivo, cantidad,
      stock_anterior, stock_nuevo, referencia_id, usuario_id
    ) VALUES (
      v_empresa, v_guia.sucursal_origen_id, r.catalogo_id,
      'salida', 'traslado', r.cantidad,
      v_so, v_so - r.cantidad, p_guia_id, v_user
    );

    SELECT id, stock_actual INTO v_pd_id, v_sd
    FROM public.ra_productos
    WHERE empresa_id = v_empresa
      AND sucursal_id = v_guia.sucursal_destino_id
      AND catalogo_id = r.catalogo_id;

    UPDATE public.ra_productos SET stock_actual = stock_actual + r.cantidad WHERE id = v_pd_id;

    INSERT INTO public.ra_kardex (
      empresa_id, sucursal_id, catalogo_id, tipo, motivo, cantidad,
      stock_anterior, stock_nuevo, referencia_id, usuario_id
    ) VALUES (
      v_empresa, v_guia.sucursal_destino_id, r.catalogo_id,
      'entrada', 'traslado', r.cantidad,
      v_sd, v_sd + r.cantidad, p_guia_id, v_user
    );
  END LOOP;

  UPDATE public.ra_guias_remision
     SET estado = 'recibida', fecha_recepcion = now()
   WHERE id = p_guia_id AND empresa_id = v_empresa;

  RETURN jsonb_build_object(
    'status', 'received',
    'guia', jsonb_build_object('id', p_guia_id, 'estado', 'recibida', 'items', v_n_items));
END;
$$;

REVOKE ALL ON FUNCTION public.ra_recibir_guia(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_recibir_guia(uuid) TO authenticated;
COMMENT ON FUNCTION public.ra_recibir_guia(uuid) IS
  '050: recepción atómica de guía. Valida origen+destino+stock antes de mutar; salida+entrada+kardex(traslado)+estado en una transacción.';

COMMIT;

-- ============================================================
-- Verificación:
--   psql ... -v ON_ERROR_STOP=1 -f openspec/changes/guia-traslado-inventario-segura/sql/tests/050_guia_traslado.test.sql
--   $env:DATABASE_URL=<TEST>; pwsh openspec/changes/guia-traslado-inventario-segura/sql/tests/guia-concurrencia-runner.ps1
-- Registrar en ledger SOLO si ambos pasan (ver cabecera).
-- ============================================================
