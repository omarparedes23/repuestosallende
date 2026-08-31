# Exploración — alta automática del producto en destino

## Estado actual

El modelo ya separa correctamente el catálogo maestro y el inventario por
sucursal:

- `ra_catalogo_repuestos`: identidad, nombre, OEM y datos compartidos.
- `ra_productos`: presencia por `(empresa_id, sucursal_id, catalogo_id)`,
  stock y condiciones comerciales locales.

La recepción segura de la migración 050 rechaza una guía con
`RA_PRODUCT_NOT_FOUND_AT_DESTINATION` cuando no existe la fila de
`ra_productos` en destino. La transacción no descuenta ni suma stock, por lo
que no hay pérdida, pero obliga a dar de alta manualmente el mismo catálogo en
la sucursal receptora antes de poder recibir.

La verificación de 052 reveló una segunda barrera: `ra_crear_guia` aún exige
el catálogo en destino. Por tanto, la alta automática de recepción solo se
alcanza si esa fila desaparece después de crear la guía, no en el flujo
operativo solicitado.

## Decisión

Para un traslado entre sucursales de la misma empresa, el catálogo ya está
validado en origen. La recepción debe habilitar automáticamente ese catálogo
en destino si le falta su fila local; no debe crear ni duplicar un catálogo.

## Riesgos a tratar en PostgreSQL

- Concurrencia: dos recepciones pueden intentar crear la misma fila destino.
- La fila nueva debe tener valores comerciales coherentes, sin reemplazar una
  fila destino que ya existía.
- La validación y todos los cambios deben permanecer atómicos junto a stock,
  kardex y estado de guía.
- La identificación de empresa y sucursales debe continuar siendo autoritativa
  dentro de la RPC `SECURITY DEFINER`.

## Fuera de alcance

- Rediseñar precios/costos para volverlos globales.
- Crear productos o catálogos desde la interfaz de una guía.
- Cambiar numeración o estados de las guías.
