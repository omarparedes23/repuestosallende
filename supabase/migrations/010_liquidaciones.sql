-- ============================================================
-- 010_liquidaciones.sql
-- Liquidación de caja: conteo físico vs sistema por método de pago
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ra_liquidaciones (
  id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id               uuid          NOT NULL REFERENCES public.ra_cajas(id) ON DELETE CASCADE,
  empresa_id            uuid          NOT NULL REFERENCES public.ra_empresas(id) ON DELETE CASCADE,
  usuario_id            uuid          NOT NULL REFERENCES auth.users(id),
  -- totales del sistema (calculados automáticamente al liquidar)
  sistema_efectivo      numeric(12,2) NOT NULL DEFAULT 0,
  sistema_yape          numeric(12,2) NOT NULL DEFAULT 0,
  sistema_tarjeta       numeric(12,2) NOT NULL DEFAULT 0,
  sistema_transferencia numeric(12,2) NOT NULL DEFAULT 0,
  sistema_credito       numeric(12,2) NOT NULL DEFAULT 0,
  -- conteo físico ingresado por el admin
  conteo_efectivo       numeric(12,2) NOT NULL DEFAULT 0,
  conteo_yape           numeric(12,2) NOT NULL DEFAULT 0,
  conteo_tarjeta        numeric(12,2) NOT NULL DEFAULT 0,
  conteo_transferencia  numeric(12,2) NOT NULL DEFAULT 0,
  conteo_credito        numeric(12,2) NOT NULL DEFAULT 0,
  -- diferencias calculadas por Postgres (conteo - sistema)
  diff_efectivo         numeric(12,2) GENERATED ALWAYS AS (conteo_efectivo      - sistema_efectivo)      STORED,
  diff_yape             numeric(12,2) GENERATED ALWAYS AS (conteo_yape          - sistema_yape)          STORED,
  diff_tarjeta          numeric(12,2) GENERATED ALWAYS AS (conteo_tarjeta       - sistema_tarjeta)       STORED,
  diff_transferencia    numeric(12,2) GENERATED ALWAYS AS (conteo_transferencia - sistema_transferencia) STORED,
  diff_credito          numeric(12,2) GENERATED ALWAYS AS (conteo_credito       - sistema_credito)       STORED,
  notas                 text,
  created_at            timestamptz   NOT NULL DEFAULT now()
);

-- Una liquidación por caja
CREATE UNIQUE INDEX IF NOT EXISTS idx_liquidaciones_caja
  ON public.ra_liquidaciones(caja_id);

CREATE INDEX IF NOT EXISTS idx_liquidaciones_empresa
  ON public.ra_liquidaciones(empresa_id, created_at DESC);

ALTER TABLE public.ra_liquidaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liquidaciones_select" ON public.ra_liquidaciones
  FOR SELECT USING (empresa_id = ra_empresa_id());

CREATE POLICY "liquidaciones_mutate" ON public.ra_liquidaciones
  FOR ALL USING (
    empresa_id = ra_empresa_id()
    AND EXISTS (
      SELECT 1 FROM public.ra_perfiles
      WHERE id = auth.uid() AND rol IN ('administrador', 'superadmin')
    )
  );
