\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', :'ADMIN_ID'::uuid, 'role','authenticated')::text, true);
SELECT public.ra_liquidar_devolucion_v1(:'OPERATION_ID'::uuid, :'DEVOLUCION_ID'::uuid, '{}'::jsonb);
COMMIT;
\echo RESULT:CONCURRENCIA:B:COMMITTED_UNEXPECTEDLY
