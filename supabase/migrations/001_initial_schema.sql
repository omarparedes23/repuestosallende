-- ============================================================
-- MIGRATION: 001_initial_schema.sql — repuestosallende ra_*
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ENUM
CREATE TYPE ra_rol AS ENUM ('superadmin', 'administrador', 'vendedor', 'lectura');

-- ============================================================
-- TABLAS GLOBALES (sin empresa_id)
-- Administradas centralmente por superadmin
-- ============================================================

CREATE TABLE ra_marcas_auto (
  id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE ra_modelos_auto (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id   UUID NOT NULL REFERENCES ra_marcas_auto(id),
  nombre     TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  motor      TEXT,
  cc         TEXT,
  año_desde  INT,
  año_hasta  INT,
  imagen_url TEXT,
  activo     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE ra_categorias (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre    TEXT NOT NULL,
  slug      TEXT NOT NULL UNIQUE,
  parent_id UUID REFERENCES ra_categorias(id),
  orden     INT NOT NULL DEFAULT 0,
  activo    BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE ra_catalogo_repuestos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES ra_categorias(id),
  codigo_oem   TEXT,
  nombre       TEXT NOT NULL,
  descripcion  TEXT,
  imagen_url   TEXT,
  activo       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ra_compatibilidades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_id UUID NOT NULL REFERENCES ra_catalogo_repuestos(id) ON DELETE CASCADE,
  modelo_id   UUID NOT NULL REFERENCES ra_modelos_auto(id),
  año_desde   INT,
  año_hasta   INT,
  UNIQUE(catalogo_id, modelo_id)
);

-- ============================================================
-- TABLAS POR EMPRESA (con empresa_id)
-- ============================================================

CREATE TABLE ra_empresas (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  logo_url   TEXT,
  telefono   TEXT,
  email      TEXT,
  direccion  TEXT,
  activo     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ra_perfiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES ra_empresas(id),
  nombre     TEXT NOT NULL,
  rol        ra_rol NOT NULL DEFAULT 'administrador',
  activo     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE ra_productos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES ra_empresas(id),
  catalogo_id      UUID NOT NULL REFERENCES ra_catalogo_repuestos(id),
  codigo_interno   TEXT,
  precio_venta     NUMERIC(10,2),
  precio_mayorista NUMERIC(10,2),
  precio_compra    NUMERIC(10,2),
  stock_actual     NUMERIC(10,3) NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_minimo     NUMERIC(10,3) NOT NULL DEFAULT 0,
  activo           BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(empresa_id, catalogo_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX idx_catalogo_nombre_trgm ON ra_catalogo_repuestos USING GIN (nombre gin_trgm_ops);
CREATE INDEX idx_catalogo_oem_trgm    ON ra_catalogo_repuestos USING GIN (codigo_oem gin_trgm_ops);
CREATE INDEX idx_catalogo_categoria   ON ra_catalogo_repuestos (categoria_id, activo);
CREATE INDEX idx_compat_catalogo      ON ra_compatibilidades (catalogo_id);
CREATE INDEX idx_compat_modelo        ON ra_compatibilidades (modelo_id);
CREATE INDEX idx_modelos_slug         ON ra_modelos_auto (slug);
CREATE INDEX idx_modelos_marca        ON ra_modelos_auto (marca_id, activo);
CREATE INDEX idx_productos_empresa    ON ra_productos (empresa_id, activo);
CREATE INDEX idx_productos_catalogo   ON ra_productos (catalogo_id);
CREATE INDEX idx_perfiles_empresa     ON ra_perfiles (empresa_id);

-- ============================================================
-- HELPER RLS
-- SECURITY DEFINER bypasea RLS al leer ra_perfiles (evita recursión)
-- ============================================================
CREATE OR REPLACE FUNCTION ra_empresa_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
AS $$ SELECT empresa_id FROM ra_perfiles WHERE id = auth.uid() $$;

-- ============================================================
-- TRIGGER: handle_new_user
-- Crea ra_perfiles automáticamente al registrarse un usuario
-- ============================================================
CREATE OR REPLACE FUNCTION ra_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO ra_perfiles (id, nombre, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', NEW.email),
    'administrador'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER ra_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION ra_handle_new_user();

-- ============================================================
-- RLS: TABLAS GLOBALES
-- SELECT → todos los autenticados | mutaciones → solo superadmin
-- ============================================================
ALTER TABLE ra_marcas_auto        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_modelos_auto       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_categorias         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_catalogo_repuestos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_compatibilidades   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marcas_select"   ON ra_marcas_auto        FOR SELECT TO authenticated USING (true);
CREATE POLICY "marcas_mutate"   ON ra_marcas_auto        FOR ALL    TO authenticated USING ((SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "modelos_select"  ON ra_modelos_auto       FOR SELECT TO authenticated USING (true);
CREATE POLICY "modelos_mutate"  ON ra_modelos_auto       FOR ALL    TO authenticated USING ((SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "cats_select"     ON ra_categorias         FOR SELECT TO authenticated USING (true);
CREATE POLICY "cats_mutate"     ON ra_categorias         FOR ALL    TO authenticated USING ((SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "catalogo_select" ON ra_catalogo_repuestos FOR SELECT TO authenticated USING (true);
CREATE POLICY "catalogo_mutate" ON ra_catalogo_repuestos FOR ALL    TO authenticated USING ((SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "compat_select"   ON ra_compatibilidades   FOR SELECT TO authenticated USING (true);
CREATE POLICY "compat_mutate"   ON ra_compatibilidades   FOR ALL    TO authenticated USING ((SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'superadmin');

-- ============================================================
-- RLS: TABLAS POR EMPRESA
-- ============================================================
ALTER TABLE ra_empresas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_perfiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "empresas_select"  ON ra_empresas  FOR SELECT TO authenticated USING (id = ra_empresa_id());
CREATE POLICY "empresas_mutate"  ON ra_empresas  FOR ALL    TO authenticated USING (id = ra_empresa_id() AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador');
CREATE POLICY "perfiles_select"  ON ra_perfiles  FOR SELECT TO authenticated USING (empresa_id = ra_empresa_id() OR id = auth.uid());
CREATE POLICY "perfiles_mutate"  ON ra_perfiles  FOR ALL    TO authenticated USING (empresa_id = ra_empresa_id() AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador');
CREATE POLICY "productos_select" ON ra_productos FOR SELECT TO authenticated USING (empresa_id = ra_empresa_id());
CREATE POLICY "productos_mutate" ON ra_productos FOR ALL    TO authenticated USING (empresa_id = ra_empresa_id() AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor'));

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO ra_marcas_auto (id, nombre) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Mercedes-Benz');

-- Slugs exactos de sprinter.ts para mantener compatibilidad con /catalogo/[modelo]
INSERT INTO ra_modelos_auto (id, marca_id, nombre, slug, motor, cc, año_desde, año_hasta, imagen_url) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Sprinter 313 / 413', 'sprinter-313-413', 'OM 611 / 646', '2.148 cc', 2000, 2013, 'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter313.png'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Sprinter 315',       'sprinter-315',     'OM 646 CDI',   '2.148 cc', 2006, 2018, 'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter315.png'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Sprinter 415',       'sprinter-415',     'OM 646 CDI',   '2.148 cc', 2006, 2018, 'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter415.png'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Sprinter 515',       'sprinter-515',     'OM 651 CDI',   '2.143 cc', 2013, 2024, 'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter515.png'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Sprinter 516',       'sprinter-516',     'OM 651 CDI',   '2.143 cc', 2013, 2024, 'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter516.png'),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Sprinter 514',       'sprinter-514',     'OM 651 CDI',   '2.143 cc', 2013, 2024, 'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter514.png'),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Sprinter 414',       'sprinter-414',     'OM 646 CDI',   '2.148 cc', 2006, 2018, 'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter414.png');

INSERT INTO ra_categorias (id, nombre, slug, orden) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Suspensión', 'suspension', 1),
  ('20000000-0000-0000-0000-000000000002', 'Dirección',  'direccion',  2),
  ('20000000-0000-0000-0000-000000000003', 'Motor',      'motor',      3),
  ('20000000-0000-0000-0000-000000000004', 'Caja',       'caja',       4);

INSERT INTO ra_catalogo_repuestos (id, categoria_id, codigo_oem, nombre, descripcion, imagen_url) VALUES
  -- Suspensión
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'A9063200230', 'Amortiguador Delantero',         'Amortiguador de gas de doble tubo para eje delantero. Mejora la estabilidad y el confort de conducción en ruta y ciudad.',     'https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/AmortiguadorDelantero.png'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'A9063200131', 'Amortiguador Trasero',            'Amortiguador trasero de gas para Sprinter. Compatible con suspensión neumática. Disponible para eje simple y doble.',           NULL),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'A9063230485', 'Buje Barra Estabilizadora',       'Buje de goma reforzado para barra estabilizadora delantera. Reduce el balanceo lateral y mejora el control en curvas.',         NULL),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', 'A9063200025', 'Fuelle de Aire Trasero',          'Fuelle neumático trasero para suspensión de aire. Repuesto directo OEM. Resiste presiones de hasta 8 bar.',                     NULL),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', NULL,          'Rótula Inferior de Suspensión',   'Rótula de suspensión inferior delantera. Permite el movimiento articulado entre el muñón y el triángulo de suspensión.',        NULL),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', NULL,          'Muñón Delantero',                 'Mangueta o muñón delantero completo con rodamiento incluido. Apto para Sprinter con dirección hidráulica.',                     NULL),
  -- Dirección
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000002', NULL,          'Terminal de Dirección',           'Terminal de barra de dirección lado derecho/izquierdo. Se recomienda cambiar en par para desgaste uniforme.',                   NULL),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', NULL,          'Barra de Dirección Completa',     'Barra de acoplamiento de dirección completa. Incluye rótulas en ambos extremos. Lista para instalar.',                           NULL),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000002', 'A0024606980', 'Bomba de Dirección Hidráulica',   'Bomba de dirección asistida hidráulica. Presión de trabajo 80-120 bar. Compatible con motor OM 646 y OM 651.',                 NULL),
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000002', NULL,          'Caja de Dirección',               'Caja de dirección mecánica/hidráulica remanufacturada. Garantía de funcionamiento. Entrega con retenes nuevos.',                  NULL),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000002', NULL,          'Manguera Alta Presión Dirección', 'Manguera de alta presión del sistema de dirección asistida. Resistente a temperaturas de -40°C a +120°C.',                     NULL),
  -- Motor
  ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000003', 'A6510905880', 'Turbocompresor OM 651',           'Turbocompresor para motor OM 651 CDI, 143 CV. Incluye junta de montaje y aceite de arranque. Carcasa de aluminio fundido.',     NULL),
  ('30000000-0000-0000-0000-000000000013', '20000000-0000-0000-0000-000000000003', 'A6510701987', 'Inyector CDI',                    'Inyector piezoeléctrico CDI de alta precisión. Caudal calibrado en fábrica. Apto para motores OM 646 y OM 651.',                NULL),
  ('30000000-0000-0000-0000-000000000014', '20000000-0000-0000-0000-000000000003', NULL,          'Kit Correa de Distribución',      'Kit completo: correa, tensor automático y polea. Intervalo de cambio recomendado: 120.000 km o 4 años.',                         NULL),
  ('30000000-0000-0000-0000-000000000015', '20000000-0000-0000-0000-000000000003', NULL,          'Kit de Juntas de Culata',         'Kit de juntas de culata completo con retenes de válvulas. Sellado de alta temperatura hasta 1.200°C.',                           NULL),
  ('30000000-0000-0000-0000-000000000016', '20000000-0000-0000-0000-000000000003', 'A6512000201', 'Bomba de Agua',                   'Bomba de agua original con impulsor de acero inoxidable. Caudal: 110 L/min. Incluye junta de montaje.',                         NULL),
  ('30000000-0000-0000-0000-000000000017', '20000000-0000-0000-0000-000000000003', NULL,          'Radiador de Motor',               'Radiador de aluminio de alta eficiencia. Capacidad de refrigerante: 12 L. Incluye tapón y sensor de temperatura.',               NULL),
  -- Caja
  ('30000000-0000-0000-0000-000000000018', '20000000-0000-0000-0000-000000000004', NULL,          'Kit de Embrague Completo',        'Kit completo: disco de embrague, plato de presión y collarín de desembrague. Listo para instalar. Vida útil: 150.000 km.',        NULL),
  ('30000000-0000-0000-0000-000000000019', '20000000-0000-0000-0000-000000000004', NULL,          'Disco de Embrague',               'Disco de embrague con amortiguadores de torsión en espiral. Diámetro: 240 mm. Cubo estriado reforzado.',                           NULL),
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000004', NULL,          'Rodamiento Caja de Cambios',      'Rodamiento de entrada y salida de caja de cambios. Acero templado de alta durabilidad. Par de apriete: 25 Nm.',                   NULL),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000004', NULL,          'Sello de Transmisión',            'Sello de aceite para diferencial trasero y caja de cambios. Evita fugas. Material: NBR resistente a aceites sintéticos.',         NULL);
