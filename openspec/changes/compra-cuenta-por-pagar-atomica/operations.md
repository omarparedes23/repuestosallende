# Checklist operativo — despliegue de compra-cuenta-por-pagar-atomica a PRODUCCIÓN

> Estado actual: migraciones 041–044 aplicadas SOLO en Supabase TEST.
> Este checklist es la puerta obligatoria antes de replicarlas en producción.
> Regla permanente: SQL Server histórico (`fasterp.sandemer.net.pe`) solo lectura.

## Fase P0 — Preflight producción (read-only)

- [ ] Instantánea read-only de `ra_compras`, `ra_compra_items`, `ra_kardex`,
      `ra_cuentas_por_pagar_movimientos`, `ra_proveedores`, `ra_ordenes_compra(+items)`:
      columnas, constraints, índices, triggers, funciones, políticas, grants.
- [ ] Ejecutar el preflight canónico de duplicados de factura ANTES de 041:
      `(empresa_id, proveedor_id, upper(btrim(nro_documento))) HAVING count(*) > 1`.
      Si hay duplicados: resolverlos manualmente y re-ejecutar. La migración aborta sola,
      pero resolver antes evita una ventana con compras bloqueadas.
- [ ] Agregados de consistencia previos: totales <= 0, kardex huérfano, cargos CxP
      duplicados por compra, saldos de proveedor divergentes vs ledger. Solo reporte;
      las divergencias se corrigen DESPUÉS de aplicar 043 (backfill auditado), no antes.
- [ ] Ventana de mantenimiento: la aplicación de 041 toma lock breve sobre `ra_compras`
      (creación de índices únicos). Programar en franja de tráfico nulo del POS.

## Fase P1 — Orden de aplicación y ledger

Orden estricto, cada migración en su propia transacción con ON_ERROR_STOP=1:

1. `041_compra_cuenta_pagar_atomica.sql` (preflight inline abortante incluido)
2. `042_ra_confirmar_compra.sql`
3. `043_recalcular_estado_pago_compra.sql` — ejecuta backfill auditado idempotente;
   verificar después: divergencias restantes = 0 y segunda corrida = cero cambios.
4. `044_deprecar_ra_registrar_compra.sql`

Después de cada una:
- [ ] Confirmar COMMIT en salida psql y exit code 0.
- [ ] Registrar fila en `supabase_migrations.schema_migrations`
      (`(version, name)`, statements NULL, nombre sin extensión).
- [ ] Releer el ledger para confirmar el registro.

## Fase P2 — Verificación post-aplicación (read-only)

- [ ] Suite schema: `compra-atomica-schema.test.sql`.
- [ ] Suite preflight abortante: `compra-atomica-preflight.test.sql`.
- [ ] Suite RPC completa: `compra-atomica-rpc.test.sql` (secciones A–I, ROLLBACK por sección).
- [ ] Suite 043: `compra-atomica-043.test.sql` (0/A/B/D).
- [ ] Concurrencia real: runner SCN1–SCN5 (`compra-atomica-concurrencia-runner.ps1`)
      y/o par Fase 5 (`compra-atomica-fase5-conc-runner.ps1`).
- [ ] E2E autenticada opcional: `compra-atomica-e2e-fase5.test.sql` con RUN_ID fresco
      (recordar: no re-ejecutable con el mismo RUN_ID) + limpieza posterior con RUN_IDs.
- [ ] Verificación de contratos 041–044: `compra-atomica-fase6-verificacion.sql`
      (ledger, columnas, índices únicos, RLS, grants, SECURITY DEFINER/search_path,
      comentario 044, advisors-equivalentes).

Criterio de cierre P2: todas las suites en verde y la verificación de contratos sin hallazgos
nuevos. Cualquier rojo BLOQUEA el corte de UI.

## Fase P3 — Corte del adaptador UI

- [ ] Desplegar la versión del frontend que usa exclusivamente `ra_confirmar_compra`
      (commit c3d0dd8 o posterior). NO existe fallback aceptable al flujo legacy.
- [ ] Confirmar que ninguna ruta de código invoca `ra_registrar_compra` ni
      `actualizarEstadoPago` (grep en el build desplegado).

## Rollback operativo

- Las migraciones son FORWARD-ONLY: no existe rollback hacia atrás.
- Rollback funcional = revertir el despliegue de UI a la versión anterior MIENTRAS la base
  conserva 041–044. El flujo legacy `ra_registrar_compra` sigue ejecutable por
  authenticated (044 solo añade metadato), lo que permite operar la UI vieja contra la base
  nueva durante la contención.
- Tras contención: diagnosticar causa, corregir forward-only con migración nueva (>= 045),
  nunca editar 041–044 ya aplicadas.
- La compra auditada por cualquier reparación 043 es permanente por diseño
  (auditoría append-only + FK RESTRICT): no intentar eliminarla ni desactivar el trigger.

## Riesgos conocidos (separados, no bloqueantes del change)

1. **Residuo auditado S9 en TEST**: compra `3feb8e17-00ba-4763-98c5-8e7c50fcb0d5` + su cadena
   es indeleble (auditoría append-only). Aceptado y documentado; no afecta producción.
2. **Migraciones 038–040 (venta transaccional) siguen sin versionarse en Git** — quedan como
   archivos untracked de otro change/commit. Riesgo de trazabilidad separado del presente.
3. **Baseline ajeno**: `tsc --noEmit` falla por `ClienteFormSheet.tsx:113` (change de clientes);
   lint global tiene deuda `any` preexistente (p.ej. `compras/[id]/page.tsx`). No corregir aquí.
