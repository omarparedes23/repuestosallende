-- ============================================================
-- 034_compras_v2.sql
-- Compras v2: vincula con orden de compra (opcional), moneda,
-- IGV real (antes hardcodeado a 0) y costeo promedio ponderado
-- de ra_productos.precio_compra. Agrega ra_anular_compra.
-- ============================================================

-- ── ALTER ra_compras ─────────────────────────────────────────
ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS orden_compra_id uuid REFERENCES public.ra_ordenes_compra(id);

CREATE INDEX IF NOT EXISTS idx_compras_orden_compra
  ON public.ra_compras(orden_compra_id);

ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS moneda CHAR(3) NOT NULL DEFAULT 'PEN';

ALTER TABLE public.ra_compras
  ADD CONSTRAINT ra_compras_moneda_check CHECK (moneda IN ('PEN', 'USD'));

ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(10,4);

ALTER TABLE public.ra_compras
  ADD CONSTRAINT ra_compras_tipo_cambio_check CHECK (tipo_cambio IS NULL OR tipo_cambio > 0);

CREATE TYPE ra_estado_compra AS ENUM ('confirmada', 'anulada');

ALTER TABLE public.ra_compras
  ADD COLUMN IF NOT EXISTS estado ra_estado_compra NOT NULL DEFAULT 'confirmada';

CREATE INDEX IF NOT EXISTS idx_compras_estado
  ON public.ra_compras(estado);

-- ── RPC: ra_registrar_compra (reemplazo) ─────────────────────
-- Postgres identifica funciones por (nombre, lista de tipos de
-- argumentos): agregar parámetros nuevos —aunque tengan DEFAULT—
-- cambia esa lista, así que un simple CREATE OR REPLACE con más
-- parámetros NO reemplaza la función original de 6 argumentos:
-- crea una función SOBRECARGADA nueva y deja la vieja (con
-- igv=0 y sin costeo) activa para cualquier llamada posicional
-- de exactamente 6 argumentos. Por eso se hace DROP explícito
-- de la firma vieja antes del CREATE OR REPLACE de la nueva.
DROP FUNCTION IF EXISTS public.ra_registrar_compra(uuid, uuid, uuid, text, text, jsonb);

