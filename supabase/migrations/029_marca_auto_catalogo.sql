-- 029_marca_auto_catalogo.sql
-- Agrega marca de vehiculo al catalogo de repuestos, poblada desde el campo libre
-- Producto2.CA02 del ERP (~90% de cobertura, ver backfill_marcas_auto.ps1). No es
-- compatibilidad por modelo/anio (eso vive en ra_compatibilidades, casi vacia,
-- solo Sprinter via backfill manual) - es una asociacion simple producto -> marca
-- de vehiculo, mismo nivel que marca_repuesto_id, para poder filtrar el catalogo
-- en /panel/articulos sin prometer precision de modelo/anio que el ERP no tiene.

ALTER TABLE ra_catalogo_repuestos
  ADD COLUMN IF NOT EXISTS marca_auto_id UUID REFERENCES ra_marcas_auto(id);

CREATE INDEX IF NOT EXISTS idx_catalogo_marca_auto ON ra_catalogo_repuestos(marca_auto_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ra_marcas_auto_nombre_key'
  ) THEN
    ALTER TABLE ra_marcas_auto ADD CONSTRAINT ra_marcas_auto_nombre_key UNIQUE (nombre);
  END IF;
END $$;
