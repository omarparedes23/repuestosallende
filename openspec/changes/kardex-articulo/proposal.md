# Propuesta — kardex por artículo

## Objetivo

Permitir que el personal autorizado consulte, desde cada artículo y sucursal,
las entradas, salidas y ajustes de inventario, identificando el documento de
origen cuando esté disponible.

## Alcance

- Botón `Ver movimientos` en cada artículo del panel.
- Panel de solo lectura paginado con fecha, tipo, motivo, cantidad, stock
  anterior/nuevo, sucursal, usuario, notas y documento de origen.
- Resolución de compra, venta y guía mediante motivo + `referencia_id`.
- Enlaces a detalles existentes de compra y guía; ventas se identifican por su
  comprobante sin crear una nueva pantalla de venta en este cambio.
- Mensaje explícito para documentos históricos ausentes.

## Fuera de alcance

- Crear, editar, borrar o ajustar kardex o stock.
- Reparar referencias históricas, reconciliar stock o modificar migraciones.
- Construir trazabilidad de lotes, costo por salida, devoluciones o detalle de
  comprobante de venta.

## Criterios de aceptación

1. Cada consulta se limita a la empresa y sucursal de la fila de artículo.
2. La lista presenta cada fila de kardex una vez, en orden descendente de fecha.
3. Compra, venta y traslado muestran su documento cuando la referencia existe.
4. Una referencia ausente sigue visible como `Documento no disponible`.
5. Ajustes, mermas y devoluciones no se atribuyen a un documento por inferencia.
6. Cambiar página o abrir el historial no modifica ninguna tabla.
