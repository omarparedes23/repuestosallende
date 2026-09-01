# Diseño — kardex por artículo

```text
Artículos (fila ra_productos)
  → Server Action getMovimientosKardex(productoId, página)
      → verifica sesión, empresa y producto
      → ra_kardex por empresa + catalogo_id + sucursal_id, paginado
      → resuelve referencias por grupos de motivo
          compra → ra_compras
          venta → ra_ventas
          traslado → ra_guias_remision
      → panel cliente de solo lectura
```

La Server Action no acepta empresa, catálogo ni sucursal como parámetros de
autoridad. El producto obtenido con `productoId` y `empresa_id` determina los
dos filtros de inventario. Las consultas de documentos se restringen también a
la misma empresa, y cualquier ausencia queda representada en la respuesta.

Se usa paginación offset de 25 filas para no trasladar el historial completo.
La consulta principal usa el índice existente por empresa/catálogo/fecha; el
filtro adicional de sucursal conserva la semántica correcta. No se propone
índice ni migración sin medir el plan contra el entorno remoto.

El cambio es reversible eliminando el botón, panel y acción: no altera datos.
