-- ============================================================
-- 006_sucursales.sql
-- Multi-sucursal support: add ra_sucursales table and
-- sucursal_id foreign key to ra_cajas, ra_ventas, ra_productos,
-- ra_kardex, and ra_perfiles.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Create ra_sucursales
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ra_sucursales (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.ra_empresas(id) ON DELETE CASCADE,
  nombre     text NOT NULL,
  direccion  text,
  activo     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ra_sucursales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sucursales_select" ON public.ra_sucursales
  FOR SELECT USING (empresa_id = ra_empresa_id());

CREATE POLICY "sucursales_mutate" ON public.ra_sucursales
  FOR ALL USING (
    empresa_id = ra_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ra_perfiles
      WHERE id = auth.uid() AND rol IN ('administrador', 'gerente')
    )
  );

-- ------------------------------------------------------------
-- 2. Seed: "Tienda Principal" for the existing empresa
-- ------------------------------------------------------------
INSERT INTO public.ra_sucursales (id, empresa_id, nombre)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Tienda Principal'
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 3. Add sucursal_id columns (nullable initially for backfill)
-- ------------------------------------------------------------
ALTER TABLE public.ra_perfiles
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.ra_sucursales(id);

ALTER TABLE public.ra_cajas
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.ra_sucursales(id);

ALTER TABLE public.ra_ventas
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.ra_sucursales(id);

ALTER TABLE public.ra_productos
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.ra_sucursales(id);

ALTER TABLE public.ra_kardex
  ADD COLUMN IF NOT EXISTS sucursal_id uuid REFERENCES public.ra_sucursales(id);

-- ------------------------------------------------------------
-- 4. Backfill all existing rows → Tienda Principal
-- ------------------------------------------------------------
UPDATE public.ra_cajas
  SET sucursal_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
  WHERE sucursal_id IS NULL
    AND empresa_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

UPDATE public.ra_ventas
  SET sucursal_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
  WHERE sucursal_id IS NULL
    AND empresa_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

UPDATE public.ra_productos
  SET sucursal_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
  WHERE sucursal_id IS NULL
    AND empresa_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

UPDATE public.ra_kardex
  SET sucursal_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
  WHERE sucursal_id IS NULL
    AND empresa_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

-- ra_perfiles: vendedores get NULL (admins) or Tienda Principal
-- All existing perfiles belong to the single empresa — assign Tienda Principal
-- (admin can be changed manually later via the picker)
UPDATE public.ra_perfiles
  SET sucursal_id = 'b2c3d4e5-f6a7-8901-bcde-f12345678901'
  WHERE sucursal_id IS NULL
    AND empresa_id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    AND rol NOT IN ('administrador', 'gerente');

-- ------------------------------------------------------------
-- 5. SET NOT NULL on operational tables (cajas, ventas, productos, kardex)
--    ra_perfiles stays nullable: NULL = admin, non-null = vendedor's fixed store
-- ------------------------------------------------------------
ALTER TABLE public.ra_cajas    ALTER COLUMN sucursal_id SET NOT NULL;
ALTER TABLE public.ra_ventas   ALTER COLUMN sucursal_id SET NOT NULL;
ALTER TABLE public.ra_productos ALTER COLUMN sucursal_id SET NOT NULL;
ALTER TABLE public.ra_kardex   ALTER COLUMN sucursal_id SET NOT NULL;

-- ------------------------------------------------------------
-- 6. Drop old unique index on ra_productos (empresa, catalogo)
--    — replaced by the 3-column index below
-- ------------------------------------------------------------
DROP INDEX IF EXISTS public.ra_productos_empresa_id_catalogo_id_key;

-- ------------------------------------------------------------
-- 7. Create new indexes
-- ------------------------------------------------------------
-- One open caja per sucursal at a time (DB-enforced invariant)
CREATE UNIQUE INDEX IF NOT EXISTS ra_cajas_sucursal_activa
  ON public.ra_cajas(sucursal_id)
  WHERE estado = 'abierta';

-- One stock row per (empresa, sucursal, catalogo)
CREATE UNIQUE INDEX IF NOT EXISTS ra_productos_por_sucursal
  ON public.ra_productos(empresa_id, sucursal_id, catalogo_id);

-- Fast lookup of ventas by sucursal
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal
  ON public.ra_ventas(sucursal_id, created_at DESC);

-- Fast lookup of productos by sucursal
CREATE INDEX IF NOT EXISTS idx_productos_sucursal
  ON public.ra_productos(sucursal_id, activo);
