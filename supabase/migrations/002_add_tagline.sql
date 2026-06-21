ALTER TABLE ra_modelos_auto ADD COLUMN tagline TEXT;

UPDATE ra_modelos_auto SET tagline = 'Furgón urbano de carga liviana'             WHERE slug = 'sprinter-313-413';
UPDATE ra_modelos_auto SET tagline = 'Equilibrio entre carga y potencia'           WHERE slug = 'sprinter-315';
UPDATE ra_modelos_auto SET tagline = 'Alta capacidad con motor eficiente'          WHERE slug = 'sprinter-415';
UPDATE ra_modelos_auto SET tagline = 'Máxima carga en configuración furgón'       WHERE slug = 'sprinter-515';
UPDATE ra_modelos_auto SET tagline = 'Techo alto para máximo volumen'              WHERE slug = 'sprinter-516';
UPDATE ra_modelos_auto SET tagline = 'Minibús y furgón de alta capacidad'         WHERE slug = 'sprinter-514';
UPDATE ra_modelos_auto SET tagline = 'Versatilidad urbana para flotas comerciales' WHERE slug = 'sprinter-414';
