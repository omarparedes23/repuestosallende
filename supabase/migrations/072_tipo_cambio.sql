-- 072: tipo de cambio diario (USD -> PEN), sincronizado desde dbo.TipCam del ERP por script.ps1.
-- El POS lo usa para prellenar el T.C. de una venta en dolares (usa `venta`).
-- Es un dato global (no por tenant). Solo lectura para la app; las escrituras las hace
-- el sync con credenciales de servicio, que no pasan por RLS.

CREATE TABLE IF NOT EXISTS public.ra_tipo_cambio (
  fecha      date          PRIMARY KEY,
  compra     numeric(8,4)  NOT NULL CHECK (compra > 0),
  venta      numeric(8,4)  NOT NULL CHECK (venta > 0),
  updated_at timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE public.ra_tipo_cambio ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ra_tipo_cambio FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.ra_tipo_cambio TO authenticated;

DROP POLICY IF EXISTS ra_tipo_cambio_select ON public.ra_tipo_cambio;
CREATE POLICY ra_tipo_cambio_select ON public.ra_tipo_cambio
  FOR SELECT TO authenticated USING (true);
