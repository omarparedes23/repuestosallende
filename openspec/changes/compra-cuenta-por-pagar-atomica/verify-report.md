# Verify Report - compra-cuenta-por-pagar-atomica

Fecha: 2026-08-23. Fases 0-2 ejecutadas contra Supabase TEST (axcrubvtpqcyscizgoee).

---

# Aplicacion 042 rev.3 y suites de la RPC (2026-08-23)

## Veredicto

**PASS COMPLETO.** `042_ra_confirmar_compra.sql` aplicada en Supabase TEST con
`ON_ERROR_STOP=1`, transaccion terminada en **COMMIT** (backfill `UPDATE 0`). Suite RPC
15/15 OK; runner de concurrencia 2/2 escenarios PASS con concurrencia real demostrada.
`'042'` registrada en `supabase_migrations.schema_migrations`.

## Suite RPC (`compra-atomica-rpc.test.sql`) - 15/15

| Seccion | Verifica | Resultado |
|---|---|---|
| A | 4 roles + empresa desde auth.uid() + sucursal requerida/ajena/inactiva | OK |
| B | credito 236 exacto / contado pagado / parcial / sobrepago / metodo invalido | OK |
| C | replay identico (tolera casing/1=1.0) / conflicto / recuperacion found+not_found / replay estable ante proveedor Y sucursal desactivados | OK |
| D | factura duplicada -> RA_INVOICE_DUPLICATE / docs vacios permitidos | OK |
| E | recepcion parcial OC 4+6 -> recibida / exceso -> RA_ORDER_INVALID | OK |
| F+F+ | >200 items, cantidad<=0, escala cantidad>3, escala precio>2, overflow precio, USD sin tc, tc escala>4, notas>500, referencia>120, abono no numerico, abono escala>2, overflow temprano SIN efectos, costo PEN fuera de rango, catalogo inexistente SIN efectos, saldo al maximo | OK |
| G | USD->PEN base: total_pen 436.60, cargo en base, costeo convertido (esperado desde kardex), abono base cierra a pagado, hash multimoneda estable | OK |
| H | sin hooks permanentes + fault injection transient x5 puntos con rollback total verificado (compras/kardex/cxp=0, stock intacto) | OK |
| I | equivalencia canonica 1/1.0/1.00 -> replay | OK |

## Concurrencia real (`compra-atomica-concurrencia-runner.ps1`) - 2/2

Metodo: dos procesos psql simultaneos via Start-Job; handshake advisory first/second por
RUN_ID; t0/t1 miden la llamada RPC; t2 = fin de retencion pre-commit. Evidencia de
solapamiento = PIDs distintos + interseccion [t0,t2]. Nota: kardex.created_at usa NOW()
(inicio de txn) y NO sirve para ordenar commits solapados.

### Escenario 1 - documentos distintos, productos en orden inverso
- RUN_ID `bb492df793f04241ba2ebd521251a14a`
- A PID=4126589 t0=04:23:22.903120 t1=04:23:24.917041 -> OK (bloqueada ~2s dentro de la RPC sobre la txn abierta de B)
- B PID=4126590 t0=04:23:22.887524 t1=04:23:22.902622 -> OK
- Efectos: 2 compras / 2 cargos / 4 kardex; invariantes stock_actual=max(stock_nuevo) y sin stocks negativos => ORDEN DETERMINISTA SIN DEADLOCK.

### Escenario 2 - misma factura, operation_id distintos
- Mismo RUN_ID
- A PID=4126623 outcome=RA_INVOICE_DUPLICATE (bloqueada dentro de la RPC)
- B PID=4126658 outcome=OK
- Efectos: 1 compra / 1 cargo / 2 kardex - un solo conjunto.

## Hallazgo mayor corregido durante la ejecucion

**Deadlock real detectado por el Escenario 1** (primera corrida: A=`deadlock detected`,
B=OK). Causa: INSERT de cabecera toma FOR KEY SHARE sobre `ra_proveedores` (FK) y el FOR
UPDATE del saldo llegaba tarde, tras el bucle de productos -> ciclo entre dos transacciones
con cabeceras insertadas y ordenes de items inversos. Fix en 042: FOR UPDATE temprano del
proveedor (paso 6) fijando orden canonico proveedor -> OC(+lineas) -> productos catalogo_id
ASC. Re-ejecutado: sin deadlocks.

