# Exploración — guía de traslado e inventario seguro

Fecha: 2026-08-31  
Estado: implementación local iniciada; cambios remotos reservados para Claude

## Hallazgo reportado

El selector de artículos de una guía muestra el mismo catálogo más de una vez
cuando el producto existe en varias sucursales. La captura reportada muestra el
mismo código OEM en Arriola y Tienda Principal.

## Evidencia local

- `NuevaGuiaForm.tsx` importa `buscarProductosParaCompra` desde compras.
- Esa acción consulta `ra_productos` por empresa y activo, pero no por
  `sucursal_id`; el índice `ra_productos_por_sucursal` permite una fila por
  `(empresa_id, sucursal_id, catalogo_id)`.
- `ra_recibir_guia` vigente se definió de nuevo en migración 045. Autoriza
  tenant/rol y bloquea filas, pero omite el efecto de inventario si no existe
  la fila de origen o destino y no devuelve un error explícito de stock.
- `crearGuia` inserta cabecera y artículos en llamadas separadas. Un fallo de
  artículos puede dejar una guía vacía.
- `GuiasView` actualiza el estado visual aunque la acción retorne error.
- No existen pruebas específicas de guías.

## Límite de autoridad

Claude es el único responsable de cualquier modificación, migración, prueba
SQL o aplicación en Supabase. Codex solo hará cambios locales en OpenSpec y
aplicación, y no usará credenciales expuestas en conversación.

## Riesgos

1. El límite de cantidad en interfaz puede quedar obsoleto por ventas o guías
   concurrentes; PostgreSQL debe ser la autoridad final.
2. Auto-crear un producto en destino decide implícitamente precios, moneda,
   mínimo y estado activo. La primera corrección debe fallar explícitamente si
   la fila destino no existe.
3. Mover stock al despacho, en lugar de recepción, requeriría reservas,
   inventario en tránsito y anulación; queda fuera de este change.
4. Las migraciones locales y el ledger remoto pueden divergir. Claude debe
   reconciliarlos antes de numerar una migración.

## Preguntas abiertas para Claude

- Confirmar en remoto el índice de producto, check de stock, RLS y definición
  de `ra_recibir_guia`.
- Inventariar guías abiertas con artículo ausente o stock insuficiente mediante
  conteos, sin exponer datos personales.
- Confirmar el número de migración disponible y el contrato RPC definitivo.
