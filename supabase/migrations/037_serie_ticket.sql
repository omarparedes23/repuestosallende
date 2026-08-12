-- ============================================================
-- MIGRATION 037: Serie de tickets (impresión de tickets POS)
-- Requiere: 004_sunat_campos.sql (ra_siguiente_correlativo,
--           ra_ventas.serie/correlativo/numero_completo,
--           idx_ventas_serie_correlativo)
--
-- Los tickets hoy se insertan con serie = NULL (solo UUID).
-- Esta migración habilita numeración secuencial propia por empresa,
-- replicando el patrón serie_boleta/serie_factura. Aditiva, sin
-- cambios de RLS. Tickets históricos quedan con serie NULL (sin
-- backfill): el RPC ra_siguiente_correlativo ignora filas NULL
-- (WHERE serie = p_serie), así la numeración arranca en T001-00000001.
-- ============================================================

ALTER TABLE ra_empresas
  ADD COLUMN IF NOT EXISTS serie_ticket text DEFAULT 'T001';

UPDATE ra_empresas SET serie_ticket = 'T001'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