## Desviaciones menores corregidas en vivo (fixtures/suites)

1. `ra_perfiles` no tiene email -> JOIN auth.users (14 sitios).
2. `ra_productos` sin created_at -> ORDER BY id.
3. Empresa TEST sin proveedores -> INSERT condicional in-txn (rollback).
4. `ra_orden_compra_items.subtotal` NOT NULL -> fixture lo incluye.
5. `(v_res->>'replayed') IS NOT TRUE` invalido (text) -> COALESCE <> 'true'.
6. Pooler 6543 es transaction-pooled y pierde GUCs de sesion -> runner usa conexion
   directa db...:5432 (session mode).
7. set_config(...,true) local moria con autocommit -> false + reset final.

## Verificaciones posteriores

- Firmas exactas de ambas RPC / SECURITY DEFINER / search_path=public,pg_temp: OK
- EXECUTE authenticated=t, anon=f: OK
- total_pen numeric(12,2): OK
- Sin ra_hay_fault_punto ni triggers fi_* residuales: OK
- Sin residuos FI-*; 19 compras CONC* acumuladas = artefactos esperados de las corridas
- Ledger: '042','ra_confirmar_compra' registrada

---

# Cobertura final de pruebas y riesgos residuales (2026-08-23)

## Matriz de cobertura ejecutada

| Requisito | Prueba | Resultado |
|---|---|---|
| Autorizacion 4 roles + sucursal | Suite RPC A; runner SCN1-4 (todas OK) | PASS |
| Empresa/usuario desde auth.uid() | Suite RPC A.5 | PASS |
| Compra credito integral | Suite RPC B1 (236 exacto) | PASS |
| Contado cargo+abono atomico | Suite RPC B2-B3, G2 | PASS |
| Sobrepago / metodo invalido | Suite RPC B4-B5 | PASS |
| Replay secuencial + recuperacion op_id | Suite RPC C1/C3/C5 | PASS |
| Conflicto idempotencia | Suite RPC C2; runner SCN4 | PASS |
| Unicidad factura (pre-check + unique_violation concurrente) | Suite RPC D; runner SCN2 | PASS |
| Recepcion parcial OC + replays sin doble efecto | Suite RPC E + E2 | PASS |
| Limites/escalas/overflow temprano sin efectos | Suite RPC F, F12-F15 | PASS |
| Multimoneda base PEN sin mezcla | Suite RPC G | PASS |
| Fault injection transient x5 con rollback total | Suite RPC H | PASS |
| Equivalencia numerica canonica 1/1.0/1.00 | Suite RPC I; C1 | PASS |
| Concurrencia orden inverso sin deadlock | Runner SCN1 (RUN_ID bb492df7 inicial con deadlock -> fix -> corridas verdes) | PASS |
| Carrera de factura concurrente | Runner SCN2 | PASS |
| Idempotencia concurrente mismo op_id | Runner SCN3 (misma compra, rep=false/true) | PASS |
| Conflicto concurrente mismo op_id | Runner SCN4 (cero efectos perdedor) | PASS |

## Deadlock detectado y corregido

Primera corrida del SCN1 expuso un deadlock real: INSERT de cabecera (FOR KEY SHARE
sobre proveedor por FK) + FOR UPDATE tardio del saldo = ciclo entre transacciones con
cabeceras insertadas e items inversos. Fix: FOR UPDATE temprano del proveedor en el
paso 6, fijando orden canonico proveedor -> OC -> productos catalogo_id ASC.
Corridas posteriores: cero deadlocks.

## Riesgos residuales

1. `ra_registrar_compra` legacy sigue desplegada (deprecated, sin ruta de llamada).
   Retiro definitivo pendiente como migracion futura.
2. `estado_pago` de compras ANULADAS queda fuera de la semantica de proyeccion
   (documentado; la anulacion plena requiere notas de credito).
3. El encabezado histórico del archivo local 043 todavía dice `BORRADOR`; no se modifica porque
   la migración aplicada está congelada. La aplicación, ledger y suites PASS constan abajo.
4. Migraciones locales 001-041 fuera del ledger salvo 038-042 (tarea separada).
5. Fixtures TEST persistentes de corridas de concurrencia (compras CONC*) quedan
   documentados como artefactos esperados; limpieza opcional posterior.

