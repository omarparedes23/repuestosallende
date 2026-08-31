# Diseño — guía de traslado e inventario seguro

## Contratos locales

La búsqueda local se expone como:

```ts
buscarProductosEnSucursal(query: string, sucursalOrigenId: string)
```

Su resultado contiene `productoId`, `catalogoId`, nombre, código OEM y
`stockDisponible`. La empresa se deriva de sesión y nunca llega del navegador.

La interfaz borra artículos al cambiar origen porque cada ítem depende del
stock de esa sucursal. Si ya hay ítems, solicita confirmación antes de hacerlo.

## Contratos pendientes de Claude

Las firmas exactas se confirmarán contra el esquema remoto antes de integrarse:

```text
ra_crear_guia(...)
ra_avanzar_estado_guia(...)
ra_recibir_guia(p_guia_id uuid)
```

Todas las funciones mutables deben derivar `auth.uid()`, empresa y rol en
PostgreSQL, tener `SECURITY DEFINER` con `search_path` fijo y grants mínimos.

## Política de recepción

La primera versión conserva el movimiento de inventario al recibir. La función
debe bloquear guía y productos, validar existencia en ambos extremos y stock
suficiente, crear salida/entrada de kardex, y actualizar el estado solo si todo
termina correctamente. La ausencia de producto en destino falla: no se crea
una fila nueva de forma implícita.

## Compatibilidad y rollout

1. Claude verifica el esquema remoto y prepara migración/pruebas.
2. Claude aplica y verifica el contrato remoto.
3. Codex conecta la interfaz a las RPC definitivas.
4. Se prueban búsqueda, creación, transición y recepción con dos sucursales.

La reversión será forward-only. No se reintroducirán permisos públicos ni se
editarán migraciones históricas.
