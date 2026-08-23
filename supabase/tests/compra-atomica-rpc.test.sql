-- ============================================================
-- supabase/tests/compra-atomica-rpc.test.sql (rev.3)
-- TDD Fase 2 contra ra_confirmar_compra (042 rev.3)
--
-- REQUIERE: 041 aplicada + 042 aplicada.
-- Ejecutar como postgres en SUPABASE TEST:
--   psql "... user=postgres.axcrubvtpqcyscizgoee ..." \
--     -v ON_ERROR_STOP=1 -f supabase/tests/compra-atomica-rpc.test.sql
--
-- Sesion simulada con set_config(request.jwt.claims, ..., true).
-- Fault injection SOLO con triggers transitorios pg_temp dentro de
-- BEGIN/ROLLBACK (sin hooks permanentes en la RPC).
-- Cada seccion termina en ROLLBACK: cero residuos.
-- ============================================================

\set ON_ERROR_STOP on

-- ============================================================
-- SECCION A - Autorizacion y sucursal
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_vend uuid; v_lect uuid;
  v_empresa uuid; v_prov uuid; v_op uuid; v_res jsonb;
  v_items jsonb; v_cat uuid; v_suc uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT p.id INTO v_vend FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.vendedor.idempotencia@%' AND p.activo LIMIT 1;
  SELECT p.id INTO v_lect FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.lectura.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  v_items := jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10));
  IF v_admin IS NULL OR v_vend IS NULL OR v_lect IS NULL OR v_prov IS NULL OR v_cat IS NULL OR v_suc IS NULL THEN
    RAISE EXCEPTION 'FALLO: fixtures insuficientes';
  END IF;

  -- A.1 sin sesion -> RA_UNAUTHENTICATED
  BEGIN
    v_res := public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A1';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_UNAUTHENTICATED%' THEN RAISE EXCEPTION 'FALLO A1: %', SQLERRM; END IF;
  END;

  -- A.2 vendedor -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_vend)::text, true);
  BEGIN
    v_res := public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A2';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO A2: %', SQLERRM; END IF;
  END;

  -- A.3 lectura -> RA_FORBIDDEN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lect)::text, true);
  BEGIN
    v_res := public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A3';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_FORBIDDEN%' THEN RAISE EXCEPTION 'FALLO A3: %', SQLERRM; END IF;
  END;

  -- A.4 superadmin (rol temporal sobre lectura; H2) -> OK
  UPDATE ra_perfiles SET rol='superadmin' WHERE id=v_lect;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_lect)::text, true);
  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(v_op, v_suc, v_prov, NULL, 'A4', v_items);
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO A4: %', v_res; END IF;

  -- A.5 empresa derivada de auth.uid(), nunca del cliente
  DECLARE v_emp_compra uuid; v_emp_perfil uuid;
  BEGIN
    SELECT empresa_id INTO v_emp_compra FROM ra_compras WHERE operation_id=v_op;
    SELECT empresa_id INTO v_emp_perfil FROM ra_perfiles WHERE id=v_lect;
    IF v_emp_compra <> v_emp_perfil THEN RAISE EXCEPTION 'FALLO A5: empresa incorrecta'; END IF;
  END;

  -- A.6 sucursal requerida
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  BEGIN
    v_res := public.ra_confirmar_compra(gen_random_uuid(), NULL, v_prov, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A6';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_BRANCH_INVALID%' THEN RAISE EXCEPTION 'FALLO A6: %', SQLERRM; END IF;
  END;

  -- A.7 sucursal ajena -> RA_BRANCH_INVALID
  DECLARE v_otra uuid;
  BEGIN
    SELECT s.id INTO v_otra FROM ra_sucursales s WHERE s.empresa_id <> v_empresa LIMIT 1;
    IF v_otra IS NOT NULL THEN
      v_res := public.ra_confirmar_compra(gen_random_uuid(), v_otra, v_prov, NULL, NULL, v_items);
      RAISE EXCEPTION 'FALLO A7: sucursal ajena aceptada';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_BRANCH_INVALID%' THEN RAISE EXCEPTION 'FALLO A7: %', SQLERRM; END IF;
  END;

  -- A.8 sucursal inactiva (se desactiva temporalmente; ROLLBACK restaura)
  DECLARE v_inactiva uuid;
  BEGIN
    SELECT s.id INTO v_inactiva FROM ra_sucursales s
     WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at DESC LIMIT 1;
    UPDATE ra_sucursales SET activo=false WHERE id=v_inactiva;

    v_res := public.ra_confirmar_compra(gen_random_uuid(), v_inactiva, v_prov, NULL, NULL, v_items);
    RAISE EXCEPTION 'FALLO A8: sucursal inactiva aceptada';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_BRANCH_INVALID%' THEN RAISE EXCEPTION 'FALLO A8: %', SQLERRM; END IF;
  END;

  RAISE NOTICE 'OK A: roles + empresa auth.uid() + sucursal requerida/ajena/inactiva';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION B - Exito PEN: credito, contado, parcial, rechazos
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_prod uuid; v_suc uuid;
  v_op uuid; v_res jsonb; v_id uuid;
  v_n int; v_stock int; v_estado text; v_total numeric; v_pen numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.id, rp.catalogo_id INTO v_prod, v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT stock_actual INTO v_stock FROM ra_productos WHERE id=v_prod;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- B.1 credito: 2 x 100 => total 236 / base 236 / pendiente
  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => 'B001-' || gen_random_uuid(), p_notas => 'credito',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 2, 'precio_unitario', 100)));
  v_id := (v_res->'compra'->>'id')::uuid;

  SELECT total, total_pen, estado_pago::text INTO v_total, v_pen, v_estado FROM ra_compras WHERE id=v_id;
  IF v_total <> 236 OR v_pen <> 236 OR v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'FALLO B1: total=% pen=% estado=%', v_total, v_pen, v_estado;
  END IF;
  SELECT count(*) INTO v_n FROM ra_compra_items WHERE compra_id=v_id;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALLO B1 items'; END IF;
  SELECT stock_actual INTO v_n FROM ra_productos WHERE id=v_prod;
  IF v_n <> v_stock + 2 THEN RAISE EXCEPTION 'FALLO B1 stock'; END IF;
  SELECT count(*) INTO v_n FROM ra_kardex WHERE referencia_id=v_id AND tipo='entrada' AND motivo='compra';
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALLO B1 kardex'; END IF;
  SELECT count(*) INTO v_n FROM ra_cuentas_por_pagar_movimientos WHERE compra_id=v_id;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FALLO B1 cxp'; END IF;
  SELECT length(request_hash) INTO v_n FROM ra_compras WHERE id=v_id;
  IF v_n <> 64 THEN RAISE EXCEPTION 'FALLO B1 hash len'; END IF;

  -- B.2 contado: cargo+abono base completo => pagado
  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => 'B002-' || gen_random_uuid(), p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)),
    p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',118,'referencia','r1'));
  v_id := (v_res->'compra'->>'id')::uuid;
  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_id;
  IF v_estado <> 'pagado' THEN RAISE EXCEPTION 'FALLO B2 estado=%', v_estado; END IF;
  SELECT count(*) INTO v_n FROM ra_cuentas_por_pagar_movimientos WHERE compra_id=v_id;
  IF v_n <> 2 THEN RAISE EXCEPTION 'FALLO B2 movimientos=%', v_n; END IF;

  -- B.3 abono parcial => parcial
  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => 'B003-' || gen_random_uuid(), p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)),
    p_abono_inicial => jsonb_build_object('metodoPago','yape','monto',50,'referencia',NULL));
  v_id := (v_res->'compra'->>'id')::uuid;
  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_id;
  IF v_estado <> 'parcial' THEN RAISE EXCEPTION 'FALLO B3 estado=%', v_estado; END IF;

  -- B.4 sobrepago base
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'B004-' || gen_random_uuid(), p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)),
      p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',99999,'referencia',NULL));
    RAISE EXCEPTION 'FALLO B4: sobrepago aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PAYMENT_EXCEEDS_TOTAL%' THEN RAISE EXCEPTION 'FALLO B4: %', SQLERRM; END IF;
  END;

  -- B.5 metodo credito en abono
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'B005-' || gen_random_uuid(), p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)),
      p_abono_inicial => jsonb_build_object('metodoPago','credito','monto',10,'referencia',NULL));
    RAISE EXCEPTION 'FALLO B5: credito aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PAYMENT_METHOD_INVALID%' THEN RAISE EXCEPTION 'FALLO B5: %', SQLERRM; END IF;
  END;

  RAISE NOTICE 'OK B: credito/contado/parcial/sobrepago/metodo';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION C - Replay/conflicto/recuperacion + replay estable ante
