# Checklist operativo — Promoción del proyecto TEST como PRODUCCIÓN

> **Contexto corregido (2026-08-23):** NO existe un segundo proyecto Supabase de producción.
> El proyecto actual (`axcrubvtpqcyscizgoee`, PostgreSQL 17.6) será promovido tal cual.
> Por lo tanto **NO se reaplican ni replican migraciones en otro proyecto**: las migraciones
> 038–044 ya están aplicadas y registradas en el ledger de ESTE proyecto, que pasará a ser
> producción. Este checklist cubre el rango completo 038–044 (venta-transaccional-idempotente
> y compra-cuenta-por-pagar-atomica).
> Regla permanente: SQL Server histórico (`fasterp.sandemer.net.pe`) solo lectura.

## Principio rector

La promoción es un cambio de **operativa y configuración**, no de esquema:
lo que hoy llamamos "TEST" pasa a atender el negocio real. El trabajo consiste en
inventariar y decidir qué datos/configuración de prueba permanecen, se corrigen o se
anulan operativamente ANTES de que el negocio empiece a facturar sobre esta base.

## Checklist de promoción

### A. Ledger confirmado (read-only)

- [ ] Confirmar presencia de 038–044 en `supabase_migrations.schema_migrations`
      (script: `supabase/tests/compra-atomica-fase6-verificacion.sql` §1).
- [ ] Nota conocida: `001`–`037` siguen fuera del ledger (aplicadas out-of-band);
      registrarlas es tarea separada opcional, NO bloqueante para promover.

### B. Inventario de fixtures y cuentas TEST

Inventario previo documentado (verify-report de venta y de compras). Elementos a clasificar
(conservar / anular operativamente / documentar):

- [ ] Empresa TEST de venta `10101010-...` con sus usuarios `@test.local`
      (`a0a0a0a0-...` vendedor/admin/lectura/otra empresa), caja abierta `50505050-...`,
      clientes de crédito, catálogos/productos `70..83`.
- [ ] Ventas TTST correlativos 1–6 con estados fiscales de fixture (`b0b0b0b0`,
      `c0c0c0c0`, etc.) y abono TEST en cuenta corriente.
- [ ] Proveedores/productos de pruebas históricos usados por suites RPC/compra.
- [ ] Empresas/perfiles creados por suites (p.ej. `F5E2E:*`, `f5e2e-*`) — ya limpiados,
      salvo el residuo del punto C.
- [ ] Decidir política: los fixtures NO se borran automáticamente; cada uno requiere
      decisión y anulación operativa auditada si corresponde.

### C. Residuo auditado S9 identificado

- [ ] Compra `3feb8e17-00ba-4763-98c5-8e7c50fcb0d5` (S7/S9, run
      `edf1090b9e324f5abe08c54c672535b9`) + su cadena (item, kardex, 2 movimientos CxP,
      proveedor `F5E2E:<run>:PROV`, 1 auditoría) es INDELEBLE por diseño
      (auditoría append-only + FK RESTRICT).
- [ ] Decisión requerida: dejarla histórica documentada, o anularla mediante el mecanismo
      operativo que se defina para anulaciones (change futuro de anulaciones/devoluciones).

### D. OSE beta versus OSE productiva

- [ ] Hoy `OSE_SUNAT_URL` apunta al beta del VPS (`w3sicad.cloud/osesunat`, SUNAT beta)
      con `FACTURACION_PROVIDER=ose`. La promoción fiscal real exige decidir:
      endpoint/certificados/credenciales de SUNAT **productiva** y serie(s) reales.
- [ ] Las ventas TTST/B001 emitidas contra beta NO tienen valor fiscal; documentar esa
      frontera antes de operar.
- [ ] El scheduler sigue SIN habilitar (sin `vercel.json`); ver
      `../venta-transaccional-idempotente/operations.md` para SLA aprobado y pasos de
      activación cuando corresponda.

### E. Variables del hosting (Vercel u otro)

- [ ] Auditar variables contra `.env.example`: Supabase URL/anon/service-role,
      `OSE_SUNAT_URL`/`OSE_SUNAT_API_KEY`, `APISPERU_TOKEN`, `SUNAT_OUTBOX_CRON_SECRET`
      (hoy SIN definir: definirla NO activa nada por sí sola),
      DeepSeek/OpenAI, R2, Stripe, IGV_RATE, APP_URL.
- [ ] Ninguna variable debe exponerse al cliente (verificar ausencia de `NEXT_PUBLIC_`
      para secretos).

### F. Usuarios y permisos

- [ ] Inventariar `ra_perfiles` activos: separar cuentas de prueba (`@test.local`,
      fixtures) de cuentas reales del negocio.
- [ ] Verificar que los roles reales sean mínimos necesarios (administrador/vendedor/
      lectura; superadmin solo si hay justificación).
- [ ] Confirmar que anon/PUBLIC no tiene EXECUTE en RPCs sensibles ni grants sobre tablas
      nuevas (ya verificado en Fase 6; re-chequeo barato con el script de contratos).

### G. Backups / PITR

- [ ] Confirmar en el dashboard de Supabase que el proyecto tiene backups automáticos y
      (si el plan lo permite) PITR activado.
- [ ] Tomar un backup manual/ snapshot ANTES de declarar la promoción completa.
- [ ] Documentar RTO/RPO acordado con el negocio.

### H. Monitoreo y plan de reversión operativa

- [ ] Monitoreo mínimo: advisor de seguridad/rendimiento periódico; consulta agregada de
      outbox por estado/antigüedad; alerta diaria para `dead_letter` según SLA aprobado.
- [ ] Reversión operativa (no hay rollback de esquema): si algo falla tras promover, la
      contención es funcional (desactivar features, anular documentos operativamente,
      restaurar backup solo como último recurso con pérdida de datos posteriores).

### I. Dominio y despliegue de la aplicación

- [ ] Apuntar el dominio del negocio al despliegue (Vercel) con las variables de E.
- [ ] Smoke post-promoción: login real, una venta ticket, una compra, impresión,
      consulta DNI/RUC, y (cuando se active) flujo OSE productivo.
- [ ] Dejar constancia de fecha/hora de la promoción y del responsable.

## Orden sugerido

A → B/C (decisiones sobre fixtures/residuo) → D/E (configuración) → F → G → H → I → smoke.

## Puerta final

La promoción queda cerrada cuando: ledger confirmado, decisiones B/C tomadas y ejecutadas,
configuración productiva cargada, backup previo tomado, smoke en verde y acta corta de
promoción (fecha, responsable, commits desplegados) guardada junto a este archivo.
