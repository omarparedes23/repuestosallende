-- 013_chatbot_search_fn.sql
-- Función pública para el chatbot: busca productos por nombre u OEM
-- SECURITY DEFINER → bypasses RLS, corre como el owner de la función

-- (superseded by 014 and 016 — kept for reference only)

-- Permitir que el anon key llame esta función
GRANT EXECUTE ON FUNCTION ra_chatbot_buscar(text) TO anon;
GRANT EXECUTE ON FUNCTION ra_chatbot_buscar(text) TO authenticated;
