-- ============================================================
-- 041_compra_cuenta_pagar_atomica.sql
-- Change: compra-cuenta-por-pagar-atomica (Fase 1)
--
-- Forward-only, aditiva. Prepara el esquema para la futura RPC
-- transaccional ra_confirmar_compra (Fase 2):
--
--   1. Columnas de idempotencia en ra_compras: operation_id /
--      request_hash (nullable => filas historicas compatibles).
--   2. Identidad documental del proveedor: tipo_documento (dominio
--      cerrado v1: FACTURA | BOLETA | OTROS, siempre mayusculas sin
--      espacios -> imposible evadir el indice con casing/espacios),
--      nro_doc_norm generada STORED e indice unico SIN exclusion de
--      anuladas.
--   3. Preflight abortante de duplicados historicos ANTES de crear
--      el indice unico: lista conflictos y NO corrige datos.
--   4. REVOKE de EXECUTE a PUBLIC/anon en las 4 RPCs legacy de
--      compra (hallazgo H1).
--   5. Proteccion de estado_pago (hallazgo H3):
--        - ra_estado_pago_proyectado(): derivada EXCLUSIVAMENTE del
--          ledger ra_cuentas_por_pagar_movimientos.
--        - trg_compras_guard_estado_pago: BEFORE ROW que rechaza
--          escrituras cuyo estado_pago difiera de la proyeccion.
--          Sin GUC ni banderas de bypass.
--        - Tres triggers statement-level SEPARADOS sobre el ledger
--          (INSERT/UPDATE/DELETE, cada uno con sus transition tables
--          validas) delegan en ra_sync_estado_pago_compras(uuid[]),
--          el UNICO escritor legitimo de estado_pago.
--   6. Funciones auxiliares internas: EXECUTE revocado para PUBLIC,
--      anon y authenticated (contrato interno; la RPC publica sera
--      ra_confirmar_compra en Fase 2).
--
-- NOTA DE ALCANCE (decision del propietario 2026-08-23): esta
-- migracion NO agrega 'anulacion_compra' a ra_motivo_kardex (queda
-- para el change futuro de anulaciones/devoluciones).
-- ra_anular_compra permanece sin cambios.
--
-- Registro: aplicar en TEST, verificar ambas suites y SOLO ENTONCES
-- insertar entrada en supabase_migrations.schema_migrations.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Proyeccion de estado_pago desde el ledger
--    Regla: sin cargo -> pendiente; saldo <= 0 -> pagado;
--    saldo >= total -> pendiente; 0 < saldo < total -> parcial.
--    Montos numeric(10,2) exactos: sin tolerancia.
--    INTERNA: sin EXECUTE publico (ver seccion 6).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_estado_pago_proyectado(
  p_compra_id uuid,
  p_total     numeric
)
RETURNS public.ra_estado_pago_compra
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_saldo numeric;
  v_tiene_cargo boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM ra_cuentas_por_pagar_movimientos
    WHERE compra_id = p_compra_id AND tipo = 'cargo'
  ) INTO v_tiene_cargo;

  IF NOT v_tiene_cargo THEN
    RETURN 'pendiente';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END), 0)
    INTO v_saldo
  FROM ra_cuentas_por_pagar_movimientos
  WHERE compra_id = p_compra_id;

  IF v_saldo <= 0 THEN
    RETURN 'pagado';
  END IF;

  IF v_saldo >= COALESCE(p_total, 0) THEN
    RETURN 'pendiente';
  END IF;

  RETURN 'parcial';
END;
$$;

-- ------------------------------------------------------------
-- 2. Preflight abortante de duplicados de factura
--    Reporta identidad tecnica: empresa, proveedor, documento
--    normalizado, cantidad y UUID representativo.
--    INTERNA: sin EXECUTE publico.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_preflight_compras_duplicadas()
RETURNS void
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_conflictos text;
BEGIN
  SELECT string_agg(
           format('%s | proveedor %s | doc %s | x%s | ej %s',
                  d.empresa_id, d.proveedor_id, d.doc_norm, d.n,
                  left(d.primer_id::text, 8)),
           E'\n  ')
    INTO v_conflictos
  FROM (
    SELECT empresa_id, proveedor_id, upper(btrim(nro_documento)) AS doc_norm,
           count(*) AS n, (array_agg(id ORDER BY id))[1] AS primer_id
    FROM ra_compras
    WHERE nro_documento IS NOT NULL AND btrim(nro_documento) <> ''
      AND proveedor_id IS NOT NULL
    GROUP BY empresa_id, proveedor_id, upper(btrim(nro_documento))
    HAVING count(*) > 1
  ) d;

  IF v_conflictos IS NOT NULL THEN
    RAISE EXCEPTION 'PREFLIGHT_DUPLICADOS: facturas duplicadas detectadas, resolver manualmente antes de aplicar:%',
                    chr(10) || v_conflictos;
  END IF;