---

# Corrida final de concurrencia (2026-08-23, RUN_ID b300345962fb44b3814073cbb14596a8)

Runner rev.4 + suites rev.4 (parser de Codex con grupos nombrados; campo changed agregado).

| Escenario | PIDs | Solape | Outcomes | Efectos verificados |
|---|---|---|---|---|
| SCN1 orden inverso | 4133671 / 4133672 | si (B bloqueada 2.1s sobre txn de A) | OK / OK | 2 compras, 2 cargos, 4 kardex, stock=max(stock_nuevo) |
| SCN2 carrera factura | 4133679 / 4133680 | si (A bloqueada dentro de la RPC) | RA_INVOICE_DUPLICATE / OK | 1 compra, 1 cargo |
| SCN3 mismo op payload identico | 4133687 / 4133688 | si | OK(replayed:true) / OK(replayed:false) | misma compra 5f4a066c: 1 compra, 1 cargo, 1 kardex |
| SCN4 mismo op payload distinto | 4133713 / 4133714 | si | RA_IDEMPOTENCY_CONFLICT / OK | 1 compra ganadora; cero efectos del perdedor |
| SCN5 reparacion concurrente | — | — | BLOQUEADO: requiere 043 aplicada (ra_recalcular_estado_pago inexistente por diseño) | se ejecutara tras aplicar 043 |

Conclusion: Fase 3 (idempotencia y concurrencia) verificada end-to-end contra Supabase
TEST con solapamiento real de transacciones. SCN5 queda como puerta de salida de 043.

---

# Aplicacion 043 rev.3 y verificacion final (2026-08-23)

## Flujo ejecutado (autorizado por el propietario)

1. **Preflight read-only pre-aplicacion** (SELECT equivalente, la funcion no
   existia aun): 1 divergencia — compra `079dc4c2...` almacenada `pendiente`
   vs proyectado `pagado` (sembrada por SCN5 del intento previo).
2. **043 aplicada** con ON_ERROR_STOP=1: COMMIT; backfill corrigio esa 1 compra
   insertando auditoria actor_tipo='migracion'.
3. **Suite compra-atomica-043.test.sql**: 0/A/B1-B6/D todas OK
   (se corrigieron en vivo dos defectos del propio test: cast name[]->text[]
   en la verificacion del indice y expectativa del search_path con espacio).
4. **Runner completo SCN1-SCN5**: todos PASS. SCN5 reparacion concurrente:
   A PID=4134989 replayed:true changed:true / B PID=4134990 replayed:false
   changed:true, misma compra `18d4f6ea...`, UNA sola fila de auditoria
   (`c9684d2a...`, motivo conc5-<RUN_ID>), solapamiento real confirmado.
   Nota: la verificacion final del runner fallo una vez por saturacion
   transitoria de conexiones en 5432; re-ejecutada manualmente = 1/OK.
5. **Segunda comprobacion de backfill**: divergencias post = 0; auditorias de
   backfill sin cambios (idempotente); actor 'migracion' con usuario NULL.
6. **Registro**: '043','recalcular_estado_pago_compra' insertada en ledger.

## Estado del change

Fases 0-3 COMPLETAS y verificadas contra Supabase TEST. La Fase 4 queda implementada y
verificada localmente; su evidencia se registra en la sección siguiente. Las Fases 5 y 6
siguen pendientes y no se consideran autorizadas ni cerradas.

---

# Fase 4 — adaptador del panel/UI y correcciones de revisión (2026-08-23)

## Veredicto

**PASS LOCAL.** El panel usa exclusivamente `ra_confirmar_compra`, conserva el mismo
`operationId` durante un resultado incierto, recupera mediante
`ra_obtener_resultado_compra`, y presenta `estado_pago` como lectura sin mutación manual.

No se modificaron las migraciones aplicadas 041–043. Se creó
`044_deprecar_ra_registrar_compra.sql` para añadir el metadato explícito
`COMMENT ON FUNCTION` de forma forward-only. La 044 fue **aplicada y registrada en el ledger
remoto el 2026-08-23 con autorización del propietario** (evidencia al final de este informe).

## Evidencia local

