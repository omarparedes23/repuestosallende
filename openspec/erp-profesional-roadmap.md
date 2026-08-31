# Evaluación y hoja de ruta hacia un ERP profesional

**Proyecto:** Repuestos Allende  
**Fecha de evaluación:** 2026-08-15  
**Estado:** Diagnóstico inicial; no constituye todavía una especificación aprobada para implementación  
**Fuente:** Análisis del repositorio local, sus 37 migraciones, módulos, Server Actions, pruebas y documentos OpenSpec

## Resumen ejecutivo

El proyecto es actualmente un sistema comercial vertical con una base sólida: catálogo, POS para tablet, ventas, inventario por sucursal, compras, tesorería operativa, cuentas corrientes, emisión electrónica mediante OSE/SUNAT e impresión de comprobantes.

Todavía no debe considerarse un ERP profesional completo. Las brechas principales se encuentran en la atomicidad de operaciones críticas, concurrencia de inventario, idempotencia, resiliencia de SUNAT, devoluciones y notas de crédito, auditoría, permisos granulares, contabilidad y operación técnica.

La prioridad no debería ser añadir más pantallas, sino proteger primero la integridad del dinero, el stock, la caja y los documentos fiscales.

## Alcance y limitaciones del análisis

La evaluación se basa en el estado local del repositorio. En esta sesión no está disponible un servidor MCP de Supabase ni herramientas `supabase_*` para inspeccionar directamente el proyecto desplegado.

Antes de implementar cambios estructurales se recomienda conectar el MCP de Supabase en modo inicialmente de solo lectura y verificar:

- Esquema real desplegado.
- Migraciones aplicadas.
- Funciones, triggers e índices.
- Políticas RLS efectivas.
- Advisors de seguridad y rendimiento.
- Logs, jobs, cron y Edge Functions.
- Volumen, integridad y consistencia de los datos.

La base real podría diferir de las migraciones locales.

## Capacidades existentes

### Ventas y POS

- Autenticación y selección de sucursal.
- Apertura y cierre de caja.
- Carrito administrado con Zustand.
- Ventas mayoristas y minoristas.
- Monedas PEN y USD.
- Registro de tipo de cambio.
- Ticket, boleta y factura.
- Pagos divididos en efectivo, Yape, tarjeta, transferencia y crédito.
- Gestión de clientes y líneas de crédito.
- Movimientos de caja.
- Kardex de inventario.
- Emisión electrónica por OSE/SUNAT.
- Estados de emisión.
- Serie y correlativo.
- Impresión y reimpresión.
- QR SUNAT.
- Historial y detalle de ventas.

### Inventario y logística

- Stock por producto y sucursal.
- Kardex de entradas, salidas y ajustes.
- Stock mínimo y conteo de stock bajo.
- Entradas por compras.
- Salidas por ventas.
- Transferencias entre sucursales mediante guías.
- Sincronización externa con el ERP anterior.

### Compras

- Proveedores.
- Órdenes de compra.
- Confirmación y anulación.
- Recepciones parciales.
- Compras directas o relacionadas con una orden.
- Costeo promedio.
- Entrada de stock y kardex.
- Compras en PEN y USD.
- Cuentas por pagar.
- Pagos a proveedores.

### Tesorería

- Cuentas por cobrar.
- Cuentas por pagar.
- Cargos y abonos.
- Cobros a clientes.
- Pagos a proveedores.
- Liquidación de caja.
- Diferencias entre sistema y conteo.
- Métodos de pago diferenciados.

### Seguridad básica

- Supabase Auth.
- Separación por empresa.
- RLS en una parte importante del esquema.
- Roles `administrador`, `vendedor` y `superadmin`.
- Sucursales asociadas a perfiles.
- Uso server-side de service role para operaciones especiales.

## Brechas críticas de integridad

### 1. Las ventas no son atómicas

Una venta se procesa mediante operaciones independientes:

