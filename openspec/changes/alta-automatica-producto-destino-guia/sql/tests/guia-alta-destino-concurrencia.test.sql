-- ============================================================
-- guia-alta-destino-concurrencia.test.sql
-- Script POR SESIÓN; el runner lo ejecuta dos veces en paralelo (SES=A|B).
-- Variables psql: -v SES -v RUN_ID -v ADMIN_EMAIL
-- (no se usan :'X' dentro del DO; van por set_config / current_setting).
--
-- Cada sesión recibe SU guía. Ambas guías transfieren el MISMO catálogo
-- desde el mismo origen hacia el mismo destino, que NO tiene fila
-- ra_productos para ese catálogo. Deben:
--   - habilitar una sola fila destino (índice único),
--   - sumar el stock de ambas sin perder ni duplicar.
-- Emite:  RESULT:recibe:<SES>:<OK:<status>|ERR:<code>>
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
  v_gid     uuid;
  v_res     jsonb;
BEGIN
  IF v_run IS NULL OR v_ses IS NULL THEN RAISE EXCEPTION 'faltan settings de sesión'; END IF;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id = auth.uid();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'sin sesión admin'; END IF;

  SELECT id INTO v_gid FROM ra_guias_remision
   WHERE empresa_id = v_empresa AND notas = 'ALTADEST:' || v_run || ':' || v_ses;
  IF v_gid IS NULL THEN RAISE EXCEPTION 'fixture ausente para SES %', v_ses; END IF;

  BEGIN
    v_res := public.ra_recibir_guia(v_gid);
    RAISE NOTICE 'RESULT:recibe:%:OK:%', v_ses, (v_res->>'status');
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'RESULT:recibe:%:ERR:%', v_ses, SQLERRM;
  END;
END $$;
