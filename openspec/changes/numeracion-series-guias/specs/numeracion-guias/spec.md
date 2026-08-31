# Especificación — numeración de guías

## Requisito: serie predeterminada por sucursal emisora

Cada sucursal MUST tener como máximo una serie activa predeterminada para el
tipo `guia_remision`. Una serie activa para guía MUST pertenecer a una sola
sucursal de la empresa.

### Scenario: preview al elegir origen

- GIVEN una sucursal origen con serie `001` y próximo correlativo `6`
- WHEN el usuario selecciona esa sucursal
- THEN la interfaz muestra `001-00000006` como preview de solo lectura

## Requisito: asignación atómica

La creación de guía MUST resolver la serie predeterminada, bloquear su fila y
avanzar el correlativo dentro de la misma transacción que inserta cabecera e
ítems. MUST NOT aceptar serie ni correlativo del cliente como autoridad.

### Scenario: dos creaciones concurrentes

- GIVEN una serie con siguiente correlativo 6
- WHEN dos usuarios crean guías concurrentemente desde la misma sucursal
- THEN las guías reciben 6 y 7, sin duplicados
- AND el siguiente correlativo queda en 8

## Requisito: serie no configurada

### Scenario: origen sin serie

- GIVEN una sucursal origen sin serie activa predeterminada de guía
- WHEN el usuario intenta crear una guía
- THEN la RPC retorna `RA_GUIDE_SERIES_NOT_CONFIGURED`
- AND no inserta guía, ítems ni movimientos

## Requisito: fecha legible

La lista MUST mostrar `created_at` como fecha de creación si `fecha_emision` es
nula. MUST NOT convertir un valor nulo a fecha Unix.