-- Registra compra + items + kardex + actualiza stock y costeo en una
-- transacción. Si p_orden_compra_id no es NULL, concilia cada línea
-- contra la OC (rechaza líneas que no pertenecen a la OC o que exceden
-- lo pendiente) y, si todas las líneas quedan sin pendiente, marca la
-- OC como 'recibida'.
-- p_items: [{"catalogo_id":"...", "cantidad":5, "precio_unitario":10.50, "nombre_producto":"..."}]
CREATE OR REPLACE FUNCTION public.ra_registrar_compra(
  p_empresa_id      uuid,
  p_sucursal_id     uuid,
  p_proveedor_id    uuid,
  p_nro_documento   text,
  p_notas           text,
  p_items           jsonb,
  p_orden_compra_id uuid DEFAULT NULL,
  p_moneda          CHAR(3) DEFAULT 'PEN',
  p_tipo_cambio     NUMERIC DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra_id       uuid;
  v_item            jsonb;
  v_catalogo_id     uuid;
  v_cantidad        numeric;
  v_precio_unit     numeric;
  v_nombre          text;
  v_subtotal_item   numeric;
  v_subtotal        numeric := 0;
  v_igv             numeric;
  v_total           numeric;
  v_producto_id     uuid;
  v_stock_anterior  numeric;
  v_precio_anterior numeric;
  v_precio_nuevo    numeric;
  v_oc              public.ra_ordenes_compra%ROWTYPE;
  v_oc_item         public.ra_orden_compra_items%ROWTYPE;
  v_oc_pendientes   integer;
BEGIN
  IF p_orden_compra_id IS NOT NULL THEN
    SELECT * INTO v_oc
    FROM public.ra_ordenes_compra
    WHERE id = p_orden_compra_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Orden de compra % no encontrada', p_orden_compra_id;
    END IF;

    IF v_oc.estado != 'confirmada' THEN
      RAISE EXCEPTION 'Solo órdenes de compra confirmadas admiten recepción (estado actual: %)', v_oc.estado;
    END IF;
  END IF;

  INSERT INTO public.ra_compras (
    empresa_id, sucursal_id, proveedor_id, nro_documento,
    notas, subtotal, igv, total, estado_pago, usuario_id,
    orden_compra_id, moneda, tipo_cambio, estado
  )
  VALUES (
    p_empresa_id, p_sucursal_id, p_proveedor_id, p_nro_documento,
    p_notas, 0, 0, 0, 'pendiente', auth.uid(),
    p_orden_compra_id, p_moneda, p_tipo_cambio, 'confirmada'
  )
  RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_catalogo_id   := (v_item->>'catalogo_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_precio_unit   := (v_item->>'precio_unitario')::numeric;
    v_nombre        := v_item->>'nombre_producto';
    v_subtotal_item := ROUND(v_cantidad * v_precio_unit, 2);
    v_subtotal      := v_subtotal + v_subtotal_item;

    INSERT INTO public.ra_compra_items (
      compra_id, catalogo_id, nombre_producto,
      cantidad, precio_unitario, subtotal
    )
    VALUES (
      v_compra_id, v_catalogo_id, v_nombre,
      v_cantidad, v_precio_unit, v_subtotal_item
    );

    -- Reconciliación contra OC (si viene vinculada): la línea debe
    -- existir en esa OC, y lo recibido no puede exceder lo pendiente.
    IF p_orden_compra_id IS NOT NULL THEN
      SELECT * INTO v_oc_item
      FROM public.ra_orden_compra_items
      WHERE orden_compra_id = p_orden_compra_id
        AND catalogo_id = v_catalogo_id
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El artículo % no pertenece a la orden de compra %', v_catalogo_id, p_orden_compra_id;
      END IF;

      IF v_cantidad > (v_oc_item.cantidad - v_oc_item.cantidad_recibida) THEN
        RAISE EXCEPTION 'La cantidad recibida (%) excede lo pendiente (%) de la línea %',
          v_cantidad, v_oc_item.cantidad - v_oc_item.cantidad_recibida, v_oc_item.id;
      END IF;

      UPDATE public.ra_orden_compra_items
        SET cantidad_recibida = cantidad_recibida + v_cantidad
      WHERE id = v_oc_item.id;
    END IF;

    -- Stock + kardex + costeo promedio ponderado.
    -- FOR UPDATE en el SELECT: sin esto, dos recepciones concurrentes del
    -- mismo producto podrían leer el mismo stock/precio "anterior" y una
    -- pisaría el costeo de la otra (misma clase de bug que ra_recibir_guia
    -- evita bloqueando la cabecera; acá el recurso en riesgo es la fila
    -- de producto, no la cabecera).
    SELECT id, stock_actual, precio_compra
    INTO v_producto_id, v_stock_anterior, v_precio_anterior
    FROM public.ra_productos
    WHERE empresa_id = p_empresa_id
      AND sucursal_id = p_sucursal_id
      AND catalogo_id = v_catalogo_id
    FOR UPDATE;

    IF v_producto_id IS NOT NULL THEN
      -- Costeo promedio ponderado — misma fórmula validada con vitest en
      -- src/lib/calc/costeoCompras.ts (calcularCostoPromedioPonderado).
      -- NULLIF evita división por cero si stock_anterior + cantidad = 0
      -- (no debería ocurrir: cantidad > 0 siempre en una línea de compra).
      v_precio_nuevo := (v_stock_anterior * COALESCE(v_precio_anterior, 0) + v_cantidad * v_precio_unit)
                        / NULLIF(v_stock_anterior + v_cantidad, 0);

      IF v_precio_nuevo IS NULL THEN
        v_precio_nuevo := v_precio_unit;
      END IF;

      v_precio_nuevo := ROUND(v_precio_nuevo, 2);

      UPDATE public.ra_productos
        SET stock_actual  = stock_actual + v_cantidad,
            precio_compra = v_precio_nuevo
      WHERE id = v_producto_id;

      INSERT INTO public.ra_kardex (
        empresa_id, sucursal_id, catalogo_id,
        tipo, motivo, cantidad,
        stock_anterior, stock_nuevo,
        referencia_id, usuario_id
      )
      VALUES (
        p_empresa_id, p_sucursal_id, v_catalogo_id,
        'entrada', 'compra', v_cantidad,
        v_stock_anterior, v_stock_anterior + v_cantidad,
        v_compra_id, auth.uid()
      );
    END IF;
  END LOOP;

  v_igv   := ROUND(v_subtotal * 0.18, 2);
  v_total := v_subtotal + v_igv;

  UPDATE public.ra_compras
    SET subtotal = v_subtotal, igv = v_igv, total = v_total
  WHERE id = v_compra_id;

  -- OC totalmente recibida (todas las líneas sin pendiente) -> 'recibida'.
  IF p_orden_compra_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_oc_pendientes
    FROM public.ra_orden_compra_items
    WHERE orden_compra_id = p_orden_compra_id
      AND cantidad_recibida < cantidad;

    IF v_oc_pendientes = 0 THEN
      UPDATE public.ra_ordenes_compra
        SET estado = 'recibida'
      WHERE id = p_orden_compra_id;
    END IF;
  END IF;

  RETURN v_compra_id;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- Nota (igual que 032_cuentas_corrientes.sql): en referencias a funciones
-- (GRANT/DROP) los modificadores de tipo (CHAR(3), NUMERIC(10,4)) se
-- ignoran — Postgres resuelve por el tipo base. Se listan sin modificador.
GRANT EXECUTE ON FUNCTION public.ra_registrar_compra(uuid, uuid, uuid, text, text, jsonb, uuid, CHAR, numeric) TO authenticated;

-- ============================================================
-- RPC: ra_anular_compra
-- Revierte stock y kardex de una compra 'confirmada', la marca
-- 'anulada'. Rechaza si el stock resultante de cualquier línea
-- quedaría negativo (aborta toda la operación, atómico).
-- Motivo de kardex: 'ajuste_manual' — ra_motivo_kardex no tiene
-- valor 'anulacion' (mismo criterio que ra_recibir_guia).
--
-- Rechaza también si la compra ya generó un cargo en cuentas por
-- pagar (ra_cuentas_por_pagar_movimientos, tabla creada después en
-- 035_cuentas_por_pagar.sql — se referencia por nombre, no por FK,
-- porque esta función se define ANTES que esa tabla exista dentro
-- de la migración 034; el chequeo solo corre en tiempo de ejecución,
-- momento en el que 035 ya se aplicó). Una vez que existe deuda real
-- con el proveedor, este sistema no soporta reversarla sin un
-- documento de Nota de Crédito — fuera de alcance v1 (ver
-- sdd/panel-compras/proposal, Out of Scope). Replica el criterio de
-- FastERP: una compra ya registrada (factura real) solo se reversa
-- vía Nota de Crédito, nunca anulando en el sitio.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ra_anular_compra(p_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_compra       public.ra_compras%ROWTYPE;
  v_item         public.ra_compra_items%ROWTYPE;
  v_producto_id  uuid;
  v_stock_actual numeric;
  v_stock_nuevo  numeric;
  v_tiene_cargo  boolean;
BEGIN
  SELECT * INTO v_compra
  FROM public.ra_compras
  WHERE id = p_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compra % no encontrada', p_compra_id;
  END IF;

  IF v_compra.estado != 'confirmada' THEN
    RAISE EXCEPTION 'Solo compras confirmadas pueden anularse (estado actual: %)', v_compra.estado;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.ra_cuentas_por_pagar_movimientos
    WHERE compra_id = p_compra_id AND tipo = 'cargo'
  ) INTO v_tiene_cargo;

  IF v_tiene_cargo THEN
    RAISE EXCEPTION 'No se puede anular: la compra ya generó un cargo en cuentas por pagar. Use una Nota de Crédito (fuera de alcance v1) para reversar una compra con deuda registrada.';
  END IF;

  FOR v_item IN
    SELECT * FROM public.ra_compra_items WHERE compra_id = p_compra_id
  LOOP
    SELECT id, stock_actual INTO v_producto_id, v_stock_actual
    FROM public.ra_productos
    WHERE empresa_id = v_compra.empresa_id
      AND sucursal_id = v_compra.sucursal_id
      AND catalogo_id = v_item.catalogo_id
    FOR UPDATE;

    IF v_producto_id IS NOT NULL THEN
      v_stock_nuevo := v_stock_actual - v_item.cantidad;

      IF v_stock_nuevo < 0 THEN
        RAISE EXCEPTION 'No se puede anular: el stock de "%" quedaría negativo (actual %, a revertir %)',
          v_item.nombre_producto, v_stock_actual, v_item.cantidad;
      END IF;

      UPDATE public.ra_productos
        SET stock_actual = v_stock_nuevo
      WHERE id = v_producto_id;

      INSERT INTO public.ra_kardex (
        empresa_id, sucursal_id, catalogo_id,
        tipo, motivo, cantidad,
        stock_anterior, stock_nuevo,
        referencia_id, usuario_id
      )
      VALUES (
        v_compra.empresa_id, v_compra.sucursal_id, v_item.catalogo_id,
        'salida', 'ajuste_manual', v_item.cantidad,
        v_stock_actual, v_stock_nuevo,
        p_compra_id, auth.uid()
      );
    END IF;
  END LOOP;

  UPDATE public.ra_compras
    SET estado = 'anulada'
  WHERE id = p_compra_id;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ra_anular_compra(uuid) TO authenticated;
