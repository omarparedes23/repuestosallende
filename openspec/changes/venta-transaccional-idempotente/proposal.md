# Proposal: Venta transaccional e idempotente

## Intent

El POS confirma actualmente una venta mediante múltiples operaciones independientes: crea la cabecera, inserta ítems, pagos y caja, registra el crédito en otra RPC, actualiza stock e inserta kardex con service role y finalmente programa SUNAT/OSE mediante `after()`. No existe una única transacción PostgreSQL ni una clave estable que identifique el intento lógico.

Este flujo permite ventas parciales, actualizaciones de stock perdidas bajo concurrencia, duplicados después de reintentos y documentos fiscales pendientes sin garantía durable de procesamiento.

El cambio propone concentrar el núcleo comercial y financiero en una operación PostgreSQL atómica e idempotente y desacoplar SUNAT/OSE mediante una outbox durable. El POS enviará intención; la base autenticará, derivará y validará los valores autoritativos antes de confirmar todo o no confirmar nada.

## Goals

- Confirmar venta, ítems, pagos, caja, crédito, stock y kardex dentro de una sola transacción PostgreSQL.
- Garantizar que un intento lógico produzca como máximo una venta, incluso ante doble envío, reintento concurrente o pérdida de respuesta.
- Permitir recuperar el resultado de una operación ya confirmada mediante su clave de idempotencia.
- Validar en servidor/base identidad, empresa, sucursal, rol, caja, cliente, crédito, productos, precios, moneda, descuentos, pagos, totales y stock.
- Descontar stock de forma concurrente y segura, manteniendo stock y kardex en la misma transacción.
- Asignar serie y correlativo sin duplicados dentro de la frontera transaccional de la venta.
- Registrar una fila outbox durable por cada boleta/factura confirmada.
- Procesar y reintentar la outbox con trazabilidad, sin revertir una venta comercial por un fallo posterior del OSE.
- Retirar el uso de service role del camino normal de confirmación de ventas en Next.js.
- Cubrir con pruebas los caminos de éxito, rollback, concurrencia, idempotencia y recuperación de respuesta.

## Non-Goals

- Contabilidad general, asientos contables, libros o conciliación bancaria.
- Devoluciones, anulaciones, notas de crédito o reversos de stock/caja.
- Cotizaciones, pedidos, reservas de stock o inventario físico.
- Atomicidad de compras, cuentas por pagar o liquidación de caja; tendrán cambios SDD separados.
- Crear una nueva política comercial de descuentos o aprobación por roles. Este cambio validará de forma segura la regla vigente y dejará una política más granular para otro cambio.
- Cambiar la política comercial de límite de crédito. Se preservará el comportamiento vigente salvo decisión explícita antes del diseño: registrar el cargo y reportar si el límite queda excedido.
- Reparar automáticamente datos históricos, incluidos los seis kardex de motivo `venta` cuya referencia no coincide actualmente con una venta.
- Garantizar numeración fiscal sin huecos. Sí se garantiza ausencia de duplicados y trazabilidad.
- Reemplazar el proveedor OSE/SUNAT ni rediseñar el contenido fiscal completo del comprobante.
- Exponer datos personales durante auditoría o pruebas.

## Scope

### In Scope

- `operation_id` UUID generado por intento lógico de venta y conservado durante sus reintentos.
- Detección de reutilización de la misma clave con un payload materialmente diferente.
- Restricciones e índices de unicidad para cerrar carreras de idempotencia y correlativos.
- RPC autenticada y transaccional para confirmar el agregado completo de venta.
- Validación y cálculo monetario con tipos PostgreSQL `numeric`, compatible con PEN/USD y las reglas vigentes del POS.
- Bloqueo determinista o descuento condicional atómico de productos.
- Escritura atómica de:
  - `ra_ventas`;
  - `ra_venta_items`;
  - `ra_venta_pagos`;
  - `ra_movimientos_caja` para pagos no crediticios;
  - `ra_cuenta_corriente_movimientos` y saldo del cliente cuando corresponda;
  - `ra_productos.stock_actual`;
  - `ra_kardex`;
  - outbox fiscal para boleta/factura.
