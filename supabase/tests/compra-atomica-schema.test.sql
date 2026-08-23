-- ============================================================
-- supabase/tests/compra-atomica-schema.test.sql
-- Pruebas de schema y comportamiento para 041_compra_cuenta_pagar_atomica.sql
--
-- Ejecutar con psql como postgres CONTRA SUPABASE TEST despues de aplicar:
--   PGPASSWORD=... psql "host=... user=postgres.axcrubvtpqcyscizgoee ..." \
--     -v ON_ERROR_STOP=1 -f supabase/tests/compra-atomica-schema.test.sql
--
-- Las pruebas de comportamiento corren en transaccion explicita con
-- ROLLBACK: cero datos residuales. Solo UUIDs tecnicos, sin datos personales.
-- ============================================================

\set ON_ERROR_STOP on

-- ------------------------------------------------------------
-- 1. Columnas nuevas presentes con tipos/constraints correctos
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ra_compras'
      AND column_name='operation_id' AND data_type='uuid' AND is_nullable='YES'
  ) THEN RAISE EXCEPTION 'FALLO: ra_compras.operation_id uuid nullable no existe'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ra_compras'
      AND column_name='request_hash' AND data_type='text' AND is_nullable='YES'
  ) THEN RAISE EXCEPTION 'FALLO: ra_compras.request_hash text nullable no existe'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ra_compras'
      AND column_name='tipo_documento' AND data_type='text'
      AND column_default LIKE '%FACTURA%'
  ) THEN RAISE EXCEPTION 'FALLO: ra_compras.tipo_documento text default FACTURA no existe'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ra_compras'
      AND column_name='nro_doc_norm' AND is_generated='ALWAYS'
      AND generation_expression LIKE '%upper(btrim(nro_documento)%'
  ) THEN RAISE EXCEPTION 'FALLO: nro_doc_norm generada STORED incorrecta'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.ra_compras'::regclass AND contype='c'
      AND conname='ra_compras_tipo_documento_check'
      AND pg_get_constraintdef(oid) LIKE '%FACTURA%'
      AND pg_get_constraintdef(oid) LIKE '%BOLETA%'
      AND pg_get_constraintdef(oid) LIKE '%OTROS%'
  ) THEN RAISE EXCEPTION 'FALLO: constraint ra_compras_tipo_documento_check ausente o incompleta'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.ra_compras'::regclass AND contype='c'
      AND conname='ra_compras_request_hash_format'
      AND pg_get_constraintdef(oid) LIKE '%0-9a-f%'
  ) THEN RAISE EXCEPTION 'FALLO: constraint ra_compras_request_hash_format ausente'; END IF;

  RAISE NOTICE 'OK 1: columnas y constraints correctas';
END $$;

-- ------------------------------------------------------------
-- 2. Indice unico parcial de operation_id
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='idx_compras_operation_id'
      AND indexdef LIKE '%UNIQUE INDEX%' AND indexdef LIKE '%(empresa_id, operation_id)%'
      AND indexdef LIKE '%operation_id IS NOT NULL%'
  ) THEN RAISE EXCEPTION 'FALLO: idx_compras_operation_id unico parcial no existe'; END IF;
  RAISE NOTICE 'OK 2: indice operation_id correcto';
END $$;

-- ------------------------------------------------------------
-- 3. Indice unico documental SIN exclusion de anuladas
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_compras_factura_proveedor'
      AND indexdef LIKE '%UNIQUE INDEX%'
      AND indexdef LIKE '%(empresa_id, proveedor_id, tipo_documento, nro_doc_norm)%'
      AND indexdef LIKE '%nro_doc_norm IS NOT NULL%'
  ) THEN RAISE EXCEPTION 'FALLO: uq_compras_factura_proveedor no existe o predicado incorrecto'; END IF;

  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='uq_compras_factura_proveedor'
      AND indexdef LIKE '%anulada%'
  ) THEN RAISE EXCEPTION 'FALLO: uq_compras_factura_proveedor excluye anuladas (no debe)'; END IF;

  RAISE NOTICE 'OK 3: indice documental sin exclusion de anuladas';
END $$;

-- ------------------------------------------------------------
-- 4. Enum SIN cambios (sin anulacion_compra)
-- ------------------------------------------------------------
DO $$
DECLARE v_motivos text;
BEGIN
  SELECT string_agg(v::text, ',') INTO v_motivos FROM unnest(enum_range(NULL::ra_motivo_kardex)) v;
  IF v_motivos LIKE '%anulacion_compra%' THEN
    RAISE EXCEPTION 'FALLO: anulacion_compra fue agregado por error (fuera de alcance)';
  END IF;
  RAISE NOTICE 'OK 4: enum ra_motivo_kardex sin cambios (%)', v_motivos;
