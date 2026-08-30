-- ============================================================
-- 046_tesoreria_idempotente_schema.sql
-- Change: tesoreria-idempotente-cierre-atomico / Fase 1
--
-- Solo schema aditivo. Las RPC versionadas se incorporan en una
-- migracion posterior, despues del preflight remoto y las pruebas.
-- Filas historicas conservan sus columnas nuevas en NULL.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Ledgers CxC / CxP: identidad de operacion y contexto.
--    sucursal_id identifica donde ocurrio el abono; caja_id solo
--    existe cuando el instrumento toca efectivo fisico.
-- ------------------------------------------------------------
ALTER TABLE public.ra_cuenta_corriente_movimientos
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS result_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.ra_sucursales(id),
  ADD COLUMN IF NOT EXISTS caja_id uuid REFERENCES public.ra_cajas(id);

ALTER TABLE public.ra_cuentas_por_pagar_movimientos
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS result_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.ra_sucursales(id),
  ADD COLUMN IF NOT EXISTS caja_id uuid REFERENCES public.ra_cajas(id);

ALTER TABLE public.ra_cuenta_corriente_movimientos
  ADD CONSTRAINT ra_cc_tesoreria_operacion_check CHECK (
    operation_id IS NULL
    OR (
      tipo = 'abono'
      AND request_hash IS NOT NULL
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND result_snapshot IS NOT NULL
      AND jsonb_typeof(result_snapshot) = 'object'
      AND sucursal_id IS NOT NULL
      AND (metodo_pago <> 'efectivo' OR caja_id IS NOT NULL)
      AND (caja_id IS NULL OR metodo_pago = 'efectivo')
    )
  );

ALTER TABLE public.ra_cuentas_por_pagar_movimientos
  ADD CONSTRAINT ra_cxp_tesoreria_operacion_check CHECK (
    operation_id IS NULL
    OR (
      tipo = 'abono'
      AND request_hash IS NOT NULL
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND result_snapshot IS NOT NULL
      AND jsonb_typeof(result_snapshot) = 'object'
      AND sucursal_id IS NOT NULL
      AND (metodo_pago <> 'efectivo' OR caja_id IS NOT NULL)
      AND (caja_id IS NULL OR metodo_pago = 'efectivo')
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_cc_abono_operation
  ON public.ra_cuenta_corriente_movimientos (empresa_id, operation_id)
  WHERE tipo = 'abono' AND operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cxp_abono_operation
  ON public.ra_cuentas_por_pagar_movimientos (empresa_id, operation_id)
  WHERE tipo = 'abono' AND operation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cc_sucursal_fecha
  ON public.ra_cuenta_corriente_movimientos (empresa_id, sucursal_id, fecha DESC)
  WHERE sucursal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cxp_sucursal_fecha
  ON public.ra_cuentas_por_pagar_movimientos (empresa_id, sucursal_id, fecha DESC)
  WHERE sucursal_id IS NOT NULL;

-- ------------------------------------------------------------
-- 2. Turnos y movimientos de caja.
-- ------------------------------------------------------------
ALTER TABLE public.ra_cajas
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text;

ALTER TABLE public.ra_cajas
  ADD CONSTRAINT ra_cajas_operation_hash_check CHECK (
    operation_id IS NULL
    OR (request_hash IS NOT NULL AND request_hash ~ '^[0-9a-f]{64}$')
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_cajas_empresa_operation
  ON public.ra_cajas (empresa_id, operation_id)
  WHERE operation_id IS NOT NULL;

-- El turno pertenece a la tienda, no al usuario que lo abrio. La unicidad
-- correcta ya existe en ra_cajas_sucursal_activa (migracion 006).
DROP INDEX IF EXISTS public.idx_caja_una_abierta_por_usuario;

DROP POLICY IF EXISTS "cajas_select" ON public.ra_cajas;
CREATE POLICY "cajas_select" ON public.ra_cajas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ra_perfiles p
      WHERE p.id = auth.uid() AND p.activo = true
        AND p.empresa_id = ra_cajas.empresa_id
        AND (
          p.rol IN ('administrador', 'superadmin')
          OR p.sucursal_id = ra_cajas.sucursal_id
        )
    )
  );

ALTER TABLE public.ra_movimientos_caja
  ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS origen text,
  ADD COLUMN IF NOT EXISTS notas text;

ALTER TABLE public.ra_movimientos_caja
  ADD CONSTRAINT ra_movimientos_caja_operacion_check CHECK (
    operation_id IS NULL
    OR (
      request_hash IS NOT NULL
      AND request_hash ~ '^[0-9a-f]{64}$'
      AND usuario_id IS NOT NULL
      AND origen IN ('venta', 'cobro', 'pago_proveedor', 'manual', 'ajuste')
    )
  );

DROP INDEX IF EXISTS public.uq_movimientos_caja_turno_operation;
CREATE UNIQUE INDEX uq_movimientos_caja_turno_operation
  ON public.ra_movimientos_caja (caja_id, origen, operation_id)
  WHERE operation_id IS NOT NULL;

DROP POLICY IF EXISTS "movimientos_select" ON public.ra_movimientos_caja;
CREATE POLICY "movimientos_select" ON public.ra_movimientos_caja
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ra_cajas c
      JOIN public.ra_perfiles p ON p.id = auth.uid() AND p.activo = true
      WHERE c.id = ra_movimientos_caja.caja_id
        AND p.empresa_id = c.empresa_id
        AND (
          p.rol IN ('administrador', 'superadmin')
          OR p.sucursal_id = c.sucursal_id
        )
    )
  );