--             estados mutables (proveedor desactivado despues)
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_op uuid; v_doc text; v_res jsonb; v_id uuid; v_id2 uuid; v_c int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  v_doc := 'C-' || gen_random_uuid();

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_op := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => v_doc, p_notas => 'original',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 3, 'price_unitario_x', NULL, 'precio_unitario', 10)));
  v_id := (v_res->'compra'->>'id')::uuid;

  -- C.1 replay identico (casing/espacios/mont equivalentes)
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => lower(v_doc) || ' ', p_notas => 'original ',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 3.0, 'precio_unitario', 10.00)));
  IF (COALESCE(v_res->>'replayed','false') <> 'true') OR (v_res->'compra'->>'id')::uuid <> v_id THEN
    RAISE EXCEPTION 'FALLO C1: replay inestable';
  END IF;
  SELECT count(*) INTO v_c FROM ra_compras WHERE operation_id=v_op;
  IF v_c <> 1 THEN RAISE EXCEPTION 'FALLO C1 compras=%', v_c; END IF;

  -- C.2 mismo op, payload distinto -> conflicto
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => v_doc, p_notas => 'original',
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 99, 'precio_unitario', 10)));
    RAISE EXCEPTION 'FALLO C2: conflicto no detectado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_IDEMPOTENCY_CONFLICT%' THEN RAISE EXCEPTION 'FALLO C2: %', SQLERRM; END IF;
  END;

  -- C.3 REPLAY ESTABLE: se desactiva el proveedor y el replay sigue OK
  UPDATE ra_proveedores SET activo=false WHERE id=v_prov;
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => v_doc, p_notas => 'original',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 3, 'precio_unitario', 10)));
  IF (COALESCE(v_res->>'replayed','false') <> 'true') THEN RAISE EXCEPTION 'FALLO C3: replay no tolera proveedor inactivo'; END IF;

  -- C.4 REPLAY ESTABLE ante sucursal desactivada despues de confirmar
  DECLARE v_res2 jsonb;
  BEGIN
    UPDATE ra_sucursales SET activo=false WHERE id=v_suc;
    v_res2 := public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => v_doc, p_notas => 'original',
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 3, 'precio_unitario', 10)));
    IF (COALESCE(v_res2->>'replayed','false') <> 'true') THEN RAISE EXCEPTION 'FALLO C4: replay no tolera sucursal inactiva'; END IF;
  END;

  -- C.5 recuperacion por operation_id
  v_res := public.ra_obtener_resultado_compra(v_op);
  IF (v_res->>'status') <> 'confirmed' THEN RAISE EXCEPTION 'FALLO C5 found'; END IF;
  v_res := public.ra_obtener_resultado_compra(gen_random_uuid());
  IF (v_res->>'status') <> 'not_found' THEN RAISE EXCEPTION 'FALLO C5 not_found'; END IF;

  RAISE NOTICE 'OK C: replay/conflicto/recuperacion + estable ante proveedor y sucursal inactivos';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION D - Unicidad de factura
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_doc text; v_res jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  v_doc := 'DUP-' || gen_random_uuid();

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  PERFORM public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => ' ' || lower(v_doc) || ' ', p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));

  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => upper(v_doc), p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
    RAISE EXCEPTION 'FALLO D1: duplicado aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_INVOICE_DUPLICATE%' THEN RAISE EXCEPTION 'FALLO D1: %', SQLERRM; END IF;
  END;

  -- docs vacios permitidos multiples veces
  PERFORM public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => '   ', p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
  PERFORM public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));

  RAISE NOTICE 'OK D: unicidad factura + vacios permitidos';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION E - Recepcion parcial OC
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_oc uuid; v_res jsonb; v_estado_oc text;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  INSERT INTO ra_ordenes_compra (empresa_id, sucursal_id, proveedor_id, usuario_id, estado)
  VALUES (v_empresa, v_suc, v_prov, v_admin, 'confirmada')
  RETURNING id INTO v_oc;
  INSERT INTO ra_orden_compra_items (orden_compra_id, catalogo_id, nombre_producto, cantidad, precio_unitario, subtotal)
  VALUES (v_oc, v_cat, 'ITEM E2E', 10, 5, 50);

  PERFORM public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'parcial 1',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 4, 'precio_unitario', 5)),
    p_orden_compra_id => v_oc);
  SELECT estado::text INTO v_estado_oc FROM ra_ordenes_compra WHERE id=v_oc;
  IF v_estado_oc <> 'confirmada' THEN RAISE EXCEPTION 'FALLO E1: OC=%', v_estado_oc; END IF;

  PERFORM public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'parcial 2',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 6, 'precio_unitario', 5)),
    p_orden_compra_id => v_oc);
  SELECT estado::text INTO v_estado_oc FROM ra_ordenes_compra WHERE id=v_oc;
  IF v_estado_oc <> 'recibida' THEN RAISE EXCEPTION 'FALLO E2: OC=%', v_estado_oc; END IF;

  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => 'exceso',
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 5)),
      p_orden_compra_id => v_oc);
    RAISE EXCEPTION 'FALLO E3: exceso aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_ORDER_INVALID%' THEN RAISE EXCEPTION 'FALLO E3: %', SQLERRM; END IF;
  END;

  RAISE NOTICE 'OK E: recepcion parcial + cierre + exceso';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION E2 - Recepcion parcial CON replays (tarea 3.5)