- Resultado estable de la RPC y consulta/recuperación por `operation_id`.
- Adaptación de `procesarVenta()` para actuar como borde de autenticación/payload y dejar de orquestar escrituras parciales.
- Persistencia temporal en el POS del intento pendiente para sobrevivir a pérdida de respuesta o recarga hasta conocer su resultado definitivo.
- Consumidor durable de outbox con estados, intentos, próximo reintento, error y resultado del OSE.
- Idempotencia del envío fiscal usando una identidad externa estable derivada de la venta/documento.
- Migración aditiva, tipos TypeScript y pruebas automatizadas.

### Out of Scope

- Operaciones distintas de la confirmación inicial de una venta.
- Migración o borrado de ventas históricas.
- Limpieza global de RLS, advisors o lint no relacionada con las tablas tocadas.
- Cambios en tablas ajenas al prefijo `ra_*` que comparten el proyecto Supabase.
- Escrituras en el SQL Server histórico de FastERP; continúa siendo estrictamente de solo lectura.

## Capabilities

### New Capabilities

- `venta-transaccional`: confirmación atómica de venta, detalle, pagos, caja, crédito, inventario y kardex.
- `venta-idempotente`: identidad estable del intento, reintentos seguros, detección de conflicto y recuperación del resultado.
- `stock-venta-concurrente`: descuento seguro bajo concurrencia y kardex coherente dentro de la misma transacción.
- `outbox-fiscal`: registro durable, procesamiento reintentable y trazabilidad de SUNAT/OSE.

### Modified Capabilities

- `venta-multimoneda`: sus precios, moneda, tipo de cambio y totales dejan de confiar en cálculos enviados por el cliente y se validan/recalculan en la base.
- `impresion-tickets`: el resultado recuperable de la venta debe conservar los campos necesarios para la pantalla de éxito e impresión, sin crear una segunda venta al reintentar.
- `cuenta-corriente`: el cargo de una venta a crédito pasa a formar parte de la misma transacción que la venta.

## Proposed Approach

Crear una migración aditiva que introduzca el contrato de idempotencia, la outbox fiscal, las restricciones faltantes y un RPC `SECURITY DEFINER` para confirmar la venta.

El RPC obtendrá el usuario mediante `auth.uid()` y resolverá perfil, empresa, sucursal y caja desde la base. Recibirá productos/cantidades/descuentos y pagos como intención, pero volverá a consultar precios, cliente, crédito y stock. Bloqueará los productos en un orden determinista, recalculará importes con `numeric` y escribirá todos los efectos dentro de la misma transacción.

La idempotencia combinará una clave única con una huella canónica del payload. Si la misma operación se repite con la misma intención, devolverá el resultado confirmado. Si la clave se reutiliza con una intención diferente, devolverá un conflicto sin modificar datos.

Boleta y factura crearán su trabajo outbox en la misma transacción. Un consumidor separado reclamará trabajos pendientes, llamará al OSE y registrará éxito, rechazo o reintento. El RPC de venta nunca llamará directamente al servicio externo.

La forma exacta del payload canónico, estados de outbox, política de backoff, mecanismo para reclamar trabajos y separación en funciones auxiliares se definirá en `design.md`.

## Security and Trust Boundary

- El RPC no aceptará `empresa_id` ni `usuario_id` como autoridad del cliente.
- Sucursal y caja deberán pertenecer al contexto autenticado y estar habilitadas para vender.
- El rol `lectura` no podrá confirmar ventas.
- Cliente y productos deberán pertenecer a la misma empresa; los productos, además, a la sucursal autorizada.
- Precio, moneda disponible, total, IGV, stock y saldo no se confiarán al navegador.
- El RPC usará `SECURITY DEFINER`, `SET search_path = public`, nombres calificados cuando sea necesario y permisos de ejecución mínimos.
- No se incorporará service role al navegador ni se mantendrá como mecanismo para descontar stock desde `procesarVenta()`.
- La outbox no expondrá credenciales del OSE; solo guardará datos de negocio, trazabilidad y respuesta permitida.

