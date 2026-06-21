-- ============================================================
-- 004_sunat_campos.sql
-- Campos SUNAT en ra_ventas y ra_empresas
-- ============================================================

-- 1. Nuevo valor en enum ra_estado_venta
ALTER TYPE ra_estado_venta ADD VALUE IF NOT EXISTS 'error_sunat';

-- 2. Campos de facturación en ra_empresas
ALTER TABLE ra_empresas
  ADD COLUMN IF NOT EXISTS ruc           text,
  ADD COLUMN IF NOT EXISTS razon_social  text,
  ADD COLUMN IF NOT EXISTS serie_boleta  text DEFAULT 'B001',
  ADD COLUMN IF NOT EXISTS serie_factura text DEFAULT 'F001';

-- Poblar empresa existente
UPDATE ra_empresas SET
  ruc          = '20101066992',
  razon_social = 'Repuestos Allende S.A.C.',
  serie_boleta = 'B001',
  serie_factura = 'F001'
WHERE id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- 3. Campos SUNAT en ra_ventas
ALTER TABLE ra_ventas
  ADD COLUMN IF NOT EXISTS serie            text,
  ADD COLUMN IF NOT EXISTS correlativo      integer,
  ADD COLUMN IF NOT EXISTS numero_completo  text GENERATED ALWAYS AS (
    CASE WHEN serie IS NOT NULL AND correlativo IS NOT NULL
    THEN serie || '-' || LPAD(correlativo::text, 8, '0')
    ELSE NULL END
  ) STORED,
  ADD COLUMN IF NOT EXISTS fecha_emision    date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS sunat_estado     text,
  ADD COLUMN IF NOT EXISTS sunat_hash       text,
  ADD COLUMN IF NOT EXISTS id_externo       text,
  ADD COLUMN IF NOT EXISTS pdf_url          text,
  ADD COLUMN IF NOT EXISTS xml_url          text;

-- 4. Índice único para evitar correlativos duplicados por empresa y serie
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_serie_correlativo
  ON ra_ventas (empresa_id, serie, correlativo)
  WHERE serie IS NOT NULL AND correlativo IS NOT NULL;

-- 5. Función atómica para obtener el siguiente correlativo
--    Usa advisory lock por empresa+serie para evitar race conditions
CREATE OR REPLACE FUNCTION ra_siguiente_correlativo(p_empresa_id uuid, p_serie text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_empresa_id::text || p_serie));
  SELECT COALESCE(MAX(correlativo), 0) + 1
  INTO v_n
  FROM ra_ventas
  WHERE empresa_id = p_empresa_id AND serie = p_serie;
  RETURN v_n;
END;
$$;
