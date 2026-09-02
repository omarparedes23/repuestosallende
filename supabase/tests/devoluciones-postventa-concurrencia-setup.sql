-- Prepara DOS devoluciones aprobadas sobre la misma línea de venta del fixture.
-- Requiere -v RUN_ID=<32 hex>. Escribe datos deliberadamente persistentes en TEST;
-- el runner siempre invoca el script retire para retirarlos y verificar residuo cero.
\set ON_ERROR_STOP on
\if :{?RUN_ID}
\else
  \echo 'RUN_ID es obligatorio'
  \quit
\endif

BEGIN;
SELECT set_config('test.postventa_run_id', :'RUN_ID', true);
DO $$
DECLARE
  v_run text := current_setting('test.postventa_run_id');
  v_venta uuid := '90000000-0000-4000-8000-000000000010';
  v_item uuid := '90000000-0000-4000-8000-000000000011';
  v_vendedor uuid;
  v_admin uuid;
  v_empresa uuid;
  v_sucursal uuid;
  v_devolucion uuid;
  v_n integer;
BEGIN
  IF v_run !~ '^[0-9a-f]{32}$' THEN
    RAISE EXCEPTION 'RUN_ID invalido';
  END IF;
  SELECT empresa_id,sucursal_id INTO v_empresa,v_sucursal
  FROM public.ra_ventas WHERE id=v_venta FOR SHARE;
  SELECT id INTO v_vendedor FROM public.ra_perfiles
  WHERE empresa_id=v_empresa AND sucursal_id=v_sucursal AND activo AND rol='vendedor'
  ORDER BY id LIMIT 1;
  SELECT id INTO v_admin FROM public.ra_perfiles
  WHERE empresa_id=v_empresa AND sucursal_id=v_sucursal AND activo AND rol IN ('administrador','superadmin')
  ORDER BY id LIMIT 1;
  IF v_vendedor IS NULL OR v_admin IS NULL THEN
    RAISE EXCEPTION 'Fixture postventa no tiene vendedor/admin scopeados';
  END IF;

  FOR v_n IN 1..2 LOOP
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',v_vendedor,'role','authenticated')::text, true);
    v_devolucion := (public.ra_solicitar_devolucion_v1(
      extensions.gen_random_uuid(), v_venta,
      jsonb_build_array(jsonb_build_object('ventaItemId',v_item,'cantidad',3,'reingresaStock',true)),
      'CONCURRENCIA:'||v_run
    )->>'devolucionId')::uuid;
    PERFORM public.ra_registrar_recepcion_devolucion_v1(
      extensions.gen_random_uuid(), v_devolucion, true, 'apto_reventa', null
    );
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',v_admin,'role','authenticated')::text, true);
    PERFORM public.ra_aprobar_devolucion_v1(
      extensions.gen_random_uuid(), v_devolucion, true, null
    );
  END LOOP;
END $$;
COMMIT;
