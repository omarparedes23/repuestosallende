-- Hardening forward-only para 038_venta_transaccional_idempotente.
-- No elimina columnas ni datos; puede aplicarse despues de una ejecucion manual de 038.

ALTER TABLE public.ra_ventas
  ADD COLUMN IF NOT EXISTS credit_limit_exceeded BOOLEAN;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ra_ventas'::regclass
      AND conname = 'ra_ventas_request_hash_shape'
  ) THEN
    ALTER TABLE public.ra_ventas
      ADD CONSTRAINT ra_ventas_request_hash_shape
      CHECK (request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$');
  END IF;
END
$constraint$;

DO $rename$
BEGIN
  IF to_regprocedure('public.ra_confirmar_venta(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date)') IS NOT NULL
     AND to_regprocedure('public.ra_confirmar_venta_v1(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date)') IS NULL THEN
    ALTER FUNCTION public.ra_confirmar_venta(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date)
      RENAME TO ra_confirmar_venta_v1;
  END IF;
END
$rename$;

CREATE OR REPLACE FUNCTION public.ra_venta_resultado(p_venta_id UUID, p_replayed BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'status', 'confirmed',
    'replayed', p_replayed,
    'operationId', v.operation_id,
    'sale', jsonb_build_object(
      'id', v.id, 'total', v.total, 'tipoComprobante', v.tipo_comprobante,
      'moneda', trim(v.moneda), 'serie', v.serie, 'correlativo', v.correlativo,
      'numeroCompleto', v.numero_completo
    ),
    'empresa', jsonb_build_object(
      'razonSocial', e.razon_social, 'ruc', e.ruc, 'direccion', e.direccion, 'telefono', e.telefono
    ),
    'sucursal', jsonb_build_object('nombre', s.nombre, 'direccion', s.direccion),
    'warnings', jsonb_build_object('creditLimitExceeded', COALESCE(v.credit_limit_exceeded, false)),
    'fiscal', jsonb_build_object(
      'required', v.tipo_comprobante IN ('boleta','factura'),
      'status', o.status
    )
  )
  FROM public.ra_ventas v
  JOIN public.ra_empresas e ON e.id = v.empresa_id
  JOIN public.ra_sucursales s ON s.id = v.sucursal_id
  LEFT JOIN public.ra_sunat_outbox o ON o.venta_id = v.id
  WHERE v.id = p_venta_id;
$$;

CREATE OR REPLACE FUNCTION public.ra_confirmar_venta(
  p_operation_id UUID,
  p_sucursal_id UUID,
  p_tipo_comprobante public.ra_tipo_comprobante,
  p_cliente_id UUID,
  p_items JSONB,
  p_pagos JSONB,
  p_moneda CHAR(3),
  p_tipo_cambio NUMERIC,
  p_fecha_vencimiento DATE
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_result JSONB;
  v_sale UUID;
  v_replayed BOOLEAN;
BEGIN
  v_result := public.ra_confirmar_venta_v1(
    p_operation_id, p_sucursal_id, p_tipo_comprobante, p_cliente_id,
    p_items, p_pagos, p_moneda, p_tipo_cambio, p_fecha_vencimiento
  );

  IF COALESCE(v_result->>'status', '') <> 'confirmed' THEN
    RETURN v_result;
  END IF;

  v_replayed := COALESCE((v_result->>'replayed')::BOOLEAN, false);
  v_sale := (v_result->'sale'->>'id')::UUID;

  -- Solo la primera confirmacion fija el resultado; los replay no recalculan el saldo actual.
  IF NOT v_replayed THEN
    UPDATE public.ra_ventas v
    SET credit_limit_exceeded = COALESCE((
      SELECT c.saldo_deudor > c.limite_credito
      FROM public.ra_clientes c
      WHERE c.id = v.cliente_id
    ), false)
    WHERE v.id = v_sale;
  END IF;

  RETURN public.ra_venta_resultado(v_sale, v_replayed);
END;
$$;

REVOKE ALL ON FUNCTION public.ra_confirmar_venta_v1(UUID,UUID,public.ra_tipo_comprobante,UUID,JSONB,JSONB,CHAR,NUMERIC,DATE) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.ra_confirmar_venta(UUID,UUID,public.ra_tipo_comprobante,UUID,JSONB,JSONB,CHAR,NUMERIC,DATE) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ra_confirmar_venta(UUID,UUID,public.ra_tipo_comprobante,UUID,JSONB,JSONB,CHAR,NUMERIC,DATE) TO authenticated;

COMMENT ON COLUMN public.ra_ventas.credit_limit_exceeded IS
  'Advertencia congelada en el commit de la venta para que los replay sean estables.';
