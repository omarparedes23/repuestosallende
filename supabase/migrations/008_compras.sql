-- ============================================================
-- 008_compras.sql
-- Registro de compras a proveedores + RPC transaccional
-- ============================================================

CREATE TYPE ra_estado_pago_compra AS ENUM ('pendiente', 'parcial', 'pagado');

-- ── Cabecera de compra ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ra_compras (
  id            uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id    uuid                   NOT NULL REFERENCES public.ra_empresas(id) ON DELETE CASCADE,
  sucursal_id   uuid                   NOT NULL REFERENCES public.ra_sucursales(id),
  proveedor_id  uuid                   REFERENCES public.ra_proveedores(id),
  usuario_id    uuid                   NOT NULL REFERENCES auth.users(id),
  nro_documento text,
  fecha_compra  date                   NOT NULL DEFAULT CURRENT_DATE,
  subtotal      numeric(12,2)          NOT NULL DEFAULT 0,
  igv           numeric(12,2)          NOT NULL DEFAULT 0,
  total         numeric(12,2)          NOT NULL DEFAULT 0,
  estado_pago   ra_estado_pago_compra  NOT NULL DEFAULT 'pendiente',
  notas         text,
  created_at    timestamptz            NOT NULL DEFAULT now(),
  updated_at    timestamptz            NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compras_empresa
  ON public.ra_compras(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_compras_proveedor
  ON public.ra_compras(proveedor_id);

CREATE TRIGGER ra_compras_updated_at
  BEFORE UPDATE ON public.ra_compras
  FOR EACH ROW EXECUTE FUNCTION ra_set_updated_at();

-- ── Líneas de compra ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ra_compra_items (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id        uuid          NOT NULL REFERENCES public.ra_compras(id) ON DELETE CASCADE,
  catalogo_id      uuid          NOT NULL REFERENCES public.ra_catalogo_repuestos(id),
  nombre_producto  text          NOT NULL,
  cantidad         numeric(10,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario  numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal         numeric(12,2) NOT NULL,
  created_at       timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compra_items_compra
  ON public.ra_compra_items(compra_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.ra_compras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compras_select" ON public.ra_compras
  FOR SELECT USING (empresa_id = ra_empresa_id());

CREATE POLICY "compras_mutate" ON public.ra_compras
  FOR ALL USING (
    empresa_id = ra_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ra_perfiles
      WHERE id = auth.uid() AND rol IN ('administrador', 'superadmin')
    )
  );

ALTER TABLE public.ra_compra_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compra_items_select" ON public.ra_compra_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ra_compras c
      WHERE c.id = compra_id AND c.empresa_id = ra_empresa_id()
    )
  );

-- ── RPC: ra_registrar_compra ─────────────────────────────────
-- Registra compra + items + kardex + actualiza stock en una transacción.
-- p_items: [{"catalogo_id":"...", "cantidad":5, "precio_unitario":10.50, "nombre_producto":"..."}]
CREATE OR REPLACE FUNCTION public.ra_registrar_compra(
  p_empresa_id    uuid,
  p_sucursal_id   uuid,
  p_proveedor_id  uuid,
  p_nro_documento text,
  p_notas         text,
  p_items         jsonb
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
  v_total           numeric := 0;
  v_producto_id     uuid;
  v_stock_anterior  numeric;
BEGIN
  INSERT INTO public.ra_compras (
    empresa_id, sucursal_id, proveedor_id, nro_documento,
    notas, subtotal, igv, total, estado_pago, usuario_id
  )
  VALUES (
    p_empresa_id, p_sucursal_id, p_proveedor_id, p_nro_documento,
    p_notas, 0, 0, 0, 'pendiente', auth.uid()
  )
  RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_catalogo_id   := (v_item->>'catalogo_id')::uuid;
    v_cantidad      := (v_item->>'cantidad')::numeric;
    v_precio_unit   := (v_item->>'precio_unitario')::numeric;
    v_nombre        := v_item->>'nombre_producto';
    v_subtotal_item := ROUND(v_cantidad * v_precio_unit, 2);
    v_total         := v_total + v_subtotal_item;

    INSERT INTO public.ra_compra_items (
      compra_id, catalogo_id, nombre_producto,
      cantidad, precio_unitario, subtotal
    )
    VALUES (
      v_compra_id, v_catalogo_id, v_nombre,
      v_cantidad, v_precio_unit, v_subtotal_item
    );

    SELECT id, stock_actual
    INTO v_producto_id, v_stock_anterior
    FROM public.ra_productos
    WHERE empresa_id = p_empresa_id
      AND sucursal_id = p_sucursal_id
      AND catalogo_id = v_catalogo_id;

    IF v_producto_id IS NOT NULL THEN
      UPDATE public.ra_productos
        SET stock_actual = stock_actual + v_cantidad
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

  UPDATE public.ra_compras
    SET subtotal = v_total, total = v_total
  WHERE id = v_compra_id;

  RETURN v_compra_id;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ra_registrar_compra TO authenticated;
