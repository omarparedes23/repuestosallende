-- ============================================================
-- 054_contar_stock_bajo_por_sucursal.sql
-- Change: articulos-filtro-sucursal (parte Supabase)
--
-- Forward-only. NO modifica migraciones históricas ni datos.
-- Reemplaza public.ra_contar_stock_bajo(uuid) por
--   public.ra_contar_stock_bajo(p_empresa_id uuid, p_sucursal_id uuid DEFAULT NULL)
-- para que el badge "stock bajo" pueda filtrar por la sucursal activa
-- de la vista de Artículos (que Codex ya scoperó en el frontend).
--
-- - Empresa validada desde auth.uid() (multitenant), igual que antes.
-- - Filtro: (p_sucursal_id IS NULL OR sucursal_id = p_sucursal_id).
--   NULL => toda la empresa (retrocompatible con la llamada actual
--   rpc('ra_contar_stock_bajo', { p_empresa_id })).
-- - Grants: solo authenticated (se revoca también service_role, que la
--   versión vieja tenía por default privileges).
--
--   psql "...user=postgres.axcrubvtpqcyscizgoee..." -v ON_ERROR_STOP=1 \
--     -f openspec/changes/articulos-filtro-sucursal/sql/054_contar_stock_bajo_por_sucursal.sql
--
-- Registrar en ledger SOLO si la suite pasa:
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('054','contar_stock_bajo_por_sucursal');
-- ============================================================

\set ON_ERROR_STOP on

BEGIN;

DROP FUNCTION IF EXISTS public.ra_contar_stock_bajo(uuid);

CREATE FUNCTION public.ra_contar_stock_bajo(
  p_empresa_id  uuid,
  p_sucursal_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING MESSAGE = 'RA_UNAUTHENTICATED'; END IF;

  SELECT empresa_id INTO v_empresa
  FROM public.ra_perfiles
  WHERE id = auth.uid() AND activo = true;

  IF v_empresa IS NULL OR p_empresa_id IS DISTINCT FROM v_empresa THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_FORBIDDEN';
  END IF;

  RETURN (
    SELECT count(*) FROM public.ra_productos
     WHERE empresa_id = v_empresa
       AND (p_sucursal_id IS NULL OR sucursal_id = p_sucursal_id)
       AND stock_actual < stock_minimo
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ra_contar_stock_bajo(uuid, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.ra_contar_stock_bajo(uuid, uuid) TO authenticated;
COMMENT ON FUNCTION public.ra_contar_stock_bajo(uuid, uuid) IS
  '054: cuenta productos con stock_actual < stock_minimo. p_sucursal_id NULL = toda la empresa; con valor = solo esa sucursal. Empresa validada desde auth.uid().';

COMMIT;

-- ============================================================
-- Verificación:
--   psql ... -v ON_ERROR_STOP=1 -f openspec/changes/articulos-filtro-sucursal/sql/tests/054_contar_stock_bajo.test.sql
-- Registrar ledger ('054','contar_stock_bajo_por_sucursal') SOLO si pasa.
-- ============================================================
