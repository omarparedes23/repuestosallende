-- Fixture persistente e idempotente para TEST. No usar en producción.
-- Reutiliza empresa, sucursal, vendedor, administrador y catálogo existentes.
\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE
  e uuid; s uuid; vendedor uuid; admin uuid; catalogo uuid;
  producto uuid := '90000000-0000-4000-8000-000000000001';
  cliente uuid := '90000000-0000-4000-8000-000000000002';
  caja uuid := '90000000-0000-4000-8000-000000000003';
  venta uuid := '90000000-0000-4000-8000-000000000010';
BEGIN
  SELECT p.empresa_id,p.sucursal_id,p.id INTO e,s,vendedor FROM public.ra_perfiles p WHERE p.activo AND p.rol='vendedor' AND p.sucursal_id IS NOT NULL ORDER BY p.id LIMIT 1;
  SELECT p.id INTO admin FROM public.ra_perfiles p WHERE p.activo AND p.empresa_id=e AND p.sucursal_id=s AND p.rol IN ('administrador','superadmin') ORDER BY p.id LIMIT 1;
  SELECT c.id INTO catalogo FROM public.ra_catalogo_repuestos c WHERE NOT EXISTS (SELECT 1 FROM public.ra_productos p WHERE p.empresa_id=e AND p.sucursal_id=s AND p.catalogo_id=c.id) ORDER BY c.id LIMIT 1;
  IF e IS NULL OR s IS NULL OR vendedor IS NULL OR admin IS NULL OR catalogo IS NULL THEN RAISE EXCEPTION 'Fixture postventa: faltan maestros elegibles'; END IF;
  INSERT INTO public.ra_productos(id,empresa_id,sucursal_id,catalogo_id,codigo_interno,precio_venta,precio_compra,stock_actual,stock_minimo,activo,moneda) VALUES(producto,e,s,catalogo,'TEST-POSTVENTA',100,50,100,1,true,'PEN') ON CONFLICT (id) DO UPDATE SET stock_actual=100,activo=true,precio_venta=100;
  INSERT INTO public.ra_clientes(id,empresa_id,tipo_cliente,tipo_documento,nro_documento,nombre,tiene_credito,limite_credito,saldo_deudor,activo) VALUES(cliente,e,'minorista','DNI','99999991','CLIENTE TEST POSTVENTA',true,10000,0,true) ON CONFLICT (id) DO UPDATE SET activo=true,tiene_credito=true,limite_credito=10000;
  INSERT INTO public.ra_cajas(id,empresa_id,sucursal_id,usuario_id,estado,monto_inicial,notas,operation_id,request_hash) VALUES(caja,e,s,admin,'abierta',1000,'Fixture postventa TEST','90000000-0000-4000-8000-000000000004',repeat('a',64)) ON CONFLICT (id) DO UPDATE SET estado='abierta',fecha_cierre=NULL;
  INSERT INTO public.ra_series_documento(empresa_id,sucursal_id,tipo_documento,serie,siguiente_correlativo,activo,es_predeterminada) VALUES(e,s,'nota_credito_boleta','BCTST',1,true,true),(e,s,'nota_credito_factura','FCTST',1,true,true) ON CONFLICT (empresa_id,sucursal_id,tipo_documento,serie) DO UPDATE SET activo=true,es_predeterminada=true,updated_at=now();
  INSERT INTO public.ra_ventas(id,empresa_id,sucursal_id,caja_id,cliente_id,usuario_id,tipo_venta,tipo_comprobante,subtotal,igv,total,estado,serie,correlativo,fecha_emision,moneda,operation_id,request_hash) VALUES(venta,e,s,caja,cliente,vendedor,'minorista','boleta',100,18,118,'completada','BTST',1,current_date,'PEN','90000000-0000-4000-8000-000000000010',repeat('b',64)) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ra_venta_items(id,venta_id,catalogo_id,cantidad,precio_unitario,descuento,subtotal,nombre_producto,codigo_oem) VALUES('90000000-0000-4000-8000-000000000011',venta,catalogo,5,100,0,500,'ITEM TEST POSTVENTA','TEST') ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ra_venta_pagos(id,venta_id,metodo_pago,monto) VALUES('90000000-0000-4000-8000-000000000012',venta,'efectivo',590) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.ra_sunat_outbox(id,empresa_id,venta_id,document_key,tipo_comprobante,serie,correlativo,request_payload,status,completed_at) VALUES('90000000-0000-4000-8000-000000000013',e,venta,'fixture-postventa-boleta','boleta','BTST',1,'{}'::jsonb,'accepted',now()) ON CONFLICT (venta_id) DO NOTHING;
END $$;
COMMIT;
