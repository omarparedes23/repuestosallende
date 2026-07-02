-- 028_sinonimos_busqueda.sql
-- El catalogo de Allende abrevia sistematicamente marcas de vehiculo (M. BENZ
-- en vez de MERCEDES, VW en vez de VOLKSWAGEN, NISS en vez de NISSAN, etc).
-- Cuando el LLM (razonablemente) usa el nombre completo de la marca al buscar,
-- el bool_and de ra_chatbot_buscar mataba la mayoria de los resultados reales
-- (ej: "mercedes benz 709" -> 0 filas, "benz 709" -> 6 filas). Confirmado con
-- datos reales que esto pasa con VW (2558 abreviados vs 27 completos), NISSAN,
-- CHEVROLET, RENAULT, HYUNDAI, PEUGEOT ademas de MERCEDES.
--
-- Se agrega una tabla de sinonimos (mantenible: se pueden sumar mas marcas
-- despues con un INSERT, sin tocar la funcion) y ra_chatbot_buscar ahora
-- prueba tambien los sinonimos conocidos de cada palabra de busqueda, no solo
-- la palabra literal.

CREATE TABLE ra_sinonimos_busqueda (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palabra  TEXT NOT NULL,   -- lo que puede escribir el usuario/LLM
  sinonimo TEXT NOT NULL,   -- variante real usada en el catalogo
  UNIQUE(palabra, sinonimo)
);

ALTER TABLE ra_sinonimos_busqueda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sinonimos_select" ON ra_sinonimos_busqueda
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "sinonimos_mutate" ON ra_sinonimos_busqueda
  TO authenticated
  USING (
    (SELECT rol FROM ra_perfiles WHERE id = auth.uid())
      = ANY (ARRAY['administrador'::ra_rol, 'superadmin'::ra_rol])
  );

INSERT INTO ra_sinonimos_busqueda (palabra, sinonimo) VALUES
  ('mercedes',   'benz'),
  ('mercedes',   'm benz'),
  ('volkswagen', 'vw'),
  ('nissan',     'niss'),
  ('chevrolet',  'chev'),
  ('chevrolet',  'chevr'),
  ('renault',    'ren'),
  ('hyundai',    'hyun'),
  ('peugeot',    'peu'),
  ('peugeot',    'peug');

DROP FUNCTION IF EXISTS public.ra_chatbot_buscar(text, text, text, text);

CREATE OR REPLACE FUNCTION public.ra_chatbot_buscar(
  q                text,
  p_tipo_repuesto  text DEFAULT NULL,
  p_marca_repuesto text DEFAULT NULL,
  p_tipo_vehiculo  text DEFAULT NULL
)
 RETURNS TABLE(
   nombre text, codigo_oem text, codigos_alternos text,
   precio_venta numeric, precio_venta_dolar numeric, stock_actual numeric,
   modelos text, marca_repuesto text, tipo_repuesto text
 )
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  empresa UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  search_words text[];
BEGIN
  PERFORM set_config('pg_trgm.word_similarity_threshold', '0.4', true);

  search_words := ARRAY(
    SELECT word FROM unnest(string_to_array(lower(trim(q)), ' ')) AS word
    WHERE length(word) >= 3
  );

  RETURN QUERY
  SELECT
    c.nombre,
    c.codigo_oem,
    c.codigos_alternos,
    p.precio_venta,
    p.precio_venta_dolar,
    p.stock_actual,
    STRING_AGG(DISTINCT m.nombre, ', ' ORDER BY m.nombre) AS modelos,
    mr.nombre AS marca_repuesto,
    tr.nombre AS tipo_repuesto
  FROM ra_catalogo_repuestos c
  JOIN ra_productos p ON p.catalogo_id = c.id AND p.empresa_id = empresa AND p.activo = true
  LEFT JOIN ra_compatibilidades compat ON compat.catalogo_id = c.id
  LEFT JOIN ra_modelos_auto m ON m.id = compat.modelo_id
  LEFT JOIN ra_marcas_repuesto mr ON mr.id = c.marca_repuesto_id
  LEFT JOIN ra_tipos_repuesto  tr ON tr.id = c.tipo_repuesto_id
  WHERE
    c.activo = true
    AND (
      array_length(search_words, 1) IS NULL
      OR (
        SELECT bool_and(
          EXISTS (
            SELECT 1
            FROM (
              SELECT word AS alt
              UNION
              SELECT sinonimo FROM ra_sinonimos_busqueda WHERE palabra = word
            ) alts
            WHERE
              lower(c.nombre) LIKE '%' || alt || '%'
              OR alt <% lower(c.nombre)
              OR regexp_replace(lower(COALESCE(c.codigo_oem, '')), '[^a-z0-9]', '', 'g')
                   LIKE '%' || regexp_replace(alt, '[^a-z0-9]', '', 'g') || '%'
              OR regexp_replace(lower(COALESCE(c.codigos_alternos, '')), '[^a-z0-9]', '', 'g')
                   LIKE '%' || regexp_replace(alt, '[^a-z0-9]', '', 'g') || '%'
          )
        )
        FROM unnest(search_words) AS word
      )
    )
    AND (p_tipo_repuesto  IS NULL OR tr.nombre ILIKE '%' || p_tipo_repuesto  || '%')
    AND (p_marca_repuesto IS NULL OR mr.nombre ILIKE '%' || p_marca_repuesto || '%')
    AND (p_tipo_vehiculo  IS NULL OR c.tipo_vehiculo = p_tipo_vehiculo)
  GROUP BY c.nombre, c.codigo_oem, c.codigos_alternos, p.precio_venta, p.precio_venta_dolar, p.stock_actual, mr.nombre, tr.nombre
  ORDER BY c.nombre
  LIMIT 6;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ra_chatbot_buscar(text, text, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.ra_chatbot_buscar(text, text, text, text) TO authenticated;
