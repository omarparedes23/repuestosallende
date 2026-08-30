# Propuesta: activar outbox fiscal P1

## Objetivo

Completar la operación fiscal asíncrona para que cada boleta o factura tenga
procesamiento periódico, trazabilidad administrativa y alerta temprana de
fallos, sin alterar ni revertir la venta comercial ya confirmada.

## Alcance

- Incorporar como contingencia temporal un envío manual, por una sola venta,
  desde el detalle de una boleta/factura pendiente. Estará limitado a
  administrador/superadmin, empresa y sucursal activas, y conservará la misma
  identidad fiscal y el lease de la outbox.
- Configurar un scheduler de producción autenticado con `CRON_SECRET`, con una
  frecuencia y observabilidad acordadas.
- Medir y alertar por trabajos `pending`/`retry` envejecidos, `submitted`
  estancados, `rejected` y `dead_letter`.
- Crear panel de administración limitado por empresa, con filtros por estado,
  sucursal, documento, fecha e intento; incluir detalle saneado de error y
  trazabilidad de la venta.
- Diseñar conciliación segura de `submitted` y resultados inciertos antes de
  cualquier nuevo envío.
- Permitir una acción manual explícita y auditada solo si el contrato OSE y la
  política fiscal confirman que es segura.
- Añadir pruebas de transiciones, autorización, reintentos, alertas y
  conciliación.

## Fuera de alcance

- Confirmar, anular o modificar ventas, caja, stock o cuentas corrientes desde
  el panel de outbox.
- Volver a emitir ciegamente documentos rechazados o enviados.
- Sustituir el proveedor OSE/SUNAT o implementar notas de crédito.
- Autohospedar Supabase/PostgreSQL como parte de este P1.

## Criterios de aceptación

1. Un scheduler de producción invoca la ruta protegida con el secreto correcto,
   deja evidencia de cada ejecución y no expone credenciales al navegador.
2. Un documento `pending` creado por una venta de prueba pasa por las
   transiciones esperadas y conserva la misma identidad fiscal entre intentos.
3. Los documentos `submitted` reciben conciliación; no quedan indefinidamente
   sin visibilidad ni se reenvían sin verificar el estado ante OSE.
4. `rejected` y `dead_letter` generan una alerta accionable con documento,
   edad, intento y mensaje saneado, sin datos sensibles.
5. El panel administrativo solo permite a usuarios autorizados ver datos de su
   empresa; sus acciones quedan auditadas con usuario, fecha y motivo.
6. Una caída del scheduler, OSE o despliegue no pierde trabajos: quedan
   recuperables por lease, reintento o revisión administrativa.

## Decisión requerida antes del diseño

Elegir la plataforma del scheduler. Para mantener Vercel Hobby, no se puede
usar su cron cada minuto; se debe usar un scheduler externo o un VPS. Si se
elige Vercel Pro, se puede volver a declarar el cron en `vercel.json`. Esta
elección define la configuración de despliegue, logs, alertas y recuperación,
pero no cambia el contrato durable de la outbox.