-- El ledger de caja es inmutable incluso si un grant futuro concede DML.
CREATE OR REPLACE FUNCTION public.ra_movimientos_caja_append_only()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'RA_CASH_MOVEMENT_IMMUTABLE: % prohibido sobre ra_movimientos_caja', TG_OP;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimientos_caja_append_only ON public.ra_movimientos_caja;
CREATE TRIGGER trg_movimientos_caja_append_only
  BEFORE UPDATE OR DELETE ON public.ra_movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION public.ra_movimientos_caja_append_only();

REVOKE ALL ON FUNCTION public.ra_movimientos_caja_append_only() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 3. Snapshot de liquidacion y revision posterior.
--    sistema_efectivo conserva el snapshot del efectivo esperado;
--    no se duplica con otra columna autoritativa.
-- ------------------------------------------------------------
ALTER TABLE public.ra_liquidaciones
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text,
  ADD COLUMN IF NOT EXISTS estado_revision text NOT NULL DEFAULT 'pendiente_revision',
  ADD COLUMN IF NOT EXISTS revisado_por uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revisado_at timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_revision text;

ALTER TABLE public.ra_liquidaciones
  ADD CONSTRAINT ra_liquidaciones_operation_hash_check CHECK (
    operation_id IS NULL
    OR (request_hash IS NOT NULL AND request_hash ~ '^[0-9a-f]{64}$')
  ),
  ADD CONSTRAINT ra_liquidaciones_estado_revision_check CHECK (
    estado_revision IN ('pendiente_revision', 'validada', 'observada')
  ),
  ADD CONSTRAINT ra_liquidaciones_revision_shape_check CHECK (
    (estado_revision = 'pendiente_revision'
      AND revisado_por IS NULL AND revisado_at IS NULL AND motivo_revision IS NULL)
    OR
    (estado_revision IN ('validada', 'observada')
      AND revisado_por IS NOT NULL AND revisado_at IS NOT NULL
      AND btrim(coalesce(motivo_revision, '')) <> '')
  );

CREATE UNIQUE INDEX IF NOT EXISTS uq_liquidaciones_empresa_operation
  ON public.ra_liquidaciones (empresa_id, operation_id)
  WHERE operation_id IS NOT NULL;

-- Una RPC de revision autorizada debe ejecutar, dentro de su misma
-- transaccion, set_config('app.ra_liquidacion_revision', 'v1', true)
-- antes del UPDATE. El trigger conserva inmutables todos los snapshots.
CREATE OR REPLACE FUNCTION public.ra_liquidaciones_proteger_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RA_LIQUIDATION_IMMUTABLE: DELETE prohibido';
  END IF;

  IF current_setting('app.ra_liquidacion_revision', true) IS DISTINCT FROM 'v1' THEN
    RAISE EXCEPTION 'RA_LIQUIDATION_IMMUTABLE: UPDATE fuera de revision autorizada';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.caja_id IS DISTINCT FROM OLD.caja_id
     OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
     OR NEW.usuario_id IS DISTINCT FROM OLD.usuario_id
     OR NEW.sistema_efectivo IS DISTINCT FROM OLD.sistema_efectivo
     OR NEW.sistema_yape IS DISTINCT FROM OLD.sistema_yape
     OR NEW.sistema_tarjeta IS DISTINCT FROM OLD.sistema_tarjeta
     OR NEW.sistema_transferencia IS DISTINCT FROM OLD.sistema_transferencia
     OR NEW.sistema_credito IS DISTINCT FROM OLD.sistema_credito
     OR NEW.conteo_efectivo IS DISTINCT FROM OLD.conteo_efectivo
     OR NEW.conteo_yape IS DISTINCT FROM OLD.conteo_yape
     OR NEW.conteo_tarjeta IS DISTINCT FROM OLD.conteo_tarjeta
     OR NEW.conteo_transferencia IS DISTINCT FROM OLD.conteo_transferencia
     OR NEW.conteo_credito IS DISTINCT FROM OLD.conteo_credito
     OR NEW.notas IS DISTINCT FROM OLD.notas
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.operation_id IS DISTINCT FROM OLD.operation_id
     OR NEW.request_hash IS DISTINCT FROM OLD.request_hash THEN
    RAISE EXCEPTION 'RA_LIQUIDATION_IMMUTABLE: snapshot no puede modificarse';
  END IF;

  IF OLD.estado_revision <> 'pendiente_revision'
     OR NEW.estado_revision NOT IN ('validada', 'observada') THEN
    RAISE EXCEPTION 'RA_LIQUIDATION_REVIEW_INVALID';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_liquidaciones_proteger_snapshot ON public.ra_liquidaciones;
CREATE TRIGGER trg_liquidaciones_proteger_snapshot
  BEFORE UPDATE OR DELETE ON public.ra_liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.ra_liquidaciones_proteger_snapshot();

REVOKE ALL ON FUNCTION public.ra_liquidaciones_proteger_snapshot() FROM PUBLIC, anon, authenticated;

COMMIT;
