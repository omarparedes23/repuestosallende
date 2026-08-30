# Tareas — seguridad RPC multitenant

Reglas:

- No modificar migraciones aplicadas.
- No aplicar nada a Supabase sin preflight, TEST y autorización explícita.
- TDD: cada control no trivial debe tener una prueba que falle antes del fix.
- Usar firmas exactas en `REVOKE`/`GRANT`.
- No tocar SQL Server histórico salvo `SELECT` autorizado.
- Preservar cambios locales y no mezclar limpieza global de lint.

## Fase 0 — Inventario remoto y consumidores

- [x] 0.1 Reconciliar ledger remoto, migraciones locales y siguiente número disponible.
- [ ] 0.2 Exportar matriz de todas las funciones `ra_*`: firma, propietario,
      `prosecdef`, `proconfig/search_path`, ACL y volatilidad.
- [x] 0.3 Clasificar cada firma como pública, autenticada, mutable, worker,
      trigger/helper o legacy.
- [x] 0.4 Buscar consumidores en TypeScript, SQL, triggers y rutas internas.
- [ ] 0.5 Confirmar expresamente las consultas que deben permanecer en `anon`.

## Fase 1 — Pruebas de seguridad antes del cambio

- [x] 1.1 Escribir pruebas de catálogo que fallen ante mutaciones ejecutables por
      `PUBLIC`/`anon` o `SECURITY DEFINER` sin `search_path` fijo.
- [ ] 1.2 Escribir pruebas directas y REST para orden de compra, anulación, guía,
      cobro y pago con sesión anónima.
- [ ] 1.3 Escribir matriz autenticada para lectura/vendedor/admin/superadmin y
      usuario cross-tenant, verificando cero efectos.
- [ ] 1.4 Registrar evidencia del fallo esperado en TEST sin reparar datos.

## Fase 2 — Migración forward-only

- [x] 2.1 Corregir autorización server-side de cada función mutable conservada.
- [x] 2.2 Fijar `search_path`, calificar objetos y sanitizar errores.
- [x] 2.3 Revocar `PUBLIC`/`anon` por firma exacta y conceder el mínimo necesario.
- [x] 2.4 Revocar ejecución cliente de triggers/helpers y legacy sin consumidor.
- [x] 2.5 Incluir las nuevas firmas de tesorería en la matriz deny-by-default.
- [x] 2.6 Ejecutar la migración en TEST solo después de aprobación explícita.
      (2026-08-30: `045` aplicada en TEST y registrada en el ledger.)

## Fase 3 — Compatibilidad funcional

- [ ] 3.1 Smoke test de confirmar/anular órdenes desde la aplicación.
- [ ] 3.2 Smoke test de recepción de guías.
- [ ] 3.3 Smoke test de cobros y pagos mediante las RPC versionadas nuevas.
- [ ] 3.4 Verificar que chatbot/catálogo público aprobado continúa funcionando.
- [x] 3.5 Confirmar que ninguna Server Action usa una firma revocada.

## Fase 4 — Verificación

- [x] 4.1 Repetir catálogo de ACL/search_path/propietario en TEST.
      (2026-08-30: `seguridad-rpc-multitenant.test.sql` PASS + advisors.)
- [ ] 4.2 Repetir matriz REST y SQL con conteos posteriores.
- [x] 4.3 Ejecutar advisors de seguridad y rendimiento.
      (2026-08-30: deny-by-default y search_path verificados en TEST.)
- [ ] 4.4 Ejecutar pruebas unitarias/lint solo de archivos modificados y suite
      completa proporcional al riesgo.
- [x] 4.5 Crear `verify-report.md` con requisito, prueba, evidencia y limitaciones.
      (2026-08-30: PASS con limitaciones documentadas.)
- [x] 4.6 Verificar registro exacto de la migración en el ledger remoto.
      (2026-08-30: `045` registrada como `045`/`seguridad_rpc_multitenant`.)

## Puerta de promoción

- [ ] Ninguna RPC mutable sensible queda ejecutable por `PUBLIC` o `anon`.
- [ ] Los flujos legítimos pasan con grants mínimos.
- [ ] El aislamiento cross-tenant produce cero efectos y no filtra existencia.
- [ ] Seguridad RPC queda en verde antes de promover tesorería/cierre.
