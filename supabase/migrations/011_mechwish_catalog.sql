-- 011_mechwish_catalog.sql
-- Categorías nuevas, modelos Sprinter faltantes y 71 productos MECHWISH

-- ─── 1. CATEGORÍAS NUEVAS ────────────────────────────────────────────────────
INSERT INTO ra_categorias (id, slug, nombre, orden) VALUES
  ('20000000-0000-0000-0000-000000000005', 'frenos',     'Frenos',     5),
  ('20000000-0000-0000-0000-000000000006', 'electrico',  'Eléctrico',  6),
  ('20000000-0000-0000-0000-000000000007', 'carroceria', 'Carrocería', 7)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. MODELOS SPRINTER FALTANTES ───────────────────────────────────────────
INSERT INTO ra_modelos_auto (id, marca_id, nombre, slug, activo) VALUES
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Sprinter 416', 'sprinter-416', true),
  ('10000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Sprinter 906', 'sprinter-906', true),
  ('10000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Sprinter 907', 'sprinter-907', true)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. PRODUCTOS + COMPATIBILIDADES ─────────────────────────────────────────
-- Variables reutilizables por bloque DO $$
DO $$
DECLARE
  -- Categorías
  CAT_SUSP UUID := '20000000-0000-0000-0000-000000000001';
  CAT_DIR  UUID := '20000000-0000-0000-0000-000000000002';
  CAT_MOT  UUID := '20000000-0000-0000-0000-000000000003';
  CAT_FRE  UUID := '20000000-0000-0000-0000-000000000005';
  CAT_ELE  UUID := '20000000-0000-0000-0000-000000000006';
  CAT_CAR  UUID := '20000000-0000-0000-0000-000000000007';

  -- Modelos
  M313 UUID := '10000000-0000-0000-0000-000000000001'; -- 313/413
  M315 UUID := '10000000-0000-0000-0000-000000000002';
  M415 UUID := '10000000-0000-0000-0000-000000000003';
  M515 UUID := '10000000-0000-0000-0000-000000000004';
  M516 UUID := '10000000-0000-0000-0000-000000000005';
  M514 UUID := '10000000-0000-0000-0000-000000000006';
  M414 UUID := '10000000-0000-0000-0000-000000000007';
  M416 UUID := '10000000-0000-0000-0000-000000000008';
  M906 UUID := '10000000-0000-0000-0000-000000000009';
  M907 UUID := '10000000-0000-0000-0000-000000000010';

  p UUID; -- ID del producto recién insertado
