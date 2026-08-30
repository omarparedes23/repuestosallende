-- Retiro no destructivo de un fixture TESORERIA-CONC en Supabase TEST.
-- Uso: psql <TEST_URL> -v RUN_ID=<id> -v ALLOW_TEST_FIXTURE_RETIRE=YES -f <este archivo>
-- No elimina ledgers ni liquidaciones. Solo desactiva la sucursal etiquetada
-- después de verificar que no quede una caja abierta.
\set ON_ERROR_STOP on
\if :{?RUN_ID}
\else
  \echo 'RUN_ID es obligatorio'
  \quit
\endif
\if :{?ALLOW_TEST_FIXTURE_RETIRE}
\else
  \echo 'Confirme -v ALLOW_TEST_FIXTURE_RETIRE=YES'
  \quit
\endif

BEGIN;
SELECT set_config('test.run', :'RUN_ID', true);
SELECT set_config('test.confirmation', :'ALLOW_TEST_FIXTURE_RETIRE', true);
DO $$
DECLARE
  v_sucursal uuid;
  v_nombre text := 'TESORERIA-CONC:'||current_setting('test.run');
BEGIN
  IF current_setting('test.confirmation') <> 'YES' THEN
    RAISE EXCEPTION 'Confirme exactamente ALLOW_TEST_FIXTURE_RETIRE=YES';
  END IF;
  IF current_setting('test.run') !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'RUN_ID invalido';
  END IF;
  SELECT id INTO v_sucursal FROM public.ra_sucursales
  WHERE nombre=v_nombre FOR UPDATE;
  IF v_sucursal IS NULL THEN RAISE EXCEPTION 'fixture no encontrado: %',v_nombre; END IF;
  IF EXISTS (SELECT 1 FROM public.ra_cajas WHERE sucursal_id=v_sucursal AND estado='abierta') THEN
    RAISE EXCEPTION 'fixture conserva una caja abierta; no se retira';
  END IF;
  UPDATE public.ra_sucursales SET activo=false WHERE id=v_sucursal AND activo;
  RAISE NOTICE 'OK: fixture retirado de operacion: %',v_nombre;
END $$;
COMMIT;
