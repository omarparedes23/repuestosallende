-- 022_rpc_stock_bajo_count.sql
-- RPC liviano para contar productos con stock bajo, usado en Panel/Articulos.
-- Evita traer las 43k+ filas al servidor solo para contar - la comparacion
-- stock_actual < stock_minimo no se puede expresar con el query builder de
-- PostgREST (compara columna contra columna, no contra un literal).

CREATE OR REPLACE FUNCTION public.ra_contar_stock_bajo(p_empresa_id uuid)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)
  FROM ra_productos
  WHERE empresa_id = p_empresa_id
    AND stock_actual < stock_minimo;
$function$;