| Verificación | Resultado |
|---|---|
| Schema Zod estricto, dominio documental y campos autoritativos | 27/27 PASS |
| Server actions, RPC única, replay, consulta y errores sanitizados | 22/22 PASS |
| Suite Vitest completa | 11 archivos, 88/88 PASS |
| ESLint focal de archivos de Fase 4 | 0 errores, 0 advertencias |
| `git diff --check` focal | PASS |
| `rg` de invocaciones RPC legacy y `actualizarEstadoPago` en TS/TSX | 0 invocaciones; queda una mención documental de `ra_registrar_compra` en `costeoCompras.ts` |

## Correcciones incorporadas

1. Se añadió el spec normativo ausente en
   `specs/confirmacion-compra-atomica/spec.md`.
2. El schema quedó alineado con PostgreSQL: `FACTURA | BOLETA | OTROS` y número documental
   de hasta 60 caracteres. Antes aceptaba valores que la RPC rechazaba.
3. `RA_INVOICE_INVALID` ahora se transforma en un mensaje de dominio probado.
4. El change OpenSpec dejó de quedar oculto por el ignore global de Markdown mediante
   excepciones limitadas a este directorio.

## Limitaciones y puertas siguientes

- La evidencia remota de Fases 0–3 procede de las corridas documentadas anteriormente; no se
  reejecutó ni se escribió en Supabase durante esta revisión.
- `tsc --noEmit` global permanece bloqueado por un error ajeno a compras en
  `src/app/tablet/(kiosk)/clientes/components/ClienteFormSheet.tsx:113`.
- Fase 5 (E2E autenticado contra TEST) continúa pendiente.
- Fase 6 (advisors, rollout y cierre final) continúa pendiente.

---

# Aplicación de 044_deprecar_ra_registrar_compra (2026-08-23)

Autorización explícita del propietario: aplicar 044 únicamente; no modificar 041–043;
no iniciar Fase 5 ni limpiar fixtures.

## Flujo ejecutado

1. **Preflight read-only**: firma exacta confirmada en remoto
   (p_empresa_id uuid, p_sucursal_id uuid, p_proveedor_id uuid, p_nro_documento text,
   p_notas text, p_items jsonb, p_orden_compra_id uuid, p_moneda character,
   p_tipo_cambio numeric), obj_description = NULL previo, y formato del ledger
   041–043 observado (statements=NULL, nombre sin extensión).
2. **044 aplicada** con psql -1 -v ON_ERROR_STOP=1: salida COMMENT, exit code 0.
3. **Verificación por lectura**: obj_description(oid,'pg_proc') devuelve el texto
   DEPRECATED completo asociado exactamente a la firma anterior. Lectura posterior
   exitosa = prueba definitiva del COMMIT.
4. **Registro en ledger**: fila insertada ('044','deprecar_ra_registrar_compra'),
   replicando el formato de 041–043; relectura confirma presencia.
