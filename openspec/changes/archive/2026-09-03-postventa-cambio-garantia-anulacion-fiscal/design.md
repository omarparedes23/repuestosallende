# Diseño: operación de devoluciones postventa

## Arquitectura

La migración **058** amplía el agregado de 055 sin editarla ni modificar filas históricas.

```text
solicitada --recepción true--> recibida --aprobación--> aprobada --liquidación--> liquidada
solicitada|recibida|aprobada --rechazo--> rechazada
solicitada --recepción false--> solicitada
```

Cada acto conserva usuario, `operation_id`, hash y auditoría. Las RPC, no las UIs, son la autoridad de negocio.

## Esquema 058

`ra_estado_devolucion` recibe `recibida` y `aprobada`. `ra_devoluciones` recibe `recepcion_operativa_por`, `recepcion_operativa_at`, `recepcion_recibido`, `condicion_declarada`, `recepcion_observacion`, `recepcion_operation_id`, `recepcion_request_hash`, `reingreso_aprobado` y `reingreso_override_motivo`.

`condicion_declarada` admite exclusivamente `apto_reventa`, `dañado`, `incompleto` y `no_recibido`.

Los `CHECK` imponen: `recepcion_recibido=false` si y solo si condición `no_recibido`; condición distinta de apta exige observación; estados `recibida` y `aprobada` exigen recepción válida; `aprobada` exige decisión de reingreso; permitir reingreso de daño/incompleto exige motivo de override. El constraint no se aplica a `liquidada`, para preservar las filas históricas 055 que no tienen las nuevas columnas. La transición 058 a `liquidada` exige previamente `aprobada`, por lo que la integridad se conserva para filas nuevas.

`receptor_id` se llena solo desde `recepcion_operativa_por`, nunca desde liquidación. Auditoría agrega eventos de recepción, no recibido, aprobación y override; las columnas tipadas son la fuente de verdad.

`ra_solicitar_devolucion_v1` conserva firma. El parámetro histórico `reingresaStock` se acepta, se ignora y las líneas nuevas se guardan con `reingresa_stock=false`; liquidación 058 nunca consulta esa columna. Filas 055 `liquidada` no cambian. Filas 055 `solicitada` no reciben backfill: registran recepción real o se rechazan.

## RPC de recepción

```sql
ra_registrar_recepcion_devolucion_v1(p_operation_id uuid, p_devolucion_id uuid, p_recibido boolean, p_condicion_declarada text, p_observacion text default null) returns jsonb
```

Exige vendedor autorizado y sucursal emisora; bloquea la devolución `solicitada`, valida combinación de campos, aplica advisory lock por empresa/operación y hash de replay. Si recibió, transiciona a `recibida`; si no, conserva `solicitada`. No cambia stock, kardex, caja, CxC ni outbox.

## RPC de aprobación

```sql
ra_aprobar_devolucion_v1(p_operation_id uuid, p_devolucion_id uuid, p_reingreso_aprobado boolean, p_reingreso_override_motivo text default null) returns jsonb
```

Exige administrador/superadmin, recepción válida y estado `recibida`. Calcula el default de reingreso, valida override, persiste columnas tipadas, aprobador y auditoría, y pasa a `aprobada`; no mueve dinero ni inventario. El rechazo usa RPC propia `ra_rechazar_devolucion_v1`, con `operation_id` y motivo obligatorio desde `solicitada`, `recibida` o `aprobada`.

## Extensión de liquidación

`ra_liquidar_devolucion_v1` conserva firma, pero exige estado `aprobada`, recepción verdadera, condición distinta de `no_recibido` y `reingreso_aprobado` no nulo. Solo esa columna decide si crea incremento de stock y kardex. La liquidación solo atribuye `liquidador_id` y resultado; no sobrescribe receptor ni aprobador.

## Concurrencia

El advisory lock actual protege solo replay de la misma `operation_id`. Antes del cálculo acumulado, 058 bloquea las líneas originales, en orden estable:

```sql
SELECT id FROM public.ra_venta_items WHERE id IN (/* líneas de esta devolución */) ORDER BY id FOR UPDATE;
```

Después se calcula el acumulado liquidado. Dos devoluciones distintas sobre la misma línea se serializan; la segunda falla `RA_RETURN_QUANTITY_EXCEEDED` si excede lo vendido. `FOR UPDATE` de los propios `ra_devolucion_items` se mantiene, pero no sustituye este lock.

## Fiscalidad e interfaces

Se conserva el gate: una boleta/factura con outbox original distinta de `accepted`/`rejected` devuelve `RA_RETURN_FISCAL_RECONCILIATION_REQUIRED` antes de cualquier efecto. Panel lo muestra como “Requiere conciliación fiscal del comprobante original”.

Tablet permite buscar venta de la sucursal activa, solicitar y registrar recepción en actos separados aunque encadenados visualmente. Panel tiene bandeja y detalle con venta, pagos, recepción, decisión de reingreso, auditoría, cálculo, estado fiscal y NC; permite aprobar, rechazar, liquidar y reintentar solo cuando el claim permita. No hay cron.

## Seguridad, rollback y verificación

Las columnas nuevas heredan RLS de `ra_devoluciones`. Las RPC `SECURITY DEFINER` fijan `search_path`, derivan empresa/sucursal/rol desde sesión y restringen ejecución a `authenticated`.

Rollback operativo: ocultar rutas y dejar de invocar RPC 058; nunca borrar evidencia ni revertir migración aplicada. Como `ra_liquidar_devolucion_v1` se reemplaza hacia adelante, restaurar su precondición anterior requiere una migración compensatoria explícita y solo es seguro después de cerrar o rechazar devoluciones en estados nuevos. Las pruebas cubren transiciones, contradicciones, idempotencia, caja/CxC, RLS, rollback y dos conexiones con devoluciones distintas. OSE se valida manualmente solo en TEST mediante emisión, replay y 409.
