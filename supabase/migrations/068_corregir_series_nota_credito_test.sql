-- 068: normaliza series NC existentes de TEST al contrato OSE de cuatro caracteres.
-- La NC FC001-00000001 rechazada se conserva en outbox como evidencia; FC01 inicia
-- en 1 porque OSE confirmó que FC001-00000001 no fue registrada.
BEGIN;

UPDATE public.ra_series_documento
SET serie = CASE serie
  WHEN 'FC001' THEN 'FC01'
  WHEN 'BC001' THEN 'BC01'
  WHEN 'FC005' THEN 'FC05'
  WHEN 'BC005' THEN 'BC05'
  WHEN 'FCTST' THEN 'FC01'
  WHEN 'BCTST' THEN 'BC01'
  WHEN 'FCTS' THEN 'FC01'
  WHEN 'BCTS' THEN 'BC01'
END,
updated_at=now()
WHERE tipo_documento IN ('nota_credito_factura','nota_credito_boleta')
  AND serie IN ('FC001','BC001','FC005','BC005','FCTST','BCTST','FCTS','BCTS');

UPDATE public.ra_series_documento
SET siguiente_correlativo=1,updated_at=now()
WHERE empresa_id='a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid
  AND sucursal_id='b2c3d4e5-f6a7-8901-bcde-f12345678901'::uuid
  AND tipo_documento IN ('nota_credito_factura','nota_credito_boleta')
  AND serie IN ('FC01','BC01');

ALTER TABLE public.ra_series_documento
  DROP CONSTRAINT IF EXISTS ra_series_documento_nota_credito_serie_check;
ALTER TABLE public.ra_series_documento
  ADD CONSTRAINT ra_series_documento_nota_credito_serie_check CHECK (
    tipo_documento NOT IN ('nota_credito_factura','nota_credito_boleta')
    OR serie ~ '^[BF][A-Z0-9]{3}$'
  );

COMMIT;
