-- 024_marcas_tipos_repuesto.sql
-- Agrega Marca de repuesto (fabricante: MONROE, BOSCH, etc - distinta de ra_marcas_auto
-- que es marca de VEHICULO) y Tipo de repuesto (SubSubClase del ERP: pastilla de freno,
-- bujia, filtro de aire, etc), mas tipo_vehiculo (liviano/pesado/agricola, Clase nivel 1
-- del ERP). Tambien desactiva categorias sin uso real (migradas desde el ERP sin filtrar,
-- ~220 de 252 con 0 productos - ver memoria "Taxonomia real del ERP" en el proyecto).
--
-- Backfill de estas columnas: ver sync_marcas_tipos.ps1 (raiz del proyecto, gitignored),
-- corre una sola vez (no es cron como sync_stock.ps1 - esta data es practicamente estatica).

-- ============================================================
-- 1. Limpieza: desactivar categorias sin productos activos
-- ============================================================
UPDATE ra_categorias
SET activo = false
WHERE id NOT IN (
  SELECT DISTINCT categoria_id FROM ra_catalogo_repuestos WHERE activo = true
);

-- ============================================================
-- 2. Marca de repuesto (fabricante)
-- ============================================================
CREATE TABLE ra_marcas_repuesto (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE ra_catalogo_repuestos
  ADD COLUMN marca_repuesto_id UUID REFERENCES ra_marcas_repuesto(id);

CREATE INDEX idx_catalogo_marca_repuesto ON ra_catalogo_repuestos (marca_repuesto_id);

ALTER TABLE ra_marcas_repuesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marcas_repuesto_anon_select" ON ra_marcas_repuesto
  FOR SELECT TO anon USING (true);

CREATE POLICY "marcas_repuesto_select" ON ra_marcas_repuesto
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "marcas_repuesto_mutate" ON ra_marcas_repuesto
  TO authenticated
  USING (
    (SELECT rol FROM ra_perfiles WHERE id = auth.uid())
      = ANY (ARRAY['administrador'::ra_rol, 'superadmin'::ra_rol])
  );

-- ============================================================
-- 3. Tipo de repuesto (SubSubClase ERP: pastilla de freno, bujia, filtro, etc.)
-- ============================================================
CREATE TABLE ra_tipos_repuesto (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE ra_catalogo_repuestos
  ADD COLUMN tipo_repuesto_id UUID REFERENCES ra_tipos_repuesto(id);

CREATE INDEX idx_catalogo_tipo_repuesto ON ra_catalogo_repuestos (tipo_repuesto_id);

ALTER TABLE ra_tipos_repuesto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_repuesto_anon_select" ON ra_tipos_repuesto
  FOR SELECT TO anon USING (true);

CREATE POLICY "tipos_repuesto_select" ON ra_tipos_repuesto
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tipos_repuesto_mutate" ON ra_tipos_repuesto
  TO authenticated
  USING (
    (SELECT rol FROM ra_perfiles WHERE id = auth.uid())
      = ANY (ARRAY['administrador'::ra_rol, 'superadmin'::ra_rol])
  );

-- ============================================================
-- 4. Tipo de vehiculo (Clase nivel 1 del ERP: liviano/pesado/agricola)
-- ============================================================
ALTER TABLE ra_catalogo_repuestos
  ADD COLUMN tipo_vehiculo TEXT
  CHECK (tipo_vehiculo IS NULL OR tipo_vehiculo IN ('liviano', 'pesado', 'agricola'));

CREATE INDEX idx_catalogo_tipo_vehiculo ON ra_catalogo_repuestos (tipo_vehiculo);

-- ============================================================
-- 5. RPC de backfill masivo (usada por sync_marcas_tipos.ps1)
--
-- Recibe un lote de {codigo_interno, marca, tipo_repuesto, tipo_vehiculo} y hace
-- upsert de marca/tipo + UPDATE de ra_catalogo_repuestos en una sola sentencia,
-- en vez de un PATCH por producto (43,609 productos por HTTP uno a uno seria
-- horas; esto es segundos por lote de miles).
--
-- Nota: el join usa ra_productos.codigo_interno, que hoy es unico porque solo
-- existe la empresa Allende. Si en el futuro Sprinter (otra empresa) reutiliza
-- codigos de producto iguales a los de Allende, este join dejaria de ser seguro
-- y habria que filtrar tambien por empresa_id.
-- ============================================================
CREATE OR REPLACE FUNCTION ra_clasificacion_bulk_upsert(items JSONB)
RETURNS TABLE(actualizados INT, marcas_creadas INT, tipos_creados INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marcas_creadas INT := 0;
  v_tipos_creados  INT := 0;
  v_actualizados   INT := 0;
BEGIN
  INSERT INTO ra_marcas_repuesto (nombre)
  SELECT DISTINCT TRIM(item->>'marca')
  FROM jsonb_array_elements(items) AS item
  WHERE NULLIF(TRIM(item->>'marca'), '') IS NOT NULL
  ON CONFLICT (nombre) DO NOTHING;
  GET DIAGNOSTICS v_marcas_creadas = ROW_COUNT;

  INSERT INTO ra_tipos_repuesto (nombre)
  SELECT DISTINCT TRIM(item->>'tipo_repuesto')
  FROM jsonb_array_elements(items) AS item
  WHERE NULLIF(TRIM(item->>'tipo_repuesto'), '') IS NOT NULL
  ON CONFLICT (nombre) DO NOTHING;
  GET DIAGNOSTICS v_tipos_creados = ROW_COUNT;

  WITH datos AS (
    SELECT
      TRIM(item->>'codigo_interno') AS codigo_interno,
      mr.id AS marca_id,
      tr.id AS tipo_id,
      NULLIF(item->>'tipo_vehiculo', '') AS tipo_vehiculo
    FROM jsonb_array_elements(items) AS item
    LEFT JOIN ra_marcas_repuesto mr ON mr.nombre = TRIM(item->>'marca')
    LEFT JOIN ra_tipos_repuesto  tr ON tr.nombre = TRIM(item->>'tipo_repuesto')
  )
  UPDATE ra_catalogo_repuestos c
  SET marca_repuesto_id = datos.marca_id,
      tipo_repuesto_id  = datos.tipo_id,
      tipo_vehiculo     = datos.tipo_vehiculo,
      updated_at        = now()
  FROM ra_productos p
  JOIN datos ON datos.codigo_interno = p.codigo_interno
  WHERE p.catalogo_id = c.id;
  GET DIAGNOSTICS v_actualizados = ROW_COUNT;

  RETURN QUERY SELECT v_actualizados, v_marcas_creadas, v_tipos_creados;
END;
$$;

GRANT EXECUTE ON FUNCTION ra_clasificacion_bulk_upsert(JSONB) TO service_role;
