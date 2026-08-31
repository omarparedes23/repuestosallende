# Propuesta — numeración y series de guías

## Objetivo

Al seleccionar la sucursal origen, el formulario muestra en solo lectura la
serie predeterminada y el siguiente correlativo de guía. Al crear, la base de
datos asigna atómicamente ese correlativo y devuelve la numeración definitiva.

## Alcance

1. Tabla `ra_series_documento` por empresa, sucursal emisora, tipo de
   documento y serie.
2. Configuración de una serie predeterminada activa para guía por sucursal.
3. RPC de preview sin reserva.
4. Reescritura forward-only de `ra_crear_guia` para que no acepte serie ni
   correlativo del cliente y los asigne bajo bloqueo.
5. Formulario y lista de guías con numeración automática y fecha válida.
6. Pantalla administrativa mínima para configurar series de guía, si el
   contrato remoto está aprobado.

## No alcance

- Migrar numeración de ventas, boletas, facturas o tickets.
- Reutilizar correlativos de guías anuladas/borradores.
- Modificar el ciclo actual de estados de guía.
- Edición manual de serie/correlativo en la creación.

## Criterios de éxito

- Una guía de una sucursal configurada nace con serie y correlativo.
- Dos creaciones concurrentes de la misma serie reciben correlativos distintos.
- Si no existe serie activa para origen, no se crea guía y se informa el error.
- Cambiar origen actualiza el preview.
- La lista no muestra 1970 cuando falta una fecha de emisión.