-- Dentro de una OC de 5 unidades:
--   R1 (op propio): recibe 2 -> replay de R1 no duplica;
--   R2 (op nuevo): recibe 3 -> OC cerrada -> replay de R2 estable.
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_oc uuid; v_op1 uuid; v_op2 uuid;
  v_res jsonb; v_rec numeric; v_estado_oc text; v_k int; v_rep boolean;
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

  INSERT INTO ra_ordenes_compra (empresa_id, sucursal_id, proveedor_id, usuario_id, estado)
  VALUES (v_empresa, v_suc, v_prov, v_admin, 'confirmada')
  RETURNING id INTO v_oc;
  INSERT INTO ra_orden_compra_items (orden_compra_id, catalogo_id, nombre_producto, cantidad, precio_unitario, subtotal)
  VALUES (v_oc, v_cat, 'ITEM E2', 5, 4, 20);

  -- R1: recibe 2 de 5
  v_op1 := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op1, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'R1',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 2, 'precio_unitario', 4)),
    p_orden_compra_id => v_oc);

  -- Replay de R1: mismo operation_id => replayed:true, sin efectos dobles
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op1, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'R1',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 2, 'precio_unitario', 4)),
    p_orden_compra_id => v_oc);
  v_rep := COALESCE(v_res->>'replayed','false');
  IF v_rep <> 'true' THEN RAISE EXCEPTION 'FALLO E2.1: replay de R1 no marcado (%)', v_res; END IF;

  SELECT cantidad_recibida INTO v_rec FROM ra_orden_compra_items
   WHERE orden_compra_id=v_oc AND catalogo_id=v_cat;
  IF v_rec <> 2 THEN RAISE EXCEPTION 'FALLO E2.1: recibida=% (esperaba 2, replay duplico)', v_rec; END IF;

  -- R2: completa el pendiente (3) con operation NUEVO
  v_op2 := gen_random_uuid();
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op2, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'R2',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 3, 'precio_unitario', 4)),
    p_orden_compra_id => v_oc);
  SELECT estado::text INTO v_estado_oc FROM ra_ordenes_compra WHERE id=v_oc;
  IF v_estado_oc <> 'recibida' THEN RAISE EXCEPTION 'FALLO E2.2: OC=%', v_estado_oc; END IF;

  -- Replay de R2: estable
  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op2, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => 'R2',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 3, 'precio_unitario', 4)),
    p_orden_compra_id => v_oc);
  IF COALESCE(v_res->>'replayed','false') <> 'true' THEN RAISE EXCEPTION 'FALLO E2.3: replay de R2'; END IF;

  -- Cantidades exactas y un solo kardex por recepcion
  SELECT cantidad_recibida INTO v_rec FROM ra_orden_compra_items WHERE orden_compra_id=v_oc;
  IF v_rec <> 5 THEN RAISE EXCEPTION 'FALLO E2.4: recibida=%', v_rec; END IF;
  SELECT count(*) INTO v_k FROM ra_kardex k
   WHERE k.referencia_id IN (SELECT id FROM ra_compras WHERE operation_id IN (v_op1, v_op2));
  IF v_k <> 2 THEN RAISE EXCEPTION 'FALLO E2.4: kardex=%', v_k; END IF;

  RAISE NOTICE 'OK E2: recepciones parciales con replays estables y OC cerrada con cantidades exactas';
