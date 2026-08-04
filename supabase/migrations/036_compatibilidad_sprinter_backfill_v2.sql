-- 036_compatibilidad_sprinter_backfill_v2.sql
-- Backfill v2 de ra_compatibilidades: amplia la migracion 019, que solo capturaba
-- productos con la palabra LITERAL "SPRINTER" en el nombre. Esta version cubre las
-- abreviaturas reales del catalogo: "SP 515", "SP.515", "SP515", listas de modelos
-- "315/415/515" (con o sin prefijo), y marcadores de motor "OM6xx" + numero de modelo.
--
-- Universo: productos con stock_actual > 0 SIN ninguna compatibilidad previa.
-- Extraccion en 2 vias independientes (union de tokens):
--   a) LISTA: subcadenas MODELO([/-]MODELO)+ sobre el nombre con "SP" pegado expandido
--      (SP515/SP.515/SP-515 -> " SP 515"). No se borran part numbers en esta via, para
--      no comerse numeros de modelo adyacentes a ellos (ej. "313 - 413 901 323 00.85").
--   b) MARCADOR: SP | SPRINTER | OM6xx + tokens modelo, sobre el nombre con part
--      numbers Mercedes espaciados ("906 540 1417") eliminados, para no extraer el
--      906/907 del propio part number cuando el nombre declara otro modelo.
--
-- Ejecutado el 2026-08-01 contra Supabase real: inserto 1.465 filas cubriendo 629
-- productos. Detalle completo en backfill_compatibilidades_v2.md (raiz del repo).

WITH base AS (
  SELECT cr.id, cr.codigo_oem, cr.nombre
  FROM ra_productos p
  JOIN ra_catalogo_repuestos cr ON cr.id = p.catalogo_id
  WHERE p.stock_actual > 0
    AND NOT EXISTS (SELECT 1 FROM ra_compatibilidades co WHERE co.catalogo_id = p.catalogo_id)
),
expandido AS (
  SELECT id,
         regexp_replace(nombre, '\ySP[.[:space:]-]*([0-9]{3})', ' SP \1', 'g') AS exp_nombre,
         regexp_replace(
           regexp_replace(nombre, '(^|[[:space:](])[0-9]{3}[[:space:]]+[0-9]{3}([[:space:]]+[0-9]{2,4})+', '\1', 'g'),
           '\ySP[.[:space:]-]*([0-9]{3})', ' SP \1', 'g'
         ) AS limpio
  FROM base
),
tokens(token) AS (
  VALUES ('313'),('413'),('315'),('414'),('415'),('416'),('514'),('515'),('516'),('906'),('907')
),
token_modelo(token, modelo_id) AS (
  VALUES
    ('313', '10000000-0000-0000-0000-000000000001'::uuid),
    ('413', '10000000-0000-0000-0000-000000000001'::uuid),
    ('315', '10000000-0000-0000-0000-000000000002'::uuid),
    ('414', '10000000-0000-0000-0000-000000000007'::uuid),
    ('415', '10000000-0000-0000-0000-000000000003'::uuid),
    ('416', '10000000-0000-0000-0000-000000000008'::uuid),
    ('514', '10000000-0000-0000-0000-000000000006'::uuid),
    ('515', '10000000-0000-0000-0000-000000000004'::uuid),
    ('516', '10000000-0000-0000-0000-000000000005'::uuid),
    ('906', '10000000-0000-0000-0000-000000000009'::uuid),
    ('907', '10000000-0000-0000-0000-000000000010'::uuid)
),
subcadenas_lista AS (
  SELECT e.id, (regexp_matches(e.exp_nombre,
           '((?:313|413|315|414|415|416|514|515|516|906|907)(?:[[:space:]]*[/-][[:space:]]*(?:313|413|315|414|415|416|514|515|516|906|907))+)',
           'g'))[1] AS sub
  FROM expandido e
),
via_lista AS (
  SELECT DISTINCT s.id, t.token
  FROM subcadenas_lista s
  JOIN tokens t ON s.sub ~* ('\y' || t.token || '\y')
),
via_marcador AS (
  SELECT DISTINCT e.id, t.token
  FROM expandido e
  JOIN tokens t ON e.limpio ~* ('\y' || t.token || '\y')
  WHERE e.limpio ~* '(\ySP\y|\ySPRINTER\y|\yOM[[:space:]]?6[0-9][0-9]\y)'
)
INSERT INTO ra_compatibilidades (catalogo_id, modelo_id)
SELECT DISTINCT u.id, tm.modelo_id
FROM (
  SELECT id, token FROM via_lista
  UNION ALL
  SELECT id, token FROM via_marcador
) u
JOIN token_modelo tm ON tm.token = u.token
ON CONFLICT (catalogo_id, modelo_id) DO NOTHING;
