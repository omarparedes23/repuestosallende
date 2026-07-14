-- ============================================================
-- 032_cuentas_corrientes.sql
-- Cuentas corrientes / cobranzas: ledger append-only de cargos
-- (ventas a crédito) y abonos (cobros), con saldo_deudor de
-- ra_clientes como cache recalculado inline por las RPC de abajo.
-- Escritura EXCLUSIVA vía ra_registrar_cargo_credito/ra_registrar_cobro
-- (SECURITY DEFINER) — la tabla solo tiene policy de SELECT.
-- ============================================================

CREATE TYPE ra_cc_tipo_movimiento AS ENUM ('cargo', 'abono');

CREATE TABLE ra_cuenta_corriente_movimientos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id        UUID NOT NULL REFERENCES ra_empresas(id) ON DELETE RESTRICT,
  cliente_id        UUID NOT NULL REFERENCES ra_clientes(id) ON DELETE RESTRICT,
  venta_id          UUID NOT NULL REFERENCES ra_ventas(id) ON DELETE RESTRICT,
  tipo              ra_cc_tipo_movimiento NOT NULL,
  monto             NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  fecha             DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,                    -- solo cargo
  moneda_cobro      CHAR(3) CHECK (moneda_cobro IS NULL OR moneda_cobro IN ('PEN','USD')),
  tipo_cambio_cobro NUMERIC(10,4) CHECK (tipo_cambio_cobro IS NULL OR tipo_cambio_cobro > 0),
  metodo_pago       ra_metodo_pago,          -- solo abono; nunca 'credito'
  referencia        TEXT,
  usuario_id        UUID NOT NULL REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT ra_cc_shape_check CHECK (
    (tipo = 'cargo' AND fecha_vencimiento IS NOT NULL
       AND moneda_cobro IS NULL AND tipo_cambio_cobro IS NULL AND metodo_pago IS NULL)
    OR
    (tipo = 'abono' AND fecha_vencimiento IS NULL
       AND moneda_cobro IS NOT NULL
       AND metodo_pago IS NOT NULL AND metodo_pago <> 'credito')
  )
);

-- Una venta a crédito tiene UN solo cargo (regla de negocio: 1 venta = 1 vencimiento)
CREATE UNIQUE INDEX idx_cc_un_cargo_por_venta
  ON ra_cuenta_corriente_movimientos (venta_id) WHERE tipo = 'cargo';

CREATE INDEX idx_cc_cliente_fecha ON ra_cuenta_corriente_movimientos (cliente_id, fecha DESC);
CREATE INDEX idx_cc_venta         ON ra_cuenta_corriente_movimientos (venta_id);
CREATE INDEX idx_cc_empresa       ON ra_cuenta_corriente_movimientos (empresa_id);

ALTER TABLE ra_cuenta_corriente_movimientos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cc_movimientos_select" ON ra_cuenta_corriente_movimientos
  FOR SELECT TO authenticated USING (empresa_id = ra_empresa_id());
-- Sin política INSERT/UPDATE/DELETE para authenticated: escritura EXCLUSIVA
-- vía las RPC SECURITY DEFINER de abajo (mismo espíritu que ra_kardex, que
-- solo admite insert por service_role; acá el "gate" es la función, no el rol).

-- ============================================================
-- RPC: ra_registrar_cargo_credito
-- Llamada desde procesarVenta DESPUÉS de insertar ra_venta_pagos.
-- El monto del cargo se DERIVA de ra_venta_pagos (metodo_pago='credito'),
-- no se recibe como parámetro, para que cargo y pago nunca diverjan.
-- ============================================================
CREATE OR REPLACE FUNCTION ra_registrar_cargo_credito(
  p_venta_id UUID,
  p_fecha_vencimiento DATE
)
RETURNS TABLE (movimiento_id UUID, saldo_deudor_nuevo NUMERIC, limite_excedido BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id   UUID;
  v_cliente_id   UUID;
  v_tiene_credito BOOLEAN;
  v_limite_credito NUMERIC;
  v_monto        NUMERIC;
  v_movimiento_id UUID;
  v_saldo_nuevo  NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_venta_id::text));

  SELECT empresa_id, cliente_id INTO v_empresa_id, v_cliente_id
  FROM ra_ventas
  WHERE id = p_venta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta % no encontrada', p_venta_id;
  END IF;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'La venta no tiene cliente asociado';
  END IF;

  IF p_fecha_vencimiento IS NULL THEN
    RAISE EXCEPTION 'Fecha de vencimiento requerida para registrar el cargo';
  END IF;

  SELECT tiene_credito, limite_credito INTO v_tiene_credito, v_limite_credito
  FROM ra_clientes
  WHERE id = v_cliente_id;

  IF NOT FOUND OR NOT v_tiene_credito THEN
    RAISE EXCEPTION 'El cliente no tiene crédito habilitado';
  END IF;

  SELECT COALESCE(SUM(monto), 0) INTO v_monto
  FROM ra_venta_pagos
  WHERE venta_id = p_venta_id AND metodo_pago = 'credito';

  IF v_monto <= 0 THEN
    RAISE EXCEPTION 'No hay pago a crédito registrado para la venta %', p_venta_id;
  END IF;

  INSERT INTO ra_cuenta_corriente_movimientos (
    empresa_id, cliente_id, venta_id, tipo, monto, fecha_vencimiento, usuario_id
  ) VALUES (
    v_empresa_id, v_cliente_id, p_venta_id, 'cargo', v_monto, p_fecha_vencimiento, auth.uid()
  )
  RETURNING id INTO v_movimiento_id;

  UPDATE ra_clientes
  SET saldo_deudor = saldo_deudor + v_monto
  WHERE id = v_cliente_id
  RETURNING saldo_deudor INTO v_saldo_nuevo;

  RETURN QUERY SELECT v_movimiento_id, v_saldo_nuevo, (v_saldo_nuevo > v_limite_credito);
