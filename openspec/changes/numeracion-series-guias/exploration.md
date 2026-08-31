# Exploración — numeración y series de guías

Fecha: 2026-08-31

## Problema

La guía permite crear con serie y correlativo vacíos. El formulario no propone
la numeración de la sucursal origen y la lista transforma `fecha_emision=NULL`
en `01 ene. 1970`.

La numeración de una guía debe provenir de una configuración administrada, no
del texto ingresado por el usuario ni de un cálculo del navegador.

## Evidencia

- `ra_guias_remision` tiene `serie` y `correlativo`; 050 exige que ambos sean
  nulos o ambos estén informados y evita duplicados por empresa/serie/número.
- 050 todavía recibe la serie y correlativo desde el cliente.
- Ventas conserva `serie_boleta`, `serie_factura` y `serie_ticket` en
  `ra_empresas`; no es una configuración por sucursal.
- La función histórica `ra_siguiente_correlativo` usa `MAX(correlativo)+1` en
  una RPC separada. No se reutiliza: la asignación debe quedar dentro de la
  misma transacción que crea la guía.

## Alcance

Crear infraestructura genérica de series, pero usarla únicamente en guías.
Ventas, facturas, boletas y tickets no se migran en este change.

## Riesgos

- Mostrar un siguiente correlativo no lo reserva; dos usuarios pueden ver el
  mismo preview. PostgreSQL asigna el número autoritativo al crear.
- Si una serie se comparte entre dos sucursales, la unicidad actual de guías
  por empresa/serie/correlativo colisiona. Una serie debe pertenecer a una sola
  sucursal emisora para un tipo de documento.
- Numerar un borrador consume/reserva el número. Esta es la decisión elegida:
  una guía guardada es un documento numerado y no reutiliza su correlativo.
