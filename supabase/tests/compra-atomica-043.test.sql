-- ============================================================
-- supabase/tests/compra-atomica-043.test.sql  (rev.3)
--
-- REQUIERE: 041 + 042 + 043 rev.3 aplicadas.
-- Ejecutar como postgres en SUPABASE TEST con ON_ERROR_STOP=1.
--
-- Contrato preflight/backfill (unico): el preflight read-only
-- (SELECT equivalente, la funcion aun no existe antes de aplicar)
-- se ejecuta ANTES de aplicar y reporta conteo e IDs tecnicos;
-- la aplicacion autorizada corrige SOLO divergentes con actor
-- 'migracion'; segunda corrida = cero cambios y cero auditorias.
-- ============================================================

\set ON_ERROR_STOP on

-- ------------------------------------------------------------
-- 0. Esquema: 4 checks exactos, indice UNIQUE exacto en su tabla,
--    trigger -> funcion exacta, RLS, grants tabla (ACL), search_path,
--    SECURITY DEFINER, EXECUTE de RPC
-- ------------------------------------------------------------
DO $$
DECLARE
  v_n int; r record; v_idx_ok boolean;
BEGIN
  SELECT count(*) INTO v_n FROM pg_constraint
   WHERE conrelid='public.ra_auditoria_estado_pago_compras'::regclass AND contype='c'
     AND conname IN ('ra_aud_epc_actor_check','ra_aud_epc_motivo_check',
                     'ra_aud_epc_hash_check','ra_aud_epc_actor_domain_check');
  IF v_n <> 4 THEN
    RAISE EXCEPTION 'FALLO 0.1: esperaba exactamente 4 checks, hay %', v_n;
  END IF;

  -- Indice: UNIQUE, pertenece a la tabla, columnas exactas
  SELECT EXISTS (
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.relname='uq_aud_epc_operacion'
      AND n.nspname='public'
      AND t.relname='ra_auditoria_estado_pago_compras'
      AND i.indisunique
      AND (SELECT array_agg(a.attname::text ORDER BY a.attnum)
             FROM pg_attribute a
            WHERE a.attrelid = i.indexrelid AND a.attnum > 0)
          = ARRAY['empresa_id','operation_id']::text[]
      AND (SELECT count(*) FROM pg_attribute a
            WHERE a.attrelid = i.indexrelid AND a.attnum > 0) = 2
  ) INTO v_idx_ok;
  IF NOT v_idx_ok THEN
    RAISE EXCEPTION 'FALLO 0.2: uq_aud_epc_operacion no es UNIQUE(empresa_id, operation_id) sobre la tabla';
  END IF;

  -- Trigger asociado EXPLICITAMENTE a ra_aud_epc_append_only
  SELECT t.tgname AS tg, p.proname AS fn INTO r
  FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE t.tgrelid='public.ra_auditoria_estado_pago_compras'::regclass
    AND NOT t.tgisinternal AND t.tgname='trg_aud_epc_immutable';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FALLO 0.3: trg_aud_epc_immutable ausente';
  ELSIF r.fn <> 'ra_aud_epc_append_only' THEN
    RAISE EXCEPTION 'FALLO 0.3: trg apunta a % (esperaba ra_aud_epc_append_only)', r.fn;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies
                 WHERE tablename='ra_auditoria_estado_pago_compras'
                   AND policyname='aud_epc_select_admin') THEN
    RAISE EXCEPTION 'FALLO 0.4: politica aud_epc_select_admin ausente';
  END IF;

  -- authenticated: SELECT si, escritura no (grants por ACL de tabla)
  IF NOT has_table_privilege('authenticated','public.ra_auditoria_estado_pago_compras','SELECT') THEN
    RAISE EXCEPTION 'FALLO 0.5a: authenticated sin SELECT';
  END IF;
  IF has_table_privilege('authenticated','public.ra_auditoria_estado_pago_compras','INSERT')
     OR has_table_privilege('authenticated','public.ra_auditoria_estado_pago_compras','UPDATE')
     OR has_table_privilege('authenticated','public.ra_auditoria_estado_pago_compras','DELETE') THEN
    RAISE EXCEPTION 'FALLO 0.5b: authenticated conserva escritura';
  END IF;
  -- PUBLIC via role_table_grants (no has_table_privilege)
  IF EXISTS (SELECT 1 FROM information_schema.role_table_grants
             WHERE table_schema='public'
               AND table_name='ra_auditoria_estado_pago_compras'
               AND grantee IN ('PUBLIC','anon')) THEN
    RAISE EXCEPTION 'FALLO 0.5c: PUBLIC/anon tienen grants sobre auditoria';
  END IF;

  FOR r IN
    SELECT proname, prosecdef, proconfig FROM pg_proc
    WHERE pronamespace='public'::regnamespace
      AND proname IN ('ra_recalcular_estado_pago','ra_aud_epc_append_only')
  LOOP
    IF NOT r.prosecdef THEN
      RAISE EXCEPTION 'FALLO 0.6: % deberia ser SECURITY DEFINER', r.proname;
    END IF;
    IF r.proconfig IS NULL OR array_to_string(r.proconfig,',') <> 'search_path=public, pg_temp' THEN
      RAISE EXCEPTION 'FALLO 0.6: % search_path incorrecto', r.proname;
    END IF;
  END LOOP;

  IF has_function_privilege('anon',
       'public.ra_recalcular_estado_pago(uuid,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'FALLO 0.7: anon ejecuta la RPC';
  END IF;
  IF NOT has_function_privilege('authenticated',
       'public.ra_recalcular_estado_pago(uuid,uuid,text)','EXECUTE') THEN
    RAISE EXCEPTION 'FALLO 0.7: authenticated sin EXECUTE';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
                 AND proname='ra_preflight_estado_pago_divergencias') THEN
    RAISE EXCEPTION 'FALLO 0.8: preflight ausente';
  END IF;

  RAISE NOTICE 'OK 0: esquema/grants/RLS/search_path/funciones correctos';