5. **Comprobación read-only de permisos/comportamiento**:
   - proacl = {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
     (idéntico al estado dejado por 041: PUBLIC/anon revocados, authenticated conservado).
   - has_function_privilege: anon=NO ejecuta, authenticated=SÍ ejecuta.
   - Atributos intactos: prosecdef=true, search_path=public, provolatile=v.

## Estado tras 044

- Migraciones aplicadas y registradas: 041, 042, 043, 044.
- Fase 5 (E2E autenticada contra TEST): PENDIENTE de autorización separada del propietario.
- Limpieza de fixtures TEST: NO realizada (fuera de alcance autorizado).

---

# Fase 5 — Suite autenticada E2E contra Supabase TEST (2026-08-23)

## Veredicto

**PASS.** Los 11 escenarios autorizados ejecutados con efectos reales COMMITADOS contra
Supabase TEST (misma base del proyecto, sin DDL de negocio, fixtures etiquetados).

Evidencia principal:
- Suite E2E: supabase/tests/compra-atomica-e2e-fase5.test.sql, RUN_ID
  edf1090b9e324f5abe08c54c672535b9 (S0–S9, todos NOTICE OK).
- Concurrencia real: compra-atomica-fase5-conc-runner.ps1 +
  compra-atomica-fase5-conc.test.sql, RUN_ID 7d040885d7584f2eac6bd159e44a185a.
- Limpieza: compra-atomica-fase5-cleanup.sql.

## Matriz requisito → escenario → evidencia

| Requisito autorizado | Escenario | Evidencia |
|---|---|---|
| Éxito integral de compra | S1 | compra e64efd73 total 141.60 (subtotal 120 + IGV 21.60), 2 items, 2 kardex entrada, cargo+abono CxP, stock exacto (+2/+1), costeo promedio ponderado exacto ROUND((sa*pa+q*pp)/(sa+q),2), saldo proveedor neto intacto, estado pagado |
| Replay idempotente | S2 | mismo operation_id con items en otro orden => replayed:true, misma compra e64efd73, cero efectos nuevos (hash canónico ordena items) |
| Conflicto idempotente | S3 | mismo op payload distinto => RA_IDEMPOTENCY_CONFLICT, 0 compras residuales |
| Timeout recovery found/not_found | S4 | ra_obtener_resultado_compra(op) => confirmed + id correcto; op inexistente => not_found; admin de otra empresa => not_found sin fuga |
| Rollback total | S5 | trigger pg_temp inyectado en kardex: fallo propagado, cero efectos parciales intra-transacción y post-ROLLBACK; DDL transitorio revertido |
| Concurrencia mismo operationId | F5-SCN1 | PIDs 4169462/4169463 solapados: una confirmed + una replayed:true, misma compra 2eb91670; 1 compra/2 movs/1 kardex |
| Concurrencia orden inverso (deadlocks/stock) | F5-SCN2 | PIDs 4169468/4169469 solapados, ops distintos, productos en orden inverso: ambos OK sin deadlock, invariante stock_nuevo=stock_actual verificada |
| Recepción parcial OC | S6 | L1 completa + L2 parcial mantiene OC 'confirmada' con cantidad_recibida 5/2; cierre final a 'recibida' (OC bdd5c305) |
| Contado/crédito/abono parcial | S1+S7 | contado total=>pagado (S1); abono 40/118=>parcial con delta saldo proveedor +78 (S7); metodo credito como abono=>RA_PAYMENT_METHOD_INVALID sin efectos |
| Proyección estado_pago | S9 | proyección ledger == almacenada en TODAS las compras del run; recalcular sobre compra consistente => changed:false; auditoría no-op registrada ('Auditoria SIEMPRE' de 043) |
| Unicidad de factura | S8 | FACTURA duplicada normalizada=>RA_INVOICE_DUPLICATE; BOLETA mismo número permitida; NULL dos veces permitido (uq empresa+proveedor+tipo+nro_norm WHERE nro IS NOT NULL) |
| Autorización y aislamiento cross-tenant | S3/S4/S7 + suite Fase 2 sección A | RA_UNAUTHENTICATED/RA_FORBIDDEN/RA_BRANCH_INVALID; resultado cross-tenant nunca filtra existencia |

## Hallazgos de la fase

1. **Auditoría append-only**: ra_auditoria_estado_pago_compras prohíbe DELETE
   (RA_AUDIT_IMMUTABLE) y su FK a compras es ON DELETE RESTRICT. Consecuencia operativa:
   toda compra con auditoría de reparación es permanente por diseño.
2. **Auditoría también en no-op**: ra_recalcular_estado_pago registra auditoría incluso con
   changed:false ("Auditoria SIEMPRE" en 043). Correcto para trazabilidad uniforme.
3. **Pooler 6543 (modo transacción)** no retiene GUCs de sesión entre sentencias: los tests de
   concurrencia requieren conexión directa 5432 o envolver setup+ejecución en una transacción.
4. La suite E2E no es re-ejecutable con el mismo RUN_ID (operation_ids deterministas colisionan
   con compras ya comprometidas => replay). Cada corrida exige RUN_ID fresco.

## Limpieza de fixtures

- Eliminadas 70 filas etiquetadas F5E2E (23 cxp, 20 kardex, 16 compras+items, 3 OC+items,
  6 proveedores, 1 usuario, 1 empresa) sobre los 6 RUN_IDs de la sesión.
- Residuo INTENCIONAL documentado (indeleble por diseño): compra auditada
  3feb8e17-00ba-4763-98c5-8e7c50fcb0d5 (S7 crédito parcial) + 1 item + 1 kardex +
  2 movimientos CxP + su proveedor + 1 auditoría.

## Puertas siguientes

- Fase 6 (npm test completo, advisors, checklist operativo, verificación final): PENDIENTE,
  requiere autorización explícita del propietario.

---

# Fase 6 — Verificación final y rollout (2026-08-23)

## VEREDICTO FINAL DEL CHANGE: PASS

Todas las fases (0–6) ejecutadas con evidencia verificable. El change está completo en
Supabase TEST y listo para el checklist de despliegue a producción (operations.md).

## Evidencia Fase 6

| # | Requisito | Resultado | Detalle |
|---|---|---|---|
| 1 | npm test completo | **PASS** | 11 archivos, 88/88 pruebas, 0 fallos (6.62s) |
| 2 | Lint focal | **PASS con nota** | 8 archivos del change: 0 errores. 2 errores ny detectados pertenecen a compras/[id]/page.tsx — baseline preexistente (commit 949104a), archivo no tocado por este change |
| 2b | git diff --check | **PASS** | EXIT 0 |
| 3 | tsc --noEmit | **PASS con riesgo separado** | Exactamente 1 error: ClienteFormSheet.tsx:113 (baseline ajeno conocido, change de clientes). Cero errores atribuibles a compras/venta/OSE |
| 4 | Advisors-equivalentes read-only sobre 041–044 | **PASS** | supabase/tests/compra-atomica-fase6-verificacion.sql, sin escrituras |

## Contratos verificados en Supabase TEST (read-only)

1. **Ledger**: 041, 042, 043, 044 registradas.
2. **Columnas 041**: operation_id, request_hash, tipo_documento (NOT NULL), nro_doc_norm,
   total_pen presentes en ra_compras.
3. **Índices únicos**: idx_compras_operation_id (unique=true) y
   uq_compras_factura_proveedor (unique=true).
4. **RLS**: habilitado en las 6 tablas del perímetro, con políticas activas
   (ra_auditoria_estado_pago_compras: 1; ra_compras: 2).
5. **Grants**: cero grants a anon/PUBLIC sobre la tabla de auditoría nueva.
6. **RPCs**: ra_confirmar_compra / ra_obtener_resultado_compra /
   ra_recalcular_estado_pago con SECURITY DEFINER y search_path fijado
   (public, pg_temp). EXECUTE revocado a anon en todas; authenticated solo donde corresponde;
   helpers internos (ra_error_compra, ra_sync_estado_pago_compras) sin EXECUTE directo.
7. **044**: comentario DEPRECATED presente sobre la firma exacta de ra_registrar_compra.
8. **Advisor search_path**: 7 funciones SECURITY DEFINER sin search_path fijado — todas
   PREEXISTENTES (ajustar_producto_stock, crm_*, etc.); ninguna pertenece a 041–044.
9. **Advisor RLS**: cero tablas expuestas a anon/authenticated sin RLS.

## Matriz requisito → prueba → evidencia

La matriz completa por fase está en las secciones previas de este informe:
Fase 5 (11 escenarios autorizados), Fase 4 (49/49 + 88/88), Fases 0–3 (suites RPC/schema/
preflight/043/concurrencia SCN1–SCN5) y la tabla de contratos de esta sección.

## Riesgos documentados (separados, no bloqueantes)

1. **Residuo auditado S9 (TEST)**: compra 3feb8e17-00ba-4763-98c5-8e7c50fcb0d5 + cadena es
   permanente por diseño (auditoría append-only RA_AUDIT_IMMUTABLE + FK RESTRICT).
   Aceptado por el propietario; no replicable en producción salvo reparaciones reales.
2. **038–040 sin versionar en Git**: las migraciones del change venta-transaccional-idempotente
   permanecen untracked; deben incorporarse al repositorio en su propio commit/change para
   trazabilidad completa del ledger.
3. **Baseline ajeno**: tsc falla por ClienteFormSheet.tsx:113 (clientes); deuda lint ny
   global. Fuera de alcance de este change.
4. **7 funciones SECURITY DEFINER preexistentes sin search_path fijado**: hallazgo de advisor,
   fuera del alcance de este change; candidatas a hardening forward-only futuro.

## Checklist operativo

Despliegue futuro a producción: operations.md (preflight P0, orden de migraciones P1,
verificación post-aplicación P2, corte UI P3, rollback operativo forward-only).
