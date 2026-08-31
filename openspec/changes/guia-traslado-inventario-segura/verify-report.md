# Verify report — guía de traslado e inventario seguro

Fecha: 2026-08-31

## Resultado

| Área | Estado | Evidencia |
|---|---|---|
| Auditoría y migración remota 050 | PASS | `audit-remoto.md`, `verify-report-supabase.md`; ledger 050 registrado |
| Seguridad RPC | PASS | `SECURITY DEFINER`, `public, pg_temp`, solo `authenticated` con EXECUTE |
| Pruebas SQL y concurrencia | PASS | Suite A–G y runner con una recepción/creación ganadora por carrera |
| Búsqueda por sucursal | PASS | Acción filtra empresa, origen, activo y stock positivo; prueba unitaria |
| Formulario de guía | PASS | Stock visible, máximo por ítem, limpieza al cambiar origen y numeración validada |
| Integración RPC local | PASS | Creación, transición y recepción usan únicamente las tres RPC 050 |
| Pruebas TypeScript locales | PASS | `npm test`: 23 archivos y 134 pruebas |
| Lint dirigido y build | PASS | lint dirigido, `tsc --noEmit` y `npm run build` |

## Contrato integrado

- `ra_crear_guia`: recibe solo origen, destino, numeración, notas e ítems
  `{catalogo_id,cantidad}`. El nombre no viene del cliente.
- `ra_avanzar_estado_guia`: realiza únicamente las transiciones permitidas.
- `ra_recibir_guia`: confirma recepción atómica y devuelve `jsonb`.
- Los códigos `RA_GUIDE_*`, `RA_PRODUCT_NOT_FOUND_*` y
  `RA_STOCK_INSUFFICIENT` se muestran como mensajes accionables.

## Limitaciones

- El stock mostrado puede cambiar antes de recibir; la 050 es la autoridad y
  rechaza insuficiencia de stock sin efectos parciales.
- Este change conserva el movimiento de stock al recibir. Reservas, inventario
  en tránsito y anulaciones permanecen fuera de alcance.