1. Creación de la cabecera.
2. Inserción de detalles.
3. Inserción de pagos.
4. Registro del movimiento de caja.
5. Registro en cuenta corriente.
6. Actualización de stock.
7. Inserción del kardex.
8. Emisión electrónica.

No existe una única transacción PostgreSQL que confirme o revierta todo el bloque.

Esto puede producir:

- Venta sin ítems.
- Venta con ítems pero sin pagos.
- Venta cobrada sin salida de inventario.
- Stock actualizado sin kardex.
- Venta a crédito sin cuenta por cobrar.
- Venta duplicada por reintento.
- Operación parcialmente procesada interpretada como fallida por el cajero.

**Recomendación:** concentrar el núcleo de la venta en un RPC transaccional que valide, bloquee inventario, registre venta, detalles, pagos, caja, cuenta corriente y kardex en una sola transacción.

**Prioridad:** crítica.

### 2. Riesgo de concurrencia en stock

El flujo actual lee `stock_actual`, calcula el nuevo stock en Next.js y posteriormente ejecuta un `UPDATE`. Dos cajas concurrentes pueden leer el mismo valor y sobrescribir sus resultados.

**Recomendación:** usar dentro de la transacción alguna de estas estrategias:

- `SELECT ... FOR UPDATE`.
- `UPDATE ... SET stock_actual = stock_actual - cantidad WHERE stock_actual >= cantidad RETURNING ...`.

La actualización y el kardex deben ser parte de la misma transacción.

**Prioridad:** crítica.

### 3. Falta de idempotencia

No se encontró una clave propia que identifique de manera única el intento de cobro. Un doble clic, recarga, pérdida de conexión o reintento puede crear operaciones duplicadas.

**Recomendación:** incorporar:

- `operation_id` o `idempotency_key` único.
- Protección visual frente a doble envío.
- Reintentos seguros.
- Consulta del resultado de una operación ya confirmada.
- Separación entre respuesta perdida y transacción fallida.
- Idempotencia también en la emisión electrónica.

**Prioridad:** crítica.

### 4. Emisión SUNAT sin cola durable

La emisión se ejecuta en segundo plano mediante `after()`. Si el proceso termina o existe un error temporal, la venta puede quedar pendiente sin una garantía durable de reintento.

**Recomendación:** implementar una tabla outbox o cola de documentos electrónicos con:

- Estado del envío.
- Número de intentos.
- Próximo reintento.
- Request normalizado.
- Respuesta del OSE.
- Código y mensaje SUNAT.
- XML, CDR y PDF.
- Hash.
- Tiempos de respuesta.
- Reenvío manual autorizado.
- Reconciliación periódica.

**Prioridad:** crítica.

### 5. Devoluciones y anulaciones fiscales incompletas

El dominio conoce ventas anuladas y el kardex contempla el motivo `devolucion`, pero no existe un flujo completo para:

- Devolución total o parcial.
- Nota de crédito electrónica.
- Motivo SUNAT.
- Reingreso de productos vendibles.
- Separación entre devolución, cambio y garantía.
- Reembolso por método de pago.
- Reversión de cuenta corriente.
- Reversión o ajuste de caja.
- Relación entre documento original y nota de crédito.
- Notas de débito.

Una venta ya emitida no debe anularse únicamente cambiando un estado interno.

**Prioridad:** crítica antes de intensificar el uso fiscal.

### 6. Compra y cuenta por pagar no son una sola transacción

El RPC de compras concentra stock, kardex y costeo, pero el cargo de cuentas por pagar se registra mediante una llamada posterior. Si falla, la compra y el inventario quedan confirmados sin la deuda correspondiente.

**Recomendación:** integrar el cargo dentro del RPC o introducir una outbox financiera reparable y monitorizada.

**Prioridad:** alta.

### 7. Liquidación y cierre de caja no son atómicos

La liquidación se inserta y luego se actualiza la caja. Si falla el segundo paso, existe una liquidación asociada a una caja todavía abierta.

