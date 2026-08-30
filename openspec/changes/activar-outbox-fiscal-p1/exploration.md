# Exploración: activar outbox fiscal P1

## Contexto y objetivo

Las boletas y facturas ya crean una fila durable en `ra_sunat_outbox` dentro de
la transacción de venta. El objetivo del P1 es operarla de forma continua,
observable y segura: scheduler, alertas y panel administrativo para estados
`submitted`, `rejected` y `dead_letter`.

La programación automática de Vercel se desactivó temporalmente porque el plan
Hobby no permite el cron de cada minuto que requiere esta operación. Mientras
esté así, toda boleta o factura nueva quedará `pending` y no será enviada a OSE.

## Estado comprobado en el código

| Área | Evidencia | Estado |
| --- | --- | --- |
| Registro durable | La venta transaccional inserta una outbox para boleta/factura. | Disponible |
| Reclamación segura | `ra_claim_sunat_outbox` usa leases para evitar doble procesamiento. | Disponible |
| Finalización | `ra_finish_sunat_outbox` registra `accepted`, `submitted`, `rejected`, reintento y `dead_letter`. | Disponible |
| Consumidor | `src/lib/facturacion/outbox.ts` procesa como máximo 10 trabajos, con concurrencia 2. | Disponible, sin scheduler activo |
| Ruta protegida | `src/app/api/internal/sunat-outbox/route.ts` exige `CRON_SECRET`. | Disponible |
| Scheduler | No hay uno activo tras retirar el cron de Vercel. | Pendiente |
| Alertas | No hay umbrales, canal ni escalamiento. | Pendiente |
| Panel operativo | No hay vista de outbox, filtros ni acciones administrativas. | Pendiente |
| Conciliación de enviados | `submitted` y respuestas inciertas no tienen proceso visible de consulta posterior. | Pendiente de diseño/verificación |

## Riesgos operativos

- Sin scheduler, los comprobantes fiscales no llegan al OSE/SUNAT aunque la
  venta, cobro, stock y caja ya estén confirmados.
- Un `submitted` permanente no confirma por sí mismo que SUNAT haya aceptado el
  documento; requiere conciliación con el proveedor antes de un reenvío.
- Un reintento manual sin conservar la identidad fiscal o sin revisar el motivo
  puede generar incidentes de emisión duplicada o trabajo inútil.
- No se deben mostrar en el panel payloads fiscales completos, secretos,
  credenciales ni respuestas no saneadas del proveedor.

## Alternativas de scheduler

| Alternativa | Ventaja | Consideración |
| --- | --- | --- |
| Vercel Pro | Mantiene el endpoint actual y habilita cron frecuente. | Costo recurrente y dependencia de Vercel. |
| VPS Ubuntu | `systemd` timer/cron, proceso y logs bajo control propio. | Requiere monitoreo, actualizaciones, backups y operación 24/7. |
| Scheduler externo | Puede llamar al endpoint existente con `CRON_SECRET`. | Añade un proveedor y debe resguardar el secreto. |
| Supabase programado | Cercano a la base de datos. | Requiere diseñar y operar una función separada; no está implementado. |

## Preguntas que bloquean la implementación

1. ¿Cuál será la plataforma que ejecuta el scheduler en producción durante los
   próximos meses?
2. ¿Cuál es el tiempo máximo aceptable para emitir una boleta/factura y qué
   canal recibirá alertas críticas?
3. ¿Qué acciones manuales puede ejecutar un administrador: solo reintentar,
   reencolar después de revisión, o ninguna?
4. ¿Cuál es el contrato de consulta/conciliación de documentos `submitted` con
   el OSE actual?

