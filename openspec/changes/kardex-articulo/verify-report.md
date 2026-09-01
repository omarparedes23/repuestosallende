# Verificación — kardex por artículo

Fecha: 2026-09-01

| Criterio | Evidencia | Resultado |
| --- | --- | --- |
| Alcance por empresa y sucursal | prueba `deriva catálogo y sucursal...` comprueba producto por empresa y kardex por empresa, catálogo y sucursal | PASS |
| Documento por motivo | pruebas compra, venta y guía en `resolverDocumentoKardex` | PASS |
| Histórico sin documento | prueba de referencia de venta ausente devuelve `documentoNoDisponible` | PASS |
| Ajuste sin inferencia | prueba de ajuste manual devuelve documento nulo | PASS |
| Paginación y orden | Action usa `order(created_at DESC)` y rango de 25 filas | PASS (revisión de código) |
| Sin efectos de escritura | Action solo usa `select`; no contiene mutation ni RPC de escritura | PASS (revisión de código) |
| Tipado | `npm exec tsc -- --noEmit` | PASS |
| Pruebas | `npm test -- "src/app/panel/(dashboard)/articulos/actions.test.ts"` | PASS — 8 pruebas |
| Lint enfocado | ESLint de los cuatro archivos de código/prueba | LIMITADO — 12 errores `no-explicit-any` preexistentes en `articulos/actions.ts`; los archivos nuevos/modificados por este cambio no aportan errores |

## Límites

- No se efectuó QA autenticado ni consulta remota: el alcance acordado es de
  implementación local y no hay conexión MCP de Supabase disponible en esta
  sesión.
- Las ventas se identifican por su comprobante pero no enlazan a un detalle,
  porque dicho detalle no existe aún en el panel. Compras y guías sí enlazan a
  sus rutas de detalle existentes.