END;
$$;

-- La migracion ABORTA aqui si hay duplicados (antes de mutar nada).
DO $$ BEGIN
  PERFORM public.ra_preflight_compras_duplicadas();
END $$;

-- ------------------------------------------------------------
-- 3. Columnas aditivas con compatibilidad historica
-- ------------------------------------------------------------
ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS operation_id uuid;

ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS request_hash text;

-- Dominio cerrado v1: FACTURA | BOLETA | OTROS. El CHECK exige el valor
-- EXACTO en mayusculas sin espacios: ' factura', 'FACTURA ' o variantes
-- son rechazadas => nadie puede evadir el indice unico con casing.
ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS tipo_documento text
  NOT NULL DEFAULT 'FACTURA';

ALTER TABLE public.ra_compras DROP CONSTRAINT IF EXISTS ra_compras_tipo_documento_check;
ALTER TABLE public.ra_compras
  ADD CONSTRAINT ra_compras_tipo_documento_check
  CHECK (tipo_documento IN ('FACTURA', 'BOLETA', 'OTROS'));

-- request_hash: NULL o SHA-256 hex minusculo exacto (64 chars)
ALTER TABLE public.ra_compras DROP CONSTRAINT IF EXISTS ra_compras_request_hash_format;
ALTER TABLE public.ra_compras
  ADD CONSTRAINT ra_compras_request_hash_format
  CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$');

-- Normalizacion autoritativa del numero documental
ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS nro_doc_norm text
  GENERATED ALWAYS AS (NULLIF(upper(btrim(nro_documento)), '')) STORED;

COMMENT ON COLUMN public.ra_compras.operation_id IS
  'Idempotencia: identificador de la operacion de negocio (recepcion logica). Reintentos reutilizan el id; recepciones nuevas usan uno nuevo. NULL = fila historica pre-migracion.';
COMMENT ON COLUMN public.ra_compras.request_hash IS
  'Hash canonico SHA-256 hex minusculo del payload normalizado. Mismo id + hash distinto = conflicto.';
COMMENT ON COLUMN public.ra_compras.tipo_documento IS
  'Dominio v1: FACTURA | BOLETA | OTROS (exacto, mayusculas, sin espacios). Parte de la identidad documental.';
COMMENT ON COLUMN public.ra_compras.nro_doc_norm IS
  'Numero documental normalizado (upper/btrim), generado STORED. Base de la unicidad por proveedor.';

-- ------------------------------------------------------------
-- 4. Unicidad de operacion (solo filas nuevas con operation_id)
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_compras_operation_id
  ON public.ra_compras (empresa_id, operation_id)
  WHERE operation_id IS NOT NULL;

-- ------------------------------------------------------------
-- 5. Unicidad de identidad documental
--    SIN exclusion de anuladas: la anulacion conserva la identidad
--    y evidencia del documento. Filas sin proveedor o sin numero
--    quedan fuera (NULLs excluidos por predicado / distincion).
-- ------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_compras_factura_proveedor
  ON public.ra_compras (empresa_id, proveedor_id, tipo_documento, nro_doc_norm)
  WHERE nro_doc_norm IS NOT NULL;