END $$;

-- ============================================================
-- SECCION A - Autorizacion y cross-tenant (fixture transaccional)
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_vend uuid;
  v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_op uuid; v_cid uuid; v_res jsonb;
  v_emp2 uuid; v_suc2 uuid; v_cid2 uuid;
  v_total_pen numeric;
  v_aud_propia_op uuid;
  v_aud_ajena uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT p.id INTO v_vend FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.vendedor.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa,'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ORDER BY rp.id LIMIT 1;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
  v_cid := (v_res->'compra'->>'id')::uuid;
  v_total_pen := (v_res->'compra'->>'total_pen')::numeric;

  -- A.1 sin sesion -> RA_UNAUTHENTICATED
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN
    PERFORM public.ra_recalcular_estado_pago(gen_random_uuid(), v_cid, 'x');
    RAISE EXCEPTION 'FALLO A1';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_UNAUTHENTICATED%' THEN RAISE EXCEPTION 'FALLO A1: %', SQLERRM; END IF;
  END;

  -- A.2 vendedor -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_vend)::text, true);
  BEGIN
    PERFORM public.ra_recalcular_estado_pago(gen_random_uuid(), v_cid, 'x');
    RAISE EXCEPTION 'FALLO A2';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO A2: %', SQLERRM; END IF;
  END;

  -- A.3 cross-tenant: compra ajena inicia PENDIENTE (guard-valida)
  INSERT INTO ra_empresas (nombre, slug) VALUES ('EMPRESA-AJENA-043','ajena-043-r3')
  RETURNING id INTO v_emp2;
  INSERT INTO ra_sucursales (empresa_id, nombre) VALUES (v_emp2,'SUC AJENA')
  RETURNING id INTO v_suc2;
  INSERT INTO ra_compras (empresa_id, sucursal_id, proveedor_id, usuario_id,
                          subtotal, igv, total, total_pen, estado_pago, estado)
  VALUES (v_emp2, v_suc2, NULL, v_admin, 100, 18, 118, 118, 'pendiente', 'confirmada')
  RETURNING id INTO v_cid2;

  -- Auditoria ajena explicita: permite demostrar aislamiento RLS real,
  -- no solamente ausencia accidental de filas de otra empresa.
  INSERT INTO ra_auditoria_estado_pago_compras (
    empresa_id, compra_id, operation_id, request_hash, usuario_id,
    actor_tipo, estado_anterior, estado_nuevo, motivo)
  VALUES (
    v_emp2, v_cid2, gen_random_uuid(), repeat('b', 64), NULL,
    'migracion', 'pendiente', 'pendiente', 'fixture RLS empresa ajena')
  RETURNING id INTO v_aud_ajena;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  v_res := public.ra_recalcular_estado_pago(gen_random_uuid(), v_cid2, 'cross');
  IF (v_res->>'status') <> 'not_found' THEN
    RAISE EXCEPTION 'FALLO A3: fuga cross-tenant (%)', v_res;
  END IF;

  -- A.4 RLS REAL como authenticated:
  --     admin ve auditoria de su empresa / vendedor no ve nada /
  --     admin no ve la de otra empresa / nadie escribe directamente.
  DECLARE v_n int;
  BEGIN
    -- generar una fila de auditoria real (reparacion con divergencia sembrada)
    ALTER TABLE ra_cuentas_por_pagar_movimientos DISABLE TRIGGER trg_cxp_sync_estado_pago_ins;
    INSERT INTO ra_cuentas_por_pagar_movimientos (
      empresa_id, proveedor_id, compra_id, tipo, monto, fecha, metodo_pago, referencia, usuario_id)
    VALUES (v_empresa, v_prov, v_cid, 'abono', v_total_pen, CURRENT_DATE,
            'efectivo', 'seed-a', v_admin);
    ALTER TABLE ra_cuentas_por_pagar_movimientos ENABLE TRIGGER trg_cxp_sync_estado_pago_ins;
    ALTER TABLE ra_compras DISABLE TRIGGER trg_compras_guard_estado_pago;
    UPDATE ra_compras SET estado_pago='pendiente' WHERE id=v_cid;
    ALTER TABLE ra_compras ENABLE TRIGGER trg_compras_guard_estado_pago;

    v_aud_propia_op := gen_random_uuid();
    v_res := public.ra_recalcular_estado_pago(v_aud_propia_op, v_cid, 'para RLS');

    -- Admin de la empresa original ve su auditoria concreta.
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
    SELECT count(*) INTO v_n FROM ra_auditoria_estado_pago_compras
     WHERE operation_id = v_aud_propia_op;
    IF v_n <> 1 THEN RAISE EXCEPTION 'FALLO A4a: admin ve % auditorias propias, esperaba 1', v_n; END IF;

    -- El mismo admin no puede ver la auditoria concreta de otra empresa.
    SELECT count(*) INTO v_n FROM ra_auditoria_estado_pago_compras
     WHERE id = v_aud_ajena;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALLO A4b: admin ve auditoria de empresa ajena'; END IF;

    -- vendedor: no ve filas
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_vend)::text, true);
    SELECT count(*) INTO v_n FROM ra_auditoria_estado_pago_compras;
    IF v_n <> 0 THEN RAISE EXCEPTION 'FALLO A4c: vendedor ve % filas', v_n; END IF;

    -- escritura directa denegada por grants (antes incluso de RLS)
    BEGIN
      INSERT INTO ra_auditoria_estado_pago_compras (
        empresa_id, compra_id, operation_id, request_hash, usuario_id,
        actor_tipo, estado_anterior, estado_nuevo, motivo)
      VALUES (ra_empresa_id(), v_cid, gen_random_uuid(), repeat('a',64),
              v_admin, 'usuario','pendiente','pagado','tamper');
      RAISE EXCEPTION 'FALLO A4d: INSERT directo aceptado';
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
      WHEN OTHERS THEN
        IF SQLSTATE <> '42501' THEN RAISE EXCEPTION 'FALLO A4d: % (%)', SQLERRM, SQLSTATE; END IF;
    END;

    BEGIN
      UPDATE ra_auditoria_estado_pago_compras SET motivo='tamper';
      RAISE EXCEPTION 'FALLO A4e: UPDATE directo aceptado';
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
      WHEN OTHERS THEN
        IF SQLSTATE <> '42501' THEN RAISE EXCEPTION 'FALLO A4e: % (%)', SQLERRM, SQLSTATE; END IF;
    END;

    BEGIN
      DELETE FROM ra_auditoria_estado_pago_compras;
      RAISE EXCEPTION 'FALLO A4f: DELETE directo aceptado';
    EXCEPTION
      WHEN insufficient_privilege THEN NULL;
      WHEN OTHERS THEN
        IF SQLSTATE <> '42501' THEN RAISE EXCEPTION 'FALLO A4f: % (%)', SQLERRM, SQLSTATE; END IF;
    END;

    RESET ROLE;
  END;

  RAISE NOTICE 'OK A: autorizacion + cross-tenant + RLS real autenticada';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION B - Reparacion / replay / conflicto / no-op /
