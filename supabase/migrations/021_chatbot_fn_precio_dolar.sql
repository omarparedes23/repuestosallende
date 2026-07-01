-- 021_chatbot_fn_precio_dolar.sql
-- Actualiza ra_chatbot_buscar para devolver precio_venta (soles) y precio_venta_dolar
-- por separado, en vez de un unico precio_venta que quedo en NULL para los productos
-- migrados a dolares (018_productos_precio_dolar.sql). La columna moneda ya no es
-- fuente de verdad (un producto puede tener ambos precios cargados de forma
-- independiente), asi que se deja de usar aqui.

DROP FUNCTION IF EXISTS public.ra_chatbot_buscar(text);

CREATE OR REPLACE FUNCTION public.ra_chatbot_buscar(q text)
 RETURNS TABLE(nombre text, codigo_oem text, codigos_alternos text, precio_venta numeric, precio_venta_dolar numeric, stock_actual numeric, modelos text)
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
    STRING_AGG(DISTINCT m.nombre, ', ' ORDER BY m.nombre) AS modelos
  FROM ra_catalogo_repuestos c
  JOIN ra_productos p ON p.catalogo_id = c.id AND p.empresa_id = empresa AND p.activo = true
  LEFT JOIN ra_compatibilidades compat ON compat.catalogo_id = c.id
  LEFT JOIN ra_modelos_auto m ON m.id = compat.modelo_id
  WHERE
    c.activo = true
    AND (
      SELECT bool_and(
        lower(c.nombre)                          LIKE '%' || word || '%'
        OR lower(COALESCE(c.codigo_oem, ''))     LIKE '%' || word || '%'
        OR lower(COALESCE(c.codigos_alternos,'')) LIKE '%' || word || '%'
      )
      FROM unnest(search_words) AS word
    )
  GROUP BY c.nombre, c.codigo_oem, c.codigos_alternos, p.precio_venta, p.precio_venta_dolar, p.stock_actual
  ORDER BY c.nombre
  LIMIT 4;
END;
$function$;
