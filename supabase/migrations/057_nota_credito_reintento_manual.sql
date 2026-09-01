-- 057: permite que un reintento manual autorizado adelante solo backoff temporal.
BEGIN;

DROP FUNCTION public.ra_claim_sunat_nota_credito_outbox_for_devolucion(text,uuid,integer);

CREATE OR REPLACE FUNCTION public.ra_claim_sunat_nota_credito_outbox_for_devolucion(
  p_worker_id text, p_devolucion_id uuid, p_lease_seconds integer default 120, p_force_retry boolean default false
) RETURNS SETOF public.ra_sunat_nota_credito_outbox
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
BEGIN
  IF nullif(btrim(p_worker_id),'') IS NULL OR p_devolucion_id IS NULL
     OR coalesce(p_lease_seconds,0) NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT';
  END IF;
  UPDATE public.ra_sunat_nota_credito_outbox
  SET status='retry',lease_token=NULL,lease_expires_at=NULL,worker_id=NULL,updated_at=now()
  WHERE devolucion_id=p_devolucion_id AND status='processing' AND lease_expires_at<now();
  IF p_force_retry THEN
    UPDATE public.ra_sunat_nota_credito_outbox SET next_attempt_at=now(),updated_at=now()
    WHERE devolucion_id=p_devolucion_id AND status='retry';
  END IF;
  RETURN QUERY WITH picked AS (
    SELECT id FROM public.ra_sunat_nota_credito_outbox
    WHERE devolucion_id=p_devolucion_id AND status IN ('pending','retry') AND next_attempt_at<=now()
    FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE public.ra_sunat_nota_credito_outbox o
    SET status='processing',attempt_count=attempt_count+1,last_attempt_at=now(),lease_token=gen_random_uuid(),
        lease_expires_at=now()+make_interval(secs=>p_lease_seconds),worker_id=p_worker_id,updated_at=now()
    FROM picked WHERE o.id=picked.id RETURNING o.*;
END; $$;

REVOKE ALL ON FUNCTION public.ra_claim_sunat_nota_credito_outbox_for_devolucion(text,uuid,integer,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ra_claim_sunat_nota_credito_outbox_for_devolucion(text,uuid,integer,boolean) TO service_role;
COMMIT;
