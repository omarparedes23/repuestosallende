# Exploración: reversos comerciales y fiscales

## Contexto y objetivo

La venta ya se confirma mediante `ra_confirmar_venta` como una única operación
transaccional e idempotente: venta, ítems, pagos, caja, crédito, stock, kardex y
outbox fiscal. El siguiente límite del núcleo operativo es cerrar su ciclo de
vida sin deshacer ni editar sus libros históricos.

Esta exploración cubre la capacidad de:

- devolución total o parcial de una venta;
- nota de crédito electrónica vinculada al comprobante original;
- anulación fiscal correcta cuando sea legal y técnicamente aplicable;
- cambio de producto como operación comercial explícita;
- garantía como caso distinto de devolución, con trazabilidad de la pieza.

No autoriza implementación, migraciones ni cambios en Supabase. El resultado
esperado es fijar el alcance del posterior `proposal.md` y evitar que una UI
resuelva un reverso con actualizaciones parciales.

## Estado actual comprobado

### Núcleo de venta

La sesión autenticada de tablet llama solamente a
`src/app/tablet/(kiosk)/pos/actions.ts:procesarVenta`, que invoca la RPC
`ra_confirmar_venta`. El cliente envía una intención acotada; la función remota
deriva y valida el contexto de empresa, sucursal, rol, precios, stock, caja y
totales.

El ledger remoto contiene las migraciones 038 a 054. La función vigente
`ra_confirmar_venta(p_operation_id, p_sucursal_id, p_tipo_comprobante,
p_cliente_id, p_items, p_pagos, p_moneda, p_tipo_cambio,
p_fecha_vencimiento)` existe como `SECURITY DEFINER` y la venta posee
`operation_id` y `request_hash` para replay/conflicto idempotente.

Una venta conserva su cabecera, ítems históricos, pagos y contexto monetario:

| Libro actual | Capacidades relevantes | Límite para un reverso |
| --- | --- | --- |
| `ra_ventas` | venta, usuario, caja, cliente, sucursal, comprobante, moneda, tipo de cambio, estado fiscal y operación idempotente | `estado` incluye `anulada`, pero no identifica causa, fecha, autor, alcance parcial ni operación compensatoria. |
| `ra_venta_items` | cantidad, precio, descuento y nombre/OEM históricos | no mantiene cantidad ya devuelta ni vínculo a una devolución. |
| `ra_venta_pagos` | pagos divididos por método | no identifica qué monto fue reembolsado, aplicado a cambio o dejado como saldo a favor. |
| `ra_movimientos_caja` | ingresos/egresos positivos y operación idempotente para venta/cobro/pago/manual/ajuste | no existe un origen tipado de devolución; un egreso no debe insertarse sin vínculo, autorización y caja correctos. |
| `ra_cuenta_corriente_movimientos` | cargos y abonos positivos, con venta, cliente y datos de cobro | la forma actual distingue cargo de venta y abono de cobro; no puede expresar con claridad una nota de crédito/saldo a favor sin ampliar el modelo. |
| `ra_kardex` | libro append-only, entrada/salida, stock anterior/nuevo, sucursal y referencia polimórfica | el motivo `devolucion` existe, pero no hay entidad que explique la devolución ni regla que impida devolver más que lo vendido. |

### Fiscal

Para boleta o factura, la venta crea una única fila durable en
`ra_sunat_outbox`, con identidad única por venta y por documento. El worker
actual llama `POST /api/v1/comprobantes` mediante `emitirComprobante()` y usa
la clave idempotente del documento. También existe consulta por número del
comprobante original.

El contrato actual de outbox solamente representa comprobantes de venta:
`tipo_comprobante` admite `ticket`, `boleta` y `factura`; no hay tabla,
tipo ni función de nota de crédito. Las funciones vigentes de venta y outbox
no contienen una transición de anulación o devolución.

La ruta interna del worker funciona, pero el scheduler automático sigue sin
estar activado. Un proceso de reversos fiscales no debe asumir que un documento
`pending`, `submitted` o `accepted` puede tratarse igual: la acción válida
depende del estado confirmado por OSE/SUNAT y de las reglas fiscales vigentes.

