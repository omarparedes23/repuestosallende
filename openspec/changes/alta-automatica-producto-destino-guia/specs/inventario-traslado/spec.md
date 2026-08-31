# Especificación — disponibilidad de producto al recibir traslado

## Requisito: el catálogo es compartido; el inventario es por sucursal

El sistema DEBE tratar `ra_catalogo_repuestos` como el maestro del artículo y
`ra_productos` como su disponibilidad por sucursal.

### Escenario: crear hacia un destino aún no habilitado

- GIVEN un catálogo presente en origen y ausente en destino
- WHEN un usuario autorizado crea una guía entre ambas sucursales
- THEN el sistema DEBE permitir crear la guía sin crear todavía la fila
  destino
- AND DEBE rechazarla si el catálogo no existe en origen.

### Escenario: destino sin fila local

- GIVEN una guía en tránsito de la empresa y un ítem con producto activo y
  stock suficiente en origen
- AND no existe `(empresa_id, sucursal_destino_id, catalogo_id)` en
  `ra_productos`
- WHEN un usuario autorizado recibe la guía
- THEN el sistema DEBE crear una sola fila local activa en destino para el
  mismo catálogo, con stock inicial cero y atributos comerciales copiados de
  origen
- AND DEBE sumar la cantidad transferida, registrar ambos movimientos kardex
  con motivo `traslado` y marcar la guía recibida atómicamente.

### Escenario: destino ya habilitado

- GIVEN existe la fila local en destino
- WHEN se recibe una guía válida
- THEN el sistema DEBE conservar sus atributos locales y solo aumentar stock.

### Escenario: concurrencia de altas de destino

- GIVEN dos transacciones intentan habilitar el mismo catálogo para la misma
  sucursal destino
- WHEN ambas se ejecutan concurrentemente
- THEN solo DEBE persistir una fila por la restricción única de la tabla
- AND ninguna recepción DEBE perder ni duplicar stock.

### Escenario: validación fallida

- GIVEN una guía sin stock suficiente en origen, con estado inválido o con
  producto origen ausente
- WHEN se intenta recibir
- THEN no DEBE crearse una fila destino ni cambiar stock, kardex o estado.