END $$;
ROLLBACK;
-- ============================================================
-- SECCION F - Limites y validaciones (overflow/escala/duplicados)
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_items_grande jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- F1: >200 items
  SELECT jsonb_agg(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 1))
    INTO v_items_grande FROM generate_series(1, 201) i;
  BEGIN
    PERFORM public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL, v_items_grande);
    RAISE EXCEPTION 'FALLO F1';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_ITEMS_INVALID%' THEN RAISE EXCEPTION 'FALLO F1: %', SQLERRM; END IF;
  END;

  -- F2: catalogo duplicado en lineas distintas
  BEGIN
    PERFORM public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL,
      jsonb_build_array(
        jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 1),
        jsonb_build_object('catalogo_id', v_cat, 'cantidad', 2, 'precio_unitario', 1)));
    RAISE EXCEPTION 'FALLO F2: catalogo duplicado aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_ITEMS_INVALID%' THEN RAISE EXCEPTION 'FALLO F2: %', SQLERRM; END IF;
  END;

  -- F3: escala de cantidad > 3
  BEGIN
    PERFORM public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL,
      jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 0.0001, 'precio_unitario', 1)));
    RAISE EXCEPTION 'FALLO F3: escala cantidad aceptada';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_ITEMS_INVALID%' THEN RAISE EXCEPTION 'FALLO F3: %', SQLERRM; END IF;
  END;

  -- F4: precio con escala > 2
  BEGIN
    PERFORM public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL,
      jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 1.999)));
    RAISE EXCEPTION 'FALLO F4: escala precio aceptada';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_ITEMS_INVALID%' THEN RAISE EXCEPTION 'FALLO F4: %', SQLERRM; END IF;
  END;

  -- F5: overflow de precio (> numeric(10,2))
  BEGIN
    PERFORM public.ra_confirmar_compra(gen_random_uuid(), v_suc, v_prov, NULL, NULL,
      jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100000000)));
    RAISE EXCEPTION 'FALLO F5: overflow aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_AMOUNT_OVERFLOW%' THEN RAISE EXCEPTION 'FALLO F5: %', SQLERRM; END IF;
  END;

  -- F6: USD sin tipo de cambio
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 1)),
      p_moneda => 'USD');
    RAISE EXCEPTION 'FALLO F6: USD sin tc';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_CURRENCY_INVALID%' THEN RAISE EXCEPTION 'FALLO F6: %', SQLERRM; END IF;
  END;

  -- F7: tc con escala > 4
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 1)),
      p_moneda => 'USD', p_tipo_cambio => 3.712345);
    RAISE EXCEPTION 'FALLO F7: tc escala aceptada';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_CURRENCY_INVALID%' THEN RAISE EXCEPTION 'FALLO F7: %', SQLERRM; END IF;
  END;

  -- F8: notas > 500
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => repeat('x', 501),
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 1)));
    RAISE EXCEPTION 'FALLO F8: notas largas';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_ITEMS_INVALID%' THEN RAISE EXCEPTION 'FALLO F8: %', SQLERRM; END IF;
  END;

  -- F9: referencia > 120 (rechazo, no truncado)
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)),
      p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',50,'referencia',repeat('r',121)));
    RAISE EXCEPTION 'FALLO F9: referencia larga truncada/aceptada';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PAYMENT_REFERENCE_TOO_LONG%' THEN RAISE EXCEPTION 'FALLO F9: %', SQLERRM; END IF;
  END;

  -- F10: abono monto no numerico -> RA_PAYMENT_AMOUNT_INVALID
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)),
      p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto','abc','referencia',NULL));
    RAISE EXCEPTION 'FALLO F10: abono no numerico aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PAYMENT_AMOUNT_INVALID%' THEN RAISE EXCEPTION 'FALLO F10: %', SQLERRM; END IF;
  END;

  -- F11: abono con escala > 2
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)),
      p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',10.555,'referencia',NULL));
    RAISE EXCEPTION 'FALLO F11: abono escala aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PAYMENT_AMOUNT_INVALID%' THEN RAISE EXCEPTION 'FALLO F11: %', SQLERRM; END IF;
  END;

  RAISE NOTICE 'OK F: limites/escalas/overflow/duplicados/referencia/abonos';

  -- ===== F12: overflow detectado ANTES de cualquier efecto =====
  DECLARE v_op uuid := gen_random_uuid(); v_c int;
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 99999.999, 'precio_unitario', 99999)));
    RAISE EXCEPTION 'FALLO F12: overflow total aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF split_part(SQLERRM, ':', 1) <> 'RA_AMOUNT_OVERFLOW' THEN
      RAISE EXCEPTION 'FALLO F12: codigo inesperado (%)', SQLERRM;
    END IF;
    SELECT count(*) INTO v_c FROM ra_compras WHERE operation_id=v_op;
    IF v_c <> 0 THEN RAISE EXCEPTION 'FALLO F12: efectos residuales'; END IF;
  END;

  -- ===== F13: costo PEN convertido fuera de rango (USD) =====
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 30000000)),
      p_moneda => 'USD', p_tipo_cambio => 3.7);
    RAISE EXCEPTION 'FALLO F13: costo PEN fuera de rango aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_AMOUNT_OVERFLOW%' THEN RAISE EXCEPTION 'FALLO F13: %', SQLERRM; END IF;
  END;

  -- ===== F14: catalogo inexistente -> RA_PRODUCT_INVALID sin efectos =====
  DECLARE v_op uuid := gen_random_uuid(); v_c int;
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', gen_random_uuid(), 'cantidad', 1, 'precio_unitario', 10)));
    RAISE EXCEPTION 'FALLO F14: catalogo inexistente aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_PRODUCT_INVALID%' THEN RAISE EXCEPTION 'FALLO F14: %', SQLERRM; END IF;
    SELECT count(*) INTO v_c FROM ra_compras WHERE operation_id=v_op;
    IF v_c <> 0 THEN RAISE EXCEPTION 'FALLO F14: efectos residuales'; END IF;
  END;

  -- ===== F15: saldo del proveedor cercano al maximo =====
  DECLARE v_saldo numeric; v_op uuid := gen_random_uuid();
  BEGIN
    SELECT saldo_deudor INTO v_saldo FROM ra_proveedores WHERE id=v_prov FOR UPDATE;
    UPDATE ra_proveedores SET saldo_deudor = 99999999.99 WHERE id=v_prov;

    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => NULL, p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 100)));
    RAISE EXCEPTION 'FALLO F15: overflow de saldo aceptado';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%RA_AMOUNT_OVERFLOW%' THEN RAISE EXCEPTION 'FALLO F15: %', SQLERRM; END IF;
  END;

  RAISE NOTICE 'OK F+: overflow temprano/costo PEN/catalogo inexistente/saldo maximo';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION G - Multimoneda: USD con base PEN, sin mezcla de monedas
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_prod uuid;
  v_cat_usd uuid; v_suc uuid; v_res jsonb; v_id uuid;
  v_pen numeric; v_estado text; v_precio_compra numeric;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.id, rp.catalogo_id, rp.precio_compra INTO v_prod, v_cat_usd, v_precio_compra
   FROM ra_productos rp WHERE rp.empresa_id=v_empresa ORDER BY rp.id LIMIT 1;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- G.1 USD: 100 x tc 3.7 => total original 118 USD, base PEN 436.60
  v_res := public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => 'USD-' || gen_random_uuid(), p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat_usd, 'cantidad', 1, 'precio_unitario', 100)),
    p_moneda => 'USD', p_tipo_cambio => 3.7);
  v_id := (v_res->'compra'->>'id')::uuid;

  SELECT total_pen, estado_pago::text INTO v_pen, v_estado FROM ra_compras WHERE id=v_id;
  IF v_pen <> 436.60 OR v_estado <> 'pendiente' THEN
    RAISE EXCEPTION 'FALLO G1: pen=% estado=%', v_pen, v_estado;
  END IF;

  -- Cargo CxP en PEN base (no 118)
  SELECT monto INTO v_pen FROM ra_cuentas_por_pagar_movimientos WHERE compra_id=v_id AND tipo='cargo';
  IF v_pen <> 436.60 THEN RAISE EXCEPTION 'FALLO G1: cargo=% (esperaba base 436.60)', v_pen; END IF;

  -- Costeo en PEN: nuevo precio_compra = promedio ponderado con precio PEN 370.
  -- Estado previo reconstruido desde el kardex de la propia compra
  -- (stock_anterior) y el precio capturado antes de la llamada.
  DECLARE
    v_pa_old numeric := COALESCE(v_precio_compra, 0);
    v_s0 numeric;
    v_nuevo numeric;
    v_esperado numeric;
  BEGIN
    SELECT stock_anterior INTO v_s0 FROM ra_kardex
     WHERE referencia_id=v_id AND tipo='entrada' AND motivo='compra' LIMIT 1;

    v_esperado := ROUND((v_s0 * v_pa_old + 1 * 370) / NULLIF(v_s0 + 1, 0), 2);

    SELECT precio_compra INTO v_nuevo FROM ra_productos WHERE id=v_prod;
    IF v_nuevo IS DISTINCT FROM v_esperado THEN
      RAISE EXCEPTION 'FALLO G1: costeo no convertido a PEN (% esperaba %)', v_nuevo, v_esperado;
    END IF;
  END;

  -- G.2 abono inicial en BASE PEN sobre compra USD => pagado
  v_res := public.ra_confirmar_compra(
    p_operation_id => gen_random_uuid(), p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => 'USD-' || gen_random_uuid(), p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat_usd, 'cantidad', 1, 'precio_unitario', 100)),
    p_moneda => 'USD', p_tipo_cambio => 3.7,
    p_abono_inicial => jsonb_build_object('metodoPago','transferencia','monto',436.60,'referencia','base'));
  v_id := (v_res->'compra'->>'id')::uuid;
  SELECT estado_pago::text INTO v_estado FROM ra_compras WHERE id=v_id;
  IF v_estado <> 'pagado' THEN
    RAISE EXCEPTION 'FALLO G2: abono base no cerro la compra USD (%), mezcla de monedas', v_estado;
  END IF;

  -- G.3 replay de compra USD con mismo payload => estable (hash con tc)
  DECLARE v_op uuid := gen_random_uuid(); r2 jsonb; r3 jsonb;
  BEGIN
    r2 := public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'USD-REPLAY', p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat_usd, 'cantidad', 2, 'precio_unitario', 50)),
      p_moneda => 'USD', p_tipo_cambio => 3.70);
    r3 := public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'usd-replay ', p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat_usd, 'cantidad', 2.0, 'precio_unitario', 50.0)),
      p_moneda => 'usd ', p_tipo_cambio => 3.7);
    IF (COALESCE(r3->>'replayed','false') <> 'true') THEN
      RAISE EXCEPTION 'FALLO G3: hash USD inestable ante equivalentes numericos';
    END IF;
  END;

  RAISE NOTICE 'OK G: USD->PEN base consistente (cargo/costeo/estado) y hash multimoneda';