Además, los totales del sistema son recibidos por el servidor; deberían recalcularse en el servidor en el momento exacto del cierre.

El cierre profesional debe distinguir:

- Saldo inicial.
- Ventas por método.
- Ingresos manuales.
- Egresos.
- Cobros de créditos anteriores.
- Reembolsos.
- Depósitos o retiros.
- Efectivo esperado.
- Efectivo contado.
- Diferencia.
- Autorización de diferencias superiores a un umbral.

**Prioridad:** alta.

## Brechas funcionales

### Inventario y logística

- Conteos físicos e inventarios cíclicos.
- Documento formal de ajuste.
- Motivos y autorización de ajustes.
- Stock comprometido, disponible y en tránsito.
- Reservas de stock.
- Lotes y números de serie cuando sean necesarios.
- Ubicaciones internas de almacén.
- Productos sustitutos y equivalentes.
- Kits y combos.
- Unidades de medida y conversiones.
- Mercancía dañada.
- Garantías.
- Devoluciones a proveedor.
- Reposición sugerida.
- Clasificación y rotación ABC.
- Stock inmovilizado.
- Valorización del inventario a una fecha.
- Conciliación automática entre existencias y kardex.

### Ventas comerciales

- Cotizaciones.
- Pedidos de venta.
- Reservas de inventario.
- Conversión cotización → pedido → venta.
- Listas de precios.
- Precios específicos por cliente.
- Promociones.
- Descuentos autorizados por rol.
- Comisiones de vendedores.
- Metas comerciales.
- Entregas parciales.
- Ventas anticipadas y separaciones.
- Historial de cambios de precios.
- Margen bruto por venta y producto.
- Aprobación de ventas bajo costo.

### Compras

- Solicitudes internas de compra.
- Flujo de aprobación.
- Comparativo de cotizaciones.
- Impuestos, descuentos, flete y costos adicionales.
- Fechas prometidas.
- Recepción contra guía y factura.
- Tolerancias de recepción.
- Devoluciones a proveedor.
- Notas de crédito de proveedor.
- Conciliación orden → recepción → factura.
- Indicadores de cumplimiento de proveedores.

### Tesorería

- Cuentas bancarias.
- Caja chica.
- Transferencias entre cajas y bancos.
- Conciliación bancaria.
- Depósitos de efectivo.
- Liquidación de tarjetas y comisiones.
- Cheques.
- Calendario de vencimientos.
- Flujo de caja proyectado.
- Aging de cuentas por cobrar y pagar.
- Anticipos de clientes y proveedores.
- Diferencias de cambio realizadas.
- Aprobaciones financieras.
- Historial de arqueos y reapertura controlada.

### Contabilidad

Esta es la diferencia principal entre el sistema actual y un ERP financiero integral. Falta:

- Plan contable.
- Asientos contables.
- Libro diario.
- Libro mayor.
- Centros de costo.
- Períodos contables.
- Cierre mensual.
- Balance de comprobación.
- Estado de resultados.
- Balance general.
- Asientos automáticos por venta, compra, cobro, pago y ajuste.
- Tratamiento contable de IGV.
- Diferencias de cambio.
- Exportación para contabilidad y SUNAT.

Sin un núcleo contable, la solución debe describirse como POS, inventario y gestión comercial, no como ERP financiero completo.

### Fiscal Perú

Además de la emisión básica, se debe validar con el contador y el proveedor OSE la necesidad de:

- Notas de crédito y débito.
- Comunicación de baja.
- Resúmenes diarios de boletas cuando correspondan.
- Consulta y reconciliación de estados.
- Persistencia del CDR.
- Gestión de contingencia.
- Detracciones.
- Retenciones.
- Percepciones.
- Guías de remisión electrónicas.
- Reglas entre documento del cliente y factura/boleta.
- Exportaciones para SIRE.
- Conservación documental y trazabilidad.

## Seguridad, permisos y auditoría

