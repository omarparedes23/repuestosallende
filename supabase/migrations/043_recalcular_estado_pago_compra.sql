-- ============================================================
-- 043_recalcular_estado_pago_compra.sql  (BORRADOR - NO APLICAR
-- hasta revision y PASS de suites; no registrar en ledger antes)
--
-- Change: compra-cuenta-por-pagar-atomica (tarea 2.13 / Fase 3 cierre)
--
-- 1) Tabla de auditoria ESPECIFICA (decision del propietario 2026-08-23:
--    NO auditoria transversal generica; eso sera un change SDD aparte):
--
--   ra_auditoria_estado_pago_compras
--     id             uuid PK
--     empresa_id     uuid NOT NULL FK ra_empresas RESTRICT
--     compra_id      uuid NOT NULL FK ra_compras RESTRICT (SIN cascade:
--                    no se borra evidencia junto a la compra)
--     operation_id   uuid NOT NULL (idempotencia de la reparacion)
--     request_hash   text NOT NULL CHECK hex64 (hash de compra+motivo)
--     usuario_id     uuid NULL REFERENCES auth.users (NULL solo backfill)
--     actor_tipo     texto 'usuario' | 'migracion'
--     estado_anterior ra_estado_pago_compra NOT NULL
--     estado_nuevo   ra_estado_pago_compra NOT NULL
--     motivo         text NOT NULL (no vacio, max 200)
--     created_at     timestamptz NOT NULL DEFAULT now()
--
--   Checks: usuario obligatorio sii actor_tipo='usuario'; motivo no
--   vacio <= 200; request_hash formato SHA-256 hex64.
--   Unicidad: (empresa_id, operation_id) => replay sin duplicar
--   auditoria y conflicto si se reutiliza para otra compra/motivo.
--
--   Append-only REAL:
--     - RLS enable; UNICA politica: SELECT para administrador/
--       superadmin de la misma empresa (ra_empresa_id()).
--     - Sin grants INSERT/UPDATE/DELETE a anon/authenticated.
--     - PUBLIC/anon sin ningun acceso.
--     - Trigger BEFORE UPDATE OR DELETE -> RAISE (defensa en profundidad
--       contra roles con bypass).
--     - FK RESTRICT (sin CASCADE).
--
-- 2) RPC ra_recalcular_estado_pago(p_operation_id uuid, p_compra_id uuid,
--    p_motivo text) RETURNS jsonb:
--     - usuario/empresa desde auth.uid(); solo administrador/superadmin.
--     - compra debe pertenecer a la empresa del perfil (aislamiento;
--       respuesta generica si no).
--     - FOR UPDATE sobre la compra durante la reparacion.
--     - calculo EXCLUSIVO desde ledger CxP + COALESCE(total_pen,total)
--       via ra_estado_pago_proyectado (041/042).
--     - escribe estado (si cambio) + fila de auditoria en UNA transaccion;
--       el trigger trg_cxp_sync de 042 no interfiere: no hay movimiento
--       nuevo en el ledger durante la reparacion.
--     - idempotente por (empresa_id, operation_id): replay devuelve el
--       resultado original con replayed:true SIN nueva auditoria;
--       misma operacion con otra compra/motivo => RA_IDEMPOTENCY_CONFLICT.
--     - devuelve {status, changed, replayed, anterior, nuevo}.
--     - si el estado ya coincide: changed=false; la auditoria SE registra
--       tambien para el no-op: cada operation_id nuevo deja exactamente
--       una fila; los replays no agregan filas.
-- 3) Backfill historico (en esta misma migracion):
-- CONTRATO UNICO (documentado en design/migracion/pruebas):
--     a) ANTES de aplicar esta migracion se ejecuta el preflight
--        READ-ONLY ra_preflight_estado_pago_divergencias(): reporta
--        conteo e IDs tecnicos.
--     b) Con autorizacion del propietario se aplica la migracion, cuyo
--     el propietario decide; luego corrige SOLO filas divergentes.
--       insertando auditoria con actor_tipo='migracion', usuario NULL,
--       motivo 'backfill 043: divergencia estado_pago vs ledger'.
--     - idempotente: segunda ejecucion produce cero cambios y cero
--       auditorias nuevas.
--
-- Forward-only. 042 CONGELADA: este archivo no la modifica.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Tabla de auditoria
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ra_auditoria_estado_pago_compras (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid NOT NULL REFERENCES public.ra_empresas(id) ON DELETE RESTRICT,
  compra_id        uuid NOT NULL REFERENCES public.ra_compras(id) ON DELETE RESTRICT,
  operation_id     uuid NOT NULL,
  request_hash     text NOT NULL,
  usuario_id       uuid REFERENCES auth.users(id),
  actor_tipo       text NOT NULL,
  estado_anterior  public.ra_estado_pago_compra NOT NULL,
  estado_nuevo     public.ra_estado_pago_compra NOT NULL,
  motivo           text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT ra_aud_epc_actor_check CHECK (
    (actor_tipo = 'usuario'   AND usuario_id IS NOT NULL)
    OR
    (actor_tipo = 'migracion' AND usuario_id IS NULL)
  ),
  CONSTRAINT ra_aud_epc_motivo_check CHECK (
    motivo IS NOT NULL AND btrim(motivo) <> '' AND char_length(motivo) <= 200
  ),
  CONSTRAINT ra_aud_epc_hash_check CHECK (
    request_hash ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT ra_aud_epc_actor_domain_check CHECK (
    actor_tipo IN ('usuario', 'migracion')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_aud_epc_operacion
  ON public.ra_auditoria_estado_pago_compras (empresa_id, operation_id);
CREATE INDEX IF NOT EXISTS idx_aud_epc_compra
  ON public.ra_auditoria_estado_pago_compras (compra_id, created_at DESC);

ALTER TABLE public.ra_auditoria_estado_pago_compras ENABLE ROW LEVEL SECURITY;

-- Privilegios: solo lectura para authenticated (RLS decide filas);
-- escritura exclusivamente via RPC SECURITY DEFINER / backfill owner.
REVOKE ALL ON public.ra_auditoria_estado_pago_compras FROM PUBLIC, anon;
REVOKE ALL ON public.ra_auditoria_estado_pago_compras FROM authenticated;
GRANT SELECT ON public.ra_auditoria_estado_pago_compras TO authenticated;

DROP POLICY IF EXISTS aud_epc_select_admin ON public.ra_auditoria_estado_pago_compras;
CREATE POLICY aud_epc_select_admin ON public.ra_auditoria_estado_pago_compras
  FOR SELECT TO authenticated
  USING (
    empresa_id = ra_empresa_id()
    AND EXISTS (SELECT 1 FROM ra_perfiles p
                WHERE p.id = auth.uid() AND p.activo
                  AND p.rol IN ('administrador','superadmin'))
  );

-- Append-only: rechazo duro de UPDATE/DELETE (defensa ante roles con
-- BYPASSRLS o futuros grants accidentales).
CREATE OR REPLACE FUNCTION public.ra_aud_epc_append_only()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'RA_AUDIT_IMMUTABLE: % prohibido sobre ra_auditoria_estado_pago_compras', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_aud_epc_immutable ON public.ra_auditoria_estado_pago_compras;
CREATE TRIGGER trg_aud_epc_immutable
  BEFORE UPDATE OR DELETE ON public.ra_auditoria_estado_pago_compras
  FOR EACH ROW EXECUTE FUNCTION public.ra_aud_epc_append_only();

REVOKE ALL ON FUNCTION public.ra_aud_epc_append_only() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 2. Preflight de divergencias (read-only; llamado por el runner de
--    aplicacion ANTES del backfill; tambien utilizable manualmente)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_preflight_estado_pago_divergencias()
RETURNS TABLE (compra_id uuid, almacenado text, proyectado text)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT c.id,
         c.estado_pago::text,
         public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen, c.total))::text
  FROM public.ra_compras c
  WHERE c.estado = 'confirmada'
    AND c.estado_pago IS DISTINCT FROM
        public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen, c.total));