### Ausencias verificadas en Supabase

La auditoría read-only remota no encontró tablas `ra_*` de devolución, nota de
crédito ni garantía. Los enums existentes sí contienen:

- `ra_estado_venta`: `pendiente`, `completada`, `anulada`, `error_sunat`.
- `ra_motivo_kardex`: `venta`, `compra`, `ajuste_manual`, `devolucion`,
  `merma`, `traslado`.
- `ra_cc_tipo_movimiento`: `cargo`, `abono`.

Las restricciones actuales exigen montos estrictamente positivos en caja y
cuenta corriente. Esto es correcto para libros append-only: un reverso debe
agregar un movimiento compensatorio de tipo adecuado, nunca introducir montos
negativos ni modificar los movimientos de la venta original.

## Diagnóstico

Hay una buena base para soportar reversos seguros, pero todavía no existe el
agregado de negocio que sea fuente de verdad para ellos. Actualizar
`ra_ventas.estado = 'anulada'`, incrementar stock y crear un egreso de caja
desde una Server Action sería insuficiente: podría dejar montos, inventario,
CxC y fiscalidad en estados incompatibles ante un fallo o reintento.

La capacidad debe modelar el reverso como una operación nueva, idempotente y
auditada, vinculada a la venta y a sus líneas originales. La venta original y
sus libros derivados permanecen inmutables; el estado agregado debe derivarse
de las operaciones posteriores trazables.

## Distinción obligatoria de casos

| Caso | Efecto comercial | Efecto de stock | Efecto financiero | Efecto fiscal esperado |
| --- | --- | --- | --- |
| Devolución | cliente devuelve total o parte de líneas vendidas | entrada solo de unidades realmente recibidas y aptas | reembolso, reducción de deuda o saldo a favor, según decisión autorizada | nota de crédito si el comprobante fue emitido/aceptado y corresponde legalmente |
| Anulación | deja sin efecto una operación aún anulable | compensación solo si la mercancía vuelve o nunca salió; no se debe inventar una entrada | reverso controlado de pagos/deuda | proceso permitido por OSE/SUNAT; no es un simple cambio de estado local |
| Cambio | devolución de la pieza entregada más una nueva salida/venta | entrada de pieza recibida y salida de reemplazo, bloqueadas en orden determinista | liquidación de diferencia, reembolso o saldo a favor | documento de reverso y nuevo comprobante cuando aplique |
| Garantía | evaluación de una falla dentro de condiciones de garantía | la pieza puede quedar en cuarentena/no vendible; no asume reingreso disponible | no equivale automáticamente a devolución ni reembolso | depende del desenlace: reemplazo, reparación, devolución o rechazo |

En particular, garantía no debe reutilizar `devolucion` como sinónimo. Requiere
motivo, evidencia, dictamen y destino de la pieza; el modelo actual solo tiene
stock disponible por producto/sucursal y no un estado de cuarentena.

## Invariantes que deberá imponer el diseño

1. Cada reverso posee `operation_id` y huella canónica del payload; un replay
   idéntico devuelve el mismo resultado y un payload distinto falla sin efecto.
2. Una línea no puede devolverse por una cantidad acumulada superior a la
   vendida, incluidas devoluciones concurrentes o históricas.
3. La devolución parcial conserva las líneas y cantidades originales; no las
   borra ni modifica.
4. Stock, kardex, caja, CxC y la entidad de reverso se escriben o revierten
   juntos dentro de una única transacción PostgreSQL.
5. El stock se bloquea en orden estable por producto/sucursal. Si la devolución
   y un cambio incluyen más de un artículo, todos los bloqueos siguen el mismo
   orden que venta, compra y traslado.
6. Ninguna devolución crea stock disponible si la unidad no fue físicamente
   recibida o quedó en cuarentena por garantía/defecto.
7. Un reembolso no puede exceder la parte efectivamente cobrada ni ignorar
   cobros posteriores; una reducción de deuda no puede exceder el saldo
   atribuible a la venta.
8. Toda acción sensible deriva empresa, sucursal, usuario y rol de la sesión;
   no acepta esas identidades como autoridad del cliente.