END $$;

-- ------------------------------------------------------------
-- 5. Privilegios: legacy con authenticated; internas sin PUBLIC/anon/authenticated
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT oid::regprocedure::text AS firma, proacl
    FROM pg_proc
    WHERE pronamespace='public'::regnamespace
      AND proname IN ('ra_registrar_compra','ra_anular_compra','ra_registrar_cargo_compra','ra_registrar_pago_proveedor')
  LOOP
    IF array_to_string(r.proacl, ',') LIKE '=X/%' THEN
      RAISE EXCEPTION 'FALLO: PUBLIC conserva EXECUTE en %', r.firma;
    END IF;
    IF has_function_privilege('anon', r.firma, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO: anon conserva EXECUTE en %', r.firma;
    END IF;
    IF NOT has_function_privilege('authenticated', r.firma, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO: authenticated perdio EXECUTE en %', r.firma;
    END IF;
  END LOOP;

  FOR r IN
    SELECT oid::regprocedure::text AS firma, proacl
    FROM pg_proc
    WHERE pronamespace='public'::regnamespace
      AND proname IN ('ra_estado_pago_proyectado','ra_preflight_compras_duplicadas',
                      'ra_sync_estado_pago_compras','ra_guard_estado_pago',
                      'ra_cxp_sync_desde_insert','ra_cxp_sync_desde_delete','ra_cxp_sync_desde_update')
  LOOP
    IF array_to_string(r.proacl, ',') LIKE '=X/%' THEN
      RAISE EXCEPTION 'FALLO: interna % conserva EXECUTE para PUBLIC', r.firma;
    END IF;
    IF has_function_privilege('anon', r.firma, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO: interna % ejecutable por anon', r.firma;
    END IF;
    IF has_function_privilege('authenticated', r.firma, 'EXECUTE') THEN
      RAISE EXCEPTION 'FALLO: interna % ejecutable por authenticated', r.firma;
    END IF;
  END LOOP;

  -- search_path EXACTO de todas las SECURITY DEFINER nuevas: public, pg_temp
  -- (pg_temp al final evita shadowing mediante objetos temporales)
  FOR r IN
    SELECT p.proname, p.prosecdef, p.proconfig
    FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace
      AND p.proname IN ('ra_sync_estado_pago_compras','ra_guard_estado_pago',
                        'ra_cxp_sync_desde_insert','ra_cxp_sync_desde_delete','ra_cxp_sync_desde_update')
  LOOP
    IF NOT r.prosecdef THEN
      RAISE EXCEPTION 'FALLO: % deberia ser SECURITY DEFINER', r.proname;
    END IF;
    IF r.proconfig IS NULL OR array_to_string(r.proconfig, ',') <> 'search_path=public, pg_temp' THEN
      RAISE EXCEPTION 'FALLO: % tiene proconfig % (esperaba search_path=public, pg_temp)',
                      r.proname, coalesce(array_to_string(r.proconfig, ','), 'NULL');
    END IF;
  END LOOP;

  -- las funciones internas INVOKER tambien fijan search_path endurecido
  FOR r IN
    SELECT p.proname, p.proconfig
    FROM pg_proc p
    WHERE p.pronamespace='public'::regnamespace
      AND p.proname IN ('ra_estado_pago_proyectado','ra_preflight_compras_duplicadas')
  LOOP
    IF r.proconfig IS NULL OR array_to_string(r.proconfig, ',') <> 'search_path=public, pg_temp' THEN
      RAISE EXCEPTION 'FALLO: % tiene proconfig % (esperaba search_path=public, pg_temp)',
                      r.proname, coalesce(array_to_string(r.proconfig, ','), 'NULL');
    END IF;
  END LOOP;

  RAISE NOTICE 'OK 5: privilegios y search_path (public, pg_temp) correctos';
END $$;

-- ------------------------------------------------------------
-- 6. Triggers por NOMBRE EXACTO y funcion asociada exacta
-- ------------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  -- guard sobre ra_compras
  SELECT t.tgname, p.proname INTO r
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid='public.ra_compras'::regclass AND NOT t.tgisinternal
    AND t.tgname='trg_compras_guard_estado_pago';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALLO: trigger trg_compras_guard_estado_pago no existe';
  ELSIF r.proname <> 'ra_guard_estado_pago' THEN
    RAISE EXCEPTION 'FALLO: trg_compras_guard_estado_pago apunta a % (esperaba ra_guard_estado_pago)', r.proname;
  END IF;

  -- sincronizadores CxP por nombre exacto y funcion exacta
  FOR r IN
    SELECT t.tgname, p.proname
    FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE t.tgrelid='public.ra_cuentas_por_pagar_movimientos'::regclass AND NOT t.tgisinternal
  LOOP
    IF r.tgname = 'trg_cxp_sync_estado_pago_ins' AND r.proname <> 'ra_cxp_sync_desde_insert' THEN
      RAISE EXCEPTION 'FALLO: trg_ins apunta a %', r.proname;
    END IF;
    IF r.tgname = 'trg_cxp_sync_estado_pago_upd' AND r.proname <> 'ra_cxp_sync_desde_update' THEN
      RAISE EXCEPTION 'FALLO: trg_upd apunta a %', r.proname;
    END IF;
    IF r.tgname = 'trg_cxp_sync_estado_pago_del' AND r.proname <> 'ra_cxp_sync_desde_delete' THEN
      RAISE EXCEPTION 'FALLO: trg_del apunta a %', r.proname;
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.ra_cuentas_por_pagar_movimientos'::regclass AND NOT tgisinternal AND tgname='trg_cxp_sync_estado_pago_ins')
  OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.ra_cuentas_por_pagar_movimientos'::regclass AND NOT tgisinternal AND tgname='trg_cxp_sync_estado_pago_upd')
  OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.ra_cuentas_por_pagar_movimientos'::regclass AND NOT tgisinternal AND tgname='trg_cxp_sync_estado_pago_del') THEN
    RAISE EXCEPTION 'FALLO: faltan triggers de sincronizacion ins/upd/del';
  END IF;

  RAISE NOTICE 'OK 6: triggers exactos presentes y asociados a sus funciones';
END $$;

-- ------------------------------------------------------------
-- 7-9. Comportamiento completo en transaccion revertida
-- ------------------------------------------------------------
BEGIN;

DO $$
DECLARE
  v_empresa uuid; v_sucursal uuid; v_proveedor uuid; v_usuario uuid; v_id uuid;
  v_estado text;
BEGIN
  SELECT e.id INTO v_empresa FROM ra_empresas e ORDER BY e.created_at LIMIT 1;
  SELECT s.id INTO v_sucursal FROM ra_sucursales s WHERE s.empresa_id=v_empresa ORDER BY s.created_at LIMIT 1;
  SELECT p.id INTO v_proveedor FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.created_at LIMIT 1;
  SELECT u.id INTO v_usuario FROM auth.users u LIMIT 1;

  IF v_empresa IS NULL OR v_sucursal IS NULL OR v_proveedor IS NULL OR v_usuario IS NULL THEN
    RAISE EXCEPTION 'FALLO: fixtures base insuficientes (empresa/sucursal/proveedor/usuario)';
  END IF;

  -- ===== 7. Compatibilidad historica + guard =====
  INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                          nro_documento, subtotal, igv, total, estado_pago, estado)
  VALUES (v_empresa, v_sucursal, v_proveedor, v_usuario,
          'HIST-' || gen_random_uuid(), 100, 18, 118, 'pendiente', 'confirmada')
  RETURNING id INTO v_id;

  BEGIN
    UPDATE ra_compras SET notas='compat-hist' WHERE id=v_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FALLO: actualizar notas de fila historica fallo: %', SQLERRM;
  END;

  BEGIN
    UPDATE ra_compras SET estado_pago='pagado' WHERE id=v_id;
    RAISE EXCEPTION 'FALLO: UPDATE directo inconsistente de estado_pago NO fue rechazado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_ESTADO_PAGO_INCONSISTENTE%' THEN
      RAISE EXCEPTION 'FALLO: error inesperado al violar guard: %', SQLERRM;
    END IF;
  END;
  RAISE NOTICE 'OK 7: compatibilidad historica + guard rechaza mutacion directa';

  -- ===== 8a. request_hash: formato invalido rechazado, valido aceptado =====
  BEGIN
    UPDATE ra_compras SET request_hash='NOHEX' WHERE id=v_id;
    RAISE EXCEPTION 'FALLO: request_hash invalido aceptado';
  EXCEPTION
    WHEN check_violation THEN NULL; -- esperado
    WHEN OTHERS THEN RAISE EXCEPTION 'FALLO: error inesperado en request_hash invalido (%)', SQLERRM;
  END;

  UPDATE ra_compras SET request_hash=repeat('a', 64) WHERE id=v_id; -- 64 hex validos

  BEGIN
    UPDATE ra_compras SET request_hash=repeat('A', 64) WHERE id=v_id; -- hex MAYUSCULA: rechazable
    RAISE EXCEPTION 'FALLO: request_hash hex mayuscula aceptado';
  EXCEPTION
    WHEN check_violation THEN NULL; -- esperado (regex exige minusculas)
    WHEN OTHERS THEN RAISE EXCEPTION 'FALLO: error inesperado en request_hash mayuscula (%)', SQLERRM;
  END;
  RAISE NOTICE 'OK 8a: request_hash valida formato (64 hex minusculos)';

  -- ===== 8b. tipo_documento: casing/espacios rechazados, dominio valido =====
  BEGIN
    UPDATE ra_compras SET tipo_documento=' factura' WHERE id=v_id;
    RAISE EXCEPTION 'FALLO: tipo_documento con espacios/casing evasivo aceptado';
  EXCEPTION
    WHEN check_violation THEN NULL;
    WHEN OTHERS THEN RAISE EXCEPTION 'FALLO: error inesperado en tipo_documento evasivo (%)', SQLERRM;
  END;

  UPDATE ra_compras SET tipo_documento='BOLETA' WHERE id=v_id;

  BEGIN
    UPDATE ra_compras SET tipo_documento='NOTACREDITO' WHERE id=v_id;
    RAISE EXCEPTION 'FALLO: tipo_documento fuera de dominio aceptado';
  EXCEPTION
    WHEN check_violation THEN NULL;
    WHEN OTHERS THEN RAISE EXCEPTION 'FALLO: error inesperado en tipo_documento fuera de dominio (%)', SQLERRM;
  END;
  RAISE NOTICE 'OK 8b: tipo_documento restringido a FACTURA|BOLETA|OTROS exactos';

  -- ===== 8c. Unicidad de operation_id (mismo empresa+operacion) =====
  DECLARE
    v_op uuid := gen_random_uuid();
    v_id2 uuid;
  BEGIN
    UPDATE ra_compras SET operation_id=v_op WHERE id=v_id;

    INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                            nro_documento, total, estado_pago, estado, operation_id)
    VALUES (v_empresa, v_sucursal, v_proveedor, v_usuario,
            'OP2-' || gen_random_uuid(), 10, 'pendiente', 'confirmada', v_op);
    RAISE EXCEPTION 'FALLO: operation_id duplicado en la misma empresa aceptado';
  EXCEPTION
    WHEN unique_violation THEN NULL;
    WHEN OTHERS THEN RAISE EXCEPTION 'FALLO: error inesperado en operacion duplicada (%)', SQLERRM;
  END;
  RAISE NOTICE 'OK 8c: unicidad (empresa, operation_id) verificada';

  -- ===== 9. Sincronizacion desde ledger: INSERT / UPDATE / DELETE =====
  UPDATE ra_compras SET request_hash=NULL WHERE id=v_id;

  -- INSERT cargo -> sigue pendiente (saldo=total)
  INSERT INTO ra_cuentas_por_pagar_movimientos (empresa_id, proveedor_id, compra_id, tipo, monto, fecha, usuario_id)
  VALUES (v_empresa, v_proveedor, v_id, 'cargo', 118, CURRENT_DATE, v_usuario);

  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_id;
  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'FALLO (sync INSERT): esperaba pendiente, obtuve %', v_estado;
  END IF;

  -- UPDATE abono parcial -> parcial (dispara trg_upd con NEW+OLD)
  INSERT INTO ra_cuentas_por_pagar_movimientos (empresa_id, proveedor_id, compra_id, tipo, monto, fecha, metodo_pago, referencia, usuario_id)
  VALUES (v_empresa, v_proveedor, v_id, 'abono', 118, CURRENT_DATE, 'efectivo', 't1', v_usuario);
  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_id;
  IF v_estado <> 'pagado' THEN
    RAISE EXCEPTION 'FALLO (tras abono completo): esperaba pagado, obtuve %', v_estado;
  END IF;

  UPDATE ra_cuentas_por_pagar_movimientos
     SET monto = 50
   WHERE compra_id=v_id AND tipo='abono';
  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_id;
  IF v_estado <> 'parcial' THEN
    RAISE EXCEPTION 'FALLO (sync UPDATE): esperaba parcial tras abono 50/118, obtuve %', v_estado;
  END IF;

  -- DELETE abono -> vuelve a pendiente (dispara trg_del con OLD)
  DELETE FROM ra_cuentas_por_pagar_movimientos WHERE compra_id=v_id AND tipo='abono';
  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_id;
  IF v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'FALLO (sync DELETE): esperaba pendiente tras borrar abonos, obtuve %', v_estado;
  END IF;

  RAISE NOTICE 'OK 9: sincronizacion INSERT/UPDATE/DELETE desde ledger correcta';
END $$;

ROLLBACK;

-- ------------------------------------------------------------
-- RESUMEN
-- ------------------------------------------------------------
SELECT 'SCHEMA TESTS OK' AS resultado;
