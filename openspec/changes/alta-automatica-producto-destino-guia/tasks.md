# Tareas — alta automática de producto en destino

## Diseño

- [x] Documentar modelo catálogo/disponibilidad y escenarios de concurrencia.

## Supabase — Claude exclusivamente

- [x] Auditar ledger y definición remota vigente de `ra_recibir_guia`. → `audit-remoto.md` (ledger en 051; siguiente 052)
- [x] Proponer migración 052 forward-only y suite SQL antes de aplicarla. → `sql/052_*.sql`, `sql/tests/*`
- [x] Implementar UPSERT seguro de disponibilidad destino sin sobrescribir
      atributos locales existentes. → `INSERT … ON CONFLICT (empresa_id,sucursal_id,catalogo_id) DO NOTHING` + `SELECT … FOR UPDATE`
- [x] Probar recepción normal, destino ausente, validaciones sin efectos y
      concurrencia; registrar ledger tras PASS. → suite A–D PASS + runner PASS (1 fila destino, stock 10/10); ledger `('052','alta_automatica_producto_destino_guia')`
- [x] Corregir `ra_crear_guia` para permitir destino ausente (052 solo cubre
      recepción); aplicar migración 053 y prueba end-to-end. → 053 aplicada; `RA_PRODUCT_NOT_FOUND_AT_DESTINATION` removido de `ra_crear_guia`; suite A–D + runner 053 + regresión 051/052 PASS; ledger `('053','crear_guia_destino_ausente')`; `audit-053.md` / `verify-report-053.md` / `rollback-plan-053.md`

## Aplicación — Codex

- [x] Confirmar que la firma RPC no cambió y conservar el mensaje defensivo
      `RA_PRODUCT_NOT_FOUND_AT_DESTINATION`.
- [x] Ejecutar pruebas dirigidas y verificación estática. → 7 pruebas de
      guías PASS, `tsc --noEmit` PASS y `git diff --check` PASS.
