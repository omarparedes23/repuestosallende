-- ============================================================
-- 033_ordenes_compra.sql
-- Órdenes de compra: cabecera + líneas SIN efecto en stock/kardex.
-- Una OC confirmada se recibe (total o parcialmente) vía compras
-- (ra_registrar_compra en 034_compras_v2.sql, referenciando
-- orden_compra_id) — la recepción es la que mueve stock, nunca la OC.
-- ============================================================

CREATE TYPE ra_estado_orden_compra AS ENUM ('borrador', 'confirmada', 'recibida', 'anulada');

-- ── Cabecera de orden de compra ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.ra_ordenes_compra (
  id           uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid                    NOT NULL REFERENCES public.ra_empresas(id) ON DELETE CASCADE,
  sucursal_id  uuid                    NOT NULL REFERENCES public.ra_sucursales(id),
  proveedor_id uuid                    REFERENCES public.ra_proveedores(id),
  usuario_id   uuid                    NOT NULL REFERENCES auth.users(id),
  referencia   text,
  fecha        date                    NOT NULL DEFAULT CURRENT_DATE,
  estado       ra_estado_orden_compra  NOT NULL DEFAULT 'borrador',
  notas        text,
  created_at   timestamptz             NOT NULL DEFAULT now(),
  updated_at   timestamptz             NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_compra_empresa
  ON public.ra_ordenes_compra(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ordenes_compra_proveedor
  ON public.ra_ordenes_compra(proveedor_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_compra_estado
  ON public.ra_ordenes_compra(estado);

CREATE TRIGGER ra_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ra_ordenes_compra
  FOR EACH ROW EXECUTE FUNCTION ra_set_updated_at();

-- ── Líneas de orden de compra ────────────────────────────────
-- precio_unitario es referencial (lo que se espera pagar); el precio
-- real de costeo se fija recién en la recepción (ra_compra_items).
-- cantidad_recibida se incrementa desde ra_registrar_compra cuando
-- la recepción viene vinculada a esta OC; pendiente = cantidad - cantidad_recibida.
CREATE TABLE IF NOT EXISTS public.ra_orden_compra_items (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id    uuid          NOT NULL REFERENCES public.ra_ordenes_compra(id) ON DELETE CASCADE,
  catalogo_id        uuid          NOT NULL REFERENCES public.ra_catalogo_repuestos(id),
  nombre_producto    text          NOT NULL,
  cantidad           numeric(10,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario    numeric(10,2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal           numeric(12,2) NOT NULL,
  cantidad_recibida  numeric(10,3) NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
  created_at         timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT ra_orden_compra_items_recibida_no_excede CHECK (cantidad_recibida <= cantidad)
);

CREATE INDEX IF NOT EXISTS idx_orden_compra_items_orden
  ON public.ra_orden_compra_items(orden_compra_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.ra_ordenes_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ordenes_compra_select" ON public.ra_ordenes_compra
  FOR SELECT USING (empresa_id = ra_empresa_id());

CREATE POLICY "ordenes_compra_mutate" ON public.ra_ordenes_compra
  FOR ALL USING (
    empresa_id = ra_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ra_perfiles
      WHERE id = auth.uid() AND rol IN ('administrador', 'superadmin')
    )
  );

ALTER TABLE public.ra_orden_compra_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orden_compra_items_select" ON public.ra_orden_compra_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ra_ordenes_compra oc
      WHERE oc.id = orden_compra_id AND oc.empresa_id = ra_empresa_id()
    )
  );

-- Los items se mutan directamente (INSERT al armar el borrador, DELETE al
-- quitar una línea antes de confirmar) — mismo criterio de rol que la cabecera.
-- La actualización de cantidad_recibida SIEMPRE pasa por ra_registrar_compra
-- (SECURITY DEFINER), nunca por esta policy — por eso no se restringe UPDATE
-- de cantidad_recibida específicamente aquí, se confía en que el flujo de
-- panel admin solo expone edición de líneas mientras la OC está en borrador.
CREATE POLICY "orden_compra_items_mutate" ON public.ra_orden_compra_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.ra_ordenes_compra oc
      WHERE oc.id = orden_compra_id AND oc.empresa_id = ra_empresa_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.ra_perfiles
      WHERE id = auth.uid() AND rol IN ('administrador', 'superadmin')
    )
  );

-- ============================================================
-- RPC: ra_confirmar_orden_compra
-- borrador -> confirmada. Exige al menos 1 línea. FOR UPDATE sobre
-- la cabecera para serializar contra confirmaciones concurrentes.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ra_confirmar_orden_compra(p_orden_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc         public.ra_ordenes_compra%ROWTYPE;
  v_item_count integer;
BEGIN
  SELECT * INTO v_oc
  FROM public.ra_ordenes_compra
  WHERE id = p_orden_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra % no encontrada', p_orden_compra_id;
  END IF;

  IF v_oc.estado != 'borrador' THEN
    RAISE EXCEPTION 'Solo órdenes en borrador pueden confirmarse (estado actual: %)', v_oc.estado;
  END IF;

  SELECT COUNT(*) INTO v_item_count
  FROM public.ra_orden_compra_items
  WHERE orden_compra_id = p_orden_compra_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'La orden de compra no tiene artículos';
  END IF;

  UPDATE public.ra_ordenes_compra
    SET estado = 'confirmada'
  WHERE id = p_orden_compra_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ra_confirmar_orden_compra(uuid) TO authenticated;

-- ============================================================
-- RPC: ra_anular_orden_compra
-- borrador | confirmada -> anulada. Rechaza si ya está 'recibida'
-- (las recepciones ya registradas viven en ra_compras y no se
-- revierten por anular la OC). FOR UPDATE sobre la cabecera.
-- ============================================================
CREATE OR REPLACE FUNCTION public.ra_anular_orden_compra(p_orden_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oc public.ra_ordenes_compra%ROWTYPE;
BEGIN
  SELECT * INTO v_oc
  FROM public.ra_ordenes_compra
  WHERE id = p_orden_compra_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orden de compra % no encontrada', p_orden_compra_id;
  END IF;

  IF v_oc.estado = 'recibida' THEN
    RAISE EXCEPTION 'No se puede anular una orden de compra ya recibida';
  END IF;

  IF v_oc.estado = 'anulada' THEN
    RAISE EXCEPTION 'La orden de compra ya está anulada';
  END IF;

  UPDATE public.ra_ordenes_compra
    SET estado = 'anulada'
  WHERE id = p_orden_compra_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ra_anular_orden_compra(uuid) TO authenticated;