## Migration Requirements

- Reconciliar primero el estado real: el historial remoto de migraciones no corresponde a la secuencia local `001`-`037`.
- Crear una migración nueva, aditiva e idempotente, sin editar migraciones históricas.
- Incorporar idempotencia a ventas mediante columnas o tabla dedicada, con unicidad acotada correctamente por tenant y una huella del payload.
- Restaurar o crear en remoto la unicidad de `(empresa_id, serie, correlativo)` que figura localmente pero no apareció en el inventario remoto.
- Crear la tabla outbox y sus índices de reclamación/reintento.
- Crear o reemplazar únicamente las funciones `ra_*` necesarias, con permisos explícitos.
- Mantener RLS en las nuevas tablas; la escritura sensible se realizará a través de funciones controladas.
- No ejecutar la migración directamente en producción durante este cambio sin validación local/staging, plan de rollback y aprobación separada.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | Idempotencia, unicidad, outbox, RPC y permisos |
| `src/app/tablet/(kiosk)/pos/actions.ts` | Major | Reemplazar escrituras encadenadas/service role/`after()` por una RPC |
| `src/app/tablet/(kiosk)/pos/actions.schema.ts` | Modified | Añadir `operationId` y endurecer el contrato de entrada |
| `src/app/tablet/(kiosk)/pos/components/PaymentSheet.tsx` | Modified | Crear, conservar y reintentar la operación; presentar estados recuperables |
| `src/app/tablet/stores/posStore.ts` | Modified | Conservar el intento pendiente hasta resolución definitiva |
| `src/lib/facturacion/ose.ts` | Modified | Ser invocado por el consumidor de outbox y aceptar identidad fiscal estable |
| `src/lib/types/database.ts` | Modified | Tipos de columnas, outbox y RPC |
| consumidor/worker por definir | New | Reclamar y procesar trabajos fiscales con reintentos |
| pruebas de POS y base | New/Modified | Idempotencia, rollback, concurrencia, permisos y outbox |

## Dependencies and Preconditions

- Acceso de solo lectura al esquema real de Supabase, ya disponible mediante MCP.
- Reconciliación explícita entre migraciones locales y estado remoto antes del despliegue.
- Entorno local o staging capaz de ejecutar pruebas PostgreSQL concurrentes y de rollback.
- Contrato actual de moneda/tipo de cambio y cálculo de venta documentado en `facturacion-multimoneda`.
- Contrato actual de impresión y resultado de venta documentado en `impresion-tickets`.
- Configuración operativa del scheduler que invocará el consumidor de outbox: Vercel Cron inicialmente o cron/systemd si la aplicación migra a VPS.
- El límite de crédito excedido advierte y no bloquea, por decisión confirmada para preservar el comportamiento vigente.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Deadlock al vender varios productos concurrentemente | Med | Bloqueo de productos en orden determinista y pruebas concurrentes |
| Duplicado por dos solicitudes simultáneas con la misma clave | Med | Restricción única y manejo explícito de conflicto dentro de PostgreSQL |
| Misma clave reutilizada con otro carrito | Med | Huella canónica y error de conflicto sin efectos nuevos |
| Divergencia de importes entre TypeScript y PostgreSQL | Med | Definir una fórmula normativa, usar Decimal/numeric y pruebas de contrato con vectores compartidos |
| Correlativos duplicados por lock fuera de la inserción | High actual | Asignar correlativo dentro de la misma transacción y reforzar con índice único |
| Worker procesa dos veces un documento | Med | Reclamación atómica, leases/locks e identidad externa idempotente |
| Worker caído deja documentos pendientes | Med | Estados observables, `next_attempt_at`, contador de intentos y monitorización |
| Función `SECURITY DEFINER` permite escalada entre empresas | High | Derivar contexto de `auth.uid()`, validar pertenencia, fijar `search_path` y probar autorización negativa |
| Migración falla por deriva local/remota | High | Preflight de catálogo, staging, migración aditiva y rollback ensayado |
| Cambio rompe impresión o pantalla de éxito | Med | Mantener contrato de `VentaResult` y añadir pruebas de reintento/recuperación |