--             rollback conjunto auditoria+estado
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_op uuid; v_cid uuid; v_res jsonb;
  v_repair_op uuid;
  v_total_pen numeric;
  v_estado text; v_aud int; v_aud_antes int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa,'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ORDER BY rp.id LIMIT 1;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
  v_cid := (v_res->'compra'->>'id')::uuid;
  v_total_pen := (v_res->'compra'->>'total_pen')::numeric;

  -- B.0 divergencia REAL: sync INSERT deshabilitado + abono con total_pen
  --     real => ledger pagado, almacenado pendiente.
  ALTER TABLE ra_cuentas_por_pagar_movimientos DISABLE TRIGGER trg_cxp_sync_estado_pago_ins;
  INSERT INTO ra_cuentas_por_pagar_movimientos (
    empresa_id, proveedor_id, compra_id, tipo, monto, fecha, metodo_pago, referencia, usuario_id)
  VALUES (v_empresa, v_prov, v_cid, 'abono', v_total_pen, CURRENT_DATE,
          'efectivo', 'seed-div-b', v_admin);
  ALTER TABLE ra_cuentas_por_pagar_movimientos ENABLE TRIGGER trg_cxp_sync_estado_pago_ins;

  -- B.1 reparacion: operation PROPIO conservado
  v_repair_op := gen_random_uuid();
  v_res := public.ra_recalcular_estado_pago(v_repair_op, v_cid, 'reparacion test B');
  IF (v_res->>'changed') <> 'true' OR (v_res->>'nuevo') <> 'pagado'
     OR (v_res->>'replayed') <> 'false' THEN
    RAISE EXCEPTION 'FALLO B1: %', v_res;
  END IF;
  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_cid;
  IF v_estado <> 'pagado' THEN RAISE EXCEPTION 'FALLO B1: estado=%', v_estado; END IF;
  SELECT count(*) INTO v_aud FROM ra_auditoria_estado_pago_compras WHERE compra_id=v_cid;
  IF v_aud <> 1 THEN RAISE EXCEPTION 'FALLO B1: auditorias=%', v_aud; END IF;

  -- B.2 replay del MISMO repair_op: replayed:true y changed:true REAL,
  --     sin duplicar auditoria.
  v_res := public.ra_recalcular_estado_pago(v_repair_op, v_cid, 'reparacion test B');
  IF (v_res->>'replayed') <> 'true' OR (v_res->>'changed') <> 'true' THEN
    RAISE EXCEPTION 'FALLO B2: replay incorrecto (%)', v_res;
  END IF;
  SELECT count(*) INTO v_aud FROM ra_auditoria_estado_pago_compras WHERE compra_id=v_cid;
  IF v_aud <> 1 THEN RAISE EXCEPTION 'FALLO B2: auditorias=%', v_aud; END IF;

  -- B.3 mismo op, motivo distinto -> conflicto
  BEGIN
    PERFORM public.ra_recalcular_estado_pago(v_repair_op, v_cid, 'motivo alterno');
    RAISE EXCEPTION 'FALLO B3';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_IDEMPOTENCY_CONFLICT%' THEN RAISE EXCEPTION 'FALLO B3: %', SQLERRM; END IF;
  END;

  -- B.4 no-op: coincide -> changed:false, deja auditoria nueva (trazabilidad)
  SELECT count(*) INTO v_aud_antes FROM ra_auditoria_estado_pago_compras WHERE compra_id=v_cid;
  v_res := public.ra_recalcular_estado_pago(gen_random_uuid(), v_cid, 'no-op test');
  IF (v_res->>'changed') <> 'false' OR (v_res->>'replayed') <> 'false' THEN
    RAISE EXCEPTION 'FALLO B4: %', v_res;
  END IF;
  SELECT count(*) INTO v_aud FROM ra_auditoria_estado_pago_compras WHERE compra_id=v_cid;
  IF v_aud <> v_aud_antes + 1 THEN RAISE EXCEPTION 'FALLO B4: no-op sin auditoria'; END IF;

  RAISE NOTICE 'OK B1-B4: reparacion/replay real/conflicto/no-op auditado';