9. La operación comercial no espera una llamada externa a OSE/SUNAT. Cuando
   corresponda, encola un trabajo fiscal durable, con identidad propia y
   vínculo inmutable al documento original.
10. Un estado fiscal incierto nunca permite reenviar ni marcar anulada la venta
    por suposiciones; exige conciliación explícita.
11. Toda aprobación, rechazo, recepción física, reembolso y decisión fiscal
    queda atribuida a usuario, fecha, motivo y evidencia mínima.

## Alternativas de alcance

### A. Un único cambio para devolución, cambio, garantía y fiscalidad

Ventaja: un vocabulario común desde el inicio.

Riesgo: mezcla reglas de logística, atención al cliente, tesorería y OSE antes
de cerrar los contratos fiscales y los estados de cuarentena. Es demasiado
grande para una primera implementación segura.

### B. Primero devolución comercial idempotente; fiscalidad posterior

Ventaja: permite restituir stock y dinero temprano.

Riesgo: si se aplica a boletas/facturas ya aceptadas puede producir una
realidad comercial sin el documento fiscal correspondiente. No es aceptable
como regla general.

### C. Núcleo de reverso comercial con gate fiscal por estado y tipo de documento

La primera capacidad crea una entidad de reverso, valida cantidades, recibe el
producto y calcula su liquidación de dinero/deuda. Para `ticket` puede concluir
el flujo comercial bajo reglas internas. Para boleta/factura, solo permite
finalizar el componente comercial cuando existe una decisión fiscal compatible:
nota de crédito durable, anulación autorizada o bloqueo explícito a espera de
conciliación.

Ventaja: preserva una frontera transaccional única sin simular que la llamada
externa es atómica. Permite que una futura outbox fiscal use el mismo patrón
durable de la venta.

Evaluación: enfoque recomendado, pero el contrato OSE/SUNAT debe comprobarse
antes de `design.md`.

## Corte recomendado para la primera propuesta

Proponer la capacidad **devolución comercial y fiscal trazable** como primer
cambio. Incluye devolución total/parcial de líneas de una venta, recepción
física, restitución condicionada de stock, liquidación controlada contra caja o
CxC, idempotencia, auditoría y una outbox fiscal de nota de crédito cuando sea
aplicable.

Dejar explícitamente para cambios posteriores:

- flujo completo de cambio, que compone devolución más una nueva venta;
- expediente de garantía, cuarentena, reparación y devolución a proveedor;
- anulación fiscal por resúmenes/bajas u otro procedimiento específico del OSE;
- devolución a proveedor;
- contabilidad automática de los reversos.

El diseño podrá reutilizar el núcleo de devolución para esos casos, pero no
debe forzarlos en una interfaz o enum genérico prematuro.

## Áreas afectadas previstas

- Nuevo cambio en `supabase/migrations/` con tablas, restricciones, índices,
  RPC, grants y RLS estrictamente `ra_*`.
- `ra_ventas`, `ra_venta_items`, `ra_kardex`, `ra_movimientos_caja`,
  `ra_cuenta_corriente_movimientos` y `ra_sunat_outbox`, preferentemente por
  relaciones aditivas y no reescritura histórica.
- `src/lib/types/database.ts` para contratos del nuevo agregado y RPC.
- Acciones server-side y vistas administrativas de detalle de venta; la tablet
  no debe contener la lógica de negocio.
- `src/lib/facturacion/ose.ts` y `src/lib/facturacion/outbox.ts` para el
  contrato específico de nota de crédito y su conciliación.
- Pruebas SQL de rollback, concurrencia de cantidades, idempotencia,
  multitenancy, caja/CxC y estados fiscales; pruebas TypeScript de schema y
  mapeo de errores.

## Riesgos

- La venta original puede tener pagos mixtos, cobros posteriores o crédito;
  devolver el total nominal sin una política de asignación puede duplicar dinero.
- `referencia_id` de kardex es polimórfica; una nueva referencia debe mostrar
  "Documento no disponible" cuando no exista documento histórico, no inferirlo.
- La reversión de un comprobante aceptado no debe usar la misma outbox ni la
  misma identidad idempotente de la venta.