END $$;
ROLLBACK;

-- ============================================================
-- SECCION H - Fault injection SIN hooks permanentes.
-- La funcion transitoria vive en pg_temp y se crea FUERA del DO
-- con delimitador $fi$ para no romper el dollar-quoting. Los
-- triggers son DDL de la transaccion: ROLLBACK los elimina.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace
             AND proname IN ('ra_hay_fault_punto')) THEN
    RAISE EXCEPTION 'FALLO H0: hook desplegable prohibido existe';
  END IF;
  RAISE NOTICE 'OK H0: sin hooks permanentes de fault injection';
END $$;

BEGIN;

CREATE FUNCTION pg_temp.fi_abort() RETURNS trigger
LANGUAGE plpgsql
AS $fi$
BEGIN
  RAISE EXCEPTION 'FAULT_INJECTION:%', TG_TABLE_NAME;
END;
$fi$;

-- ===== punto after_header: primer insert en items =====
CREATE TRIGGER fi_after_header AFTER INSERT ON public.ra_compra_items
  FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.fi_abort();

DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid; v_op uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_op := gen_random_uuid();
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'FI-HDR-' || gen_random_uuid(), p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
    RAISE EXCEPTION 'FALLO H1: FI no disparo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%FAULT_INJECTION:%' THEN RAISE EXCEPTION 'FALLO H1: %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'OK H1 after_header';
