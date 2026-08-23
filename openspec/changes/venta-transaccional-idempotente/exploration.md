# Exploration: venta-transaccional-idempotente

## Objetivo de la exploración

Verificar el flujo real de confirmación de ventas antes de diseñar el cambio que debe garantizar atomicidad, control concurrente de stock, idempotencia y entrega durable a SUNAT/OSE.

Esta exploración usa dos fuentes:

- código y migraciones locales del repositorio;
- esquema real de Supabase consultado el 2026-08-16 mediante MCP acotado al proyecto y con `read_only=true`.

No se ejecutaron escrituras, migraciones ni consultas que expusieran datos personales. Las mediciones remotas se limitaron a catálogo técnico, conteos y agregaciones.

## Estado actual del flujo

El punto de entrada es `procesarVenta()` en `src/app/tablet/(kiosk)/pos/actions.ts`. La secuencia actual es:

1. Resolver sesión, empresa y sucursal.
2. Validar el payload con `VentaInputSchema`.
3. Consultar caja abierta, productos, empresa, sucursal y crédito del cliente.
4. Calcular precios y totales en Next.js.
5. Obtener serie/correlativo mediante `ra_siguiente_correlativo`.
6. Insertar la cabecera en `ra_ventas`.
7. Insertar en paralelo ítems, pagos y movimientos de caja.
8. Registrar por separado el cargo de cuenta corriente mediante `ra_registrar_cargo_credito`.
9. Crear un cliente con service role y actualizar por separado cada stock e insertar cada kardex.
10. Programar la emisión OSE/SUNAT mediante `after()` y actualizar después la venta.

No existe una transacción PostgreSQL que abarque el conjunto. El propio código reconoce que, si falla el cargo de crédito, la venta ya quedó creada.

La UI deshabilita el botón mientras `isPending` es verdadero y muestra `Procesando...`. Esto reduce dobles clics dentro del mismo montaje del componente, pero no protege contra reenvíos, recargas, pérdida de respuesta, dos pestañas ni reintentos de red. El payload no contiene `operationId` ni `idempotencyKey`.

## Evidencia de falta de atomicidad

Las escrituras actuales están separadas por fronteras de red y credenciales:

- cabecera, ítems, pagos y caja usan el cliente autenticado;
- el cargo de crédito es otra RPC y otra transacción;
- stock y kardex usan el cliente service-role, con un `UPDATE` y un `INSERT` independientes por ítem;
- SUNAT/OSE corre después de responder mediante `after()`.

`Promise.all()` solo coordina promesas en la aplicación; no crea atomicidad en PostgreSQL ni revierte las operaciones que ya terminaron.

Fallos intermedios posibles:

- venta sin alguno de sus ítems, pagos o movimientos de caja;
- venta a crédito sin cargo en cuenta corriente;
- stock modificado sin kardex o kardex sin el stock correspondiente;
- una parte de los productos descontada y otra no;
- venta confirmada en base de datos cuya respuesta no llegó al POS y que el cajero reintenta;
- documento fiscal pendiente perdido si el proceso que ejecuta `after()` termina.

## Riesgo concurrente de stock

El flujo lee `ra_productos.stock_actual`, calcula `stockNuevo` en Next.js y luego ejecuta `UPDATE ... SET stock_actual = <valor calculado>`. Dos ventas concurrentes pueden leer el mismo stock inicial y escribir valores derivados del mismo snapshot, perdiendo uno de los descuentos.

El `CHECK (stock_actual >= 0)` remoto impide valores negativos, pero no evita una actualización perdida. El núcleo transaccional debe bloquear la fila (`SELECT ... FOR UPDATE`) o ejecutar un descuento condicional atómico (`UPDATE ... SET stock_actual = stock_actual - cantidad WHERE stock_actual >= cantidad RETURNING ...`). Stock y kardex deben escribirse en la misma transacción.

## Estado verificado de Supabase

### Tablas y columnas relevantes

El esquema remoto contiene:

- `ra_ventas`, sin columna de idempotencia;
- `ra_venta_items` y `ra_venta_pagos`;
- `ra_movimientos_caja`;
- `ra_productos`, con `stock_actual >= 0` y unicidad por empresa, sucursal y catálogo;
- `ra_kardex`, con `referencia_id` nullable y sin clave foránea a ventas;
- `ra_cuenta_corriente_movimientos`, con un índice único para un cargo por venta;
- `ra_cajas`, con una caja abierta única por sucursal;
- moneda y tipo de cambio ya presentes en ventas/productos.

No existe una tabla outbox para SUNAT/OSE dentro del conjunto `ra_*` revisado.

### Funciones remotas

Existen `ra_siguiente_correlativo` y `ra_registrar_cargo_credito`, ambas `SECURITY DEFINER` y con `search_path=public`.

No existe `ra_registrar_venta` ni otra función equivalente que confirme el núcleo completo.

`ra_siguiente_correlativo` usa un advisory lock, pero el lock termina al finalizar esa RPC. Como la inserción de `ra_ventas` ocurre en una llamada posterior, el lock no protege el intervalo entre calcular e insertar el correlativo.

