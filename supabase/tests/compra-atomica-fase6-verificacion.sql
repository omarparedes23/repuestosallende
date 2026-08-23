-- ============================================================
-- Fase 6 - verificación READ-ONLY de objetos 041–044 en Supabase TEST.
-- Solo SELECT/pg_catalog. Cero escrituras.
-- ============================================================
\set ON_ERROR_STOP on
\pset pager off

\echo '=== 1. LEDGER: migraciones registradas ==='
SELECT version, name FROM supabase_migrations.schema_migrations
 WHERE version IN ('041','042','043','044') ORDER BY version;

\echo '=== 2. COLUMNAS nuevas en ra_compras (041) ==='
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name='ra_compras'
   AND column_name IN ('operation_id','request_hash','tipo_documento','nro_doc_norm','total_pen')
 ORDER BY column_name;

\echo '=== 3. ÍNDICES únicos críticos ==='
SELECT i.indexname, x.indisunique::text AS es_unico
  FROM pg_indexes i
  JOIN pg_class c ON c.relname=i.indexname
  JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
  JOIN pg_index x ON x.indexrelid=c.oid
 WHERE i.indexname IN ('idx_compras_operation_id','uq_compras_factura_proveedor')
 ORDER BY indexname;

\echo '=== 4. RLS habilitado y políticas (tablas del change) ==='
SELECT c.relname, c.relrowsecurity AS rls_on,
       (SELECT count(*) FROM pg_policies p
         WHERE p.schemaname='public' AND p.tablename=c.relname) AS politicas
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public'
   AND c.relname IN ('ra_compras','ra_compra_items','ra_auditoria_estado_pago_compras',
                     'ra_ordenes_compra','ra_orden_compra_items','ra_cuentas_por_pagar_movimientos')
 ORDER BY c.relname;

\echo '=== 5. GRANTS directos a anon sobre tablas nuevas (debe ser 0 filas) ==='
SELECT DISTINCT grantee, table_name
  FROM information_schema.role_table_grants
 WHERE table_schema='public'
   AND grantee IN ('anon','PUBLIC')
   AND table_name IN ('ra_auditoria_estado_pago_compras');

\echo '=== 6. RPCs del change: SECURITY DEFINER / search_path / volatile ==='
SELECT p.proname, p.prosecdef AS definer,
       COALESCE((SELECT cfg FROM unnest(COALESCE(p.proconfig,'{}')) AS o(cfg)
                  WHERE cfg ILIKE 'search_path=%'), '(SIN FIJAR)') AS search_path
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname IN ('ra_confirmar_compra','ra_obtener_resultado_compra',
                     'ra_recalcular_estado_pago','ra_registrar_compra')
 ORDER BY p.proname;

\echo '=== 7. EXECUTE público revocado en RPCs (todas deben listar NO para anon/PUBLIC) ==='
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_ejecuta,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ejecuta
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname IN ('ra_confirmar_compra','ra_obtener_resultado_compra',
                     'ra_recalcular_estado_pago','ra_registrar_compra',
                     'ra_error_compra','ra_sync_estado_pago_compras')
 ORDER BY p.proname;

\echo '=== 8. Comentario de deprecación 044 ==='
SELECT obj_description(p.oid,'pg_proc') IS NOT NULL AS comentario_deprecated_presente
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.proname='ra_registrar_compra';

\echo '=== 9. ADVISOR-equivalente seguridad: SECURITY DEFINER sin search_path fijado ==='
SELECT p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prosecdef
   AND NOT EXISTS (
        SELECT 1 FROM unnest(COALESCE(p.proconfig,'{}')) AS o(cfg)
         WHERE cfg ILIKE 'search_path=%')
 ORDER BY 1;

\echo '=== 10. Tablas expuestas sin RLS (advisor seguridad; debe ser vacío) ==='
SELECT c.relname
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity
   AND EXISTS (SELECT 1 FROM information_schema.role_table_grants g
                WHERE g.table_schema='public' AND g.table_name=c.relname
                  AND g.grantee IN ('anon','authenticated'))
 ORDER BY 1;
