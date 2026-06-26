-- 013_chatbot_search_fn.sql
-- Función pública para el chatbot: busca productos por nombre u OEM
-- SECURITY DEFINER → bypasses RLS, corre como el owner de la función

CREATE OR REPLACE FUNCTION ra_chatbot_buscar(q text)
RETURNS TABLE (
  nombre          text,
  codigo_oem      text,
  precio_venta    numeric,
  tiene_stock     boolean,
  modelos         text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  empresa UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
BEGIN
  RETURN QUERY
  SELECT
    c.nombre,
    c.codigo_oem,
    p.precio_venta,
    (p.stock_actual > 0) AS tiene_stock,
    STRING_AGG(DISTINCT m.nombre, ', ' ORDER BY m.nombre) AS modelos
  FROM ra_catalogo_repuestos c
  JOIN ra_productos p ON p.catalogo_id = c.id AND p.empresa_id = empresa AND p.activo = true
  LEFT JOIN ra_compatibilidades compat ON compat.catalogo_id = c.id
  LEFT JOIN ra_modelos_auto m ON m.id = compat.modelo_id
  WHERE
    c.activo = true
    AND (
      c.nombre      ILIKE '%' || q || '%'
      OR c.codigo_oem ILIKE '%' || q || '%'
    )
  GROUP BY c.nombre, c.codigo_oem, p.precio_venta, p.stock_actual
  ORDER BY c.nombre
  LIMIT 10;
END;
$$;

-- Permitir que el anon key llame esta función
GRANT EXECUTE ON FUNCTION ra_chatbot_buscar(text) TO anon;
GRANT EXECUTE ON FUNCTION ra_chatbot_buscar(text) TO authenticated;