### Roles insuficientes

Los roles actuales son demasiado amplios para una separación profesional de funciones. Se recomienda contemplar:

- Cajero.
- Vendedor.
- Almacenero.
- Comprador.
- Tesorería.
- Contabilidad.
- Supervisor.
- Administrador.
- Auditor.

Los permisos deberían definirse por capacidad, por ejemplo:

- Ver costos.
- Cambiar precios.
- Aplicar descuentos.
- Vender sin stock.
- Anular documentos.
- Reimprimir.
- Cerrar cajas ajenas.
- Ajustar inventario.
- Aprobar compras.
- Registrar pagos.
- Consultar información financiera.

### Auditoría transversal

Aunque el kardex es append-only, falta una bitácora general que registre:

- Usuario.
- Fecha y hora.
- Acción.
- Entidad afectada.
- Valor anterior.
- Valor nuevo.
- Motivo.
- IP o dispositivo cuando corresponda.
- Operación relacionada.

### Uso de service role

La service role omite RLS y debe utilizarse con controles estrictos:

- Encapsulación en operaciones de propósito limitado.
- Validación explícita de empresa y sucursal.
- Auditoría.
- Prohibición de actualizaciones genéricas construidas desde datos del cliente.
- Gestión y rotación segura del secreto.

## Calidad y operación técnica

Estado observado:

- 33 pruebas pasan.
- Existen 8 archivos de pruebas para 147 archivos TypeScript/TSX.
- ESLint reporta 138 errores y 18 advertencias.
- Hay uso extendido de `any` pese a TypeScript estricto.
- Faltan pruebas de integración de las operaciones críticas.

Capacidades pendientes:

- Pruebas de integración con Supabase local.
- Pruebas de concurrencia de stock y correlativos.
- Pruebas end-to-end del POS.
- Pruebas de reintento e idempotencia.
- Pruebas del ciclo SUNAT.
- CI obligatoria.
- Backups y restauraciones ensayadas.
- Monitorización y alertas.
- Error tracking.
- Métricas operativas.
- Runbooks.
- Ambientes separados de desarrollo, staging y producción.
- Gestión y rotación de secretos.
- Política formal de migraciones y rollback.

## Evaluación de madurez

| Área | Madurez estimada |
|---|---|
| POS y venta presencial | Media-alta |
| Catálogo | Media-alta |
| Compras | Media |
| Inventario | Media |
| Tesorería operativa | Media |
| Facturación electrónica | Media |
| Seguridad y permisos | Baja-media |
| Auditoría | Baja |
| Resiliencia operacional | Baja |
| Contabilidad | Inicial o inexistente |
| Reporting gerencial | Bajo |
| Calidad automatizada | Baja-media |

## Hoja de ruta recomendada

### Fase 0: verificación de la plataforma real

1. Conectar el MCP de Supabase en modo inicialmente de solo lectura.
2. Comparar migraciones locales y remotas.
3. Inventariar tablas, funciones, triggers, políticas e índices reales.
4. Ejecutar advisors de seguridad y rendimiento.
5. Medir inconsistencias actuales de ventas, pagos, caja, stock, kardex y cuentas corrientes.
6. Definir staging y estrategia de recuperación.

### Fase 1: integridad operacional

1. Venta transaccional completa.
2. Descuento concurrente y seguro de stock.
3. Idempotencia de venta.
4. Outbox y reintentos SUNAT.
5. Compra y cuenta por pagar atómicas.
6. Liquidación de caja atómica.
7. Procesos de conciliación y reparación.

### Fase 2: reversos y control

1. Devoluciones totales y parciales.
2. Notas de crédito.
3. Anulación fiscal correcta.
4. Ajustes de inventario autorizados.
5. Auditoría transversal.
6. Matriz granular de roles y permisos.
7. Aprobación de descuentos y operaciones sensibles.

### Fase 3: operación comercial

