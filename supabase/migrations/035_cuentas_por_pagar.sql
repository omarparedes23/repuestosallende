-- ============================================================
-- 035_cuentas_por_pagar.sql
-- Cuentas por pagar / proveedores: ledger append-only de cargos
-- (compras) y abonos (pagos a proveedor), con saldo_deudor de
-- ra_proveedores como cache recalculado inline por las RPC de abajo.
-- Mismo patrón que 032_cuentas_corrientes.sql (ledger + RPC
-- SECURITY DEFINER como único camino de escritura).
--
-- Nota de alcance vs. ra_cuenta_corriente_movimientos: esta tabla
-- NO incluye fecha_vencimiento ni moneda_cobro/tipo_cambio_cobro —
-- el diseño (sdd/panel-compras/design) no las pidió para CxP (la
-- moneda de la compra ya vive en ra_compras.moneda/tipo_cambio) y no
-- hay concepto de vencimiento de crédito para proveedores en v1.
-- ============================================================

CREATE TYPE ra_cxp_tipo_movimiento AS ENUM ('cargo', 'abono');

CREATE TABLE ra_cuentas_por_pagar_movimientos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID NOT NULL REFERENCES ra_empresas(id) ON DELETE RESTRICT,
  proveedor_id UUID NOT NULL REFERENCES ra_proveedores(id) ON DELETE RESTRICT,
  compra_id    UUID NOT NULL REFERENCES ra_compras(id) ON DELETE RESTRICT,
  tipo         ra_cxp_tipo_movimiento NOT NULL,
  monto        NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha        DATE NOT NULL DEFAULT CURRENT_DATE,
  metodo_pago  ra_metodo_pago,          -- solo abono; nunca 'credito'
  referencia   TEXT,
  usuario_id   UUID NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ra_cxp_shape_check CHECK (
    (tipo = 'cargo' AND metodo_pago IS NULL)
    OR
    (tipo = 'abono' AND metodo_pago IS NOT NULL AND metodo_pago <> 'credito')
  )
);

-- Una compra tiene UN solo cargo (regla de negocio: 1 compra = 1 cargo)
CREATE UNIQUE INDEX idx_cxp_un_cargo_por_compra
  ON ra_cuentas_por_pagar_movimientos (compra_id) WHERE tipo = 'cargo';

CREATE INDEX idx_cxp_proveedor_fecha ON ra_cuentas_por_pagar_movimientos (proveedor_id, fecha DESC);
CREATE INDEX idx_cxp_compra          ON ra_cuentas_por_pagar_movimientos (compra_id);
CREATE INDEX idx_cxp_empresa         ON ra_cuentas_por_pagar_movimientos (empresa_id);

ALTER TABLE ra_cuentas_por_pagar_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cxp_movimientos_select" ON ra_cuentas_por_pagar_movimientos
  FOR SELECT TO authenticated USING (empresa_id = ra_empresa_id());
-- Sin política INSERT/UPDATE/DELETE para authenticated: escritura EXCLUSIVA
-- vía las RPC SECURITY DEFINER de abajo (mismo espíritu que
-- ra_cuenta_corriente_movimientos).

