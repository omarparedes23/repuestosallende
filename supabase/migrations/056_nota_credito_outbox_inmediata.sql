-- 056: procesamiento exclusivo e idempotente de la outbox de notas de crédito.
BEGIN;

CREATE OR REPLACE FUNCTION public.ra_claim_sunat_nota_credito_outbox_for_devolucion(
  p_worker_id text, p_devolucion_id uuid, p_lease_seconds integer default 120
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
  RETURN QUERY WITH picked AS (
    SELECT id FROM public.ra_sunat_nota_credito_outbox
    WHERE devolucion_id=p_devolucion_id AND status IN ('pending','retry') AND next_attempt_at<=now()
    FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE public.ra_sunat_nota_credito_outbox o
    SET status='processing',attempt_count=attempt_count+1,last_attempt_at=now(),lease_token=gen_random_uuid(),
        lease_expires_at=now()+make_interval(secs=>p_lease_seconds),worker_id=p_worker_id,updated_at=now()
    FROM picked WHERE o.id=picked.id RETURNING o.*;
END; $$;

CREATE OR REPLACE FUNCTION public.ra_finish_sunat_nota_credito_outbox(
  p_job_id uuid,p_lease_token uuid,p_outcome text,p_external_id text default null,p_http_status integer default null,
  p_error_code text default null,p_error_message text default null,p_response_payload jsonb default null
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_job public.ra_sunat_nota_credito_outbox; v_status text; v_delay integer;
BEGIN
  SELECT * INTO v_job FROM public.ra_sunat_nota_credito_outbox
  WHERE id=p_job_id AND status='processing' AND lease_token=p_lease_token AND lease_expires_at>=now() FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_status:=CASE p_outcome WHEN 'accepted' THEN 'accepted' WHEN 'rejected' THEN 'rejected'
    WHEN 'submitted' THEN 'submitted' WHEN 'uncertain' THEN 'submitted'
    WHEN 'temporary_error' THEN CASE WHEN v_job.attempt_count>=10 THEN 'dead_letter' ELSE 'retry' END ELSE NULL END;
  IF v_status IS NULL THEN RAISE EXCEPTION USING MESSAGE='RA_INVALID_INPUT'; END IF;
  v_delay:=least(300*power(2,greatest(v_job.attempt_count-1,0))::integer,21600);
  UPDATE public.ra_sunat_nota_credito_outbox
  SET status=v_status,external_id=coalesce(p_external_id,external_id),http_status=p_http_status,error_code=p_error_code,
      error_message=left(p_error_message,2000),response_payload=p_response_payload,
      next_attempt_at=CASE WHEN v_status='retry' THEN now()+make_interval(secs=>v_delay) ELSE next_attempt_at END,
      completed_at=CASE WHEN v_status IN ('accepted','rejected','dead_letter') THEN now() ELSE NULL END,
      lease_token=NULL,lease_expires_at=NULL,worker_id=NULL,updated_at=now()
  WHERE id=v_job.id;
  IF v_status IN ('accepted','rejected') THEN
    INSERT INTO public.ra_auditoria_devoluciones(empresa_id,devolucion_id,evento,motivo,metadata)
    VALUES(v_job.empresa_id,v_job.devolucion_id,'fiscal_'||v_status,'Resultado OSE nota de crédito',
      jsonb_build_object('outboxId',v_job.id,'externalId',p_external_id,'status',v_status));
  END IF;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.ra_claim_sunat_nota_credito_outbox_for_devolucion(text,uuid,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.ra_finish_sunat_nota_credito_outbox(uuid,uuid,text,text,integer,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ra_claim_sunat_nota_credito_outbox_for_devolucion(text,uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ra_finish_sunat_nota_credito_outbox(uuid,uuid,text,text,integer,text,text,jsonb) TO service_role;
COMMIT;
