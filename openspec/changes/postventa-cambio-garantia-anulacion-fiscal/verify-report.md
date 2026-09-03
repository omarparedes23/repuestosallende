# Verificación — operación de devoluciones postventa

Fecha: 2026-09-03  
Alcance: Fase 1 de `postventa-cambio-garantia-anulacion-fiscal`.

## Veredicto actual

**Implementación y contrato de datos: PASS.**

La fase queda aplicada en Supabase TEST y versionada en los commits `efa2e37`,
`c44abda` y `1dc9190`. No se declara archivada todavía: faltan QA visual de
navegador y la emisión manual contra el tenant OSE TEST.

## Evidencia de base de datos TEST

| Capacidad | Resultado | Evidencia |
| --- | --- | --- |
| Estados, recepción, aprobación y liquidación | PASS | Migraciones 058--066 registradas; suite `supabase/tests/devoluciones-postventa.test.sql` pasó bajo `BEGIN/ROLLBACK`. |
| Actor físico separado | PASS | El vendedor registra recepción; 065 bloquea recepción por administrador. `receptor_id`, `aprobador_id` y `liquidador_id` se verificaron como actores distintos. |
| Admin global y admin scopeado | PASS | Global opera dentro de empresa; el scopeado queda restringido a sucursal. 062--063 y prueba de contrato. |
| Aislamiento de RPC | PASS | 066 revoca `EXECUTE` sobre shims `_055`/`_059`; llamada como rol SQL `authenticated` devuelve `42501`; wrappers públicos continúan funcionando. |
| Concurrencia | PASS | Runner de dos sesiones: una liquidación confirma y la otra recibe `RA_RETURN_QUANTITY_EXCEEDED`; commits reales y retiro con residuo cero. |
| Stock, kardex, caja y NC | PASS | Flujo feliz aislado verificó stock, kardex, egreso de caja, auditoría y outbox NC. |
| Gate fiscal | PASS | `RA_RETURN_FISCAL_RECONCILIATION_REQUIRED` se cubre en suite SQL y se muestra en la acción/UI. |
| Serie NC inválida | PASS preventivo | 067 bloquea una serie que no cumpla `^[BF][A-Z0-9]{3}$` antes de efectos comerciales. |

## Aplicación

| Capacidad | Resultado | Evidencia |
| --- | --- | --- |
| Tablet de recepción | PASS estático | `/tablet/devoluciones`, solo vendedor; registra condición y observación sin decidir reingreso. |
| Panel documental | PASS estático | `/panel/devoluciones`, aprobar, rechazar, override y liquidación para administrador. |
| Outbox NC manual | PASS estático | Estado, intentos, error y reintento solo para `pending`/`retry`; `submitted` queda como conciliación manual. |
| Idempotencia por acto | PASS | Cada Server Action genera UUID nuevo en servidor; la base protege replay y conflicto. |
| Compilación TypeScript | PASS | `tsc --noEmit` pasó tras la UI. |
| Vitest | PASS | `npm test`: 25 archivos, 147 pruebas pasaron el 2026-09-03. |

## Límites y pendientes explícitos

1. **QA visual de navegador: pendiente.** La conexión de navegador de esta
   sesión no disponía de su cliente local, por lo que no se simuló una sesión
   visual ni se declarará como realizada.
2. **OSE TEST manual: pendiente.** Falta tenant/API key TEST autorizada para
   emitir boleta y factura de prueba, NC, replay de `Idempotency-Key`, conflicto
   409 y baja fiscal futura. No se realizaron emisiones externas.
3. **Tipos generados: pendiente menor.** `database.ts` fue actualizado contra
   el esquema TEST vivo. La CLI oficial no pudo generar el archivo completo en
   este entorno porque requiere Docker/Podman para el generador. Se debe
   regenerar antes de una refactorización amplia de tipos.
4. No existe cron en Vercel por decisión de alcance. Los estados `retry`,
   `dead_letter` y `submitted` se supervisan en la bandeja manual; `submitted`
   no se reenvía automáticamente.
5. Fases 2 y 3 continúan fuera de alcance: cambio atómico de producto,
   garantías/RMA y baja fiscal real.
6. La NC `FC001-00000001` ya rechazada permanece como evidencia TEST. OSE
   confirmó que `F001-00000007` sí está emitida y aceptada; el rechazo se
   atribuye a que `FC001` tiene cinco caracteres, mientras el contrato OSE
   exige cuatro. La configuración de serie futura requiere decisión operativa.

## Rollback operativo

No se modifica ni se revierte 055--066 en TEST mediante borrado de migraciones.
Ante un incidente de UI, se ocultan las rutas de devoluciones y se deja de
invocar las acciones nuevas. Las devoluciones ya liquidadas, su kardex, caja,
CxC y outbox permanecen como evidencia durable; cualquier corrección comercial
debe ser compensatoria y auditada.

## Condición para `sdd-archive`

Completar los puntos 1 y 2 con evidencia reproducible, regenerar tipos cuando
el entorno permita el generador y actualizar este informe. Hasta entonces el
cambio permanece activo y no se archiva prematuramente.
