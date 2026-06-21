-- ============================================================
-- MIGRATION 003: Tablet POS — Clientes, Caja, Ventas, Kardex
-- Patrón: prefijo ra_, RLS con ra_empresa_id(), enums para tipados
-- Requiere: 001_initial_schema.sql (ra_empresas, ra_catalogo_repuestos,
--           ra_perfiles, ra_empresa_id, pg_trgm)
-- ============================================================

-- ============================================================
-- ENUMS — uno por dimensión semántica
-- ============================================================
CREATE TYPE ra_tipo_cliente     AS ENUM ('mayorista', 'minorista');
CREATE TYPE ra_tipo_documento   AS ENUM ('DNI', 'RUC', 'CE', 'PASAPORTE');
CREATE TYPE ra_estado_caja      AS ENUM ('abierta', 'cerrada');
CREATE TYPE ra_tipo_movimiento  AS ENUM ('ingreso', 'egreso');
CREATE TYPE ra_metodo_pago      AS ENUM ('efectivo', 'yape', 'tarjeta', 'transferencia', 'credito');
CREATE TYPE ra_tipo_comprobante AS ENUM ('ticket', 'boleta', 'factura');
CREATE TYPE ra_estado_venta     AS ENUM ('pendiente', 'completada', 'anulada');
CREATE TYPE ra_tipo_kardex      AS ENUM ('entrada', 'salida', 'ajuste');
CREATE TYPE ra_motivo_kardex    AS ENUM ('venta', 'compra', 'ajuste_manual', 'devolucion', 'merma');

-- ============================================================
-- TRIGGER helper: updated_at (reutilizable para todas las tablas)
-- ============================================================
CREATE OR REPLACE FUNCTION ra_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLA: ra_clientes
-- Clientes por empresa. Documento único por empresa (NULLs excluidos).
-- GIN trigram en nombre y nro_documento para búsqueda parcial rápida.
-- ============================================================
CREATE TABLE ra_clientes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES ra_empresas(id) ON DELETE CASCADE,
  tipo_cliente   ra_tipo_cliente NOT NULL DEFAULT 'minorista',
  tipo_documento ra_tipo_documento DEFAULT 'DNI',
  nro_documento  TEXT,
  nombre         TEXT NOT NULL,
  telefono       TEXT,
  email          TEXT,
  direccion      TEXT,
  tiene_credito  BOOLEAN NOT NULL DEFAULT FALSE,
  limite_credito NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (limite_credito >= 0),
  saldo_deudor   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (saldo_deudor >= 0),
  activo         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unicidad por documento dentro de la empresa.
-- NULLs son distintos entre sí en PostgreSQL, por eso WHERE IS NOT NULL.
CREATE UNIQUE INDEX idx_clientes_empresa_doc
  ON ra_clientes (empresa_id, nro_documento)
  WHERE nro_documento IS NOT NULL;

CREATE INDEX idx_clientes_empresa_nombre ON ra_clientes (empresa_id, nombre);
CREATE INDEX idx_clientes_nombre_trgm    ON ra_clientes USING GIN (nombre gin_trgm_ops);
CREATE INDEX idx_clientes_doc_trgm       ON ra_clientes USING GIN (nro_documento gin_trgm_ops);

CREATE TRIGGER ra_clientes_updated_at
  BEFORE UPDATE ON ra_clientes
  FOR EACH ROW EXECUTE FUNCTION ra_set_updated_at();

-- ============================================================
-- TABLA: ra_cajas — turno de caja por usuario
-- Índice parcial único: máximo 1 caja 'abierta' por usuario/empresa.
-- ============================================================
CREATE TABLE ra_cajas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES ra_empresas(id) ON DELETE CASCADE,
  usuario_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  estado         ra_estado_caja NOT NULL DEFAULT 'abierta',
  monto_inicial  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (monto_inicial >= 0),
  monto_final    NUMERIC(10,2) CHECK (monto_final IS NULL OR monto_final >= 0),
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_cierre   TIMESTAMPTZ,
  notas          TEXT
);

-- Garantía de negocio: solo 1 caja abierta por usuario/empresa.
-- El índice parcial es la única forma de imponer esta regla cross-row
-- en PostgreSQL sin triggers.
CREATE UNIQUE INDEX idx_caja_una_abierta_por_usuario
  ON ra_cajas (empresa_id, usuario_id)
  WHERE estado = 'abierta';

CREATE INDEX idx_cajas_empresa_fecha
  ON ra_cajas (empresa_id, fecha_apertura DESC);

