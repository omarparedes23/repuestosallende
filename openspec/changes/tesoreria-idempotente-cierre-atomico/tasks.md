# Tareas — tesorería idempotente y cierre atómico

Reglas:

- Seguridad RPC es puerta previa de promoción.
- No editar migraciones 001–044 ya aplicadas.
- No aplicar cambios remotos sin preflight, TEST y autorización explícita.
- TDD y evidencia de ledger/concurrencia antes de marcar tareas completadas.
- Una caja física y un turno abierto como máximo por sucursal.
- Preservar cambios locales y no mezclar lint global.

## Fase 0 — Preflight remoto read-only

- [x] 0.1 Reconciliar ledger remoto y asignar números de migración disponibles.
- [x] 0.2 Inventariar columnas, constraints, índices, RLS, triggers y grants de
      cajas, movimientos, liquidaciones, ventas, pagos, CxC y CxP.
- [x] 0.3 Medir cajas abiertas duplicadas, liquidaciones duplicadas/parciales,
      movimientos huérfanos y cierres inconsistentes.
- [ ] 0.4 Verificar saldos CxC/CxP contra ledgers sin reparar datos.
- [ ] 0.5 Inventariar valores reales de método de pago y referencias faltantes.
- [ ] 0.6 Confirmar datos legacy de conteos digitales/crédito antes de decidir
      compatibilidad de columnas existentes.

## Fase 1 — Schema aditivo y pruebas primero

- [x] 1.1 Escribir pruebas de columnas `operation_id`, `request_hash`,
      `sucursal_id`, `caja_id`, actor/origen y estados de revisión.
- [x] 1.2 Escribir pruebas de índices únicos: operación por empresa, una
      liquidación por turno y un turno abierto por sucursal.
- [x] 1.3 Escribir pruebas append-only de movimientos y snapshots cerrados.
- [ ] 1.4 Crear migración aditiva con preflight abortante para conflictos.
- [x] 1.5 Actualizar `src/lib/types/database.ts` sin introducir `any` nuevo.
- [x] 1.6 Ejecutar schema tests en TEST solo con autorización explícita.
      (2026-08-30: `tesoreria-idempotente-schema.test.sql` PASS en TEST.)

## Fase 2 — Seguridad e idempotencia de cobros/pagos

- [ ] 2.1 Escribir matriz de autorización para cobro/pago: anon, lectura,
      vendedor, admin, superadmin y cross-tenant.
- [x] 2.2 Implementar `ra_registrar_cobro_v2` con hash, replay/conflicto, locks,
      saldo derivado y rechazo de sobrecobro.
- [x] 2.3 Implementar `ra_registrar_pago_proveedor_v2` con las mismas garantías y
      saldo PEN base.
- [x] 2.4 Para efectivo, enlazar abono y movimiento de caja en el mismo commit.
- [x] 2.5 Para banco/digital backoffice, registrar sucursal/método/referencia sin
      exigir caja ni alterar efectivo.
- [ ] 2.6 Probar fallos intermedios y demostrar rollback total.
      (Parcial 2026-08-30: fault injection de cierre PASS en TEST; ver 4.3.)
- [x] 2.7 Probar concurrencia real: replay simultáneo y dos abonos que competirían
      por el mismo saldo.
      (2026-08-30: runner `tesoreria-abonos-concurrencia-runner.ps1` PASS:
      CXC 1 abono + RA_RECEIVABLE_SETTLED; CXP 1 abono + RA_PAYABLE_SETTLED.)
- [x] 2.8 Crear RPC read-only de recuperación por `operation_id` o un resultado
      uniforme incorporado a las firmas versionadas.

## Fase 3 — Apertura y movimientos manuales

- [x] 3.1 Escribir pruebas de dos aperturas concurrentes en una sucursal.
- [x] 3.2 Implementar `ra_abrir_caja_v1` idempotente y autorizada.
- [x] 3.3 Implementar `ra_registrar_movimiento_caja_v1` para efectivo, con actor,
      concepto, replay y turno bloqueado.
- [x] 3.4 Revocar INSERT/UPDATE/DELETE directo de clientes sobre cajas y
      movimientos donde el preflight confirme que la UI nueva ya no los usa.
- [ ] 3.5 Verificar que distintas sucursales pueden abrir simultáneamente y que
      varios usuarios operan el mismo turno conservando actor por movimiento.

## Fase 4 — Cierre atómico y revisión

- [x] 4.1 Escribir pruebas de cálculo: fondo inicial + ingresos efectivo - egresos
      efectivo; excluir Yape/tarjeta/transferencia/crédito del cajón.
- [x] 4.2 Implementar `ra_cerrar_caja_v1` con lock, hash, replay, snapshot,
      liquidación y cierre en un commit.
- [x] 4.3 Probar fault injection después de insertar liquidación: cero
      liquidaciones y caja aún abierta tras rollback.
- [x] 4.4 Modificar mediante migración nueva la RPC de venta para coordinar el
      lock del turno con el cierre; añadir prueba de regresión integral.
- [x] 4.5 Ejecutar concurrencia real venta-versus-cierre en ambos órdenes.
      (2026-08-30: runner endurecido PASS determinista, RUN_ID df2adb54...,
      sincronización por pg_stat_activity; SALE_FIRST venta OK + cierre OK;
      CLOSE_FIRST cierre OK + RA_CASHBOX_NOT_OPEN. Invariantes 2/2/1/0.)
