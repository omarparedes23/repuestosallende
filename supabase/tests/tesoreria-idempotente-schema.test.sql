-- ============================================================
-- Schema checks for 046_tesoreria_idempotente_schema.sql
-- Execute against Supabase TEST only after applying migration 046.
-- ============================================================

\set ON_ERROR_STOP on

-- 1. Required additive columns retain historical NULL compatibility.
DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'ra_cuenta_corriente_movimientos', 'ra_cuentas_por_pagar_movimientos'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public' AND table_name = v_table
                     AND column_name = 'operation_id' AND data_type = 'uuid' AND is_nullable = 'YES')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = v_table
                        AND column_name = 'request_hash' AND data_type = 'text' AND is_nullable = 'YES')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = v_table
                        AND column_name = 'result_snapshot' AND data_type = 'jsonb' AND is_nullable = 'YES')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = v_table
                        AND column_name = 'sucursal_id' AND data_type = 'uuid' AND is_nullable = 'YES')
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = v_table
                        AND column_name = 'caja_id' AND data_type = 'uuid' AND is_nullable = 'YES') THEN
      RAISE EXCEPTION 'FALLO: columnas de tesoreria incompletas en %', v_table;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='ra_cajas'
                   AND column_name='operation_id' AND data_type='uuid')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='ra_movimientos_caja'
                      AND column_name='usuario_id' AND data_type='uuid')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='ra_liquidaciones'
                      AND column_name='estado_revision' AND column_default LIKE '%pendiente_revision%') THEN
    RAISE EXCEPTION 'FALLO: columnas de caja/liquidacion incompletas';
  END IF;
  RAISE NOTICE 'OK 1: columnas aditivas presentes';
END $$;

-- 2. Idempotency indexes are scoped to company / current ledger effect.
DO $$
DECLARE v_index text;
BEGIN
  FOREACH v_index IN ARRAY ARRAY[
    'uq_cc_abono_operation', 'uq_cxp_abono_operation',
    'uq_cajas_empresa_operation', 'uq_movimientos_caja_turno_operation',
    'uq_liquidaciones_empresa_operation'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_indexes
                   WHERE schemaname='public' AND indexname=v_index
                     AND indexdef LIKE '%UNIQUE INDEX%'
                     AND indexdef LIKE '%operation_id IS NOT NULL%') THEN
      RAISE EXCEPTION 'FALLO: indice idempotente % ausente o no parcial', v_index;
    END IF;
  END LOOP;
  RAISE NOTICE 'OK 2: indices idempotentes presentes';
END $$;

DO $$
BEGIN
  IF to_regclass('public.idx_caja_una_abierta_por_usuario') IS NOT NULL THEN
    RAISE EXCEPTION 'FALLO: persiste la unicidad historica por usuario';
  END IF;
  IF to_regclass('public.ra_cajas_sucursal_activa') IS NULL THEN
    RAISE EXCEPTION 'FALLO: falta unicidad de caja abierta por sucursal';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ra_cajas'
      AND policyname = 'cajas_select' AND qual LIKE '%sucursal_id%'
  ) THEN
    RAISE EXCEPTION 'FALLO: RLS de caja no contempla turno compartido por sucursal';
  END IF;
  RAISE NOTICE 'OK 2b: una caja por tienda y lectura compartida por sucursal';
END $$;

-- 3. Constraints protect new operation rows and review states.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ra_cc_tesoreria_operacion_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ra_cxp_tesoreria_operacion_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ra_movimientos_caja_operacion_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ra_liquidaciones_estado_revision_check')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ra_liquidaciones_revision_shape_check') THEN
    RAISE EXCEPTION 'FALLO: faltan constraints de tesoreria';
  END IF;
  RAISE NOTICE 'OK 3: constraints presentes';
END $$;

-- 4. Append-only triggers use their intended functions.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE t.tgrelid='public.ra_movimientos_caja'::regclass
      AND NOT t.tgisinternal AND t.tgname='trg_movimientos_caja_append_only'
      AND p.proname='ra_movimientos_caja_append_only'
  ) THEN RAISE EXCEPTION 'FALLO: trigger append-only de movimientos ausente'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
    WHERE t.tgrelid='public.ra_liquidaciones'::regclass
      AND NOT t.tgisinternal AND t.tgname='trg_liquidaciones_proteger_snapshot'
      AND p.proname='ra_liquidaciones_proteger_snapshot'
  ) THEN RAISE EXCEPTION 'FALLO: trigger de snapshot de liquidacion ausente'; END IF;
  RAISE NOTICE 'OK 4: triggers append-only presentes';
END $$;

-- 5. The schema does not alter either existing enum.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname='ra_estado_revision_liquidacion') THEN
    RAISE EXCEPTION 'FALLO: 046 no debe crear un enum de revision';
  END IF;
  RAISE NOTICE 'OK 5: estado de revision es CHECK aditivo';
END $$;
