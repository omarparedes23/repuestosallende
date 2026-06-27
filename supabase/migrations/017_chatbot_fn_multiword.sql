-- 017_chatbot_fn_multiword.sql
-- Búsqueda AND por múltiples palabras: "amortiguador sprinter 315" filtra por todas

DROP FUNCTION IF EXISTS ra_chatbot_buscar(text);

CREATE FUNCTION ra_chatbot_buscar(q text)
RETURNS TABLE (
  nombre            text,
  codigo_oem        text,
  codigos_alternos  text,
  precio_venta      numeric,
  moneda            char(3),
  stock_actual      numeric,
  modelos           text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  empresa UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  search_words text[];
BEGIN
  -- Dividir la query en palabras (para búsqueda multi-keyword AND)
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
    p.moneda,
    p.stock_actual,
    STRING_AGG(DISTINCT m.nombre, ', ' ORDER BY m.nombre) AS modelos
  FROM ra_catalogo_repuestos c
  JOIN ra_productos p ON p.catalogo_id = c.id AND p.empresa_id = empresa AND p.activo = true
  LEFT JOIN ra_compatibilidades compat ON compat.catalogo_id = c.id
  LEFT JOIN ra_modelos_auto m ON m.id = compat.modelo_id
  WHERE
    c.activo = true
    AND (
      -- Cada palabra del query debe aparecer en nombre, codigo_oem o codigos_alternos
      SELECT bool_and(
        lower(c.nombre)                          LIKE '%' || word || '%'
        OR lower(COALESCE(c.codigo_oem, ''))     LIKE '%' || word || '%'
        OR lower(COALESCE(c.codigos_alternos,'')) LIKE '%' || word || '%'
      )
      FROM unnest(search_words) AS word
    )
  GROUP BY c.nombre, c.codigo_oem, c.codigos_alternos, p.precio_venta, p.moneda, p.stock_actual
  ORDER BY c.nombre
  LIMIT 4;
END;
$$;

GRANT EXECUTE ON FUNCTION ra_chatbot_buscar(text) TO anon;
GRANT EXECUTE ON FUNCTION ra_chatbot_buscar(text) TO authenticated;
