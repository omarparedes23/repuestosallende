-- 031_drop_precio_mayorista.sql
-- Elimina precio_mayorista: se retira el concepto de tipo de venta (minorista/mayorista),
-- queda un unico precio de venta. Verificado en produccion de test: 0 filas con valor.

ALTER TABLE ra_productos
  DROP COLUMN IF EXISTS precio_mayorista;
