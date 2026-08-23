-- ============================================================
-- supabase/tests/compra-atomica-fase5-cleanup.sql
-- Fase 5 - Limpieza EXCLUSIVA de fixtures etiquetados F5E2E.
--
-- Uso:
--   psql "<conn>" -v ON_ERROR_STOP=1 \
--     -v R1=<id1> -v R2=<id2> ... \
--     -f supabase/tests/compra-atomica-fase5-cleanup.sql
--
-- Orden FK-safe: auditorias -> cxp -> kardex -> compras (items en
-- cascada) -> OC (items en cascada) -> proveedores -> usuarios ->
-- empresas. Reporta lo que quede.
-- ============================================================

\set ON_ERROR_STOP on

CREATE TEMP TABLE _f5_runs (run text);
INSERT INTO _f5_runs VALUES (:'R1'), (:'R2'), (:'R3'), (:'R4'), (:'R5'), (:'R6');

CREATE TEMP TABLE _f5_compras AS
SELECT c.id FROM ra_compras c
 WHERE EXISTS (
   SELECT 1 FROM _f5_runs r
    WHERE c.notas LIKE 'F5E2E:' || r.run || '%')
   -- la tabla de auditoria es APPEND-ONLY (RA_AUDIT_IMMUTABLE) y su FK
   -- hacia ra_compras es ON DELETE RESTRICT: la compra auditada por la
   -- reparacion S9 NO puede eliminarse. Se excluye y se documenta.
   AND NOT EXISTS (
   SELECT 1 FROM ra_auditoria_estado_pago_compras a
    WHERE a.compra_id = c.id);

CREATE TEMP TABLE _f5_audited AS
SELECT c.id AS compra_id, c.notas FROM ra_compras c
 WHERE EXISTS (
   SELECT 1 FROM _f5_runs r
    WHERE c.notas LIKE 'F5E2E:' || r.run || '%')
   AND EXISTS (
   SELECT 1 FROM ra_auditoria_estado_pago_compras a
    WHERE a.compra_id = c.id);

BEGIN;

-- 1. movimientos de cuenta por pagar (compras eliminables)
DELETE FROM ra_cuentas_por_pagar_movimientos m
 USING _f5_compras t WHERE m.compra_id = t.id;

-- 2. kardex de entradas por compra
DELETE FROM ra_kardex k
 USING _f5_compras t
WHERE k.referencia_id = t.id AND k.tipo='entrada';

-- 3. compras (ra_compra_items en cascada)
DELETE FROM ra_compras c USING _f5_compras t WHERE c.id = t.id;

-- 4. ordenes de compra del run (items en cascada)
DELETE FROM ra_ordenes_compra o
 USING _f5_runs r WHERE o.referencia LIKE 'F5E2E:' || r.run || '%';

-- 5. proveedores SIN movimientos restantes (la compra conservada retiene
--    su proveedor via FK RESTRICT de los movimientos no eliminables)
DELETE FROM ra_proveedores p
 USING _f5_runs r
WHERE p.nombre LIKE 'F5E2E:' || r.run || ':PROV'
  AND NOT EXISTS (
        SELECT 1 FROM ra_cuentas_por_pagar_movimientos m
         WHERE m.proveedor_id = p.id);

-- 6. usuario cross-tenant (perfil en cascada por FK)
DELETE FROM auth.users u
 USING _f5_runs r WHERE u.email LIKE 'fase5e2e+' || r.run || '@%';

-- 7. empresa cross-tenant del run
DELETE FROM ra_empresas e
 USING _f5_runs r WHERE e.slug LIKE 'f5e2e-' || left(r.run,12) || '%';

COMMIT;

-- ============================================================
-- Reporte final: eliminables restantes deben ser 0;
-- _f5_audited conserva la cadena intencional de la compra auditada.
-- ============================================================
SELECT 'auditorias'  AS tabla, count(*) FROM ra_auditoria_estado_pago_compras WHERE motivo LIKE 'F5E2E%' OR motivo LIKE 'f5e2e-proyeccion-%'
UNION ALL
SELECT 'cxp_movs', count(*) FROM ra_cuentas_por_pagar_movimientos m JOIN ra_compras c ON c.id=m.compra_id WHERE c.notas LIKE 'F5E2E:%'
UNION ALL
SELECT 'kardex', count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id WHERE c.notas LIKE 'F5E2E:%'
UNION ALL
SELECT 'compra_items', count(*) FROM ra_compra_items i JOIN ra_compras c ON c.id=i.compra_id WHERE c.notas LIKE 'F5E2E:%'
UNION ALL
SELECT 'compras', count(*) FROM ra_compras WHERE notas LIKE 'F5E2E:%'
UNION ALL
SELECT 'oc_items', count(*) FROM ra_orden_compra_items i JOIN ra_ordenes_compra o ON o.id=i.orden_compra_id WHERE o.referencia LIKE 'F5E2E:%'
UNION ALL
SELECT 'ordenes_compra', count(*) FROM ra_ordenes_compra WHERE referencia LIKE 'F5E2E:%'
UNION ALL
SELECT 'proveedores', count(*) FROM ra_proveedores WHERE nombre LIKE 'F5E2E:%'
UNION ALL
SELECT 'usuarios_f5', count(*) FROM auth.users WHERE email LIKE 'fase5e2e+%'
UNION ALL
SELECT 'empresas_f5', count(*) FROM ra_empresas WHERE nombre LIKE 'F5E2E:%';

\echo '=== COMPRA(S) AUDITADA(S) CONSERVADAS INTENCIONALMENTE ==='
TABLE _f5_audited;
