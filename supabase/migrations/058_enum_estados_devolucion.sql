-- 058: los valores nuevos de enum deben confirmarse antes de ser referidos por 059.
-- PostgreSQL no permite usar un valor agregado de enum en la misma transacción.
ALTER TYPE public.ra_estado_devolucion ADD VALUE IF NOT EXISTS 'recibida' AFTER 'solicitada';
ALTER TYPE public.ra_estado_devolucion ADD VALUE IF NOT EXISTS 'aprobada' AFTER 'recibida';