END $$;

-- ===== B5-B6 rollback conjunto via trigger transitorio:
-- la RPC inserta auditoria y LUEGO actualiza estado_pago; el fallo
-- en AFTER UPDATE OF estado_pago demuestra que ambos se revierten. =====
DO $$
DECLARE
    v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
    v_total_pen numeric; v_cid uuid; v_res jsonb; v_c int; v_est text;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa,'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ORDER BY rp.id LIMIT 1;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_res := public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
  v_cid := (v_res->'compra'->>'id')::uuid;
  v_total_pen := (v_res->'compra'->>'total_pen')::numeric;

  -- Divergencia: sync off + abono total
  ALTER TABLE ra_cuentas_por_pagar_movimientos DISABLE TRIGGER trg_cxp_sync_estado_pago_ins;
  INSERT INTO ra_cuentas_por_pagar_movimientos (
    empresa_id, proveedor_id, compra_id, tipo, monto, fecha, metodo_pago, referencia, usuario_id)
  VALUES (v_empresa, v_prov, v_cid, 'abono', v_total_pen, CURRENT_DATE, 'efectivo', 'seed-b6', v_admin);
  ALTER TABLE ra_cuentas_por_pagar_movimientos ENABLE TRIGGER trg_cxp_sync_estado_pago_ins;

  -- Fallo AFTER UPDATE OF estado_pago (la RPC audita primero, actualiza despues)
  CREATE FUNCTION pg_temp.fi_abort_upd() RETURNS trigger
  LANGUAGE plpgsql AS $fi$
  BEGIN
    RAISE EXCEPTION 'FAULT_INJECTION:%', TG_TABLE_NAME;
  END;
  $fi$;
  CREATE TRIGGER fi_upd AFTER UPDATE OF estado_pago ON public.ra_compras
    FOR EACH ROW WHEN (NEW.estado_pago = 'pagado')
    EXECUTE FUNCTION pg_temp.fi_abort_upd();

  DECLARE v_aud_pre int; v_est_pre text;
  BEGIN
    SELECT count(*) INTO v_aud_pre FROM ra_auditoria_estado_pago_compras WHERE compra_id=v_cid;
    SELECT estado_pago::text INTO v_est_pre FROM ra_compras WHERE id=v_cid;

    BEGIN
      PERFORM public.ra_recalcular_estado_pago(gen_random_uuid(), v_cid, 'rollback B6');
      RAISE EXCEPTION 'FALLO B6: FI no disparo';
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%FAULT_INJECTION:%' THEN RAISE EXCEPTION 'FALLO B6: %', SQLERRM; END IF;
    END;

    -- Rollback conjunto: ni auditoria nueva ni estado mutado
    SELECT count(*) INTO v_c FROM ra_auditoria_estado_pago_compras WHERE compra_id=v_cid;
    IF v_c <> v_aud_pre THEN
      RAISE EXCEPTION 'FALLO B6: auditorias residuales (% -> %)', v_aud_pre, v_c;
    END IF;
    SELECT estado_pago::text INTO v_est FROM ra_compras WHERE id=v_cid;
    IF v_est <> v_est_pre THEN RAISE EXCEPTION 'FALLO B6: estado mutado (% -> %)', v_est_pre, v_est; END IF;
  END;

  DROP TRIGGER fi_upd ON public.ra_compras;
  DROP FUNCTION pg_temp.fi_abort_upd();

  RAISE NOTICE 'OK B5/B6: rollback conjunto auditoria+estado verificado';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION D - Backfill idempotente (divergencia sembrada con
--             abono de total_pen real y trigger _ins)
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_op uuid; v_cid uuid; v_res jsonb;
  v_total_pen numeric;
  v_div int; v_aud int; v_aud_antes int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
   WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa,'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ORDER BY rp.id LIMIT 1;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
  v_cid := (v_res->'compra'->>'id')::uuid;
  v_total_pen := (v_res->'compra'->>'total_pen')::numeric;

  -- Sembrar divergencia real: sync _ins off + abono por total_pen real
  ALTER TABLE ra_cuentas_por_pagar_movimientos DISABLE TRIGGER trg_cxp_sync_estado_pago_ins;
  INSERT INTO ra_cuentas_por_pagar_movimientos (
    empresa_id, proveedor_id, compra_id, tipo, monto, fecha, metodo_pago, referencia, usuario_id)
  VALUES (v_empresa, v_prov, v_cid, 'abono', v_total_pen, CURRENT_DATE,
          'efectivo', 'seed-backfill', v_admin);
  ALTER TABLE ra_cuentas_por_pagar_movimientos ENABLE TRIGGER trg_cxp_sync_estado_pago_ins;

  -- Preflight read-only detecta
  SELECT count(*) INTO v_div FROM public.ra_preflight_estado_pago_divergencias();
  IF v_div < 1 THEN RAISE EXCEPTION 'FALLO D1: preflight no detecto divergencia'; END IF;

  -- Backfill (mismo bloque de la migracion)
  WITH divergentes AS (
    SELECT c.id, c.empresa_id, c.estado_pago AS anterior,
           public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen,c.total)) AS nuevo
    FROM ra_compras c
    WHERE c.estado='confirmada'
      AND c.estado_pago IS DISTINCT FROM
          public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen,c.total))
    FOR UPDATE OF c
  ), corregidas AS (
    UPDATE ra_compras c SET estado_pago=d.nuevo FROM divergentes d
     WHERE c.id=d.id
    RETURNING c.id, c.empresa_id, d.anterior, d.nuevo
  )
  INSERT INTO ra_auditoria_estado_pago_compras (
    empresa_id, compra_id, operation_id, request_hash,
    usuario_id, actor_tipo, estado_anterior, estado_nuevo, motivo)
  SELECT r.empresa_id, r.id, md5('043-backfill-' || r.id::text)::uuid,
         encode(sha256(convert_to('backfill:' || r.id::text,'UTF8')),'hex'),
         NULL,'migracion',r.anterior,r.nuevo,
         'backfill 043: divergencia estado_pago vs ledger'
  FROM corregidas r;

  -- Segunda corrida REAL del mismo backfill: debe afectar cero filas
  -- y no crear auditorias nuevas.
  SELECT count(*) INTO v_div FROM public.ra_preflight_estado_pago_divergencias();
  IF v_div <> 0 THEN RAISE EXCEPTION 'FALLO D2: divergencias residuales=%', v_div; END IF;
  SELECT count(*) INTO v_aud_antes FROM ra_auditoria_estado_pago_compras WHERE motivo LIKE 'backfill 043%';
  WITH divergentes AS (
    SELECT c.id, c.empresa_id, c.estado_pago AS anterior,
           public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen,c.total)) AS nuevo
    FROM ra_compras c
    WHERE c.estado='confirmada'
      AND c.estado_pago IS DISTINCT FROM
          public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen,c.total))
    FOR UPDATE OF c
  ), corregidas AS (
    UPDATE ra_compras c SET estado_pago=d.nuevo FROM divergentes d
     WHERE c.id=d.id
    RETURNING c.id, c.empresa_id, d.anterior, d.nuevo
  )
  INSERT INTO ra_auditoria_estado_pago_compras (
    empresa_id, compra_id, operation_id, request_hash,
    usuario_id, actor_tipo, estado_anterior, estado_nuevo, motivo)
  SELECT r.empresa_id, r.id, md5('043-backfill-' || r.id::text)::uuid,
         encode(sha256(convert_to('backfill:' || r.id::text,'UTF8')),'hex'),
         NULL,'migracion',r.anterior,r.nuevo,
         'backfill 043: divergencia estado_pago vs ledger'
  FROM corregidas r;
  GET DIAGNOSTICS v_div = ROW_COUNT;
  IF v_div <> 0 THEN RAISE EXCEPTION 'FALLO D3: segunda corrida afecto % filas', v_div; END IF;
  SELECT count(*) INTO v_aud FROM ra_auditoria_estado_pago_compras WHERE motivo LIKE 'backfill 043%';
  IF v_aud <> v_aud_antes THEN RAISE EXCEPTION 'FALLO D3: auditorias nuevas en segunda corrida'; END IF;

  -- actor_tipo='migracion' con usuario NULL en filas de backfill
  SELECT count(*) INTO v_aud FROM ra_auditoria_estado_pago_compras
   WHERE motivo LIKE 'backfill 043%' AND (actor_tipo <> 'migracion' OR usuario_id IS NOT NULL);
  IF v_aud <> 0 THEN RAISE EXCEPTION 'FALLO D4: filas backfill mal actor'; END IF;

  RAISE NOTICE 'OK D: preflight/backfill/idempotencia/actor migracion';
END $$;
ROLLBACK;

-- ============================================================
-- RESUMEN
-- ============================================================
SELECT '043 TESTS OK' AS resultado;