-- ============================================================
-- TABLA: ra_movimientos_caja — ingresos/egresos de caja
-- Inmutable: montos siempre positivos, tipo indica dirección.
-- ============================================================
CREATE TABLE ra_movimientos_caja (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caja_id       UUID NOT NULL REFERENCES ra_cajas(id) ON DELETE CASCADE,
  tipo          ra_tipo_movimiento NOT NULL,
  concepto      TEXT NOT NULL,
  monto         NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  metodo_pago   ra_metodo_pago NOT NULL DEFAULT 'efectivo',
  referencia_id UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_movimientos_caja_caja
  ON ra_movimientos_caja (caja_id, created_at DESC);

-- ============================================================
-- TABLA: ra_ventas
-- Header de venta. Estado inicia 'pendiente', pasa a 'completada'
-- una vez que procesarVenta confirma todos los inserts.
-- ============================================================
CREATE TABLE ra_ventas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID NOT NULL REFERENCES ra_empresas(id) ON DELETE RESTRICT,
  caja_id          UUID REFERENCES ra_cajas(id),
  cliente_id       UUID REFERENCES ra_clientes(id),
  usuario_id       UUID NOT NULL REFERENCES auth.users(id),
  tipo_venta       ra_tipo_cliente NOT NULL DEFAULT 'minorista',
  tipo_comprobante ra_tipo_comprobante NOT NULL DEFAULT 'ticket',
  subtotal         NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  igv              NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (igv >= 0),
  total            NUMERIC(10,2) NOT NULL CHECK (total >= 0),
  estado           ra_estado_venta NOT NULL DEFAULT 'pendiente',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ventas_empresa_fecha ON ra_ventas (empresa_id, created_at DESC);
CREATE INDEX idx_ventas_caja          ON ra_ventas (caja_id, created_at DESC);
CREATE INDEX idx_ventas_cliente       ON ra_ventas (cliente_id);

CREATE TRIGGER ra_ventas_updated_at
  BEFORE UPDATE ON ra_ventas
  FOR EACH ROW EXECUTE FUNCTION ra_set_updated_at();

-- ============================================================
-- TABLA: ra_venta_items — snapshot inmutable de items vendidos
-- catalogo_id apunta a ra_catalogo_repuestos porque ahí viven
-- nombre y codigo_oem que queremos congelar al momento de la venta.
-- nombre_producto y codigo_oem se copian como texto (desnormalización
-- intencional: el catálogo puede cambiar, el item histórico no).
-- ============================================================
CREATE TABLE ra_venta_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id        UUID NOT NULL REFERENCES ra_ventas(id) ON DELETE CASCADE,
  catalogo_id     UUID NOT NULL REFERENCES ra_catalogo_repuestos(id) ON DELETE RESTRICT,
  cantidad        NUMERIC(10,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
  descuento       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  subtotal        NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
  nombre_producto TEXT NOT NULL,
  codigo_oem      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venta_items_venta    ON ra_venta_items (venta_id);
CREATE INDEX idx_venta_items_catalogo ON ra_venta_items (catalogo_id);

-- ============================================================
-- TABLA: ra_venta_pagos — uno o más pagos por venta (split payment)
-- ============================================================
CREATE TABLE ra_venta_pagos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id    UUID NOT NULL REFERENCES ra_ventas(id) ON DELETE CASCADE,
  metodo_pago ra_metodo_pago NOT NULL,
  monto       NUMERIC(10,2) NOT NULL CHECK (monto > 0),
  referencia  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venta_pagos_venta ON ra_venta_pagos (venta_id);

-- ============================================================
-- TABLA: ra_kardex — historial inmutable de movimientos de stock
-- catalogo_id (consistente con ra_venta_items).
-- Sin UPDATE/DELETE por RLS — solo append via service role.
-- ============================================================
CREATE TABLE ra_kardex (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     UUID NOT NULL REFERENCES ra_empresas(id) ON DELETE RESTRICT,
  catalogo_id    UUID NOT NULL REFERENCES ra_catalogo_repuestos(id) ON DELETE RESTRICT,
  tipo           ra_tipo_kardex NOT NULL,
  motivo         ra_motivo_kardex NOT NULL,
  cantidad       NUMERIC(10,3) NOT NULL CHECK (cantidad > 0),
  stock_anterior NUMERIC(10,3) NOT NULL,
  stock_nuevo    NUMERIC(10,3) NOT NULL,
  referencia_id  UUID,
  usuario_id     UUID REFERENCES auth.users(id),
  notas          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kardex_empresa_catalogo
  ON ra_kardex (empresa_id, catalogo_id, created_at DESC);

CREATE INDEX idx_kardex_referencia
  ON ra_kardex (referencia_id);

-- ============================================================
-- RLS — todas las tablas, patrón empresa_id = ra_empresa_id()
-- Permisos por rol consistentes con productos_mutate (admin + vendedor)
-- ============================================================
ALTER TABLE ra_clientes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_cajas            ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_movimientos_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_ventas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_venta_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_venta_pagos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE ra_kardex           ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- RLS: ra_clientes
-- SELECT: todos los roles de la empresa
-- INSERT/UPDATE: admin y vendedor
-- DELETE: solo administrador
-- ------------------------------------------------------------
CREATE POLICY "clientes_select" ON ra_clientes
  FOR SELECT TO authenticated
  USING (empresa_id = ra_empresa_id());

CREATE POLICY "clientes_insert" ON ra_clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = ra_empresa_id()
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

CREATE POLICY "clientes_update" ON ra_clientes
  FOR UPDATE TO authenticated
  USING (
    empresa_id = ra_empresa_id()
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

CREATE POLICY "clientes_delete" ON ra_clientes
  FOR DELETE TO authenticated
  USING (
    empresa_id = ra_empresa_id()
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador'
  );

-- ------------------------------------------------------------
-- RLS: ra_cajas
-- SELECT: el usuario ve sus propias cajas; admin ve todas las de la empresa
-- INSERT: admin y vendedor pueden abrir su propia caja
-- UPDATE: el usuario cierra su caja; admin puede cerrar cualquiera
-- ------------------------------------------------------------
CREATE POLICY "cajas_select" ON ra_cajas
  FOR SELECT TO authenticated
  USING (
    empresa_id = ra_empresa_id()
    AND (
      usuario_id = auth.uid()
      OR (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador'
    )
  );

CREATE POLICY "cajas_insert" ON ra_cajas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = ra_empresa_id()
    AND usuario_id = auth.uid()
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

CREATE POLICY "cajas_update" ON ra_cajas
  FOR UPDATE TO authenticated
  USING (
    empresa_id = ra_empresa_id()
    AND (
      usuario_id = auth.uid()
      OR (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador'
    )
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

-- ------------------------------------------------------------
-- RLS: ra_movimientos_caja
-- SELECT: movimientos de cajas accesibles (propias o admin)
-- INSERT: solo en cajas abiertas accesibles, roles admin/vendedor
-- ------------------------------------------------------------
CREATE POLICY "movimientos_select" ON ra_movimientos_caja
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ra_cajas c
      WHERE c.id = caja_id
        AND c.empresa_id = ra_empresa_id()
        AND (
          c.usuario_id = auth.uid()
          OR (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador'
        )
    )
  );

CREATE POLICY "movimientos_insert" ON ra_movimientos_caja
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ra_cajas c
      WHERE c.id = caja_id
        AND c.empresa_id = ra_empresa_id()
        AND c.estado = 'abierta'
        AND (
          c.usuario_id = auth.uid()
          OR (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador'
        )
    )
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

-- ------------------------------------------------------------
-- RLS: ra_ventas
-- SELECT: todos los roles de la empresa
-- INSERT: admin y vendedor (usuario = auth.uid() garantizado)
-- UPDATE: solo admin (para anulaciones)
-- ------------------------------------------------------------
CREATE POLICY "ventas_select" ON ra_ventas
  FOR SELECT TO authenticated
  USING (empresa_id = ra_empresa_id());

CREATE POLICY "ventas_insert" ON ra_ventas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = ra_empresa_id()
    AND usuario_id = auth.uid()
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

CREATE POLICY "ventas_update" ON ra_ventas
  FOR UPDATE TO authenticated
  USING (
    empresa_id = ra_empresa_id()
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) = 'administrador'
  );

-- ------------------------------------------------------------
-- RLS: ra_venta_items
-- SELECT/INSERT: accesibles via JOIN a ra_ventas de la empresa
-- ------------------------------------------------------------
CREATE POLICY "venta_items_select" ON ra_venta_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ra_ventas v
      WHERE v.id = venta_id
        AND v.empresa_id = ra_empresa_id()
    )
  );

CREATE POLICY "venta_items_insert" ON ra_venta_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ra_ventas v
      WHERE v.id = venta_id
        AND v.empresa_id = ra_empresa_id()
    )
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

-- ------------------------------------------------------------
-- RLS: ra_venta_pagos
-- SELECT/INSERT: accesibles via JOIN a ra_ventas de la empresa
-- ------------------------------------------------------------
CREATE POLICY "venta_pagos_select" ON ra_venta_pagos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ra_ventas v
      WHERE v.id = venta_id
        AND v.empresa_id = ra_empresa_id()
    )
  );

CREATE POLICY "venta_pagos_insert" ON ra_venta_pagos
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ra_ventas v
      WHERE v.id = venta_id
        AND v.empresa_id = ra_empresa_id()
    )
    AND (SELECT rol FROM ra_perfiles WHERE id = auth.uid()) IN ('administrador', 'vendedor')
  );

-- ------------------------------------------------------------
-- RLS: ra_kardex
-- SELECT: todos los roles de la empresa (solo lectura por RLS)
-- INSERT: SOLO via service role (admin client) — bypasa RLS
-- La tabla es append-only auditable; ningún usuario puede
-- insertar directamente desde el cliente.
-- ------------------------------------------------------------
CREATE POLICY "kardex_select" ON ra_kardex
  FOR SELECT TO authenticated
  USING (empresa_id = ra_empresa_id());
