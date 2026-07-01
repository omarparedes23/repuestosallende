-- 018_productos_precio_dolar.sql
-- Separa precio_venta en dos columnas explicitas: precio_venta (soles) y precio_venta_dolar.
-- Los productos con moneda='USD' tenian su precio en USD guardado (por error historico) en precio_venta.
-- Se mueve ese valor a precio_venta_dolar y se limpia precio_venta (no hay precio real en soles para ellos).

ALTER TABLE ra_productos
  ADD COLUMN IF NOT EXISTS precio_venta_dolar numeric(10,2);

UPDATE ra_productos
SET precio_venta_dolar = precio_venta,
    precio_venta = NULL
WHERE moneda = 'USD';
