# Proposal — compra-cuenta-por-pagar-atomica

Fecha: 2026-08-23. Basada en `exploration.md` del mismo change (inspección de código + esquema
real remoto, solo lectura).

## Objetivo

Garantizar que una compra se confirme **exactamente una vez** y que cabecera, items, conciliación
de orden de compra, stock, costeo promedio ponderado, kardex, cargo en cuentas por pagar y saldo
del proveedor queden íntegros como **una sola operación transaccional**, con reintentos seguros
(idempotencia) y trazabilidad completa.

## Problema

Hoy `registrarCompra` ejecuta dos RPC separadas: la compra (stock/kardex/costeo) y el cargo CxP.
Un fallo entre ambas deja la compra registrada sin deuda registrada — estado comercial incorrecto
y silencioso. Además no existe idempotencia ni unicidad de factura, el orden de bloqueo de
productos no es determinista (riesgo de deadlock), y `estado_pago` es escribible desde la UI sin
pasar por el ledger.

## Alcance

1. **RPC transaccional única** (`ra_confirmar_compra` o evolución de `ra_registrar_compra`),
   SECURITY DEFINER con `search_path` fijo, que en una transacción haga:
   - resolución server-side de identidad (auth.uid() → perfil → empresa/sucursal autorizadas);
   - inserción de cabecera + items;
   - conciliación contra orden de compra (líneas válidas, sin exceder pendiente, cierre a `recibida`);
   - actualización de stock + costeo promedio ponderado + kardex;
   - registro del cargo CxP + incremento de saldo del proveedor;
   - validaciones estructurales con códigos de dominio estables (sin filtrar errores internos).
2. **Idempotencia**: columnas `operation_id`/`request_hash` en `ra_compras`, unicidad parcial,
   replay estable del resultado, conflicto controlado ante hash distinto (mismo patrón probado en
   venta-transaccional-idempotente).
3. **Orden de bloqueo determinista** de filas de producto (ascendente) para eliminar deadlocks.
4. **Unicidad de factura de proveedor** según decisión sobre la pregunta abierta #1.
5. **Integridad de `estado_pago`**: derivarlo del ledger CxP (vista o cálculo), retirando la
   escritura libre desde la UI.
6. **Anulación coherente**: `ra_anular_compra` revisada contra el nuevo flujo (sin cambios de
   diseño fiscal: compra con cargo sigue requiriendo Nota de Crédito).
7. Adaptador del panel (`compras/actions.ts`) para usar únicamente la RPC nueva; retiro de la
   segunda llamada suelta.
8. Pruebas: replay/conflicto, rollback total por fault injection, concurrencia (misma OC,
   mismos productos en orden inverso), crédito de proveedor/saldo, unicidad de factura.

## No-alcance

- Notas de crédito de compra / reversos de deuda con proveedor (sigue fuera de alcance).
- Pagos a proveedor FIFO/genéricos (`ra_registrar_pago_proveedor` permanece como está).
- Guías de remisión y su recepción de stock (`ra_recibir_guia`), salvo que compartan helper de
  bloqueo determinista si la evidencia lo justifica.
- Liquidación/caja (no interviene en compras a crédito de proveedores).
- Emisión SUNAT de compras.
- Registrar migraciones históricas 001–037 en el ledger (tarea separada ya documentada).

## Criterios de éxito

1. Una compra confirmada genera exactamente una vez TODOS los efectos: 1 cabecera, N items,
   stock incrementado, kardex de entrada, cargo CxP único, saldo de proveedor incrementado —
   verificable con conteos SQL.
2. Replay idéntico del mismo `operation_id` devuelve la misma compra sin duplicar ningún efecto
   (stock descontado una sola vez).
3. Mismo `operation_id` con payload distinto → conflicto controlado, cero efectos adicionales.
4. Fault injection tras cada efecto crítico demuestra rollback TOTAL (incluidos cargo CxP y
   saldo del proveedor): 0 compras, 0 kardex, 0 cargos, stock intacto.
5. Dos recepciones concurrentes con los mismos productos en orden inverso no deadlockean y
   serializan correctamente (stock final = suma correcta).
6. No puede registrarse dos veces la misma factura de proveedor según la regla decidida.
7. `estado_pago` ya no es escribible desde la UI y refleja el ledger.
8. `npm test` completo en verde; suites autenticadas nuevas documentadas en verify-report.md.

## Dependencias

- Patrón y lecciones de `venta-transaccional-idempotente` (migración forward-only, fault
  injection vía triggers transitorios, fixtures TEST, suite opt-in).
- Requiere decisiones sobre las preguntas abiertas 1–5 de `exploration.md` antes de design.md.