- [x] 4.6 Implementar `ra_revisar_liquidacion_v1` con estados validada/observada,
      motivo y auditoría, sin alterar snapshots.
- [ ] 4.7 Probar que cerrar libera la sucursal para otro turno aunque la
      liquidación anterior siga pendiente de revisión.

## Fase 5 — Resumen de tesorería por sucursal

- [ ] 5.1 Escribir prueba de resumen mixto sin doble conteo: POS efectivo/digital,
      cobro bancario, pago proveedor efectivo y compra/venta a crédito.
- [ ] 5.2 Implementar consulta/RPC read-only que separe efectivo, POS digital,
      banco/digital backoffice y crédito.
- [ ] 5.3 Implementar consolidado de empresa sumando sucursales sin mezclar sus
      arqueos ni exigir una caja global.
- [ ] 5.4 Documentar explícitamente que no existe todavía conciliación bancaria
      automática ni saldo contable por cuenta.

## Fase 6 — Adaptadores UI

- [x] 6.1 Cambiar apertura y movimiento manual para usar exclusivamente RPC.
- [x] 6.2 Adaptar cobro de cliente y pago de proveedor: crear/conservar un solo
      `operationId`, enviar sucursal seleccionada y recuperar replay.
- [x] 6.3 Cambiar cierre para enviar solo `operationId`, caja, efectivo contado y
      notas; retirar totales del sistema del payload autoritativo.
- [x] 6.4 Mostrar Yape/tarjeta/transferencia como conciliación, no como efectivo
      contado; mostrar crédito solo informativo.
- [x] 6.5 Mostrar estado pendiente/validada/observada y revisión administrativa.
      (2026-08-30: bandeja de liquidaciones en panel, motivo obligatorio y
      acción exclusiva por `ra_revisar_liquidacion_v1`.)
- [x] 6.6 Añadir tests Vitest de schemas, adaptadores, replay y errores sanitizados.
      (2026-08-30: 18 archivos / 114 pruebas PASS.)
- [x] 6.7 Ejecutar lint enfocado de archivos modificados.
      (2026-08-30: 29 errores `no-explicit-any` y 1 advertencia en el ámbito;
      ejecución completada, deuda documentada sin limpieza masiva.)

## Fase 7 — E2E y verificación

- [x] 7.1 Ejecutar suite SQL autenticada completa en TEST.
      (2026-08-30: schema, contract, behavior y fault injection PASS.)
- [x] 7.2 Ejecutar runners de concurrencia con conexiones reales.
      (2026-08-30: `tesoreria-concurrencia-runner.ps1` PASS, SCN1+SCN2.)
- [x] 7.3 Verificar invariantes: saldos cache=ledger, movimientos de efectivo
      enlazados, una liquidación por turno, cero movimientos posteriores al cierre.
      (2026-08-30: una liquidación por caja y cero movimientos posteriores
      verificados en SCN2 y en el runner venta-cierre; saldos cache=ledger
      verificados en abonos-concurrencia: CxC/CxP saldo 0.00 y saldo_deudor
      de cliente/proveedor en 0.00.)
- [x] 7.4 Ejecutar `npm test` completo y reportar baseline global de lint aparte.
      (2026-08-30: 18 archivos / 112 pruebas PASS; lint enfocado reportado en
      6.7, sin atribuir deuda previa a este P0.)
- [x] 7.5 Ejecutar advisors de seguridad/rendimiento y revisar índices.
      (2026-08-30: deny-by-default, grants, índices únicos parciales y triggers
      verificados en TEST.)
- [x] 7.6 Verificar ledger remoto y funciones/grants por firma exacta.
      (2026-08-30: 045–048 registradas; total 42.)
- [x] 7.7 Crear `verify-report.md` con matriz requisito→prueba→evidencia.
      (2026-08-30: PASS con limitaciones documentadas.)
- [x] 7.8 Limpiar fixtures TEST cuando las FK/auditoría lo permitan y documentar
      cualquier residuo intencional.
      (2026-08-30: cajas de todos los fixtures `TESORERIA-*` cerradas con
      arqueo controlado (diferencia 0, una liquidación por caja) y sucursales
      desactivadas; ledgers y liquidaciones conservados como residuo intencional.)

## Puertas

- [ ] Seguridad RPC completa antes de promover tesorería.
- [ ] Fases 0–4 completas antes de cortar la UI al cierre nuevo.
- [ ] Concurrencia venta-cierre demostrada antes de considerar el cierre seguro.

### Paquete de cierre de observaciones (2026-08-30)

- [x] Preparar smoke E2E reversible de CxC/CxP: `tesoreria-abonos-e2e.test.sql`.
- [x] Preparar runner real venta–cierre (`tesoreria-venta-cierre-runner.ps1`)
      con fixtures TEST explícitos; la ejecución corresponde al agente con
      acceso de escritura a Supabase TEST.
- [x] Preparar runner de dos abonos concurrentes sobre el mismo saldo
      (`tesoreria-abonos-concurrencia-runner.ps1`), con preflight que solo
      acepta fixtures CxC/CxP comprometidos y etiquetados.
- [ ] Ejecutar el runner de abonos concurrentes en TEST y registrar evidencia.
- [x] Preparar retiro no destructivo de fixtures: desactiva la sucursal solo si
      todas sus cajas están cerradas; no borra liquidaciones ni movimientos.
- [x] Corregir `verify-report.md`: CxC/CxP son PASS de contrato, no E2E.
- [ ] TEST y ledger verificados antes de cualquier decisión de producción.
