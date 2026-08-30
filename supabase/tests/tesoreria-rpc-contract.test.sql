-- Contract/static catalog checks for migrations 047-048. TEST only.
\set ON_ERROR_STOP on

DO $$
DECLARE
  v_sig text;
  v_table text;
  v_priv text;
  v_def text;
  v_pos_op integer;
  v_pos_replay integer;
  v_pos_caja integer;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.ra_abrir_caja_v1(uuid,uuid,numeric,text)',
    'public.ra_registrar_cobro_v2(uuid,uuid,uuid,numeric,date,public.ra_metodo_pago,character,numeric,text)',
    'public.ra_registrar_pago_proveedor_v2(uuid,uuid,uuid,numeric,date,public.ra_metodo_pago,text)',
    'public.ra_registrar_movimiento_caja_v1(uuid,uuid,text,text,numeric,text)',
    'public.ra_cerrar_caja_v1(uuid,uuid,numeric,text)',
    'public.ra_revisar_liquidacion_v1(uuid,uuid,text,text)'
  ] LOOP
    IF to_regprocedure(v_sig) IS NULL THEN
      RAISE EXCEPTION 'FALLO: firma ausente %',v_sig;
    END IF;
    IF has_function_privilege('anon',v_sig,'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO: anon conserva EXECUTE en %',v_sig;
    END IF;
    IF NOT has_function_privilege('authenticated',v_sig,'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO: authenticated no puede ejecutar %',v_sig;
    END IF;
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY['public.ra_cajas','public.ra_movimientos_caja',
    'public.ra_liquidaciones','public.ra_cuenta_corriente_movimientos',
    'public.ra_cuentas_por_pagar_movimientos'] LOOP
    FOREACH v_priv IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('authenticated',v_table,v_priv) THEN
        RAISE EXCEPTION 'FALLO: authenticated conserva % sobre %',v_priv,v_table;
      END IF;
    END LOOP;
  END LOOP;

  v_def:=pg_get_functiondef('public.ra_confirmar_venta_v1(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date)'::regprocedure);
  v_pos_op:=strpos(v_def,'pg_advisory_xact_lock');
  v_pos_replay:=strpos(v_def,'IF v_venta IS NOT NULL');
  v_pos_caja:=strpos(v_def,'SELECT id INTO v_caja FROM public.ra_cajas');
  IF v_pos_op=0 OR v_pos_replay=0 OR v_pos_caja=0
     OR NOT (v_pos_op<v_pos_replay AND v_pos_replay<v_pos_caja) THEN
    RAISE EXCEPTION 'FALLO: venta no respeta operation lock -> replay -> caja';
  END IF;
  IF v_def LIKE '%usuario_id=v_user OR v_rol=%' THEN
    RAISE EXCEPTION 'FALLO: venta aun restringe el turno compartido por propietario';
  END IF;
  RAISE NOTICE 'OK: seis RPC, ACL y orden venta/cierre verificados';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ra_cuenta_corriente_movimientos'
      AND column_name='result_snapshot' AND data_type='jsonb')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ra_cuentas_por_pagar_movimientos'
      AND column_name='result_snapshot' AND data_type='jsonb')
     OR NOT EXISTS (SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_liquidaciones_empresa_review_operation') THEN
    RAISE EXCEPTION 'FALLO: persistencia de replay estable incompleta';
  END IF;
  RAISE NOTICE 'OK: snapshots de resultado e identidad de revision presentes';
END $$;
