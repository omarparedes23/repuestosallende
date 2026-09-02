\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claims', jsonb_build_object('sub', :'ADMIN_ID'::uuid, 'role','authenticated')::text, true);
SELECT public.ra_liquidar_devolucion_v1(:'OPERATION_ID'::uuid, :'DEVOLUCION_ID'::uuid, '{}'::jsonb);
-- La RPC ya tomó FOR UPDATE sobre venta y venta_item. Se retiene la transacción
-- para que la sesión B alcance la misma línea antes del COMMIT.
SELECT pg_sleep(2);
COMMIT;
\echo RESULT:CONCURRENCIA:A:COMMITTED