END;
$$;

GRANT EXECUTE ON FUNCTION ra_registrar_cargo_credito(UUID, DATE) TO authenticated;

-- Nota: en las referencias a funciones (GRANT/DROP/COMMENT) los modificadores
-- de tipo (CHAR(3), NUMERIC(10,4)) se ignoran — Postgres resuelve por el tipo
-- base (bpchar/numeric). Se listan sin modificador abajo por eso.

-- ============================================================
-- RPC: ra_registrar_cobro
-- Llamada desde el panel admin (registrarCobro). Registra un abono
-- contra una venta específica con saldo pendiente.
-- No toca ra_venta_pagos (esa tabla es solo la foto del pago original).
-- ============================================================
CREATE OR REPLACE FUNCTION ra_registrar_cobro(
  p_venta_id UUID,
  p_monto NUMERIC,
  p_fecha DATE,
  p_metodo_pago ra_metodo_pago,
  p_moneda_cobro CHAR(3),
  p_tipo_cambio_cobro NUMERIC DEFAULT NULL,
  p_referencia TEXT DEFAULT NULL
)
RETURNS TABLE (movimiento_id UUID, saldo_venta_nuevo NUMERIC, saldo_deudor_nuevo NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id    UUID;
  v_cliente_id    UUID;
  v_moneda_venta  CHAR(3);
  v_saldo_venta   NUMERIC;
  v_movimiento_id UUID;
  v_saldo_venta_nuevo NUMERIC;
  v_saldo_deudor_nuevo NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(p_venta_id::text));

  SELECT empresa_id, cliente_id, moneda INTO v_empresa_id, v_cliente_id, v_moneda_venta
  FROM ra_ventas
  WHERE id = p_venta_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta % no encontrada', p_venta_id;
  END IF;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'La venta no tiene cliente asociado';
  END IF;

  IF p_metodo_pago = 'credito' THEN
    RAISE EXCEPTION 'El método de pago del cobro no puede ser crédito';
  END IF;

  IF p_moneda_cobro <> v_moneda_venta THEN
    RAISE EXCEPTION 'La moneda del cobro (%) no coincide con la moneda de la venta (%)', p_moneda_cobro, v_moneda_venta;
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del cobro debe ser mayor a cero';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ra_cuenta_corriente_movimientos
    WHERE venta_id = p_venta_id AND tipo = 'cargo'
  ) THEN
    RAISE EXCEPTION 'La venta % no tiene un cargo a crédito registrado', p_venta_id;
  END IF;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE -monto END), 0) INTO v_saldo_venta
  FROM ra_cuenta_corriente_movimientos
  WHERE venta_id = p_venta_id;

  IF p_monto > v_saldo_venta THEN
    RAISE EXCEPTION 'El monto del cobro (%) supera el saldo pendiente de la venta (%)', p_monto, v_saldo_venta;
  END IF;

  INSERT INTO ra_cuenta_corriente_movimientos (
    empresa_id, cliente_id, venta_id, tipo, monto, fecha,
    moneda_cobro, tipo_cambio_cobro, metodo_pago, referencia, usuario_id
  ) VALUES (
    v_empresa_id, v_cliente_id, p_venta_id, 'abono', p_monto, p_fecha,
    p_moneda_cobro, p_tipo_cambio_cobro, p_metodo_pago, p_referencia, auth.uid()
  )
  RETURNING id INTO v_movimiento_id;

  v_saldo_venta_nuevo := v_saldo_venta - p_monto;

  UPDATE ra_clientes
  SET saldo_deudor = saldo_deudor - p_monto
  WHERE id = v_cliente_id
  RETURNING saldo_deudor INTO v_saldo_deudor_nuevo;

  RETURN QUERY SELECT v_movimiento_id, v_saldo_venta_nuevo, v_saldo_deudor_nuevo;
END;
$$;

GRANT EXECUTE ON FUNCTION ra_registrar_cobro(UUID, NUMERIC, DATE, ra_metodo_pago, CHAR, NUMERIC, TEXT) TO authenticated;
