-- Retira únicamente el fixture de concurrencia identificado por RUN_ID y restaura
-- exactamente el stock/correlativo anteriores. TEST exclusivamente.
\set ON_ERROR_STOP on
\if :{?RUN_ID}
\else
  \echo 'RUN_ID es obligatorio'
  \quit
\endif
\if :{?STOCK_BEFORE}
\else
  \echo 'STOCK_BEFORE es obligatorio'
  \quit
\endif
\if :{?SERIE_BEFORE}
\else
  \echo 'SERIE_BEFORE es obligatorio'
  \quit
\endif

BEGIN;
-- Los ledgers de caja y CxC son append-only en operación. La concurrencia exige
-- commits reales, por lo que TEST necesita este bypass transaccional y acotado
-- para retirar exclusivamente el namespace generado por el runner.
SET LOCAL session_replication_role = replica;
SELECT set_config('test.postventa_run_id', :'RUN_ID', true);
DO $$
DECLARE
  v_run text := current_setting('test.postventa_run_id');
  v_ids uuid[];
BEGIN
  IF v_run !~ '^[0-9a-f]{32}$' THEN RAISE EXCEPTION 'RUN_ID invalido'; END IF;
  SELECT coalesce(array_agg(id), ARRAY[]::uuid[]) INTO v_ids
  FROM public.ra_devoluciones WHERE motivo='CONCURRENCIA:'||v_run;

  DELETE FROM public.ra_auditoria_devoluciones WHERE devolucion_id = ANY(v_ids);
  DELETE FROM public.ra_sunat_nota_credito_outbox WHERE devolucion_id = ANY(v_ids);
  DELETE FROM public.ra_devolucion_liquidaciones WHERE devolucion_id = ANY(v_ids);
  DELETE FROM public.ra_movimientos_caja WHERE devolucion_id = ANY(v_ids);
  DELETE FROM public.ra_cuenta_corriente_movimientos WHERE devolucion_id = ANY(v_ids);
  DELETE FROM public.ra_kardex WHERE referencia_id = ANY(v_ids);
  DELETE FROM public.ra_devolucion_items WHERE devolucion_id = ANY(v_ids);
  DELETE FROM public.ra_devoluciones WHERE id = ANY(v_ids);
END $$;
UPDATE public.ra_productos SET stock_actual=:'STOCK_BEFORE'::numeric
WHERE id='90000000-0000-4000-8000-000000000001'::uuid;
UPDATE public.ra_series_documento SET siguiente_correlativo=:'SERIE_BEFORE'::integer
WHERE tipo_documento='nota_credito_boleta' AND serie='BCTST'
  AND empresa_id=(SELECT empresa_id FROM public.ra_ventas WHERE id='90000000-0000-4000-8000-000000000010'::uuid);
COMMIT;
