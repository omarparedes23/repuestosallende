-- 023_fix_search_path_funciones.sql
-- Hardening de seguridad (Supabase Security Advisor: "Function Search Path
-- Mutable"): fija search_path en nuestras funciones propias (ra_*) que no lo
-- tenian. Sin esto, una funcion SECURITY DEFINER puede resolver nombres de
-- tabla contra un search_path manipulado por quien la ejecuta - riesgo real
-- en ra_empresa_id() y ra_siguiente_correlativo(), que son SECURITY DEFINER
-- y se usan en la mayoria de las policies RLS del proyecto.
--
-- No modifica logica ni firma, solo agrega el SET search_path.

ALTER FUNCTION public.ra_empresa_id() SET search_path = public;
ALTER FUNCTION public.ra_set_updated_at() SET search_path = public;
ALTER FUNCTION public.ra_siguiente_correlativo(uuid, text) SET search_path = public;
