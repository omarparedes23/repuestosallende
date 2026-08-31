# Especificación — guías de traslado

## Requisito: búsqueda ligada al origen

El buscador de una guía MUST consultar productos de la empresa autenticada,
activos, con `stock_actual > 0` y pertenecientes exclusivamente a la sucursal
origen seleccionada.

### Scenario: producto en dos sucursales

- GIVEN un catálogo con una fila de producto en dos sucursales
- WHEN el usuario selecciona una de ellas como origen y busca el producto
- THEN ve una sola sugerencia correspondiente a esa sucursal
- AND la sugerencia muestra el stock disponible de origen

## Requisito: cantidad asistida por stock

La interfaz MUST impedir cantidades menores que uno o mayores que el stock
visible para cada artículo. Este control MUST NOT sustituir la validación de
base de datos.

### Scenario: cantidad excesiva

- GIVEN una sugerencia con stock disponible 3
- WHEN el usuario intenta registrar cantidad 4
- THEN el formulario muestra el máximo permitido
- AND no permite crear la guía hasta corregirla

## Requisito: recepción atómica

La RPC de recepción MUST validar y ejecutar en una transacción el descuento de
origen, la entrada en destino, ambos kardex y el cambio a `recibida`.

### Scenario: falta producto en destino

- GIVEN una guía en tránsito cuyo artículo no tiene fila en destino
- WHEN un usuario autorizado intenta recibirla
- THEN recibe `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`
- AND no cambia stock, kardex ni estado de guía

### Scenario: recepción repetida

- GIVEN una guía recibida correctamente
- WHEN se intenta recibirla por segunda vez
- THEN la RPC rechaza el estado inválido
- AND no duplica movimientos de stock ni kardex

## Requisito: errores fieles en interfaz

La interfaz MUST cambiar su estado local solo después de confirmar un resultado
correcto del servidor.

### Scenario: recepción rechazada

- GIVEN una recepción que retorna error
- WHEN la acción termina
- THEN la guía sigue visible como `en_transito`
- AND el usuario ve un mensaje accionable