$$;

REVOKE ALL ON FUNCTION public.ra_preflight_estado_pago_divergencias() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. RPC de reparacion
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_recalcular_estado_pago(
  p_operation_id uuid,
  p_compra_id    uuid,
  p_motivo       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid      uuid;
  v_empresa  uuid;
  v_rol      text;
  v_previo   record;
  v_hash_in  text;
  v_hash     text;
  v_anterior public.ra_estado_pago_compra;
  v_nuevo    public.ra_estado_pago_compra;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    PERFORM public.ra_error_compra('RA_UNAUTHENTICATED', 'sesion requerida');
  END IF;

  SELECT empresa_id, rol INTO v_empresa, v_rol
  FROM ra_perfiles WHERE id = v_uid AND activo;
  IF NOT FOUND THEN
    PERFORM public.ra_error_compra('RA_UNAUTHENTICATED', 'perfil inexistente o inactivo');
  END IF;
  IF v_rol NOT IN ('administrador','superadmin') THEN
    PERFORM public.ra_error_compra('RA_FORBIDDEN', 'rol sin permiso de reparacion');
  END IF;

  IF p_operation_id IS NULL OR p_compra_id IS NULL THEN
    PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'operation_id y compra_id requeridos');
  END IF;
  IF p_motivo IS NULL OR btrim(p_motivo) = '' OR char_length(p_motivo) > 200 THEN
    PERFORM public.ra_error_compra('RA_ITEMS_INVALID', 'motivo obligatorio (1..200)');
  END IF;

  -- Idempotencia ANTES de cualquier lock: hash canonico de (compra, motivo)
  v_hash := encode(sha256(convert_to(jsonb_build_object(
              'empresa', v_empresa,
              'compra',  p_compra_id,
              'motivo',  upper(btrim(COALESCE(p_motivo,'')))
            )::text, 'UTF8')), 'hex');

  -- Serializa reparaciones concurrentes del mismo operation_id:
  -- sin este lock, dos llamadas paralelas leen 'no existe' y la
  -- segunda termina en unique_violation cruda.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    v_empresa::text || ':' || p_operation_id::text, 0));

  -- Replay/conflicto contra auditoria existente (sin tocar la compra)
  SELECT * INTO v_previo FROM ra_auditoria_estado_pago_compras
   WHERE empresa_id = v_empresa AND operation_id = p_operation_id;

  IF FOUND THEN
    IF v_previo.request_hash = v_hash AND v_previo.compra_id = p_compra_id THEN
      RETURN jsonb_build_object(
        'status', 'ok', 'replayed', true,
        'changed', (v_previo.estado_anterior IS DISTINCT FROM v_previo.estado_nuevo),
        'anterior', v_previo.estado_anterior::text,
        'nuevo',    v_previo.estado_nuevo::text);
    END IF;
    PERFORM public.ra_error_compra('RA_IDEMPOTENCY_CONFLICT',
      'operation_id reutilizado para otra compra o motivo');
  END IF;

  -- Bloqueo de la compra durante la reparacion; aislamiento cross-tenant
  SELECT id, estado_pago, total_pen, total INTO v_previo
  FROM ra_compras
   WHERE id = p_compra_id AND empresa_id = v_empresa AND estado = 'confirmada'
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  v_anterior := v_previo.estado_pago;
  v_nuevo := public.ra_estado_pago_proyectado(
    v_previo.id, COALESCE(v_previo.total_pen, v_previo.total));

  -- Auditoria SIEMPRE (tambien en no-op): habilita replay/conflicto
  -- uniformes y deja trazabilidad completa de cada operacion.
  INSERT INTO ra_auditoria_estado_pago_compras (
    empresa_id, compra_id, operation_id, request_hash,
    usuario_id, actor_tipo, estado_anterior, estado_nuevo, motivo)
  VALUES (
    v_empresa, p_compra_id, p_operation_id, v_hash,
    v_uid, 'usuario', v_anterior, v_nuevo, left(btrim(p_motivo), 200));

  IF v_nuevo IS DISTINCT FROM v_anterior THEN
    UPDATE ra_compras SET estado_pago = v_nuevo WHERE id = p_compra_id;
    RETURN jsonb_build_object('status','ok','replayed',false,'changed',true,
                              'anterior',v_anterior::text,'nuevo',v_nuevo::text);
  END IF;

  RETURN jsonb_build_object('status','ok','replayed',false,'changed',false,
                            'anterior',v_anterior::text,'nuevo',v_anterior::text);
