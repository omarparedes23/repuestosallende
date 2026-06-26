-- ============================================================
-- 009_guias.sql
-- Guías de remisión entre sucursales + RPC de recepción
-- ============================================================

CREATE TYPE ra_estado_guia AS ENUM ('borrador', 'emitida', 'en_transito', 'recibida');

-- ── Cabecera de guía ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ra_guias_remision (
  id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          uuid            NOT NULL REFERENCES public.ra_empresas(id) ON DELETE CASCADE,
  sucursal_origen_id  uuid            NOT NULL REFERENCES public.ra_sucursales(id),
  sucursal_destino_id uuid            NOT NULL REFERENCES public.ra_sucursales(id),
  usuario_id          uuid            NOT NULL REFERENCES auth.users(id),
  estado              ra_estado_guia  NOT NULL DEFAULT 'borrador',
  serie               text,
  correlativo         integer,
  notas               text,
  fecha_emision       date,
  fecha_recepcion     timestamptz,
  created_at          timestamptz     NOT NULL DEFAULT now(),
  updated_at          timestamptz     NOT NULL DEFAULT now(),
  CHECK (sucursal_origen_id != sucursal_destino_id)
);

CREATE INDEX IF NOT EXISTS idx_guias_empresa
  ON public.ra_guias_remision(empresa_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guias_origen
  ON public.ra_guias_remision(sucursal_origen_id);

CREATE INDEX IF NOT EXISTS idx_guias_destino
  ON public.ra_guias_remision(sucursal_destino_id);

CREATE TRIGGER ra_guias_updated_at
  BEFORE UPDATE ON public.ra_guias_remision
  FOR EACH ROW EXECUTE FUNCTION ra_set_updated_at();

-- ── Líneas de guía ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ra_guia_items (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_id         uuid          NOT NULL REFERENCES public.ra_guias_remision(id) ON DELETE CASCADE,
  catalogo_id     uuid          NOT NULL REFERENCES public.ra_catalogo_repuestos(id),
  nombre_producto text          NOT NULL,
  cantidad        numeric(10,3) NOT NULL CHECK (cantidad > 0),
  created_at      timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guia_items_guia
  ON public.ra_guia_items(guia_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.ra_guias_remision ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guias_select" ON public.ra_guias_remision
  FOR SELECT USING (empresa_id = ra_empresa_id());

CREATE POLICY "guias_mutate" ON public.ra_guias_remision
  FOR ALL USING (
    empresa_id = ra_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ra_perfiles
      WHERE id = auth.uid() AND rol IN ('administrador', 'superadmin')
    )
  );

ALTER TABLE public.ra_guia_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guia_items_select" ON public.ra_guia_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ra_guias_remision g
      WHERE g.id = guia_id AND g.empresa_id = ra_empresa_id()
    )
  );

-- ── RPC: ra_recibir_guia ─────────────────────────────────────
-- Marca guía como recibida y ejecuta kardex doble (salida origen + entrada destino)
CREATE OR REPLACE FUNCTION public.ra_recibir_guia(p_guia_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guia              public.ra_guias_remision%ROWTYPE;
  v_item              public.ra_guia_items%ROWTYPE;
  v_prod_origen_id    uuid;
  v_prod_destino_id   uuid;
  v_stock_origen      numeric;
  v_stock_destino     numeric;
BEGIN
  SELECT * INTO v_guia
  FROM public.ra_guias_remision
  WHERE id = p_guia_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Guía no encontrada';
  END IF;

  IF v_guia.estado != 'en_transito' THEN
    RAISE EXCEPTION 'Solo guías en_transito pueden ser recibidas (estado actual: %)', v_guia.estado;
  END IF;

  FOR v_item IN
    SELECT * FROM public.ra_guia_items WHERE guia_id = p_guia_id
  LOOP
    -- Origen
    SELECT id, stock_actual INTO v_prod_origen_id, v_stock_origen
    FROM public.ra_productos
    WHERE empresa_id = v_guia.empresa_id
      AND sucursal_id = v_guia.sucursal_origen_id
      AND catalogo_id = v_item.catalogo_id;

    IF v_prod_origen_id IS NOT NULL THEN
      UPDATE public.ra_productos
        SET stock_actual = stock_actual - v_item.cantidad
      WHERE id = v_prod_origen_id;

      INSERT INTO public.ra_kardex (
        empresa_id, sucursal_id, catalogo_id, tipo, motivo,
        cantidad, stock_anterior, stock_nuevo, referencia_id, usuario_id
      ) VALUES (
        v_guia.empresa_id, v_guia.sucursal_origen_id, v_item.catalogo_id,
        'salida', 'ajuste_manual', v_item.cantidad,
        v_stock_origen, v_stock_origen - v_item.cantidad,
        p_guia_id, auth.uid()
      );
    END IF;

    -- Destino
    SELECT id, stock_actual INTO v_prod_destino_id, v_stock_destino
    FROM public.ra_productos
    WHERE empresa_id = v_guia.empresa_id
      AND sucursal_id = v_guia.sucursal_destino_id
      AND catalogo_id = v_item.catalogo_id;

    IF v_prod_destino_id IS NOT NULL THEN
      UPDATE public.ra_productos
        SET stock_actual = stock_actual + v_item.cantidad
      WHERE id = v_prod_destino_id;

      INSERT INTO public.ra_kardex (
        empresa_id, sucursal_id, catalogo_id, tipo, motivo,
        cantidad, stock_anterior, stock_nuevo, referencia_id, usuario_id
      ) VALUES (
        v_guia.empresa_id, v_guia.sucursal_destino_id, v_item.catalogo_id,
        'entrada', 'ajuste_manual', v_item.cantidad,
        v_stock_destino, v_stock_destino + v_item.cantidad,
        p_guia_id, auth.uid()
      );
    END IF;
  END LOOP;

  UPDATE public.ra_guias_remision
    SET estado = 'recibida', fecha_recepcion = now()
  WHERE id = p_guia_id;

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ra_recibir_guia TO authenticated;
