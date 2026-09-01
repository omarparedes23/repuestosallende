# Exploración — kardex por artículo

Fecha: 2026-09-01  
Estado: lectura local; sin cambios remotos ni datos modificados.

## Estado actual

`Panel → Artículos` lista filas de `ra_productos`, cada una asociada a una
sucursal y a un `catalogo_id`, pero no expone sus movimientos. `ra_kardex`
conserva `empresa_id`, `sucursal_id`, `catalogo_id`, tipo, motivo, cantidad,
stock anterior/nuevo, `referencia_id`, usuario, notas y fecha.

Las confirmaciones de compra y venta insertan el identificador de su documento
en `referencia_id`; las transferencias usan el identificador de la guía. Esa
referencia es polimórfica, no una clave foránea única:

| Motivo | Documento de origen |
| --- | --- |
| `compra` | `ra_compras` |
| `venta` | `ra_ventas` |
| `traslado` | `ra_guias_remision` |
| ajuste, devolución, merma | no se presume documento; se muestran notas y referencia corta |

El reset controlado de TEST conservó kardex aun cuando se eliminaron ventas.
Por tanto una referencia histórica puede no encontrar su documento: la UI no
debe ocultar el movimiento ni afirmar que el documento existe.

## Riesgos

- Un mismo `catalogo_id` puede existir en varias sucursales. La consulta debe
  partir de `ra_productos.id` y limitar kardex a su sucursal, no consolidar
  involuntariamente movimientos de otras sedes.
- El cliente no puede elegir empresa ni sucursal como autoridad. Se deriva la
  empresa de la sesión y se verifica la fila del producto en servidor; RLS
  sigue siendo la segunda barrera.
- El historial puede crecer. La primera versión pagina en servidor y no carga
  todos los movimientos al navegador.

## Conclusión

No se requiere migración. Se necesita una Server Action de solo lectura,
pruebas de alcance/resolución y un panel de historial desde Artículos.
