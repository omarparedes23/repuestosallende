-- Permite al worker de servidor reclamar exactamente la outbox de una venta.
-- La UI nunca recibe acceso directo: solo service_role ejecuta esta función,
-- después de que la acción de Next.js validó usuario administrador, empresa y
-- sucursal de la venta solicitada.

CREATE OR REPLACE FUNCTION public.ra_claim_sunat_outbox_for_venta(
  p_worker_id TEXT,
  p_venta_id UUID,
  p_lease_seconds INTEGER DEFAULT 120
)
RETURNS SETOF public.ra_sunat_outbox
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NULLIF(trim(p_worker_id), '') IS NULL
     OR p_venta_id IS NULL
     OR COALESCE(p_lease_seconds, 0) NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION USING MESSAGE = 'RA_INVALID_INPUT';
  END IF;

  -- Recupera únicamente el lease vencido del comprobante solicitado. No toca
  -- otros trabajos de la cola cuando un administrador hace un envío manual.
  UPDATE public.ra_sunat_outbox
  SET status = 'retry',
      lease_token = NULL,
      lease_expires_at = NULL,
      worker_id = NULL,
      updated_at = now()
  WHERE venta_id = p_venta_id
    AND status = 'processing'
    AND lease_expires_at < now();

  RETURN QUERY
  WITH picked AS (
    SELECT id
    FROM public.ra_sunat_outbox
    WHERE venta_id = p_venta_id
      AND status IN ('pending', 'retry')
      AND next_attempt_at <= now()
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.ra_sunat_outbox o
  SET status = 'processing',
      attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      lease_token = gen_random_uuid(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      worker_id = p_worker_id,
      updated_at = now()
  FROM picked
  WHERE o.id = picked.id
  RETURNING o.*;
END;
$$;

REVOKE ALL ON FUNCTION public.ra_claim_sunat_outbox_for_venta(TEXT, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ra_claim_sunat_outbox_for_venta(TEXT, UUID, INTEGER)
  TO service_role;

COMMENT ON FUNCTION public.ra_claim_sunat_outbox_for_venta(TEXT, UUID, INTEGER)
  IS 'Reclama de forma exclusiva una outbox fiscal concreta para envío manual de servidor.';