1. Cotizaciones y pedidos.
2. Reservas de stock.
3. Listas de precios.
4. Márgenes y rentabilidad.
5. Inventarios físicos.
6. Reposición y rotación.
7. Gestión bancaria y conciliación.

### Fase 4: ERP financiero

1. Plan contable.
2. Motor de asientos.
3. Períodos y cierres.
4. Libros y estados financieros.
5. Integración fiscal y contable.
6. Reportes de dirección.

## Primer cambio SDD recomendado

El primer cambio debería denominarse:

`venta-transaccional-idempotente`

Objetivo preliminar:

> Garantizar que una venta se confirme exactamente una vez y que venta, detalles, pagos, caja, crédito, stock y kardex queden íntegros como una sola operación transaccional, dejando la emisión SUNAT registrada en una outbox durable.

Este cambio debe comenzar con una exploración OpenSpec específica. No se deben reutilizar sin verificación las conclusiones de este documento como diseño definitivo.

### Alcance preliminar

- Clave de idempotencia por intento de venta.
- RPC transaccional para el núcleo comercial y financiero.
- Bloqueo o actualización atómica de stock.
- Validación server-side de cliente, crédito, precios, moneda y caja.
- Venta, ítems, pagos, caja, cuenta corriente y kardex en una transacción.
- Outbox durable para SUNAT.
- Resultado recuperable ante pérdida de respuesta.
- Pruebas de concurrencia, rollback e idempotencia.

### Fuera de alcance preliminar

- Contabilidad completa.
- Cotizaciones.
- Inventario físico.
- Notas de crédito, salvo los contratos necesarios para no bloquear su incorporación posterior.

## Backlog futuro: integración GRE con OSE/SUNAT

**Estado:** pendiente; no forma parte de las guías internas de traslado ni
autoriza emisión fiscal desde la aplicación actual.

### Objetivo

Emitir una Guía de Remisión Electrónica (GRE) Remitente antes del traslado
físico de bienes, vinculada cuando corresponda a una guía interna de inventario
o a una factura de venta, mediante el servicio OSE existente.

### Alcance esperado

- Datos fiscales por sucursal: ubigeo, dirección y código de establecimiento
  de partida/llegada.
- Configuración de transporte privado (vehículos y conductores) y público
  (transportistas formales).
- Captura de motivo de traslado, inicio, peso, bultos, destinatario e ítems.
- Numeración GRE fiscal separada de la numeración interna de guías.
- Outbox idempotente específica para GRE, estados, XML, ZIP, CDR, hash, QR y
  manejo de rechazos o resultados inciertos.
- Integración con el contrato OSE `POST /api/v1/guias`, tras verificar la
  versión desplegada y las credenciales GRE por tenant.
- Pruebas OSE/SUNAT beta y aprobación explícita antes de habilitar producción.

### Decisiones pendientes

1. Política operativa para transporte privado frente a taxi/terceros.
2. Momento de reserva de stock y emisión GRE: la GRE debe emitirse antes de
   iniciar el traslado, mientras que la recepción interna confirma el ingreso.
3. Regla para ventas: relación factura ↔ GRE y supuestos tributarios en los
   que la factura pueda sustentar el traslado.
4. Validación final con contador y OSE sobre obligatoriedad del RUC, datos y
   reglas vigentes antes de activar la emisión.

## Criterio de éxito global

La evolución debe permitir demostrar que:

- Ninguna venta confirmada queda parcialmente registrada.
- Un reintento no genera una segunda venta.
- Dos cajas no pueden perder actualizaciones de stock.
- Todo movimiento de stock posee kardex consistente.
- Todo crédito posee cuenta por cobrar.
- Toda compra a crédito posee cuenta por pagar.
- Todo documento fiscal pendiente puede reintentarse y auditarse.
- Toda operación sensible identifica quién la ejecutó y por qué.
- Los cierres de caja se calculan y confirman en el servidor.
- Las pruebas automatizadas cubren los caminos críticos y sus fallos.
