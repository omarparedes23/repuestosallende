# Propuesta: devolución comercial y fiscal trazable

## Objetivo

Incorporar un núcleo de devolución total o parcial que compense de forma
atómica y trazable una venta confirmada, sin alterar sus registros originales.
La capacidad abarcará recepción en sucursal emisora, stock/kardex, reembolso o
reducción de deuda, aprobación administrativa e inicio durable de la nota de
crédito cuando el comprobante electrónico lo requiera.

## Decisiones de negocio aprobadas

- El reembolso se realiza al mismo medio de pago: efectivo desde caja abierta;
  Yape, tarjeta y transferencia al mismo medio con referencia obligatoria;
  crédito disminuye la deuda y no entrega efectivo.
- Un pago mixto se devuelve proporcionalmente por medio. Un saldo a favor es
  una excepción administrativa, no un comportamiento implícito.
- La devolución se recibe solo en la sucursal emisora de la venta en esta
  entrega.
- El vendedor puede solicitar; `administrador` o `superadmin` aprueba, recibe,
  liquida y puede producir el efecto fiscal en un único acto atómico al tener
  la pieza físicamente presente.
- No existe un plazo automático rígido en la primera entrega. La antigüedad de
  la venta y el motivo quedan visibles y auditados; la aprobación administrativa
  es el control de excepción. Una política configurable por categoría/motivo se
  tratará en un cambio posterior.
- Para TEST, las series NC son por sucursal emisora: Tienda Principal usa
  `FC001`/`BC001` y Sucursal Nicolas Arriola `FC005`/`BC005`, todas desde el
  correlativo 1. La configuración productiva requerirá una decisión separada.
- Una factura o boleta aceptada se modifica mediante nota de crédito cuando
  corresponda. El endpoint OSE de anulación local no se considerará anulación
  fiscal.

## Alcance

1. Nuevo agregado de devolución y sus líneas, enlazado de forma inmutable a
   venta e ítems originales.
2. Estados explícitos para solicitud, aprobación, recepción, liquidación y
   resultado fiscal, con usuario, fecha y motivo auditables.
3. RPC transaccional e idempotente para aprobar/recibir/liquidar una devolución
   parcial o total, con bloqueo determinista de líneas y stock.
4. Entrada de stock y kardex solo por cantidades físicamente recibidas y aptas
   para volver a disponibilidad.
5. Egreso de caja o reducción de CxC según la composición de pagos y la
   política aprobada; sin montos negativos ni edición de movimientos previos.
6. Outbox separada para nota de crédito, con identidad fiscal e idempotencia
   propias y vínculo al comprobante original.
7. Acciones server-side y detalle administrativo de la venta/devolución; la
   tablet será un cliente de solicitud, no la autoridad del negocio.
8. Pruebas PostgreSQL de idempotencia, concurrencia, rollback, RLS/empresa,
   pagos mixtos y fiscalidad; pruebas TypeScript del contrato de entrada.

## Fuera de alcance

- Cambio de producto en una sola operación; se diseñará después como
  devolución más una venta nueva.
- Expediente de garantía, cuarentena, reparación, devolución a proveedor y
  disposición de piezas defectuosas.
- Recepción de devolución en una sucursal distinta a la emisora.
- Política configurable de plazos, embalaje, categoría o garantía.
- Saldo a favor como modalidad ordinaria de liquidación.
- Resumen de bajas, reversiones y cualquier anulación fiscal que el OSE actual
  aún no ejecute frente a SUNAT.
- Asientos contables automáticos y PLE.
- Reprocesar o corregir ventas históricas sin el vínculo requerido.

## Criterios de éxito

1. Una devolución no puede exceder, aun bajo concurrencia, la cantidad neta
   vendida de cada línea.
2. La misma `operation_id` con el mismo payload devuelve el mismo resultado;
   un payload distinto no produce efectos.
3. Si falla cualquier efecto interno, no persisten devolución, kardex, stock,
   caja, CxC ni outbox parcialmente creados.
4. Una devolución de efectivo solo se liquida contra caja abierta de la
   sucursal emisora; los medios digitales conservan referencia obligatoria.
5. Un crédito reduce únicamente la deuda atribuible a la venta sin generar
   egreso de caja.
6. Una boleta/factura aceptada genera como máximo una nota de crédito durable,
   vinculada al comprobante original, con moneda coincidente e identidad fiscal
   independiente.
7. Para una venta fiscal `accepted`, el reembolso comercial se confirma sin
   esperar la respuesta de OSE: deja en la misma transacción una outbox de nota
   de crédito durable y observable. Un fallo externo posterior no revierte
   dinero ni stock; exige reintento/conciliación.
8. Los documentos `pending`, `submitted`, `retry` o inciertos no se reembolsan
   automáticamente ni se tratan como anulados sin conciliación explícita con
   OSE. Un `rejected` final puede revertirse comercialmente sin nota de crédito.
9. Un vendedor no puede aprobar, liquidar ni emitir el efecto fiscal; una
   sesión de otra empresa o sucursal no puede consultar ni alterar la operación.
10. Los libros de venta, pago, caja, CxC y kardex originales permanecen
   append-only y explicables desde la devolución vinculada.

## Capacidades nuevas

- `devolucion-comercial-fiscal-trazable`: devuelve parcialmente o totalmente
  una venta, liquida el impacto económico y crea el trabajo fiscal cuando
  corresponde.

## Dependencias y límites

La emisión de nota de crédito depende del contrato OSE existente de
`POST /api/v1/comprobantes`; este ya soporta `NOTA_CREDITO`, referencia,
moneda coincidente e idempotencia. La activación de scheduler, alertas y
conciliación general de outbox continúa perteneciendo al cambio
`activar-outbox-fiscal-p1`; esta propuesta no habilita cron ni llamadas reales
por sí sola.

Por decisión operativa, tras el commit comercial la Server Action intenta emitir
la nota de crédito una sola vez de forma inmediata y con la misma clave
idempotente. Si OSE falla, el reembolso no se revierte: la outbox conserva el
estado y queda disponible para un reintento manual autorizado. El worker/cron
general de reintentos continúa en espera hasta la migración a VPS, porque la
frecuencia diaria de Vercel Hobby no es una cola fiscal oportuna.

La aplicación productiva requerirá revisión del contador sobre motivo, plazo y
documento aplicable según SUNAT. Esta propuesta no interpreta una aceptación
de OSE como sustituto de esa aprobación fiscal.
