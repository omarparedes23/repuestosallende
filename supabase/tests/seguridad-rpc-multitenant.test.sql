-- Ejecutar despues de 045. Solo inspecciona catalogo; no persiste datos.
BEGIN;

DO $$
DECLARE
  v_sig text;
  v_def text;
BEGIN
  FOREACH v_sig IN ARRAY ARRAY[
    'public.ra_recibir_guia(uuid)',
    'public.ra_confirmar_orden_compra(uuid)',
    'public.ra_anular_orden_compra(uuid)',
    'public.ra_anular_compra(uuid)',
    'public.ra_contar_stock_bajo(uuid)'
  ] LOOP
    IF has_function_privilege('anon', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO ACL anon conserva EXECUTE sobre %', v_sig;
    END IF;
    IF NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO ACL authenticated no puede ejecutar %', v_sig;
    END IF;
    SELECT pg_get_functiondef(to_regprocedure(v_sig)) INTO v_def;
    IF v_def NOT LIKE '%auth.uid()%' OR v_def NOT LIKE '%empresa_id%' THEN
      RAISE EXCEPTION 'FALLO guard server-side ausente en %', v_sig;
    END IF;
  END LOOP;

  FOREACH v_sig IN ARRAY ARRAY[
    'public.ra_registrar_cargo_credito(uuid,date)',
    'public.ra_registrar_cargo_compra(uuid)',
    'public.ra_confirmar_venta_v1(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date)',
    'public.ra_clasificacion_bulk_upsert(jsonb)',
    'public.ra_siguiente_correlativo(uuid,text)'
  ] LOOP
    IF has_function_privilege('anon', v_sig, 'EXECUTE')
       OR has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO ACL cliente conserva EXECUTE sobre %', v_sig;
    END IF;
  END LOOP;
END;
$$;

SELECT 'SEGURIDAD RPC TESTS OK' AS resultado;
ROLLBACK;
