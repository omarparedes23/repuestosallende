-- ============================================================
-- 007_proveedores.sql
-- Maestro de proveedores por empresa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ra_proveedores (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid        NOT NULL REFERENCES public.ra_empresas(id) ON DELETE CASCADE,
  nombre       text        NOT NULL,
  ruc          text,
  telefono     text,
  email        text,
  direccion    text,
  contacto     text,
  notas        text,
  saldo_deudor numeric(10,2) NOT NULL DEFAULT 0 CHECK (saldo_deudor >= 0),
  activo       boolean     NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- RUC único por empresa (NULLs excluidos — múltiples sin RUC son válidos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_empresa_ruc
  ON public.ra_proveedores(empresa_id, ruc)
  WHERE ruc IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proveedores_empresa_nombre
  ON public.ra_proveedores(empresa_id, nombre);

CREATE TRIGGER ra_proveedores_updated_at
  BEFORE UPDATE ON public.ra_proveedores
  FOR EACH ROW EXECUTE FUNCTION ra_set_updated_at();

ALTER TABLE public.ra_proveedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proveedores_select" ON public.ra_proveedores
  FOR SELECT USING (empresa_id = ra_empresa_id());

CREATE POLICY "proveedores_mutate" ON public.ra_proveedores
  FOR ALL USING (
    empresa_id = ra_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ra_perfiles
      WHERE id = auth.uid()
        AND rol IN ('administrador', 'superadmin')
    )
  );
