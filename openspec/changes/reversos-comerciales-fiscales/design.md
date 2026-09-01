# Diseño: devolución comercial y fiscal trazable

## Decisión arquitectónica

Se introduce un agregado `devolución` separado de `ra_ventas`. La venta conserva
su condición histórica; los efectos se expresan como nuevos registros
compensatorios. El núcleo vive en RPC PostgreSQL `SECURITY DEFINER`; Server
Actions/UI solo validan formato y presentan resultados.

```
Solicitud vendedor ──> devolución solicitada
                               │
Administrador ──> RPC de liquidación idempotente
                               │
       ┌──────────┬───────────┼────────────┐
       ▼          ▼           ▼            ▼
 devolución   stock/kardex  caja/CxC   outbox NC (si accepted)
                                             │
                                             ▼
                                      worker OSE separado
```

La transacción termina después de persistir la outbox; nunca espera una llamada
HTTP a OSE/SUNAT.

## Modelo propuesto

### Agregado comercial

Se crearán tablas aditivas:

- `ra_devoluciones`: empresa, venta, sucursal emisora, estado, motivo,
  solicitante, aprobador, receptor, liquidador, `operation_id`, `request_hash`,
  resumen de liquidación y timestamps.
- `ra_devolucion_items`: devolución, `venta_item_id`, catálogo, cantidad,
  precio/importe histórico proporcional y condición de reingreso.
- `ra_devolucion_liquidaciones`: devolución, medio original, monto,
  referencia de reembolso y vínculo al movimiento de caja o CxC generado.
- `ra_auditoria_devoluciones`: eventos append-only de solicitud, aprobación,
  rechazo, recepción, liquidación y fiscalidad.

Las restricciones incluirán unicidad `(empresa_id, operation_id)`, cantidades y
montos positivos, venta/línea de la misma empresa, y una llave única por línea
de devolución. Las devoluciones liquidadas no se eliminan ni actualizan.

### Libros existentes

- `ra_kardex`: se agregará entrada `devolucion` con `referencia_id` de la nueva
  devolución y notas inequívocas. No se tocará el kardex de venta.
- `ra_movimientos_caja`: se extenderá el `CHECK` de `origen` para un valor
  explícito `devolucion`; el egreso seguirá teniendo monto positivo, caja,
  usuario, operación y hash.
- `ra_cuenta_corriente_movimientos`: se ampliará de forma compatible el shape
  para admitir un abono compensatorio de devolución sin falsificar un medio de
  pago. Debe llevar `origen='devolucion'`, devolución vinculada e idempotencia;
  el cálculo de saldo continuará siendo `cargo - abono`.
- `ra_clientes.saldo_deudor`: se actualiza en la misma transacción y bajo
  bloqueo de fila del cliente.

No se añadirá un monto negativo ni se mutarán `ra_venta_pagos` o movimientos
históricos para representar un reembolso.

### Outbox fiscal exclusiva

`ra_sunat_outbox` no se reutiliza: su modelo es uno-a-uno con venta y su enum
solo representa ticket/boleta/factura. Se creará `ra_sunat_nota_credito_outbox`
con devolución, venta, identidad fiscal de nota de crédito, referencia del
documento original, payload, lease/fencing, intentos, estado y resultado.

La nueva outbox tendrá su propia clave idempotente estable y unicidad por
devolución. El worker compartirá las reglas de concurrencia y clasificación de
resultados de `processSunatOutbox`, pero llamará un adaptador OSE para
`NOTA_CREDITO` con el objeto `notaCredito` requerido.

La nota de crédito reutiliza `ra_series_documento`, fuente de verdad existente
para las guías. Se amplía su constraint de `tipo_documento` con
`nota_credito_factura` y `nota_credito_boleta`; la RPC bloquea la fila
predeterminada con `FOR UPDATE`, consume `siguiente_correlativo` y lo incrementa
en la misma transacción. La combinación empresa+tipo+serie ya es única en esa
tabla; el libro NC tendrá además identidad fiscal única. En TEST se configura
por sucursal Principal `FC001`/`BC001` y Arriola `FC005`/`BC005`, desde 1.

## RPC y flujo

1. `ra_solicitar_devolucion_v1(...)`: vendedor/admin registra una intención sin
   efectos económicos. Valida venta, sucursal emisora, líneas, motivo y empresa.
2. `ra_liquidar_devolucion_v1(operation_id, devolucion_id, items, liquidaciones,
   referencia...)`: solo admin/superadmin. Obtiene locks en este orden:
   empresa/operación, devolución, venta, ítems de venta, productos ordenados por
   UUID, cliente y caja. Calcula cantidad devuelta acumulada y distribución
   proporcional autoritativa; no confía en importes del cliente.
   Esta RPC constituye un solo acto de aprobación, recepción física y
   liquidación; no existen estados intermedios aprobados/recibidos en la primera
   entrega. La venta no tiene plazo de devolución codificado: se persisten su
   antigüedad y motivo en auditoría para la decisión explícita del administrador.
3. Según el estado fiscal original:
   - ticket: confirma reverso comercial;
   - boleta/factura `accepted`: confirma reverso comercial e inserta outbox NC;
   - `rejected`: confirma reverso comercial sin NC;
   - `pending`, `retry`, `processing`, `submitted`, `dead_letter`: falla con un
     código explícito que exige conciliación, sin efectos locales.
4. Inserta kardex/stock, caja/CxC, auditoría y resultado JSON estable. Un
   replay devuelve el mismo snapshot; payload distinto produce
   `RA_IDEMPOTENCY_CONFLICT`.

La liquidación usa la composición de pagos históricos y el valor proporcional
de las líneas; no permite que la UI elija libremente el monto o el medio. Los
medios digitales requieren referencia del reembolso; efectivo exige caja abierta
de la sucursal emisora; crédito se aplica a la deuda pendiente atribuible.

Para una venta fiscal aceptada, la RPC también deriva el motivo de la nota de
crédito desde las líneas autoritativas: usa el catálogo SUNAT `06` únicamente
si la devolución actual cubre todas las líneas y cantidades de la venta, y `07`
en cualquier devolución parcial. El cliente no entrega un código fiscal. La
outbox conserva código, descripción, comprobante original, líneas, base, IGV y
total; el adaptador OSE posterior traduce ese contrato a su payload externo.

## Seguridad

- Todas las funciones usan `SET search_path = public, extensions, pg_temp` y
  objetos calificados.
- `PUBLIC`, `anon` y `service_role` no reciben ejecución por defecto; se otorga
  solo la mínima ejecución a `authenticated` y al worker técnico que corresponda.
- RLS limita lectura a la empresa; tablas de outbox fiscal no se exponen al
  navegador.
- El rol y la empresa derivan de `auth.uid()` y `ra_perfiles`; sucursal, venta,
  caja y cliente se vuelven a validar en SQL.
- La auditoría no guarda payloads completos de OSE, secretos ni datos innecesarios.

## Pruebas y rollback

La suite SQL debe ejecutar cada fixture en `BEGIN ... ROLLBACK` y cubrir:

- cantidad total/parcial y carrera concurrente;
- replay/conflicto de idempotencia;
- fallo inyectado después de cada efecto interno;
- medios efectivo/digital/crédito/mixto;
- otra empresa, vendedor sin autorización y sucursal distinta;
- estados fiscales accepted/rejected/inciertos;
- reserva concurrente de serie/correlativo NC y lease/fencing de outbox.

El rollback será forward-only: se deshabilitan nuevas RPC/UI y se conserva toda
devolución ya liquidada, su kardex, caja/CxC y outbox para auditoría. No se
eliminan ni reescriben operaciones reales.
