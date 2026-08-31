-- ============================================================
-- 052_alta_automatica_producto_destino_guia.sql
-- Change: alta-automatica-producto-destino-guia
--
-- Forward-only. NO modifica migraciones históricas ni datos.
-- Recrea public.ra_recibir_guia(uuid) (misma firma -> CREATE OR REPLACE):
-- al recibir, si el catálogo existe en origen pero NO tiene fila
-- ra_productos en la sucursal destino, se crea automáticamente
-- (INSERT ... ON CONFLICT (empresa_id,sucursal_id,catalogo_id) DO NOTHING,
--  copiando codigo_interno, precios, costo, stock_minimo y moneda de la
--  fila origen; stock_actual=0; activo=true) y luego se re-bloquea.
--
-- NO crea ni duplica ra_catalogo_repuestos.
-- NO sobrescribe atributos locales de una fila destino ya existente.
-- Mantiene TODA la validación, autorización, locks, kardex y atomicidad
-- de 050/051.
--
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/alta-automatica-producto-destino-guia/sql/052_alta_automatica_producto_destino_guia.sql
--
-- Registrar en ledger SOLO si la suite + el runner de concurrencia pasan:
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('052','alta_automatica_producto_destino_guia');
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION public.ra_recibir_guia(p_guia_id uuid)
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

  -- ---- Paso 1: bloquear origen, asegurar destino, validar (ORDER BY catalogo_id) ----
  FOR r IN
    SELECT catalogo_id, cantidad
    FROM public.ra_guia_items
    WHERE guia_id = p_guia_id
    ORDER BY catalogo_id
  LOOP
    -- Origen: debe existir; se bloquea.
    SELECT id, stock_actual INTO v_po_id, v_so
    FROM public.ra_productos
    WHERE empresa_id = v_empresa
      AND sucursal_id = v_guia.sucursal_origen_id
      AND catalogo_id = r.catalogo_id
    FOR UPDATE;
    IF v_po_id IS NULL THEN
      RAISE EXCEPTION USING MESSAGE = 'RA_PRODUCT_NOT_FOUND_AT_ORIGIN';
    END IF;

    -- Destino: alta automática si falta. Copia condiciones locales de origen;
    -- stock 0; activo true. Seguro ante concurrencia por el índice único
    -- (empresa_id, sucursal_id, catalogo_id): DO NOTHING si otra transacción
    -- ya la creó. NO toca ra_catalogo_repuestos.
    INSERT INTO public.ra_productos (
      empresa_id, sucursal_id, catalogo_id,
      codigo_interno, precio_venta, precio_venta_dolar, precio_compra,
      stock_minimo, moneda, stock_actual, activo
    )
    SELECT
      v_empresa, v_guia.sucursal_destino_id, o.catalogo_id,
      o.codigo_interno, o.precio_venta, o.precio_venta_dolar, o.precio_compra,
      o.stock_minimo, o.moneda, 0, true
    FROM public.ra_productos o
    WHERE o.id = v_po_id
    ON CONFLICT (empresa_id, sucursal_id, catalogo_id) DO NOTHING;

    -- Re-seleccionar/bloquear destino en el orden canónico. Tras el upsert
    -- SIEMPRE debe existir; el guard cubre un caso imposible sin dejar efecto parcial.
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

  -- ---- Paso 2: aplicar (locks del Paso 1 retenidos) ----
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
  '052: recepcion atomica de guia. Alta automatica de la fila ra_productos en destino si falta (copia condiciones de origen, stock 0, activo true, ON CONFLICT DO NOTHING); no toca ra_catalogo_repuestos; no sobrescribe una fila destino existente. Mantiene validaciones/locks/kardex de 050/051.';

COMMIT;

-- ============================================================
-- Verificación:
--   psql ... -v ON_ERROR_STOP=1 -f openspec/changes/alta-automatica-producto-destino-guia/sql/tests/052_alta_automatica_destino.test.sql
--   $env:DATABASE_URL=<TEST>; pwsh openspec/changes/alta-automatica-producto-destino-guia/sql/tests/guia-alta-destino-concurrencia-runner.ps1 -Cleanup
-- Registrar ledger ('052','alta_automatica_producto_destino_guia') SOLO si ambos pasan.
-- ============================================================
