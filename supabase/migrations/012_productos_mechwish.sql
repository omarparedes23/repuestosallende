-- 012_productos_mechwish.sql
-- Carga los 71 productos MECHWISH a ra_productos de Repuestos Allende (datos de test)

DO $$
DECLARE
  emp UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  suc UUID := 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
  precio NUMERIC(10,2);
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, descripcion
    FROM ra_catalogo_repuestos
    WHERE descripcion LIKE 'MECHWISH%'
      AND NOT EXISTS (
        SELECT 1 FROM ra_productos p
        WHERE p.catalogo_id = ra_catalogo_repuestos.id
          AND p.empresa_id = emp
      )
  LOOP
    -- Extraer precio despues de 'S/ '
    precio := REPLACE(
      SPLIT_PART(rec.descripcion, 'S/ ', 2),
      ',', ''
    )::NUMERIC(10,2);

    INSERT INTO ra_productos (
      empresa_id, sucursal_id, catalogo_id,
      precio_venta, precio_compra, precio_mayorista,
      stock_actual, stock_minimo
    ) VALUES (
      emp, suc, rec.id,
      precio,
      ROUND(precio * 0.70, 2),
      ROUND(precio * 0.90, 2),
      FLOOR(RANDOM() * 16 + 5),
      2
    );
  END LOOP;
END $$;