## Rollback Plan

El despliegue deberá ser compatible en dos etapas:

1. Desplegar primero las piezas aditivas de base sin retirar el flujo antiguo.
2. Desplegar código que use la nueva RPC.
3. Verificar métricas e invariantes.
4. Retirar el camino antiguo y `after()` solo cuando la nueva ruta esté estable.

Ante un fallo de aplicación, se podrá volver temporalmente al código anterior mientras la migración aditiva permanezca instalada y sin uso. La outbox y columnas de idempotencia no se eliminarán durante un rollback operativo porque podrían contener operaciones confirmadas o documentos pendientes.

Una reversión destructiva de esquema solo podrá ejecutarse después de demostrar que no existen trabajos pendientes, que los datos fueron preservados y que ninguna versión desplegada depende del nuevo contrato.

## Success Criteria

- [ ] Una venta exitosa confirma cabecera, ítems, pagos, movimientos de caja, crédito, stock, kardex y outbox aplicable en una sola transacción.
- [ ] Forzar un fallo en cualquiera de esos pasos deja todas las tablas en su estado anterior.
- [ ] Repetir secuencialmente el mismo `operation_id` y payload devuelve la misma venta sin nuevos efectos.
- [ ] Enviar concurrentemente el mismo `operation_id` produce una sola venta y un único conjunto de efectos.
- [ ] Reutilizar un `operation_id` con payload diferente devuelve conflicto y no modifica datos.
- [ ] Perder la respuesta después del commit permite recuperar la venta por `operation_id` sin cobrar de nuevo.
- [ ] Dos ventas concurrentes sobre el mismo producto nunca pierden descuentos de stock ni dejan stock negativo.
- [ ] Stock insuficiente en cualquier ítem revierte toda la venta.
- [ ] Cada descuento de stock por venta tiene exactamente un kardex con stock anterior/nuevo coherentes.
- [ ] Cada pago no crediticio tiene su movimiento de caja; el crédito no genera ingreso de caja.
- [ ] Toda venta a crédito confirmada tiene exactamente un cargo por el importe crediticio y saldo actualizado en la misma transacción.
- [ ] Precio, moneda, totales, empresa, usuario, sucursal y caja son rechazados o corregidos si la intención del cliente contradice la fuente server-side.
- [ ] Serie/correlativo permanece único bajo solicitudes concurrentes.
- [ ] Cada boleta/factura confirmada crea exactamente un trabajo outbox; un ticket no crea trabajo fiscal.
- [ ] Un fallo temporal del OSE conserva el trabajo y programa un reintento; un rechazo definitivo queda trazable.
- [ ] Dos consumidores concurrentes no emiten dos veces el mismo documento lógico.
- [ ] El rol `lectura`, una sucursal ajena, un producto ajeno y un cliente ajeno no pueden confirmar la venta.
- [ ] Las ventas PEN/USD y la impresión posterior conservan el comportamiento funcional aprobado.
- [ ] Las pruebas automatizadas incluyen éxito, fallo inducido, concurrencia, idempotencia, autorización y ciclo de outbox.

## Open Decisions Before Design Completion

1. Configurar el scheduler de producción y su modelo de credenciales/monitorización; el endpoint permanece portable entre Vercel Cron y cron/systemd en VPS.
2. Definir la reconciliación del historial remoto antes de aplicar la migración local confirmada `038_venta_transaccional_idempotente.sql`.
3. Clasificar los seis kardex de venta sin referencia existente antes de cualquier reparación; la reparación queda fuera de este cambio.