BEGIN

  -- 1. AMORTIGUADOR DELANTERO — 515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_SUSP, '906320730', 'Amortiguador Delantero', 'MECHWISH — Precio ref. S/ 210.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M515),(p,M516) ON CONFLICT DO NOTHING;

  -- 2. AMORTIGUADOR POSTERIOR — 515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_SUSP, '9063260000', 'Amortiguador Posterior', 'MECHWISH — Precio ref. S/ 105.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M515) ON CONFLICT DO NOTHING;

  -- 3. BOCINA DE BARRA ESTABILIZADORA — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_SUSP, '6673200073', 'Bocina de Barra Estabilizadora', 'MECHWISH — Precio ref. S/ 8.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 4. BOMBA DE AGUA AUXILIAR DE CALEFACCION — OM651 (315/415/515/516/906/907)
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '2118350264', 'Bomba de Agua Auxiliar de Calefacción', 'MECHWISH — Precio ref. S/ 262.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 5. BOMBA DE AGUA — OM611 (313/413)
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6112001101', 'Bomba de Agua OM611', 'MECHWISH — Precio ref. S/ 210.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 6. BOMBA DE AGUA — OM651 (315/415/515/516/906/907)
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6512002301', 'Bomba de Agua OM651', 'MECHWISH — Precio ref. S/ 231.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 7. BOMBA DE COMBUSTIBLE — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '9064707294', 'Bomba de Combustible', 'MECHWISH — Precio ref. S/ 892.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 8. TAPA PROTECTORA CONTRA SALPICADURAS — 415
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9064230420', 'Tapa Protectora contra Salpicaduras', 'MECHWISH — Precio ref. S/ 157.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M415) ON CONFLICT DO NOTHING;

  -- 9. COMPRESOR DE AIRE — OM651
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '0032300641', 'Compresor de Aire OM651', 'MECHWISH — Precio ref. S/ 998.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 10. COMPRESOR DE AIRE — OM611
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '0022305411', 'Compresor de Aire OM611', 'MECHWISH — Precio ref. S/ 998.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 11. CONDENSADOR DE AIRE — 315/415/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '9065000054', 'Condensador de Aire', 'MECHWISH — Precio ref. S/ 577.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516) ON CONFLICT DO NOTHING;

  -- 12. CREMALLERA DE DIRECCION ASISTIDA — 416/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9074600504', 'Cremallera de Dirección Asistida', 'MECHWISH — Precio ref. S/ 14,500.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M416),(p,M516) ON CONFLICT DO NOTHING;

  -- 13. CREMALLERA DE DIRECCION — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9064600800', 'Cremallera de Dirección', 'MECHWISH — Precio ref. S/ 1,155.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 14. CREMALLERA DE DIRECCION — 313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9014600800', 'Cremallera de Dirección 313/413', 'MECHWISH — Precio ref. S/ 945.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 15. DISCO DE FRENO DELANTERO — 315/415/515/516/416/414/514/906/907
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_FRE, '9064210012', 'Disco de Freno Delantero', 'MECHWISH — Precio ref. S/ 126.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M416),(p,M414),(p,M514),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 16. DISCO DE FRENO POSTERIOR — 313
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_FRE, '9024230612', 'Disco de Freno Posterior 313', 'MECHWISH — Precio ref. S/ 105.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 17. DISCO DE FRENO POSTERIOR — 315/414/415/416
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_FRE, '9064230012', 'Disco de Freno Posterior 315/414/415/416', 'MECHWISH — Precio ref. S/ 105.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M414),(p,M415),(p,M416) ON CONFLICT DO NOTHING;

  -- 18. DISCO DE FRENO POSTERIOR — 514/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_FRE, '9064230112', 'Disco de Freno Posterior 514/515/516', 'MECHWISH — Precio ref. S/ 150.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M514),(p,M515),(p,M516) ON CONFLICT DO NOTHING;

  -- 19. ENFRIADOR DE ACEITE — 315/415/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6511801210', 'Enfriador de Aceite', 'MECHWISH — Precio ref. S/ 630.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516) ON CONFLICT DO NOTHING;

  -- 20. ENFRIADOR DE ACEITE COMPLETO — OM651
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6511800610', 'Enfriador de Aceite Completo OM651', 'MECHWISH — Precio ref. S/ 577.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 21. ENFRIADOR DE ACEITE — OM611
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6111880301', 'Enfriador de Aceite OM611', 'MECHWISH — Precio ref. S/ 231.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 22. ENFRIADOR DE ACEITE (GALLETA) — 415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6511800665', 'Enfriador de Aceite (Galleta)', 'MECHWISH — Precio ref. S/ 262.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 23. ESPEJO RETROVISOR DERECHO — 313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9018100216', 'Espejo Retrovisor Derecho 313/413', 'MECHWISH — Precio ref. S/ 157.20') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 24. ESPEJO EXTERIOR DERECHO — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9068106116', 'Espejo Exterior Derecho', 'MECHWISH — Precio ref. S/ 210.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 25. ESPEJO RETROVISOR IZQUIERDO — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9068106016', 'Espejo Retrovisor Izquierdo', 'MECHWISH — Precio ref. S/ 210.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 26. ESPEJO RETROVISOR IZQUIERDO — 313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9018100116', 'Espejo Retrovisor Izquierdo 313/413', 'MECHWISH — Precio ref. S/ 157.20') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 27. FILTRO DE ACEITE — 902/903/904 (modelos no en DB, sin compat.)
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6111800009', 'Filtro de Aceite 902/903/904', 'MECHWISH — Precio ref. S/ 21.00') RETURNING id INTO p;

  -- 28. FILTRO DE ACEITE — OM611/313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, 'OX153D3', 'Filtro de Aceite OM611', 'MECHWISH — Precio ref. S/ 21.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 29. FILTRO DE A/C TECHO — 516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '0008354800', 'Filtro de A/C Techo', 'MECHWISH — Precio ref. S/ 42.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M516) ON CONFLICT DO NOTHING;

  -- 30. FILTRO DE ACEITE — OM651/315/415/515/416/516/906/907
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6511800009', 'Filtro de Aceite OM651', 'MECHWISH — Precio ref. S/ 21.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M416),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 31. FILTRO DE AIRE — OM611/313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '0030948304', 'Filtro de Aire OM611', 'MECHWISH — Precio ref. S/ 42.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 32. FILTRO DE AIRE — OM651/906/907
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '0000903751', 'Filtro de Aire OM651/906/907', 'MECHWISH — Precio ref. S/ 42.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 33. FILTRO DE AIRE — OM651/514/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '9075283500', 'Filtro de Aire OM651/514/516', 'MECHWISH — Precio ref. S/ 52.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M514) ON CONFLICT DO NOTHING;

  -- 34. FILTRO DE CABINA INFERIOR — OM611/313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9018300018', 'Filtro de Cabina Inferior 313/413', 'MECHWISH — Precio ref. S/ 42.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 35. FILTRO DE CABINA INFERIOR — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9068300318', 'Filtro de Cabina Inferior 315/415/515', 'MECHWISH — Precio ref. S/ 42.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 36. FILTRO DE CABINA INFERIOR — 414/514/416/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '4478300100', 'Filtro de Cabina Inferior 414/514/416/516', 'MECHWISH — Precio ref. S/ 42.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M414),(p,M514),(p,M416),(p,M516) ON CONFLICT DO NOTHING;

  -- 37. FILTRO DE COMBUSTIBLE — OM651/315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6510902952', 'Filtro de Combustible OM651', 'MECHWISH — Precio ref. S/ 126.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 38. FILTRO DE COMBUSTIBLE — OM611/313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6110900852', 'Filtro de Combustible OM611', 'MECHWISH — Precio ref. S/ 42.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 39. FILTRO DE COMBUSTIBLE SIN SENSOR — OM651/906/907/315/415/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '6460920501', 'Filtro de Combustible sin Sensor', 'MECHWISH — Precio ref. S/ 52.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 40. INTERCOOLER — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '9065010101', 'Intercooler', 'MECHWISH — Precio ref. S/ 472.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 41. FLUJOMETRO DE AIRE — OM651
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '6510900148', 'Flujómetro de Aire (MAF)', 'MECHWISH — Precio ref. S/ 367.20') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 42. KIT DE CADENA DE DISTRIBUCION 6 PIEZAS — OM651
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '559100330', 'Kit de Cadena de Distribución 6 Piezas', 'MECHWISH — Precio ref. S/ 609.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 43. KIT DE CADENA DE DISTRIBUCION 7 PIEZAS — OM651
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '559100330-7', 'Kit de Cadena de Distribución 7 Piezas', 'MECHWISH — Precio ref. S/ 609.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 44. MICA REFLECTORA PARACHOQUE POST DER — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9068260140', 'Mica Reflectora Parachoque Post. Derecha', 'MECHWISH — Precio ref. S/ 26.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 45. MICA REFLECTORA PARACHOQUE POST IZQ — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_CAR, '9068260040', 'Mica Reflectora Parachoque Post. Izquierda', 'MECHWISH — Precio ref. S/ 26.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 46. PASTILLA DE FRENO DELANTERA — 414/416/514/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_FRE, '107929510', 'Pastilla de Freno Delantera', 'MECHWISH — Precio ref. S/ 105.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M414),(p,M416),(p,M514),(p,M515),(p,M516) ON CONFLICT DO NOTHING;

  -- 47. PASTILLA DE FRENO POSTERIOR — 515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_FRE, '0044208120', 'Pastilla de Freno Posterior', 'MECHWISH — Precio ref. S/ 105.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M515) ON CONFLICT DO NOTHING;

  -- 48. PONCHO DE AMORTIGUADOR — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_SUSP, '9063230292', 'Poncho de Amortiguador', 'MECHWISH — Precio ref. S/ 21.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 49. RACK DE DIRECCION — 907/414/514/416/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9074606300', 'Rack de Dirección 907/416/516', 'MECHWISH — Precio ref. S/ 79.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M907),(p,M414),(p,M514),(p,M416),(p,M516) ON CONFLICT DO NOTHING;

  -- 50. RACK DE DIRECCION — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9064600055', 'Rack de Dirección 315/415/515', 'MECHWISH — Precio ref. S/ 52.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 51. RADIADOR — OM611/313/413
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '9015003400', 'Radiador OM611/313/413', 'MECHWISH — Precio ref. S/ 577.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M313) ON CONFLICT DO NOTHING;

  -- 52. RADIADOR — OM651
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_MOT, '9065000102', 'Radiador OM651', 'MECHWISH — Precio ref. S/ 525.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 53. RODAJE DE RUEDA POSTERIOR — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_SUSP, '9063503710', 'Rodaje de Rueda Posterior', 'MECHWISH — Precio ref. S/ 262.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 54. RODAJE DE RUEDA DELANTERA — 906/907/315/415/515/516/514/414
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_SUSP, '9063303520', 'Rodaje de Rueda Delantera', 'MECHWISH — Precio ref. S/ 252.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M906),(p,M907),(p,M315),(p,M415),(p,M515),(p,M516),(p,M514),(p,M414) ON CONFLICT DO NOTHING;

  -- 55. ROTULA DE DIRECCION — 906/907/315/415/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9063380227', 'Rótula de Dirección', 'MECHWISH — Precio ref. S/ 52.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M906),(p,M907),(p,M315),(p,M415),(p,M515),(p,M516) ON CONFLICT DO NOTHING;

  -- 56. SENSOR ABS DELANTERO/IZQUIERDO — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '9065400317', 'Sensor ABS Delantero/Izquierdo', 'MECHWISH — Precio ref. S/ 210.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 57. SENSOR DE DESGASTE PASTILLA INFERIOR — 315/415
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '6395401417', 'Sensor de Desgaste Pastilla Inferior', 'MECHWISH — Precio ref. S/ 105.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415) ON CONFLICT DO NOTHING;

  -- 58. SENSOR DE DESGASTE PASTILLA POSTERIOR — 315/415
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '9065401317', 'Sensor de Desgaste Pastilla Posterior', 'MECHWISH — Precio ref. S/ 12.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415) ON CONFLICT DO NOTHING;

  -- 59. SENSOR DE OXIGENO — OM651 (código 1)
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '0035428418', 'Sensor de Oxígeno OM651 (0035428418)', 'MECHWISH — Precio ref. S/ 262.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 60. SENSOR DE OXIGENO — OM651 (código 2)
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '0015409217', 'Sensor de Oxígeno OM651 (0015409217)', 'MECHWISH — Precio ref. S/ 262.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 61. SENSOR DE OXIGENO — 907
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '0075246418', 'Sensor de Oxígeno 907', 'MECHWISH — Precio ref. S/ 262.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M907) ON CONFLICT DO NOTHING;

  -- 62. SENSOR DE REVOLUCION RUEDA POST IZQ/DER — 907
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '9079050300', 'Sensor de Revolución Rueda Post. Izq/Der', 'MECHWISH — Precio ref. S/ 262.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M907) ON CONFLICT DO NOTHING;

  -- 63. SENSOR DE PASTILLAS FRENO DEL Y POST — 906/907
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_ELE, '9065401417', 'Sensor de Pastillas de Freno Del. y Post.', 'MECHWISH — Precio ref. S/ 13.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 64. SERVO DE DIRECCION — 904/906 (solo 906 en DB)
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '0024667501', 'Servo de Dirección 906', 'MECHWISH — Precio ref. S/ 441.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M906) ON CONFLICT DO NOTHING;

  -- 65. SERVO DE DIRECCION — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '0064667801', 'Servo de Dirección 315/415/515', 'MECHWISH — Precio ref. S/ 472.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 66. TERMINAL DE DIRECCION — 315/415/515
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9064600048', 'Terminal de Dirección', 'MECHWISH — Precio ref. S/ 52.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515) ON CONFLICT DO NOTHING;

  -- 67. TERMINAL DE DIRECCION DERECHO — 416/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9074606400', 'Terminal de Dirección Derecho 416/516', 'MECHWISH — Precio ref. S/ 30.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M416),(p,M516) ON CONFLICT DO NOTHING;

  -- 68. TERMINAL DE DIRECCION IZQUIERDO — 416/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9074606200', 'Terminal de Dirección Izquierdo 416/516', 'MECHWISH — Precio ref. S/ 79.00') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M416),(p,M516) ON CONFLICT DO NOTHING;

  -- 69. TORRETA DE AMORTIGUADOR — OM651
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_SUSP, '9063230520', 'Torreta de Amortiguador', 'MECHWISH — Precio ref. S/ 68.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M315),(p,M415),(p,M515),(p,M516),(p,M906),(p,M907) ON CONFLICT DO NOTHING;

  -- 70. TRAPECIO DE DIRECCION DERECHO — 906/907/315/415/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9063304007', 'Trapecio de Dirección Derecho', 'MECHWISH — Precio ref. S/ 388.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M906),(p,M907),(p,M315),(p,M415),(p,M515),(p,M516) ON CONFLICT DO NOTHING;

  -- 71. TRAPECIO DE DIRECCION IZQUIERDO — 906/907/315/415/515/516
  INSERT INTO ra_catalogo_repuestos (categoria_id, codigo_oem, nombre, descripcion)
  VALUES (CAT_DIR, '9063304007-I', 'Trapecio de Dirección Izquierdo', 'MECHWISH — Precio ref. S/ 388.50') RETURNING id INTO p;
  INSERT INTO ra_compatibilidades (catalogo_id, modelo_id) VALUES (p,M906),(p,M907),(p,M315),(p,M415),(p,M515),(p,M516) ON CONFLICT DO NOTHING;

END $$;
