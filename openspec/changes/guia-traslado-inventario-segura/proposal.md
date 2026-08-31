# Propuesta — guía de traslado e inventario seguro

## Objetivo

Mostrar para una guía únicamente productos activos con stock disponible en la
sucursal origen y asegurar que la creación, cambios de estado y recepción de
una guía no produzcan efectos parciales de inventario.

## Alcance local (Codex)

1. Búsqueda por empresa, sucursal origen, estado activo y stock positivo.
2. Mostrar stock disponible y limitar la cantidad en el formulario.
3. Limpiar artículos dependientes al cambiar origen, con confirmación.
4. Tipar resultados y eliminar `any` del formulario nuevo.
5. Mostrar errores de operaciones y no actualizar optimistamente estados ante
   fallos.
6. Preparar consumo de las RPC que publique Claude.

## Alcance Supabase (Claude exclusivamente)

1. Auditoría remota read-only de ledger, RLS, restricciones y datos agregados.
2. Migración forward-only para RPC atómicas de creación, transición y recepción.
3. Pruebas SQL de autorización, atomicidad, stock, kardex e idempotencia de
   recepción.
4. Aplicación remota y comprobación posterior del ledger.

## No alcance

- Editar migraciones ya aplicadas.
- Auto-configurar productos ausentes en sucursal destino.
- Reserva de stock, inventario en tránsito, cancelación o reversión de guías.
- Reparación automática de datos existentes.
- Cambios al SQL Server histórico.

## Criterios de éxito

- Un producto aparece una vez al buscar en una sucursal origen.
- El formulario no permite pedir más que el stock mostrado.
- El servidor remoto rechaza falta de origen/destino, stock insuficiente,
  estados inválidos y usuarios sin permiso sin generar efectos parciales.
- Una recepción correcta deja exactamente una salida y una entrada de kardex por
  artículo y marca la guía recibida una sola vez.
- La interfaz conserva el estado anterior cuando la operación falla.