### Índices y deriva de esquema

La migración local `004_sunat_campos.sql` declara `idx_ventas_serie_correlativo`, único por empresa, serie y correlativo. Ese índice no apareció en el inventario remoto de `ra_ventas`.

El historial remoto de migraciones tampoco refleja la secuencia local numerada `001` a `037`; contiene un conjunto distinto de versiones con timestamp. Por ello no se debe asumir equivalencia entre archivos locales y base remota. Antes de implementar habrá que definir cómo reconciliar y desplegar la próxima migración sin depender de que el historial remoto conozca las migraciones locales.

### RLS y privilegios

Las tablas comerciales relevantes tienen RLS. Usuarios autenticados pueden insertar ventas, ítems, pagos y movimientos de caja dentro de su empresa/rol. Kardex y cuenta corriente no admiten inserción directa mediante políticas normales.

El RPC nuevo probablemente deberá ser `SECURITY DEFINER` para escribir todo el agregado, pero tendrá que derivar identidad, empresa, sucursal autorizada y rol desde `auth.uid()` y datos confiables de la base. No debe aceptar como autoridad `empresa_id`, `usuario_id`, precio, total, caja ni stock enviados por el cliente.

También deberá usar `SET search_path = public`, calificar objetos sensibles y conceder ejecución solo a los roles necesarios.

## Medición remota inicial de consistencia

Conteos agregados al 2026-08-16:

- ventas: 5;
- ventas sin ítems: 0;
- ventas sin pagos: 0;
- ventas a crédito sin cargo: 0;
- ventas sin kardex de motivo `venta`: 0;
- productos con stock negativo: 0;
- ventas cuyo total de ítems difiere del subtotal por más de 0.01: 0;
- ventas con pagos inferiores al total por más de 0.01: 0;
- kardex con motivo `venta` cuya `referencia_id` no coincide con una venta existente: 6.

La muestra actual no demuestra atomicidad: solo indica que las cinco ventas existentes no presentan los huecos agregados consultados. Los seis kardex requieren una investigación separada de procedencia/histórico antes de decidir si son datos huérfanos reparables; `referencia_id` es un UUID genérico y no tiene clave foránea.

## Contrato de confianza propuesto para el futuro RPC

El cliente debería enviar únicamente intención:

- `operation_id` generado una vez por intento lógico y conservado para reintentos;
- tipo de comprobante;
- cliente opcional;
- productos, cantidades y descuentos solicitados;
- formas de pago, montos y referencias;
- moneda, tipo de cambio cuando corresponda y vencimiento del crédito.

La base debe derivar o validar:

- usuario mediante `auth.uid()`;
- perfil, empresa, sucursal autorizada y rol;
- caja abierta correspondiente al usuario/sucursal;
- pertenencia y estado activo de cliente y productos;
- habilitación y límite de crédito;
- precios vigentes y regla de descuentos;
- moneda, tipo de cambio y totales con aritmética `numeric`;
- disponibilidad de stock bajo bloqueo;
- serie y correlativo dentro de la misma transacción;
- cabecera, ítems, pagos, caja, crédito, stock y kardex;
- fila outbox para boleta/factura.

El resultado debe poder recuperarse por `operation_id` sin crear una segunda venta.

## Invariantes que debe imponer la solución

1. Una clave de operación pertenece a una sola empresa/usuario y produce como máximo una venta.
2. Repetir exactamente la misma operación devuelve la venta ya confirmada.
3. Reutilizar la misma clave con un payload materialmente distinto genera conflicto y no altera la venta original.
4. Una venta visible como confirmada tiene todos sus ítems y pagos.
5. Todo pago no crediticio genera el movimiento de caja correspondiente; el crédito no ingresa a caja.
6. Toda línea a crédito tiene cliente habilitado, vencimiento y exactamente un cargo derivado de los pagos a crédito.
7. Todo ítem descuenta stock una vez y genera exactamente un kardex coherente con stock anterior/nuevo.
8. Stock insuficiente revierte toda la operación.
9. Serie/correlativo no se duplica bajo concurrencia.
10. Toda boleta/factura confirmada crea exactamente un trabajo outbox durable dentro de la misma transacción.
11. Un fallo o rechazo OSE posterior no revierte la venta comercial; queda trazable y reintentable en la outbox.
12. Ningún dato autoritativo de empresa, usuario, precios, totales o stock proviene sin validación del cliente.

## Alternativas consideradas

### A. Mantener el flujo en Next.js y compensar fallos

Agregar más comprobaciones y tareas de reparación alrededor de las llamadas actuales.

- Ventaja: menor cambio inicial.
- Desventajas: no ofrece atomicidad real, aumenta estados parciales y obliga a diseñar compensaciones complejas.
- Evaluación: descartado para una operación crítica de dinero e inventario.

### B. RPC transaccional único para venta y fila outbox

Una función PostgreSQL valida y escribe todo el núcleo en una transacción implícita de función. Next.js queda como adaptador de sesión/payload y consumidor del resultado.

