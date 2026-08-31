-- ============================================================
-- guia-numeracion-concurrencia.test.sql
-- Script POR SESIÓN; el runner lo ejecuta dos veces en paralelo (SES=A|B).
-- Variables psql: -v SES -v RUN_ID -v ADMIN_EMAIL
-- (no se usan :'X' dentro del DO; van por set_config / current_setting).
--
-- Ambas sesiones crean una guía desde la MISMA sucursal origen, cuya serie
-- predeterminada tiene siguiente_correlativo = 6. Deben salir 6 y 7,
-- distintos y consecutivos; siguiente_correlativo termina en 8.
-- Emite:  RESULT:crea:<SES>:<OK:<serie>:<correlativo>|ERR:<code>>
-- ============================================================
\set ON_ERROR_STOP on

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', (
    SELECT p.id FROM ra_perfiles p JOIN auth.users u ON u.id = p.id
    WHERE lower(u.email) = lower(:'ADMIN_EMAIL') AND p.activo
      AND p.rol IN ('administrador','superadmin') LIMIT 1
  ))::text, false);
SELECT set_config('app.guia_ses',    :'SES',    false);
SELECT set_config('app.guia_run_id', :'RUN_ID', false);

DO $$
DECLARE
  v_ses     text := current_setting('app.guia_ses', true);
  v_run     text := current_setting('app.guia_run_id', true);
  v_empresa uuid;
  v_o       uuid;
  v_d       uuid;
  v_cat     uuid;
  v_res     jsonb;
BEGIN
  IF v_run IS NULL OR v_ses IS NULL THEN RAISE EXCEPTION 'faltan settings de sesión'; END IF;
  v_o := md5('guianum-o-' || v_run)::uuid;
  v_d := md5('guianum-d-' || v_run)::uuid;

  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id = auth.uid();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'sin sesión admin'; END IF;

  SELECT catalogo_id INTO v_cat FROM ra_productos
   WHERE empresa_id = v_empresa AND sucursal_id = v_o LIMIT 1;
  IF v_cat IS NULL THEN RAISE EXCEPTION 'fixture ausente'; END IF;

  BEGIN
    v_res := public.ra_crear_guia(
      v_o, v_d, 'GUIANUM:' || v_run || ':' || v_ses,
      jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
    RAISE NOTICE 'RESULT:crea:%:OK:%:%',
      v_ses, (v_res->'guia'->>'serie'), (v_res->'guia'->>'correlativo');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RESULT:crea:%:ERR:%', v_ses, SQLERRM;
  END;
END $$;