- Un `SECURITY DEFINER` nuevo requiere `search_path` fijo, objetos calificados,
  grants mínimos y pruebas entre empresas/roles.
- El proyecto remoto contiene otros productos con tablas no `ra_*`; toda
  migración y auditoría debe permanecer acotada a Repuestos Allende.
- Las reglas fiscales peruanas y el contrato real de OSE pueden variar; deben
  verificarse con contador y proveedor antes de permitir acciones productivas.

## Preguntas abiertas para propuesta y diseño

1. ¿Qué roles pueden solicitar, aprobar, recibir físicamente y liquidar una
   devolución? ¿Se exige aprobación distinta al vendedor?
2. ¿Cuál es la política comercial por método de pago: reembolso al medio
   original, efectivo, saldo a favor o reducción de deuda?
3. ¿La devolución se recibe en la sucursal que vendió, en cualquier sucursal o
   ambas? Si difieren, ¿cómo se atribuye caja, stock y documento?
4. ¿Qué condición debe cumplir una pieza para volver a stock disponible y qué
   destino tiene una pieza defectuosa de garantía?
5. ¿Qué plazos, motivos y evidencias son obligatorios para devolución, cambio y
   garantía?
6. Para cada estado del comprobante (`pending`, `submitted`, `accepted`,
   `rejected`, `dead_letter`), ¿qué acción fiscal autoriza el OSE y SUNAT?
7. ¿El OSE expone creación, consulta e idempotencia de notas de crédito, y cuál
   es su relación obligatoria con serie/correlativo y documento de referencia?
8. ¿Qué casos se consideran anulación fiscal y cuáles requieren nota de
   crédito? Esta decisión debe ser contable/fiscal, no de la interfaz.
9. ¿Se requiere emitir un nuevo ticket/comprobante por un cambio en la misma
   interacción o se liquidan devolución y venta como operaciones separadas?

## Decisiones aprobadas por el propietario (2026-09-01)

1. El reembolso respeta el medio de pago original: efectivo se devuelve desde
   una caja abierta; Yape, tarjeta y transferencia exigen devolución al mismo
   medio con referencia; crédito reduce deuda y no genera efectivo.
2. Si hubo pago mixto, la devolución se liquida proporcionalmente por cada
   medio. Una excepción como saldo a favor requiere aprobación administrativa.
3. La primera versión recibe devoluciones únicamente en la sucursal emisora de
   la venta. La recepción entre sucursales queda fuera de alcance y requerirá
   un flujo explícito de traslado/compensación.
4. El vendedor puede registrar una solicitud; solo `administrador` o
   `superadmin` puede aprobar, recibir, liquidar y emitir el efecto fiscal.
5. Una boleta o factura aceptada se corrige mediante nota de crédito cuando
   aplique; nunca se presenta un cambio de estado local como anulación fiscal.

## Contrato fiscal comprobado después de la exploración

El repositorio local `D:\tempo\claudecode\osesunat` expone
`POST /api/v1/comprobantes` para `FACTURA`, `BOLETA` y `NOTA_CREDITO`. La nota
de crédito usa identidad fiscal propia e `Idempotency-Key`, requiere el
comprobante referenciado, motivo y la misma moneda; sus pruebas de integración
cubren emisión y rechazan una moneda distinta. El endpoint
`POST /api/v1/comprobantes/{id}/anular` continúa siendo solo local: el propio
servicio indica que la baja fiscal requiere un resumen de bajas.

La orientación vigente de SUNAT reconoce la nota de crédito electrónica para
anulaciones, descuentos, devoluciones, bonificaciones y disminuciones de valor
de una factura o boleta emitida previamente al mismo adquirente. La validez
concreta de motivo, plazo y baja debe revisarse con contabilidad antes de
producción; la propuesta no automatizará resumen de bajas.

## Ready for Proposal

Sí, para una propuesta acotada a **devolución comercial y fiscal trazable**.
Las decisiones de liquidación, sucursal, roles y nota de crédito ya fueron
aprobadas; quedan para diseño los motivos concretos, estructuras e invariantes
de implementación. La anulación por resumen de bajas sigue fuera de alcance.
