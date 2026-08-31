# Tareas — numeración y series de guías

## Diseño y preflight

- [x] Documentar modelo, contratos y decisión de reservar al crear.
- [x] Claude: auditar esquema remoto y ledger; confirmar siguiente migración. → `audit-remoto.md`, migración `051`
- [x] Claude: proponer migración, RLS, grants y pruebas SQL antes de aplicar. → `sql/051_*.sql`, `sql/tests/*`

## Supabase — Claude exclusivamente

- [x] Crear `ra_series_documento`, constraints y políticas. → aplicado en TEST
- [ ] Crear configuración inicial de series solo con datos explícitamente
      aprobados por el propietario. → **pendiente**: confirmar sucursal de serie `001` y su `siguiente_correlativo`
- [x] Crear preview y recrear `ra_crear_guia` con asignación atómica. → `ra_obtener_preview_serie_guia` + `ra_crear_guia(uuid,uuid,text,jsonb)`
- [x] Ejecutar pruebas de concurrencia y registrar ledger. → suite A–G PASS + runner PASS (correlativos 6/7); ledger `('051','numeracion_series_guias')`

## Aplicación — Codex

- [x] Actualizar tipos TypeScript y acciones RPC.
- [x] Mostrar preview por sucursal origen y retirar inputs editables.
- [x] Corregir fecha de lista y mostrar número formateado.
- [ ] Crear pantalla administrativa de series si el contrato lo autoriza.
- [ ] Ejecutar pruebas, lint dirigido, build y reporte final.
