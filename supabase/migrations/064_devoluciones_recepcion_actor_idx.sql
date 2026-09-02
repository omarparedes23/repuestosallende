-- 064: índice para la FK de recepción operativa y auditorías por actor.
CREATE INDEX IF NOT EXISTS ra_devoluciones_recepcion_operativa_por_idx
  ON public.ra_devoluciones(recepcion_operativa_por)
  WHERE recepcion_operativa_por IS NOT NULL;
