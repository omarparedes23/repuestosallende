-- 015_productos_moneda.sql
-- Agrega columna moneda a ra_productos para distinguir precios en USD vs soles

ALTER TABLE ra_productos
  ADD COLUMN IF NOT EXISTS moneda CHAR(3) NOT NULL DEFAULT 'PEN';
