# Especificación — kardex por artículo

## Requisito: historial acotado por producto y sucursal

El panel MUST permitir consultar los movimientos de kardex de una fila de
`ra_productos`. La consulta MUST obtener empresa y alcance desde la sesión y
la fila de producto verificada en servidor, y MUST filtrar por su `catalogo_id`
y `sucursal_id`.

#### Scenario: mismo catálogo en dos sucursales

- GIVEN un catálogo con movimientos en sucursal A y B
- WHEN se abre el historial de la fila del producto de sucursal A
- THEN solo se muestran movimientos de A
- AND no se muestra ningún movimiento de B

## Requisito: trazabilidad documental honesta

Para movimientos de compra, venta y traslado, el sistema MUST resolver el
documento usando motivo y `referencia_id`. Si no existe el documento, MUST
mantener el movimiento visible y señalarlo como no disponible. El sistema MUST
NOT inventar un documento para ajustes, devoluciones o mermas.

#### Scenario: venta histórica eliminada

- GIVEN un kardex de motivo `venta` con una referencia sin fila en `ra_ventas`
- WHEN se consulta el historial
- THEN la fila indica `Documento no disponible`
- AND conserva fecha, cantidad y evolución de stock

## Requisito: consulta sin efectos

Abrir, paginar y cerrar el historial MUST ser operaciones de solo lectura; no
deben crear, editar ni eliminar kardex, productos, compras, ventas o guías.

#### Scenario: consulta paginada

- GIVEN más movimientos que el tamaño de página
- WHEN el usuario cambia de página
- THEN obtiene únicamente la página solicitada ordenada por fecha descendente
- AND el stock y kardex persistidos no cambian
