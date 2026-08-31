# Diseño — recepción con habilitación automática en destino

## Flujo dentro de `ra_recibir_guia`

La función conserva su fase de validación completa antes de mutar stock. Tras
validar guía, empresa, estado, ítems, origen y stock:

1. Bloquea las filas origen en orden canónico por `catalogo_id`.
2. Para cada catálogo, intenta insertar la disponibilidad destino con
   `INSERT ... ON CONFLICT (empresa_id, sucursal_id, catalogo_id) DO NOTHING`.
   La nueva fila copia `codigo_interno`, precios, costo, mínimo y moneda de la
   fila origen, queda activa y nace con stock cero.
3. Vuelve a seleccionar/bloquear las filas destino en el orden canónico ya
   usado por 050.
4. Descuenta origen, incrementa destino, escribe kardex y marca recibida.

Si la fila destino ya existía, el `ON CONFLICT` no la modifica: sus condiciones
locales prevalecen.

## Creación de guía

`ra_crear_guia` debe validar que cada catálogo exista en origen, que es la
sucursal que transferirá stock. No debe exigir ni crear una fila destino: la
guía representa la futura habilitación y `ra_recibir_guia` (052) la materializa
atómicamente al recibir.

## Seguridad y atomicidad

- La empresa, las sucursales y el usuario se obtienen en la RPC; jamás llegan
  como autoridad desde el cliente.
- La función continúa `SECURITY DEFINER`, con `search_path` fijo, grants solo
  para `authenticated` y sin políticas INSERT abiertas al navegador.
- Cualquier excepción revierte la inserción provisional de destino junto con
  stock, kardex y estado.

## Compatibilidad

La firma pública `ra_recibir_guia(p_guia_id uuid)` no cambia. El frontend no
necesita insertar productos ni adaptar su RPC; solo debe conservar el mapeo de
errores defensivo para guías históricas o inconsistentes.

## Rollback

Forward-only: una migración posterior puede restaurar la validación estricta
sin borrar filas de disponibilidad ya creadas ni alterar kardex.