-- ============================================================
-- RPC: ra_registrar_cargo_compra
-- Inserta el cargo (monto = total de la compra) e incrementa
-- ra_proveedores.saldo_deudor inline. FOR UPDATE sobre ra_compras
-- para serializar contra otra llamada concurrente sobre la misma compra.
-- ============================================================
CREATE OR REPLACE FUNCTION ra_registrar_cargo_compra(
  p_compra_id UUID
)
RETURNS TABLE (movimiento_id UUID, saldo_deudor_nuevo NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra        ra_compras%ROWTYPE;
  v_movimiento_id UUID;
  v_saldo_nuevo   NUMERIC;
BEGIN
  SELECT * INTO v_compra
  FROM ra_compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % no encontrada', p_compra_id;
  END IF;

  IF v_compra.proveedor_id IS NULL THEN
    RAISE EXCEPTION 'La compra no tiene proveedor asociado';
  END IF;

  IF v_compra.total <= 0 THEN
    RAISE EXCEPTION 'La compra no tiene un total válido para generar cargo';
  END IF;

  IF EXISTS (
    SELECT 1 FROM ra_cuentas_por_pagar_movimientos
    WHERE compra_id = p_compra_id AND tipo = 'cargo'
  ) THEN
    RAISE EXCEPTION 'La compra % ya tiene un cargo registrado', p_compra_id;
  END IF;

  INSERT INTO ra_cuentas_por_pagar_movimientos (
    empresa_id, proveedor_id, compra_id, tipo, monto, fecha, usuario_id
  ) VALUES (
    v_compra.empresa_id, v_compra.proveedor_id, p_compra_id, 'cargo', v_compra.total, CURRENT_DATE, auth.uid()
  )
  RETURNING id INTO v_movimiento_id;

  UPDATE ra_proveedores
  SET saldo_deudor = saldo_deudor + v_compra.total
  WHERE id = v_compra.proveedor_id
  RETURNING saldo_deudor INTO v_saldo_nuevo;

  RETURN QUERY SELECT v_movimiento_id, v_saldo_nuevo;
END;
$$;

GRANT EXECUTE ON FUNCTION ra_registrar_cargo_compra(UUID) TO authenticated;

-- ============================================================
-- RPC: ra_registrar_pago_proveedor
-- Registra un abono contra una compra específica con saldo pendiente.
-- Rechaza sobrepago (pago genérico/FIFO NO existe — mismo criterio
-- que ra_registrar_cobro). FOR UPDATE sobre ra_compras.
-- ============================================================
CREATE OR REPLACE FUNCTION ra_registrar_pago_proveedor(
  p_compra_id   UUID,
  p_monto       NUMERIC,
  p_fecha       DATE,
  p_metodo_pago ra_metodo_pago,
  p_referencia  TEXT DEFAULT NULL
)
RETURNS TABLE (movimiento_id UUID, saldo_compra_nuevo NUMERIC, saldo_deudor_nuevo NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra             ra_compras%ROWTYPE;
  v_saldo_compra       NUMERIC;
  v_movimiento_id      UUID;
  v_saldo_compra_nuevo NUMERIC;
  v_saldo_deudor_nuevo NUMERIC;
BEGIN
  SELECT * INTO v_compra
  FROM ra_compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % no encontrada', p_compra_id;
  END IF;

  IF v_compra.proveedor_id IS NULL THEN
    RAISE EXCEPTION 'La compra no tiene proveedor asociado';
  END IF;

  IF p_metodo_pago = 'credito' THEN
    RAISE EXCEPTION 'El método de pago del pago a proveedor no puede ser crédito';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a cero';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ra_cuentas_por_pagar_movimientos
    WHERE compra_id = p_compra_id AND tipo = 'cargo'
  ) THEN
    RAISE EXCEPTION 'La compra % no tiene un cargo registrado', p_compra_id;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END), 0) INTO v_saldo_compra
  FROM ra_cuentas_por_pagar_movimientos
  WHERE compra_id = p_compra_id;

  IF p_monto > v_saldo_compra THEN
    RAISE EXCEPTION 'El monto del pago (%) supera el saldo pendiente de la compra (%)', p_monto, v_saldo_compra;
  END IF;

  INSERT INTO ra_cuentas_por_pagar_movimientos (
    empresa_id, proveedor_id, compra_id, tipo, monto, fecha,
    metodo_pago, referencia, usuario_id
  ) VALUES (
    v_compra.empresa_id, v_compra.proveedor_id, p_compra_id, 'abono', p_monto, p_fecha,
    p_metodo_pago, p_referencia, auth.uid()
  )
  RETURNING id INTO v_movimiento_id;

  v_saldo_compra_nuevo := v_saldo_compra - p_monto;

  UPDATE ra_proveedores
  SET saldo_deudor = saldo_deudor - p_monto
  WHERE id = v_compra.proveedor_id
  RETURNING saldo_deudor INTO v_saldo_deudor_nuevo;

  RETURN QUERY SELECT v_movimiento_id, v_saldo_compra_nuevo, v_saldo_deudor_nuevo;
END;
$$;

GRANT EXECUTE ON FUNCTION ra_registrar_pago_proveedor(UUID, NUMERIC, DATE, ra_metodo_pago, TEXT) TO authenticated;
