-- 071: CREATE OR REPLACE con un parámetro nuevo NO reemplaza la función
-- anterior cuando cambia el número de argumentos — crea un overload aparte.
-- La migración 070 dejó dos firmas de ra_confirmar_venta/_v1 (9 y 10
-- argumentos) coexistiendo, lo cual es ambiguo y un riesgo de resolución de
-- overload en llamadas por nombre vía PostgREST. Se elimina la firma vieja
-- de 9 argumentos; la de 10 (con p_numero_placa DEFAULT NULL) es la única.
DROP FUNCTION IF EXISTS public.ra_confirmar_venta(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date);
DROP FUNCTION IF EXISTS public.ra_confirmar_venta_v1(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date);
