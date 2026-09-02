-- 066: los shims internos no son parte del contrato PostgREST.
-- Las RPC públicas SECURITY DEFINER delegan con los privilegios de su owner.
BEGIN;

REVOKE EXECUTE ON FUNCTION
  public.ra_solicitar_devolucion_v1_055(uuid,uuid,jsonb,text),
  public.ra_aprobar_devolucion_v1_059(uuid,uuid,boolean,text),
  public.ra_liquidar_devolucion_v1_059(uuid,uuid,jsonb)
FROM authenticated, anon, PUBLIC;

COMMIT;