- Ventajas: rollback real, bloqueo de stock, idempotencia e invariantes cerca de los datos.
- Desventajas: función PL/pgSQL extensa; exige pruebas de base y disciplina de seguridad.
- Evaluación: enfoque recomendado.

### C. RPC comercial sin outbox, manteniendo `after()`

Atomicidad para venta/stock/caja, pero emisión fiscal todavía efímera.

- Ventaja: alcance algo menor.
- Desventaja: incumple el objetivo aprobado y deja sin resolver pérdida/reintento durable de SUNAT.
- Evaluación: no recomendado.

## Enfoque recomendado

Implementar un RPC transaccional único, acompañado por restricciones e índices, con estas piezas conceptuales:

1. `operation_id` UUID y huella canónica del payload para idempotencia.
2. Restricción única que cierre la carrera entre solicitudes concurrentes con la misma operación.
3. Validación/derivación server-side de contexto y valores monetarios.
4. Bloqueo determinista de productos para reducir riesgo de deadlocks.
5. Inserción atómica de venta, detalle, pagos, caja, crédito, stock y kardex.
6. Asignación de correlativo dentro de la misma transacción.
7. Inserción de outbox fiscal dentro de la misma transacción.
8. Respuesta estable recuperable por `operation_id`.
9. Worker/reintentador separado para consumir la outbox; el RPC no llama al OSE.

La forma exacta de la outbox, el estado comercial/fiscal y el algoritmo de reserva de idempotencia deben definirse en `design.md` después de fijar los requisitos normativos.

## Áreas afectadas previstas

- `src/app/tablet/(kiosk)/pos/actions.ts`: sustituir escrituras encadenadas por una RPC y retirar el service role del flujo normal de venta.
- `src/app/tablet/(kiosk)/pos/actions.schema.ts`: incorporar y validar `operationId`.
- `src/app/tablet/(kiosk)/pos/components/PaymentSheet.tsx`: generar/conservar la clave durante reintentos y distinguir resultado perdido de fallo definitivo.
- `src/app/tablet/stores/posStore.ts`: posible persistencia temporal de la operación hasta recibir resultado confirmado.
- `src/lib/facturacion/ose.ts`: convertirse en consumidor del trabajo durable, sin ser disparado directamente por la confirmación.
- `src/lib/types/database.ts`: tipos de nuevas columnas, RPC y outbox.
- `supabase/migrations/`: nueva migración aditiva con tablas/columnas, restricciones, índices, función y permisos.
- pruebas unitarias del schema/UI y pruebas de integración PostgreSQL para rollback, concurrencia e idempotencia.

## Riesgos

- Una función demasiado grande puede ser difícil de mantener; conviene separar helpers internos sin romper la única frontera transaccional.
- Orden distinto de bloqueo de productos puede generar deadlocks; los IDs deben bloquearse en orden determinista.
- Un diseño de idempotencia que solo use `UNIQUE(operation_id)` sin comparar payload puede devolver silenciosamente una venta para una intención distinta.
- Consumir la outbox al menos una vez exige también idempotencia frente al OSE; `venta_id`/documento debe ser clave estable externa.
- Cambiar cuándo se asigna el correlativo puede introducir huecos. La prioridad es unicidad y trazabilidad, no necesariamente ausencia absoluta de huecos después de rollbacks/rechazos.
- El esquema remoto comparte el proyecto con tablas ajenas al prefijo `ra_*`; toda migración debe estar estrictamente acotada.
- La deriva entre historial local y remoto aumenta el riesgo de despliegue y rollback.
- Los cambios locales del usuario en clientes, ticket y servicios no deben sobrescribirse.

## Preguntas abiertas para propuesta/diseño

1. ¿La clave de idempotencia debe sobrevivir al cierre o recarga de la tablet mediante almacenamiento local, o basta conservarla mientras exista el intento activo? Recomendación: persistir el intento pendiente hasta recuperar éxito o fallo definitivo.
2. ¿El límite de crédito debe bloquear la venta cuando se excede o solo advertir? El RPC existente hoy registra el cargo y devuelve `limite_excedido`; el flujo actual no usa ese resultado para bloquear.
3. ¿Los descuentos enviados por el POS tienen límites por rol o se aceptan mientras sean no negativos? Hoy no existe una política server-side de autorización de descuento.
4. ¿Qué proceso ejecutará los reintentos de outbox en producción (cron/worker/Edge Function) y qué credenciales operativas tendrá? La tabla y el contrato pueden diseñarse ahora, pero la ejecución durable requiere una decisión de operación.
5. ¿Cómo se reconciliará el historial remoto de migraciones con los archivos locales antes del despliegue? No debe aplicarse la nueva migración suponiendo que `001`-`037` están registrados remotamente.
6. ¿Los seis kardex de motivo `venta` sin venta referenciada corresponden a carga histórica, ventas eliminadas o referencias de otro sistema?

## Ready for Proposal

Sí para redactar una propuesta de alcance y criterios de éxito basada en el RPC transaccional único y outbox durable.

No está listo todavía para implementación. Antes del diseño final deben resolverse las reglas de crédito/descuento, la operación del worker y la estrategia de despliegue frente a la deriva de migraciones.