END;
$$;

REVOKE ALL ON FUNCTION public.ra_recalcular_estado_pago(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ra_recalcular_estado_pago(uuid, uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 4. Backfill historico: SOLO filas divergentes, auditadas como
--    migracion. Preflight primero (aborta con conteo si hay dudas no,
--    aqui simplemente corrige lo divergente; el preflight read-only
--    corre antes de aplicar esta migracion).
-- ------------------------------------------------------------
DO $$
DECLARE
  v_filas int;
BEGIN
  WITH divergentes AS (
    SELECT c.id, c.empresa_id, c.estado_pago AS anterior,
           public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen, c.total)) AS nuevo
    FROM ra_compras c
    WHERE c.estado = 'confirmada'
      AND c.estado_pago IS DISTINCT FROM
          public.ra_estado_pago_proyectado(c.id, COALESCE(c.total_pen, c.total))
    FOR UPDATE OF c
  ), corregidas AS (
    UPDATE ra_compras c
       SET estado_pago = d.nuevo
    FROM divergentes d
     WHERE c.id = d.id
    RETURNING c.id, c.empresa_id, d.anterior, d.nuevo
  )
  INSERT INTO ra_auditoria_estado_pago_compras (
    empresa_id, compra_id, operation_id, request_hash,
    usuario_id, actor_tipo, estado_anterior, estado_nuevo, motivo)
  SELECT r.empresa_id, r.id,
         md5('043-backfill-' || r.id::text)::uuid,
         encode(sha256(convert_to('backfill:' || r.id::text, 'UTF8')), 'hex'),
         NULL, 'migracion', r.anterior, r.nuevo,
         'backfill 043: divergencia estado_pago vs ledger'
  FROM corregidas r;

  GET DIAGNOSTICS v_filas = ROW_COUNT;
  RAISE NOTICE 'backfill 043: % compras corregidas', v_filas;
END $$;

COMMIT;

-- ============================================================
-- Verificacion post-aplicacion:
--   psql -f supabase/tests/compra-atomica-043.test.sql
-- Segunda ejecucion del backfill: cero cambios, cero auditorias nuevas.
-- Registro en ledger SOLO si la suite pasa:
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('043','recalcular_estado_pago_compra');
-- ============================================================