-- ------------------------------------------------------------
-- 6. Hallazgo H1: revocar EXECUTE publico/anon en RPCs legacy
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ra_registrar_compra(uuid, uuid, uuid, text, text, jsonb, uuid, CHAR, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ra_registrar_compra(uuid, uuid, uuid, text, text, jsonb, uuid, CHAR, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.ra_registrar_compra(uuid, uuid, uuid, text, text, jsonb, uuid, CHAR, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.ra_anular_compra(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ra_anular_compra(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ra_anular_compra(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ra_registrar_cargo_compra(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ra_registrar_cargo_compra(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.ra_registrar_cargo_compra(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.ra_registrar_pago_proveedor(uuid, numeric, date, ra_metodo_pago, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ra_registrar_pago_proveedor(uuid, numeric, date, ra_metodo_pago, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ra_registrar_pago_proveedor(uuid, numeric, date, ra_metodo_pago, text) TO authenticated;

-- ------------------------------------------------------------
-- 7. Proteccion de estado_pago (hallazgo H3)
--
--    7.a Helper interno: unico escritor legitimo de estado_pago.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_sync_estado_pago_compras(p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.ra_compras c
     SET estado_pago = public.ra_estado_pago_proyectado(c.id, c.total)
   WHERE c.id = ANY(p_ids)
     AND c.estado = 'confirmada';
END;
$$;

--    7.b Guard row-level sobre ra_compras
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_guard_estado_pago()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_esperado public.ra_estado_pago_compra;
BEGIN
  -- Si la columna no cambia, nada que validar
  IF TG_OP = 'UPDATE' AND NEW.estado_pago IS NOT DISTINCT FROM OLD.estado_pago THEN
    RETURN NEW;
  END IF;

  -- Compras anuladas: fuera de la semantica de pago
  IF NEW.estado <> 'confirmada' THEN
    RETURN NEW;
  END IF;

  v_esperado := public.ra_estado_pago_proyectado(NEW.id, NEW.total);

  IF NEW.estado_pago IS DISTINCT FROM v_esperado THEN
    RAISE EXCEPTION 'RA_ESTADO_PAGO_INCONSISTENTE: estado_pago (%) no coincide con el ledger (proyeccion %)',
                    NEW.estado_pago, v_esperado;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compras_guard_estado_pago ON public.ra_compras;
CREATE TRIGGER trg_compras_guard_estado_pago
  BEFORE INSERT OR UPDATE ON public.ra_compras
  FOR EACH ROW
  EXECUTE FUNCTION public.ra_guard_estado_pago();

--    7.c Sincronizadores statement-level separados (transition tables
--        validas por operacion): INSERT->NEW, DELETE->OLD,
--        UPDATE->ambas. Delegan en el helper comun.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ra_cxp_sync_desde_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT compra_id), '{}') INTO v_ids FROM new_tab;
  PERFORM public.ra_sync_estado_pago_compras(v_ids);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_cxp_sync_desde_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT compra_id), '{}') INTO v_ids FROM old_tab;
  PERFORM public.ra_sync_estado_pago_compras(v_ids);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.ra_cxp_sync_desde_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  SELECT COALESCE(array_agg(DISTINCT s.compra_id), '{}') INTO v_ids
  FROM (
    SELECT compra_id FROM new_tab
    UNION ALL
    SELECT compra_id FROM old_tab
  ) s;
  PERFORM public.ra_sync_estado_pago_compras(v_ids);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cxp_sync_estado_pago_ins ON public.ra_cuentas_por_pagar_movimientos;
CREATE TRIGGER trg_cxp_sync_estado_pago_ins
  AFTER INSERT ON public.ra_cuentas_por_pagar_movimientos
  REFERENCING NEW TABLE AS new_tab
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.ra_cxp_sync_desde_insert();

DROP TRIGGER IF EXISTS trg_cxp_sync_estado_pago_upd ON public.ra_cuentas_por_pagar_movimientos;
CREATE TRIGGER trg_cxp_sync_estado_pago_upd
  AFTER UPDATE ON public.ra_cuentas_por_pagar_movimientos
  REFERENCING NEW TABLE AS new_tab OLD TABLE AS old_tab
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.ra_cxp_sync_desde_update();

DROP TRIGGER IF EXISTS trg_cxp_sync_estado_pago_del ON public.ra_cuentas_por_pagar_movimientos;
CREATE TRIGGER trg_cxp_sync_estado_pago_del
  AFTER DELETE ON public.ra_cuentas_por_pagar_movimientos
  REFERENCING OLD TABLE AS old_tab
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.ra_cxp_sync_desde_delete();

-- ------------------------------------------------------------
-- 8. Funciones auxiliares internas: sin contrato publico.
--    EXECUTE revocado para PUBLIC, anon y authenticated.
--    (La RPC publica ra_confirmar_compra llega en Fase 2.)
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.ra_estado_pago_proyectado(uuid, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_preflight_compras_duplicadas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_sync_estado_pago_compras(uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_guard_estado_pago() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_cxp_sync_desde_insert() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_cxp_sync_desde_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ra_cxp_sync_desde_update() FROM PUBLIC, anon, authenticated;

-- ------------------------------------------------------------
-- 9. Backfill idempotente de filas historicas
--    (pasa el guard porque asigna exactamente la proyeccion)
-- ------------------------------------------------------------
UPDATE public.ra_compras
   SET estado_pago = public.ra_estado_pago_proyectado(id, total)
WHERE estado = 'confirmada';

COMMIT;

-- ============================================================
-- Verificacion post-aplicacion (manual, read-only):
--   psql -f supabase/tests/compra-atomica-schema.test.sql
--   psql -f supabase/tests/compra-atomica-preflight.test.sql
--
-- Registro en ledger (SOLO despues de que ambas suites pasen):
--   INSERT INTO supabase_migrations.schema_migrations (version, name)
--   VALUES ('041','compra_cuenta_pagar_atomica');
-- ============================================================