END $$;
DROP TRIGGER fi_after_header ON public.ra_compra_items;

-- ===== punto after_items: primer kardex =====
CREATE TRIGGER fi_after_items AFTER INSERT ON public.ra_kardex
  FOR EACH STATEMENT EXECUTE FUNCTION pg_temp.fi_abort();

DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid; v_op uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_op := gen_random_uuid();
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'FI-ITM-' || gen_random_uuid(), p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
    RAISE EXCEPTION 'FALLO H2: FI no disparo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%FAULT_INJECTION:%' THEN RAISE EXCEPTION 'FALLO H2: %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'OK H2 after_items';
END $$;
DROP TRIGGER fi_after_items ON public.ra_kardex;

-- ===== punto after_stock_kardex: update de totales =====
CREATE TRIGGER fi_totals BEFORE UPDATE OF subtotal ON public.ra_compras
  FOR EACH ROW WHEN (NEW.total IS DISTINCT FROM OLD.total)
  EXECUTE FUNCTION pg_temp.fi_abort();

DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid; v_op uuid;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  v_op := gen_random_uuid();
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'FI-TOT-' || gen_random_uuid(), p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)));
    RAISE EXCEPTION 'FALLO H3: FI no disparo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%FAULT_INJECTION:%' THEN RAISE EXCEPTION 'FALLO H3: %', SQLERRM; END IF;
  END;
  RAISE NOTICE 'OK H3 after_stock_kardex';
