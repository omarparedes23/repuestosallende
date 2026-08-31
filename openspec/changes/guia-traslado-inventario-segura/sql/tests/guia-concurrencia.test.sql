-- ============================================================
-- guia-concurrencia.test.sql
-- Script POR SESIÓN; el runner lo ejecuta dos veces en paralelo (SES=A|B).
-- Variables psql: -v SES -v SCN -v RUN_ID -v ADMIN_EMAIL
--
-- Las variables psql (:'X') NO se usan dentro del DO: se pasan a settings de
-- sesión con set_config(...) y adentro se leen con current_setting(..., true).
--
-- SCN:
--   recepcion : cada sesión recibe SU guía; ambas compiten por el mismo
--               stock de origen (alcanza para una).
--   creacion  : ambas sesiones crean una guía con la MISMA numeración
--               (serie 'TC-<RUN_ID>', correlativo 1).
-- Emite:  RESULT:<SCN>:<SES>:<OK:...|ERR:...>
-- El fixture lo prepara el runner ANTES (committeado).
-- ============================================================
\set ON_ERROR_STOP on

-- Sesión: identidad admin + parámetros de la corrida
SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', (
    SELECT p.id FROM ra_perfiles p JOIN auth.users u ON u.id = p.id
    WHERE lower(u.email) = lower(:'ADMIN_EMAIL') AND p.activo
      AND p.rol IN ('administrador','superadmin') LIMIT 1
  ))::text,
  false
);
SELECT set_config('app.guia_scn',    :'SCN',    false);
SELECT set_config('app.guia_ses',    :'SES',    false);
SELECT set_config('app.guia_run_id', :'RUN_ID', false);

DO $$
DECLARE
  v_scn     text := current_setting('app.guia_scn', true);
  v_ses     text := current_setting('app.guia_ses', true);
  v_run     text := current_setting('app.guia_run_id', true);
  v_empresa uuid;
  v_o       uuid;
  v_d       uuid;
  v_cat     uuid;
  v_gid     uuid;
  v_res     jsonb;
  v_out     text;
BEGIN
  IF v_run IS NULL OR v_scn IS NULL OR v_ses IS NULL THEN
    RAISE EXCEPTION 'faltan settings de sesión (scn/ses/run_id)';
  END IF;

  v_o := md5('guia-o-' || v_run)::uuid;
  v_d := md5('guia-d-' || v_run)::uuid;

  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id = auth.uid();
  IF v_empresa IS NULL THEN RAISE EXCEPTION 'sin sesión admin'; END IF;

  IF v_scn = 'recepcion' THEN
    SELECT id INTO v_gid FROM ra_guias_remision
     WHERE empresa_id = v_empresa AND notas = 'GUIACONC:' || v_run || ':' || v_ses;
    IF v_gid IS NULL THEN RAISE EXCEPTION 'fixture recepcion ausente para SES %', v_ses; END IF;
    BEGIN
      v_res := public.ra_recibir_guia(v_gid);
      v_out := 'OK:' || (v_res->>'status');
    EXCEPTION WHEN OTHERS THEN
      v_out := 'ERR:' || SQLERRM;
    END;

  ELSIF v_scn = 'creacion' THEN
    SELECT catalogo_id INTO v_cat FROM ra_productos
     WHERE empresa_id = v_empresa AND sucursal_id = v_o LIMIT 1;
    IF v_cat IS NULL THEN RAISE EXCEPTION 'fixture creacion ausente'; END IF;
    BEGIN
      v_res := public.ra_crear_guia(
        v_o, v_d, 'TC-' || v_run, 1,
        'GUIACONC-CREATE:' || v_run || ':' || v_ses,
        jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1)));
      v_out := 'OK:' || (v_res->>'status');
    EXCEPTION WHEN OTHERS THEN
      v_out := 'ERR:' || SQLERRM;
    END;

  ELSE
    RAISE EXCEPTION 'SCN desconocido: %', v_scn;
  END IF;

  RAISE NOTICE 'RESULT:%:%:%', v_scn, v_ses, v_out;
END $$;
