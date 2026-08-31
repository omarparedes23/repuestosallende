-- ============================================================
-- 051_numeracion_series_guias.sql
-- Change: numeracion-series-guias
--
-- Forward-only. NO modifica migraciones históricas ni datos.
-- NO inserta configuración real de series (pendiente de confirmación
-- de valores por el propietario).
--
-- Agrega:
--   - tabla public.ra_series_documento (config genérica; datos solo
--     'guia_remision' en esta entrega)
--   - RPC public.ra_obtener_preview_serie_guia(uuid) -> jsonb
--   - reescritura de public.ra_crear_guia: firma (origen, destino,
--     notas, items); asigna serie/correlativo bajo FOR UPDATE dentro
--     de la misma transacción. DROP + CREATE (cambia # de args).
--
-- Mantiene TODAS las validaciones y protecciones de 050.
-- NO reutiliza ra_siguiente_correlativo (MAX+1, de ventas).
--
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/numeracion-series-guias/sql/051_numeracion_series_guias.sql
--
-- Registrar en ledger SOLO si la suite + el runner de concurrencia pasan:
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('051','numeracion_series_guias');
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

-- ===== 1. Tabla ra_series_documento ==========================
CREATE TABLE IF NOT EXISTS public.ra_series_documento (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid        NOT NULL REFERENCES public.ra_empresas(id) ON DELETE CASCADE,
  sucursal_id           uuid        NOT NULL REFERENCES public.ra_sucursales(id),
  tipo_documento        text        NOT NULL,
  serie                 text        NOT NULL,
  siguiente_correlativo integer     NOT NULL CHECK (siguiente_correlativo > 0),
  activo                boolean     NOT NULL DEFAULT true,
  es_predeterminada     boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- Alcance de esta entrega: solo guías. Ampliar = ALTER forward-only.
  CONSTRAINT ra_series_tipo_documento_check CHECK (tipo_documento IN ('guia_remision')),
  CONSTRAINT ra_series_serie_norm_check CHECK (
    serie = btrim(serie) AND serie <> '' AND char_length(serie) <= 20
  )
);

COMMENT ON TABLE public.ra_series_documento IS
  '051: configuración de series/correlativos por empresa+sucursal emisora+tipo_documento. siguiente_correlativo es el próximo número a emitir (no MAX+1). Datos solo guia_remision en esta entrega.';

-- (empresa, sucursal, tipo, serie) única
CREATE UNIQUE INDEX IF NOT EXISTS ra_series_suc_serie_unica
  ON public.ra_series_documento (empresa_id, sucursal_id, tipo_documento, serie);

-- (empresa, tipo, serie) única -> una serie pertenece a UNA sola sucursal emisora
-- (evita colisión con la identidad de guía, ya única por empresa/serie/correlativo)
CREATE UNIQUE INDEX IF NOT EXISTS ra_series_empresa_serie_unica
  ON public.ra_series_documento (empresa_id, tipo_documento, serie);

-- una sola serie activa predeterminada por (empresa, sucursal, tipo)
CREATE UNIQUE INDEX IF NOT EXISTS ra_series_una_predeterminada
  ON public.ra_series_documento (empresa_id, sucursal_id, tipo_documento)
  WHERE activo AND es_predeterminada;

CREATE INDEX IF NOT EXISTS idx_series_lookup
  ON public.ra_series_documento (empresa_id, sucursal_id, tipo_documento)
  WHERE activo;

DROP TRIGGER IF EXISTS ra_series_documento_updated_at ON public.ra_series_documento;
CREATE TRIGGER ra_series_documento_updated_at
  BEFORE UPDATE ON public.ra_series_documento
  FOR EACH ROW EXECUTE FUNCTION public.ra_set_updated_at();

ALTER TABLE public.ra_series_documento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ra_series_documento_select ON public.ra_series_documento;
CREATE POLICY ra_series_documento_select ON public.ra_series_documento
  FOR SELECT TO authenticated
  USING (empresa_id = public.ra_empresa_id());
-- Sin política de escritura: config vía RPC SECURITY DEFINER / administración controlada.

-- ===== 2. RPC preview (no reserva, no incrementa) ============
CREATE OR REPLACE FUNCTION public.ra_obtener_preview_serie_guia(p_sucursal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_empresa uuid;
  v_serie   text;
  v_sig     integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;

  SELECT empresa_id INTO v_empresa
  FROM public.ra_perfiles WHERE id = v_user AND activo = true;
  IF v_empresa IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN'; END IF;

  IF p_sucursal_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.ra_sucursales
                     WHERE id = p_sucursal_id AND empresa_id = v_empresa AND activo) THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_INVALID_BRANCH';
  END IF;

  SELECT serie, siguiente_correlativo INTO v_serie, v_sig
  FROM public.ra_series_documento
  WHERE empresa_id = v_empresa
    AND sucursal_id = p_sucursal_id
    AND tipo_documento = 'guia_remision'
    AND activo AND es_predeterminada;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_SERIES_NOT_CONFIGURED';
  END IF;

  RETURN jsonb_build_object(
    'serie', v_serie,
    'siguiente_correlativo', v_sig,
    'numero_preview', v_serie || '-' || lpad(v_sig::text, 8, '0'));
END;
$$;

REVOKE ALL ON FUNCTION public.ra_obtener_preview_serie_guia(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_obtener_preview_serie_guia(uuid) TO authenticated;
COMMENT ON FUNCTION public.ra_obtener_preview_serie_guia(uuid) IS
  '051: preview de la serie predeterminada de guía de una sucursal. No reserva ni incrementa.';

-- ===== 3. ra_crear_guia (reescritura: firma sin serie/correlativo) ==
DROP FUNCTION IF EXISTS public.ra_crear_guia(uuid, uuid, text, integer, text, jsonb);

CREATE FUNCTION public.ra_crear_guia(
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

  -- Sucursales (idéntico a 050)
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

  -- Items (idéntico a 050)
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

  -- ===== Numeración: serie predeterminada de ORIGEN, bajo FOR UPDATE =====
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
    -- Colisión con una guía preexistente del mismo serie/número
    RAISE EXCEPTION USING MESSAGE = 'RA_GUIDE_DUPLICATE_NUMBER';
  END;

  -- Consumir el correlativo (rollback revierte el incremento)
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
  '051: creación atómica de guía. No acepta serie/correlativo del cliente: resuelve la serie predeterminada de origen, la bloquea FOR UPDATE, asigna el correlativo e incrementa siguiente_correlativo en la misma transacción. Mantiene todas las validaciones de 050.';

COMMIT;

-- ============================================================
-- Verificación:
--   psql ... -v ON_ERROR_STOP=1 -f openspec/changes/numeracion-series-guias/sql/tests/051_numeracion_series.test.sql
--   $env:DATABASE_URL=<TEST>; pwsh openspec/changes/numeracion-series-guias/sql/tests/guia-numeracion-concurrencia-runner.ps1 -Cleanup
-- Registrar ledger ('051','numeracion_series_guias') SOLO si ambos pasan.
-- ============================================================
