-- 019_compatibilidad_sprinter_backfill.sql
-- Backfill de ra_compatibilidades para repuestos Sprinter, parseando el numero de
-- modelo desde ra_catalogo_repuestos.nombre/descripcion (ej. "SPRINTER 313-413",
-- "SPRINTER 315-415-515"). Solo cubre productos que ya mencionan el modelo en el texto.
--
-- Tambien amplia la politica de escritura de ra_compatibilidades: antes solo
-- 'superadmin' podia mutarla, pero el panel (donde se va a gestionar esto) se usa
-- con rol 'administrador'.

DROP POLICY IF EXISTS "compat_mutate" ON ra_compatibilidades;
CREATE POLICY "compat_mutate" ON ra_compatibilidades
  TO authenticated
  USING (
    (SELECT rol FROM ra_perfiles WHERE id = auth.uid())
      = ANY (ARRAY['administrador'::ra_rol, 'superadmin'::ra_rol])
  );

INSERT INTO ra_compatibilidades (catalogo_id, modelo_id)
SELECT c.id, m.modelo_id
FROM ra_catalogo_repuestos c
CROSS JOIN LATERAL (
  VALUES
    ('10000000-0000-0000-0000-000000000001'::uuid, '\y(313|413)\y'),
    ('10000000-0000-0000-0000-000000000002'::uuid, '\y315\y'),
    ('10000000-0000-0000-0000-000000000007'::uuid, '\y414\y'),
    ('10000000-0000-0000-0000-000000000003'::uuid, '\y415\y'),
    ('10000000-0000-0000-0000-000000000008'::uuid, '\y416\y'),
    ('10000000-0000-0000-0000-000000000006'::uuid, '\y514\y'),
    ('10000000-0000-0000-0000-000000000004'::uuid, '\y515\y'),
    ('10000000-0000-0000-0000-000000000005'::uuid, '\y516\y'),
    ('10000000-0000-0000-0000-000000000009'::uuid, '\y906\y'),
    ('10000000-0000-0000-0000-000000000010'::uuid, '\y907\y')
) AS m(modelo_id, patron)
WHERE c.nombre ~* '\ySPRINTER\y'
  AND (c.nombre ~* m.patron OR c.descripcion ~* m.patron)
ON CONFLICT (catalogo_id, modelo_id) DO NOTHING;
