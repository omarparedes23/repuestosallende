-- ============================================================
-- 053_crear_guia_destino_ausente.sql
-- Change: alta-automatica-producto-destino-guia (parte 2 — creación)
--
-- Forward-only. NO modifica migraciones históricas ni datos.
-- Recrea public.ra_crear_guia(uuid, uuid, text, jsonb) (misma firma ->
-- CREATE OR REPLACE): elimina ÚNICAMENTE la validación que exigía una
-- fila ra_productos en la sucursal DESTINO al crear la guía.
--
-- Se conserva TODO lo demás de 050/051: auth, empresa, roles,
-- SECURITY DEFINER, search_path, series, correlativos (asignación
-- atómica bajo FOR UPDATE), validación de cantidades, artículos
-- duplicados, sucursales, guía vacía, RA_PRODUCT_NOT_FOUND_AT_ORIGIN,
-- RA_GUIDE_DUPLICATE_NUMBER, formato de número.
--
-- NO crea ra_productos en destino durante la creación. El alta
-- automática en destino la hace ra_recibir_guia (052) al recibir.
--
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/alta-automatica-producto-destino-guia/sql/053_crear_guia_destino_ausente.sql
--
-- Registrar en ledger SOLO si la suite + el runner de concurrencia pasan:
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('053','crear_guia_destino_ausente');
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION public.ra_crear_guia(
  p_sucursal_origen_id  uuid,
  p_sucursal_destino_id uuid,
  p_notas               text,
  p_items               jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user     uuid := auth.uid();
  v_empresa  uuid;
  v_rol      public.ra_rol;
  v_notas    text;
  v_items    jsonb;
  v_count    int;
  v_guia_id  uuid;
  v_serie_id uuid;
  v_serie    text;
  v_corr     integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL OR v_rol NOT IN ('administrador','superadmin') THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;

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

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_items) j
    GROUP BY (j->>'catalogo_id') HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_DUPLICATE_ITEM';
  END IF;

  -- Existencia SOLO en la sucursal ORIGEN.
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

  -- (053) Eliminada la validación de existencia en la sucursal DESTINO.
  --       ra_recibir_guia (052) crea la fila destino automáticamente al recibir.

  SELECT id, serie, siguiente_correlativo
    INTO v_serie_id, v_serie, v_corr
  FROM public.ra_series_documento
  WHERE empresa_id = v_empresa
    AND sucursal_id = p_sucursal_origen_id
    AND tipo_documento = 'guia_remision'
    AND activo AND es_predeterminada
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_SERIES_NOT_CONFIGURED';
  END IF;

  v_notas := NULLIF(btrim(coalesce(p_notas, '')), '');

  BEGIN
    INSERT INTO public.ra_guias_remision (
      empresa_id, sucursal_origen_id, sucursal_destino_id, usuario_id,
      estado, serie, correlativo, notas
    ) VALUES (
      v_empresa, p_sucursal_origen_id, p_sucursal_destino_id, v_user,
      'borrador', v_serie, v_corr, v_notas
    )
    RETURNING id INTO v_guia_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_DUPLICATE_NUMBER';
  END;

  UPDATE public.ra_series_documento
     SET siguiente_correlativo = siguiente_correlativo + 1
   WHERE id = v_serie_id;

  INSERT INTO public.ra_guia_items (guia_id, catalogo_id, nombre_producto, cantidad)
  SELECT v_guia_id,
         (j->>'catalogo_id')::uuid,
         c.nombre,
         (j->>'cantidad')::numeric
  FROM jsonb_array_elements(v_items) j
  JOIN public.ra_catalogo_repuestos c ON c.id = (j->>'catalogo_id')::uuid;

  RETURN jsonb_build_object(
    'status', 'created',
    'guia', jsonb_build_object(
      'id', v_guia_id,
      'estado', 'borrador',
      'items', v_count,
      'serie', v_serie,
      'correlativo', v_corr,
      'numero', v_serie || '-' || lpad(v_corr::text, 8, '0')));
END;
$$;

REVOKE ALL ON FUNCTION public.ra_crear_guia(uuid, uuid, text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_crear_guia(uuid, uuid, text, jsonb) TO authenticated;
COMMENT ON FUNCTION public.ra_crear_guia(uuid, uuid, text, jsonb) IS
  '053: creacion atomica de guia. Valida el catalogo SOLO contra ra_productos de la sucursal origen; ya NO exige la fila en destino (ra_recibir_guia 052 la crea al recibir). Numeracion, series, correlativos y demas protecciones de 050/051 sin cambios.';

COMMIT;

-- ============================================================
-- Verificación:
--   psql ... -v ON_ERROR_STOP=1 -f openspec/changes/alta-automatica-producto-destino-guia/sql/tests/053_crear_guia_destino_ausente.test.sql
--   $env:DATABASE_URL=<TEST>; pwsh openspec/changes/alta-automatica-producto-destino-guia/sql/tests/guia-crear-sin-destino-concurrencia-runner.ps1 -Cleanup
--   (+ regresión: guia-numeracion-concurrencia-runner.ps1  y  guia-alta-destino-concurrencia-runner.ps1)
-- Registrar ledger ('053','crear_guia_destino_ausente') SOLO si todo pasa.
-- ============================================================
