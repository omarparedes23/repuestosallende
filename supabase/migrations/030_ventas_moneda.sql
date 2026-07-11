-- 030_ventas_moneda.sql
-- Agrega moneda y tipo_cambio a ra_ventas para soportar facturacion multimoneda (PEN/USD).
-- Aditivo: DEFAULT 'PEN' clasifica correctamente las ventas historicas, tipo_cambio queda NULL en ellas.

ALTER TABLE ra_ventas
  ADD COLUMN IF NOT EXISTS moneda CHAR(3) NOT NULL DEFAULT 'PEN';

ALTER TABLE ra_ventas
  ADD CONSTRAINT ra_ventas_moneda_check CHECK (moneda IN ('PEN', 'USD'));

ALTER TABLE ra_ventas
  ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(10,4);

ALTER TABLE ra_ventas
  ADD CONSTRAINT ra_ventas_tipo_cambio_check CHECK (tipo_cambio IS NULL OR tipo_cambio > 0);