END $$;
DROP TRIGGER fi_totals ON public.ra_compras;

-- ===== puntos after_cargo / after_abono =====
CREATE TRIGGER fi_abono BEFORE INSERT ON public.ra_cuentas_por_pagar_movimientos
  FOR EACH ROW WHEN (NEW.tipo = 'abono') EXECUTE FUNCTION pg_temp.fi_abort();

DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_prod uuid; v_suc uuid;
  v_stock int; v_op uuid; v_c int;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.id, rp.catalogo_id INTO v_prod, v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;
  SELECT stock_actual INTO v_stock FROM ra_productos WHERE id=v_prod;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- after_cargo: abono intentado => cargo ya insertado
  v_op := gen_random_uuid();
  BEGIN
    PERFORM public.ra_confirmar_compra(
      p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
      p_nro_documento => 'FI-CGO-' || gen_random_uuid(), p_notas => NULL,
      p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 10)),
      p_abono_inicial => jsonb_build_object('metodoPago','efectivo','monto',11.8,'referencia',NULL));
    RAISE EXCEPTION 'FALLO H4: FI no disparo';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%FAULT_INJECTION:%' THEN RAISE EXCEPTION 'FALLO H4: %', SQLERRM; END IF;
  END;

  -- Rollback total verificado para TODOS los puntos FI-*
  SELECT count(*) INTO v_c FROM ra_compras WHERE nro_documento LIKE 'FI-%';
  IF v_c <> 0 THEN RAISE EXCEPTION 'FALLO H: compras residuales=%', v_c; END IF;
  SELECT count(*) INTO v_c FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id
   WHERE c.nro_documento LIKE 'FI-%';
  IF v_c <> 0 THEN RAISE EXCEPTION 'FALLO H: kardex residual'; END IF;
  SELECT count(*) INTO v_c FROM ra_cuentas_por_pagar_movimientos m JOIN ra_compras c ON c.id=m.compra_id
   WHERE c.nro_documento LIKE 'FI-%';
  IF v_c <> 0 THEN RAISE EXCEPTION 'FALLO H: cxp residual'; END IF;
  SELECT stock_actual INTO v_c FROM ra_productos WHERE id=v_prod;
  IF v_c <> v_stock THEN RAISE EXCEPTION 'FALLO H: stock alterado'; END IF;

  DROP TRIGGER fi_abono ON public.ra_cuentas_por_pagar_movimientos;
  RAISE NOTICE 'OK H4/H5: fault injection transient + rollback total verificado';
