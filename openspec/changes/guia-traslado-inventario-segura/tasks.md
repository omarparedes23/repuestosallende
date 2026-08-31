# Tareas — guía de traslado e inventario seguro

## Fase 0 — evidencia y diseño

- [x] 0.1 Preservar estado local y documentar evidencia de duplicación.
- [x] 0.2 Crear exploración, propuesta, especificación y diseño.
- [x] 0.3 Claude: reconciliar ledger y esquema remoto en modo read-only. → `audit-remoto.md`
- [x] 0.4 Claude: confirmar contrato RPC y número de migración. → `rpc-contract.md`, migración `050`

## Fase 1 — Supabase, responsable Claude

- [x] 1.1 Crear pruebas SQL negativas para origen/destino ausente, stock y
      repetición. → `sql/tests/050_guia_traslado.test.sql` + `sql/tests/guia-concurrencia*.{sql,ps1}`
- [x] 1.2 Crear migración forward-only de creación/transición/recepción. → `sql/050_guia_traslado_inventario_segura.sql`
- [x] 1.3 Verificar RLS, grants, estado, stock y kardex en TEST. → suite A–G PASS + runner de concurrencia PASS, `verify-report-supabase.md`
- [x] 1.4 Aplicar migración y verificar ledger remoto. → objetos aplicados; ledger `('050','guia_traslado_inventario_segura')` registrado; residuos 0

## Fase 2 — aplicación, responsable Codex

- [x] 2.1 Implementar buscador por sucursal y resultado tipado.
- [x] 2.2 Mostrar stock y limitar cantidades; limpiar ítems al cambiar origen.
- [x] 2.3 Integrar creación y estados con contratos RPC aprobados.
- [x] 2.4 Mostrar errores sin actualizar estado local falsamente para los flujos
      actuales; mensajes de dominio quedan pendientes de RPC.
- [x] 2.5 Añadir pruebas unitarias de la búsqueda por sucursal.

## Fase 3 — verificación

- [x] 3.1 Ejecutar pruebas específicas y suite completa. → 23 archivos / 134
      pruebas PASS.
- [x] 3.2 Ejecutar lint dirigido y build. → lint dirigido, TypeScript y build
      PASS.
- [x] 3.3 Claude: smoke test remoto, concurrencia y conteos de stock/kardex.
- [x] 3.4 Redactar `verify-report.md` con PASS/FAIL/BLOCKED.
