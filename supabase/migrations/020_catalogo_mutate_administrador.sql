-- 020_catalogo_mutate_administrador.sql
-- Amplia la escritura de ra_catalogo_repuestos a rol 'administrador' (antes solo
-- 'superadmin'), necesario para que el panel (usado con ese rol) pueda subir
-- fotos de producto (columna imagen_url) desde /panel/articulos.

DROP POLICY IF EXISTS "catalogo_mutate" ON ra_catalogo_repuestos;
CREATE POLICY "catalogo_mutate" ON ra_catalogo_repuestos
  TO authenticated
  USING (
    (SELECT rol FROM ra_perfiles WHERE id = auth.uid())
      = ANY (ARRAY['administrador'::ra_rol, 'superadmin'::ra_rol])
  );
