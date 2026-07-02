-- 025_chatbot_busqueda_estructurada.sql
-- Etapa 2 de mejora de busqueda del chatbot: ra_chatbot_buscar ahora acepta
-- filtros estructurados opcionales (tipo de repuesto, marca de repuesto, tipo
-- de vehiculo) ademas del texto libre, aprovechando ra_marcas_repuesto /
-- ra_tipos_repuesto / tipo_vehiculo agregados en 024. El LLM extrae estos
-- filtros de la pregunta del usuario antes de llamar a esta funcion (ver
-- src/app/api/chat/route.ts, funcion extraerIntencion).
--
-- Los parametros nuevos tienen DEFAULT NULL, asi que sigue siendo compatible
-- con llamadas que solo mandan {q}.

DROP FUNCTION IF EXISTS public.ra_chatbot_buscar(text);

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
      -- Sin palabras de texto libre (busqueda 100% por filtros estructurados)
      -- no se exige match de texto; si hay palabras, se exige que TODAS aparezcan
      array_length(search_words, 1) IS NULL
      OR (
        SELECT bool_and(
          lower(c.nombre)                           LIKE '%' || word || '%'
          OR lower(COALESCE(c.codigo_oem, ''))      LIKE '%' || word || '%'
          OR lower(COALESCE(c.codigos_alternos,'')) LIKE '%' || word || '%'
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