END $$;

ROLLBACK; -- elimina los triggers transitorios (la funcion pg_temp muere con la sesion)
-- ============================================================
-- SECCION I - Equivalencia numerica canonica 1 / 1.0 / 1.00
-- (mismo operation_id, representaciones distintas -> replay)
-- ============================================================
BEGIN;
DO $$
DECLARE
  v_admin uuid; v_empresa uuid; v_prov uuid; v_cat uuid; v_suc uuid;
  v_op uuid; v_res jsonb; r3 jsonb;
BEGIN
  SELECT p.id INTO v_admin FROM ra_perfiles p JOIN auth.users u ON u.id = p.id WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo LIMIT 1;
  SELECT empresa_id INTO v_empresa FROM ra_perfiles WHERE id=v_admin;
  SELECT p.id INTO v_prov FROM ra_proveedores p WHERE p.empresa_id=v_empresa ORDER BY p.id LIMIT 1;
  IF v_prov IS NULL THEN
    INSERT INTO ra_proveedores (empresa_id, nombre) VALUES (v_empresa, 'PROV-TEST') RETURNING id INTO v_prov;
  END IF;
  SELECT rp.catalogo_id INTO v_cat FROM ra_productos rp WHERE rp.empresa_id=v_empresa ;
  SELECT s.id INTO v_suc FROM ra_sucursales s WHERE s.empresa_id=v_empresa AND s.activo ORDER BY s.created_at LIMIT 1;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);
  v_op := gen_random_uuid();

  v_res := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => NULL,
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat, 'cantidad', 1, 'precio_unitario', 5)),
    p_tipo_cambio => NULL);

  r3 := public.ra_confirmar_compra(
    p_operation_id => v_op, p_sucursal_id => v_suc, p_proveedor_id => v_prov,
    p_nro_documento => NULL, p_notas => '',
    p_items => jsonb_build_array(jsonb_build_object('catalogo_id', v_cat::text, 'cantidad', 1.0, 'precio_unitario', 5.00)));

  IF (COALESCE(r3->>'replayed','false') <> 'true') THEN
    RAISE EXCEPTION 'FALLO I: 1 vs 1.0/1.00 produjo hash distinto';
  END IF;

  RAISE NOTICE 'OK I: equivalencia numerica canonica';
END $$;
ROLLBACK;

-- ============================================================
-- RESUMEN
-- ============================================================
SELECT 'RPC TESTS OK' AS resultado;
