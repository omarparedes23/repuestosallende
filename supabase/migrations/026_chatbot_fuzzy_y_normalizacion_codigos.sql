-- 026_chatbot_fuzzy_y_normalizacion_codigos.sql
-- Etapa 1: tolerancia a errores de tipeo usando pg_trgm (el indice GIN ya
-- existe desde 001_initial_schema.sql, idx_catalogo_nombre_trgm, pero nunca
-- se habia usado para similitud, solo aceleraba el LIKE de rebote).
--
-- Ademas, normaliza puntuacion en codigos (guiones/puntos/espacios) para que
-- un codigo escrito sin guion (ej "895460K280") siga encontrando el producto
-- aunque en la base este con guion ("89546-0K280"). Esto NO depende del LLM
-- porque los codigos van por el camino rapido que a proposito no pasa por
-- OpenAI (ver route.ts, extractFastPathTerm).

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
  -- Umbral de tolerancia a typos: 0.4 (el default de Postgres es 0.6, muy
  -- estricto para nuestro caso). set_config con "true" lo escopa a esta
  -- transaccion nada mas, no cambia configuracion global de la BD.
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
          -- match exacto (cubre la mayoria de los casos, el mas barato)
          lower(c.nombre) LIKE '%' || word || '%'
          -- fuzzy por errores de tipeo en el nombre (usa el indice GIN trigram)
          OR word <% lower(c.nombre)
          -- codigo OEM ignorando guiones/puntos/espacios de mas o de menos
          OR regexp_replace(lower(COALESCE(c.codigo_oem, '')), '[^a-z0-9]', '', 'g')
               LIKE '%' || regexp_replace(word, '[^a-z0-9]', '', 'g') || '%'
          -- idem para codigos alternos
          OR regexp_replace(lower(COALESCE(c.codigos_alternos, '')), '[^a-z0-9]', '', 'g')
               LIKE '%' || regexp_replace(word, '[^a-z0-9]', '', 'g') || '%'
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
