-- Contract checks for 055_reversos_comerciales_fiscales_schema.sql.
-- Execute only against Supabase TEST after applying migration 055.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_sig text;
  v_def text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.ra_solicitar_devolucion_v1(uuid,uuid,jsonb,text)',
    'public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb)'
  ] LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'FALLO: firma ausente %', v_sig;
    END IF;
    IF has_function_privilege('anon', v_sig, 'EXECUTE')
       OR has_function_privilege('service_role', v_sig, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO: ACL incorrecta en %', v_sig;
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.ra_devoluciones', 'public.ra_devolucion_items',
    'public.ra_devolucion_liquidaciones', 'public.ra_auditoria_devoluciones',
    'public.ra_sunat_nota_credito_outbox'
  ] LOOP
    IF to_regclass(v_sig) IS NULL THEN
      RAISE EXCEPTION 'FALLO: tabla ausente %', v_sig;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ra_sunat_nota_credito_outbox'
      AND column_name='motivo_codigo' AND data_type='text' AND is_nullable='NO')
     OR NOT EXISTS (SELECT 1 FROM pg_constraint
       WHERE conrelid='public.ra_sunat_nota_credito_outbox'::regclass
         AND conname='ra_sunat_nc_outbox_document_identity')
     OR NOT EXISTS (SELECT 1 FROM pg_policies
       WHERE schemaname='public' AND tablename='ra_sunat_nota_credito_outbox'
         AND policyname='ra_sunat_nota_credito_outbox_select') THEN
    RAISE EXCEPTION 'FALLO: contrato de outbox NC incompleto';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.ra_series_documento'::regclass
      AND conname='ra_series_tipo_documento_check'
      AND pg_get_constraintdef(oid) LIKE '%nota_credito_factura%'
      AND pg_get_constraintdef(oid) LIKE '%nota_credito_boleta%') THEN
    RAISE EXCEPTION 'FALLO: series NC no habilitadas';
  END IF;

  v_def:=pg_get_functiondef('public.ra_liquidar_devolucion_v1(uuid,uuid,jsonb)'::regprocedure);
  IF strpos(v_def,'pg_advisory_xact_lock')=0
     OR strpos(v_def,'FOR UPDATE')=0
     OR strpos(v_def,'ra_sunat_nota_credito_outbox')=0
     OR strpos(v_def,'RA_CREDIT_NOTE_SERIES_NOT_CONFIGURED')=0
     OR strpos(v_def, '''06''')=0
     OR strpos(v_def, '''07''')=0 THEN
    RAISE EXCEPTION 'FALLO: liquidacion no conserva locks, outbox o motivos SUNAT';
  END IF;
  RAISE NOTICE 'OK: contrato de devolución y nota de crédito presente';
END $$;
