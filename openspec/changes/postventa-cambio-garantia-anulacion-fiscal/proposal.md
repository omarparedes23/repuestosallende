# Propuesta: operación de devoluciones postventa

## Objetivo

Completar la primera operación postventa utilizable para devoluciones totales o
parciales: solicitud y recepción operativa trazables desde tablet, revisión y
liquidación documental desde el panel, y protección verificable de stock,
kardex, caja, CxC y nota de crédito.

La propuesta corrige una debilidad de la migración 055 ya aplicada: hoy la
solicitud decide `reingresa_stock` y la liquidación atribuye al administrador
la recepción física. En el flujo real, el vendedor atiende y registra la
recepción; el administrador solo revisa documentos y liquida. Ninguna pieza
puede reingresar a stock vendible por una declaración no atribuida al receptor
operativo.

## Decisiones de negocio aprobadas

- El vendedor puede solicitar una devolución y registrar la recepción
  operativa; ambos actos pueden encadenarse en la UI, pero son RPC y eventos
  separados.
- La evidencia mínima es: `recibido`, condición declarada
  (`apto_reventa`, `dañado`, `incompleto`, `no_recibido`), observación,
  usuario y fecha. La observación es obligatoria salvo para `apto_reventa`.
  No se usa Supabase Storage ni fotos en esta fase.
- Solo una pieza recibida como `apto_reventa` y aprobada por un administrador
  vuelve a stock vendible. Daño o faltante no suman stock; `no_recibido`
  impide la liquidación. El administrador puede ser más conservador; un
  override hacia reingreso exige motivo y auditoría.
- La devolución se atiende y liquida únicamente en la sucursal emisora.
- El reembolso conserva la composición proporcional de pagos: efectivo contra
  caja abierta; Yape, tarjeta y transferencia exigen referencia; crédito solo
  reduce la deuda atribuible sin egreso de caja.
- Una NC se intenta emitir de inmediato después del commit comercial. Sin cron
  en Vercel, los estados pendientes, reintentables, rechazados y de
  conciliación se administran en una bandeja manual autorizada.
- La prueba de emisión OSE se hará exclusivamente contra tenant TEST; no forma
  parte de esta propuesta emitir documentos de prueba en producción.

## Alcance

1. Migración aditiva `058+`; la migración 055 y sus filas históricas no se
   editan ni se reinterpretan.
2. Recepción operativa separada de la solicitud, con actor, fecha, condición,
   observación y resultado de stock propuesto/auditado.
3. Nueva RPC idempotente `ra_registrar_recepcion_devolucion_v1` para vendedor;
   extensión compatible de la liquidación existente para consumir la recepción
   y no el booleano recibido al solicitar.
4. Roles claros: vendedor solicita/registra; administrador o superadmin
   aprueba, decide el override permitido y liquida; las identidades se guardan
   por separado.
5. Interfaz tablet para buscar una venta de la sucursal activa, elegir líneas y
   cantidades, crear solicitud y registrar recepción.
6. Interfaz administrativa de devoluciones: bandeja, detalle documental,
   aprobación/rechazo, liquidación, referencias de reembolso, decisión de
   reingreso y estado/reintento de NC.
7. Pruebas SQL de concurrencia, idempotencia, pago mixto, CxC, caja, RLS por
   empresa/sucursal y rollback; pruebas TypeScript de acciones y UI crítica.
8. Procedimiento reproducible para validar manualmente una NC contra OSE TEST,
   incluido replay y conflicto idempotente.

## Fuera de alcance

- Cambio inmediato o diferido de producto.
- Expediente de garantía, cuarentena, RMA y resolución con proveedor.
- Fotos, archivos o Supabase Storage.
- Baja, resumen diario o reversión fiscal; tampoco se usa el endpoint local
  `/comprobantes/{id}/anular` como sustituto.
- Ampliar motivos de NC fuera de `06` y `07`.
- Worker/cron, alertas automáticas o despliegue VPS para outbox.
- Modificar ventas, pagos, kardex, caja, CxC o devoluciones históricas.
- Contabilidad, PLE y asientos automáticos.

## Criterios de éxito

1. Una solicitud no modifica stock, kardex, caja, CxC ni outbox.
2. La recepción queda atribuida al vendedor real; el administrador nunca se
   asigna automáticamente como receptor.
3. Sin recepción `recibido=true`, la liquidación falla sin efectos. La condición
   controla el reingreso: únicamente `apto_reventa` aprobado suma stock.
4. Cada RPC soporta replay exacto y rechaza el mismo `operation_id` con un
   payload diferente sin crear efectos adicionales.
5. Dos liquidaciones concurrentes nunca devuelven más unidades que las vendidas.
6. Una liquidación exitosa confirma o revierte como una sola transacción sus
   efectos de devolución, stock, kardex, caja/CxC, auditoría y outbox NC.
7. Pago mixto, crédito puro y cobro parcial mantienen importes positivos,
   proporcionales y sin deuda negativa ni doble reembolso.
8. Sesiones de otra empresa o sucursal no pueden ver, solicitar, registrar,
   aprobar, liquidar o reintentar datos ajenos.
9. La bandeja manual no permite reemitir estados inciertos o enviados; solo
   permite los estados de reintento autorizados por la outbox.
10. Una NC TEST aceptada puede repetirse con la misma clave sin duplicarse; un
    payload distinto con la misma clave resulta en conflicto y no emite otra NC.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Vendedor declara incorrectamente el estado de una pieza | condición, observación, actor/fecha auditables y override administrativo con motivo |
| Stock vendible de una pieza dañada | derivar reingreso desde recepción + aprobación; nunca desde el payload de solicitud |
| Caída o resultado incierto de OSE | commit comercial primero; outbox durable y bandeja de conciliación manual, sin reenvío automático |
| Doble devolución o doble reembolso | locks, hashes, `operation_id`, restricciones únicas y pruebas concurrentes |
| Filtración entre empresas/sucursales | RLS de lectura, autorización y alcance de sucursal dentro de cada RPC, con prueba negativa |

## Dependencias y entrega

La propuesta depende de las migraciones 055--057 ya aplicadas, del adaptador
OSE de nota de crédito y del motor transaccional de ventas. La emisión contra
OSE TEST requiere que Operaciones disponga de un tenant y una API key de prueba;
las credenciales no se almacenan en código, OpenSpec ni logs.

El siguiente artefacto será la especificación normativa de
`operacion-devoluciones-postventa`, seguida por diseño y tareas. La aprobación
de esos documentos será previa a cualquier aplicación de migración o cambio de
comportamiento remoto.
