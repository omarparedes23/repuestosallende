-- Configuración TEST posterior a 055. No ejecutar en producción.
-- Preflight 2026-09-01: Tienda Principal=b2c3d4e5-f6a7-8901-bcde-f12345678901;
-- Sucursal Nicolas Arriola=d7931340-7bac-4eb3-8772-7494eb58e9a0.
BEGIN;

WITH empresa AS (
  SELECT e.id FROM public.ra_empresas e
  WHERE e.ruc = '20610105280' AND e.activo
), config(sucursal_id,tipo_referenciado,serie) AS (
  VALUES
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,'factura'::public.ra_tipo_comprobante,'FC001'),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid,'boleta'::public.ra_tipo_comprobante,'BC001'),
    ('d7931340-7bac-4eb3-8772-7494eb58e9a0'::uuid,'factura'::public.ra_tipo_comprobante,'FC005'),
    ('d7931340-7bac-4eb3-8772-7494eb58e9a0'::uuid,'boleta'::public.ra_tipo_comprobante,'BC005')
)
INSERT INTO public.ra_series_documento(empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada)
SELECT e.id,c.sucursal_id,
  CASE c.tipo_referenciado WHEN 'factura' THEN 'nota_credito_factura' ELSE 'nota_credito_boleta' END,
  c.serie,1,true,true
FROM empresa e CROSS JOIN config c
ON CONFLICT (empresa_id,sucursal_id,tipo_documento,serie)
DO UPDATE SET siguiente_correlativo=1, activo=true, es_predeterminada=true, updated_at=now();

COMMIT;
