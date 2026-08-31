# Propuesta — disponibilidad automática al recibir una guía

## Objetivo

Permitir que una guía de traslado se reciba aunque el catálogo todavía no esté
habilitado en la sucursal destino.

## Alcance

La migración 052 recreó `ra_recibir_guia(uuid)`. Una migración 053 debe
recrear `ra_crear_guia(uuid,uuid,text,jsonb)` para completar el flujo:

1. Conservar todas las validaciones, autorización, bloqueos y efectos de 050.
2. Para cada ítem validado en origen, asegurar una fila `ra_productos` en
   destino mediante una operación segura ante concurrencia.
3. Si la fila no existe, crearla para el mismo `catalogo_id` y empresa,
   copiando las condiciones locales de la fila origen; iniciar stock en cero.
4. Aplicar el ingreso, kardex y estado de recepción dentro de la misma
   transacción.
5. Al crear, validar el catálogo únicamente en origen; no exigir una fila
   `ra_productos` en destino, pues 052 la habilita al recibir.

## No alcance

- No crear una fila nueva de `ra_catalogo_repuestos`.
- No sobrescribir precio, costo, código interno, mínimo o moneda si la fila
  destino ya existía.
- No modificar series, creación, emisión o despacho de guías.

## Criterio de éxito

Una guía con producto presente en origen y ausente en destino se recibe una vez:
el destino termina con una única fila local y stock incrementado; origen,
kardex y guía quedan consistentes.
