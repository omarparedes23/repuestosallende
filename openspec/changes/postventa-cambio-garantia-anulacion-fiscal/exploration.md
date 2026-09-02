# Exploracion: postventa, cambios, garantias y anulacion fiscal

## Proposito y limite

Esta exploracion define el trabajo pendiente despues del nucleo ya aplicado de
devoluciones y notas de credito (migraciones 055--057). Cubre:

1. la interfaz para solicitar, documentar y liquidar devoluciones;
2. las pruebas que aun faltan para el nucleo transaccional existente;
3. cambio de producto;
4. expediente de garantia; y
5. anulacion/baja fiscal real, separada de la nota de credito.

No autoriza implementacion, migraciones ni llamadas a Supabase u OSE. El
worker/cron fiscal general queda explicitamente **en standby** para un futuro
VPS: no forma parte de este change ni se implementara en Vercel.

## Decision operativa confirmada

El administrador no recibe ni inspecciona fisicamente piezas. Su funcion es
revisar los documentos registrados en el sistema, aprobar cuando corresponda
y ejecutar la liquidacion administrativa.

Por tanto, el sistema debe diferenciar tres actos atribuibles:

| Acto | Actor esperado | Que certifica | Efecto por si solo |
| --- | --- | --- | --- |
| Solicitud | vendedor u operador de sucursal | cliente solicita el caso, lineas, cantidades y motivo | ninguno |
| Registro operativo | vendedor/operador que atiende el mostrador | pieza entregada o no entregada, condicion declarada y evidencia/referencia | ninguno hasta aprobacion; nunca autoriza dinero por si solo |
| Aprobacion y liquidacion documental | administrador/superadmin | documentos, monto, medio de pago, deuda y accion fiscal permitida | efecto atomico de stock, kardex, caja/CxC y outbox cuando aplique |

El campo `receptor_id` de 055 no representa hoy esta realidad: la RPC
`ra_liquidar_devolucion_v1` lo llena con el administrador junto a
`aprobador_id` y `liquidador_id`. Asimismo, el `reingresaStock` de las lineas
se captura al solicitar y la liquidacion repone stock con ese valor. Antes de
exponer la UI se debe corregir el contrato para que el operador registre la
condicion de la pieza y el administrador no pueda declarar una recepcion que
no realizo.

No se interpreta este registro como una pericia tecnica: es evidencia
operativa/documental. Para garantia, el diagnostico tecnico es otro acto.

## Estado actual comprobado

### Devolucion y nota de credito

- 055 creo `ra_devoluciones`, lineas, liquidaciones, auditoria, extensiones
  compensatorias de caja/CxC y la outbox exclusiva de nota de credito.
- 056--057 permiten emitir o reintentar manualmente una nota de credito desde
  `src/app/tablet/(kiosk)/devoluciones/actions.ts`; una caida de OSE conserva
  la devolucion y su outbox. No existe pantalla que invoque ese flujo.
- `ra_liquidar_devolucion_v1` bloquea la devolucion, venta, lineas y productos,
  impide exceder cantidades ya liquidadas, y crea efectos append-only.
- Los reportes previos registran PASS de schema, rollback por fallo inyectado,
  claim/fencing, Vitest y build en TEST. Aun no hay evidencia de concurrencia
  real, pagos mixtos, CxC puro, RLS multiempresa ni prueba manual OSE de nota
  de credito.

### Superficies disponibles

- Ya existe el modulo tablet `devoluciones/`, pero contiene solo Server
  Actions y sus pruebas; no existe `page.tsx` ni componentes de solicitud.
- El panel contiene rutas de ventas, clientes, caja, tesoreria y reportes, pero
  no una ruta administrativa de devoluciones/postventa.
- La tabla `ra_kardex` reconoce el motivo `devolucion`; el dialogo de articulos
  ya lo muestra como tal. Cualquier nueva referencia debe conservar su caracter
  append-only y no inventar documentos historicos ausentes.

### Cambio y garantia

No existen entidades, rutas, RPC ni estados de stock para cambio de producto o
garantia. El stock actual solo distingue disponibilidad por producto/sucursal;
no hay cuarentena, diagnostico, reparacion, devolucion a proveedor ni
disposicion de piezas defectuosas.

### Fiscal

El adaptador local soporta `NOTA_CREDITO`, documento de referencia y una clave
de idempotencia propia. La nota de credito es el mecanismo previsto para una
devolucion comercial de un comprobante aceptado.

La anulacion/baja fiscal no esta implementada. El endpoint local de anulacion
conocido no equivale a la comunicacion fiscal ante OSE/SUNAT. Su contrato,
estados, plazos y acuses deben confirmarse con el proveedor OSE y mediante una
prueba manual controlada; no se deduciran desde la UI ni se cambiara
`ra_ventas.estado` como sustituto.

## Diseno de alcance recomendado

No es seguro implementar los cinco temas como una unica RPC o pantalla. Se
recomiendan tres capacidades coordinadas y desplegables por separado:

| Capacidad | Incluye | Excluye deliberadamente |
| --- | --- | --- |
| `operacion-devoluciones-postventa` | UI tablet y panel, registro operativo separado, aprobacion documental, liquidacion existente corregida y pruebas pendientes | cambio, garantia y baja fiscal |
| `cambio-producto-atomico` | devolucion vinculada + venta nueva + diferencia de pago, stock/kardex de ambos lados y documentos separados | diagnostico de garantia y baja fiscal |
| `garantias-y-baja-fiscal` | expediente, cuarentena, dictamen y resolucion de garantia; investigacion/contrato de baja fiscal | automatizar bajas o cron VPS sin decision posterior |

La separacion evita que una garantia ingrese por error a stock disponible o que
un cambio modifique una venta/factura ya emitida.

## Flujo propuesto: devolucion visible y documentada

1. El operador abre una venta de su sucursal y selecciona lineas y cantidades.
   La Server Action llama `ra_solicitar_devolucion_v1`; la UI no calcula ni
   escribe stock, total, caja o CxC.
2. Al recibir el articulo en mostrador, el operador registra una constancia
   operativa: recibido/no recibido, condicion comercial declarada, observacion,
   evidencia o referencia y usuario/fecha. Si no fue recibido, no se habilita
   ingreso a stock.
3. El administrador abre el detalle, ve documentos originales, pagos,
   devoluciones previas, constancia operativa, monto derivado y estado fiscal.
   Aprueba o rechaza con motivo auditable.
4. Solo tras aprobar, la liquidacion atomica decide el reingreso de stock segun
   la constancia, genera kardex, devuelve proporcionalmente por medio o reduce
   la deuda, y crea la outbox NC si corresponde.
5. La interfaz refleja el estado fiscal (`pending`, `submitted`, `accepted`,
   `retry`, `rejected`, `dead_letter`) y habilita un reintento manual solo al
   administrador autorizado y solo para estados seguros. No revierte dinero ni
   stock porque falle OSE.

La propuesta debe decidir si el operador puede registrar una solicitud y
constancia en la misma interaccion o si deben ser dos acciones. En ambos casos,
la identidad del receptor real debe quedar separada del administrador.

## Contratos y migraciones a explorar en la propuesta

Para la primera capacidad, una migracion aditiva debe evaluar:

- crear una migracion nueva **058 o posterior**. La 055 ya esta aplicada en
  TEST y versionada; nunca se edita para corregir `receptor_id`,
  `reingresa_stock` ni sus RPC vigentes;
- reemplazar o ampliar los estados `solicitada/liquidada/rechazada` con un
  estado previo a liquidacion que no altere operaciones historicas;
- registrar `recepcion_operativa_por`, fecha, resultado y evidencia; conservar
  `aprobador_id` y `liquidador_id` como roles distintos;
- mover `reingresa_stock` de una declaracion controlada por la solicitud a una
  decision validada a partir del registro operativo y la aprobacion;
- separar RPC de registrar la constancia y RPC de aprobar/liquidar, con hashes,
  locks y grants minimos independientes;
- mantener RLS por empresa, y validar sucursal en cada RPC; ningun ID de
  empresa, rol, caja, precio o stock llega como autoridad desde la UI;
- agregar solo indices respaldados por consultas reales de la bandeja
  administrativa (empresa/sucursal/estado/created_at y venta).

No se debe reescribir la venta, pagos, kardex, caja ni CxC originales.

## Plan de pruebas indispensable

| Caso | Preparacion y accion | Resultado exigido |
| --- | --- | --- |
| Concurrencia de cantidad | dos sesiones liquidan devoluciones que juntas exceden una linea vendida | una sola confirma; la otra recibe `RA_RETURN_QUANTITY_EXCEEDED`; stock, kardex, caja/CxC y outbox solo reflejan la ganadora |
| Idempotencia de solicitud/registro/liquidacion | repetir igual cada RPC y repetir con payload distinto | replay devuelve el mismo resultado; el segundo payload falla sin nuevos efectos |
| Pago mixto | venta con efectivo, Yape/tarjeta/transferencia y/o credito; devolucion parcial | importes proporcionales con redondeo determinista; digitales exigen referencia; no hay monto duplicado ni negativo |
| CxC puro y cobro parcial | venta a credito, con y sin abonos posteriores | solo crea abono compensatorio hasta la deuda atribuible pendiente; no crea egreso de caja ni saldo deudor negativo |
| Caja | venta con medio no credito, caja cerrada o abierta | caja cerrada rechaza y revierte todo; abierta crea un unico egreso vinculado |
| RLS multiempresa y sucursal | usuarios de otra empresa/sucursal intentan SELECT y RPC con UUID conocido | no ven ni modifican datos ajenos; las RPC derivan empresa/rol/sucursal de sesion |
| Fallo inyectado | provocar fallo en stock, caja y CxC durante liquidacion | rollback total de agregado, stock, kardex, movimientos y outbox |
| OSE manual | caso TEST no productivo con NC, conservar request/response y consultar el estado | una NC con identidad propia, vinculada al original; reintento no duplica; los estados inciertos no se fuerzan |

Las pruebas SQL se ejecutaran en una transaccion con `ROLLBACK` o con datos
aislados. La prueba OSE manual requiere autorizacion operativa separada y no
debe realizarse contra produccion sin confirmacion expresa.

## Cambio de producto: limites del diseno futuro

Un cambio debe ser una operacion compuesta y trazable, no una edicion de la
venta original:

1. una devolucion documentada de la pieza entregada;
2. una nueva venta del articulo de reemplazo, con precio vigente y stock
   bloqueado; y
3. una liquidacion de diferencia por cobrar o devolver, con documentos
   fiscales separados cuando aplique.

La propuesta debe decidir si ambas fases son una sola transaccion comercial
interna. Si cualquiera falla, no puede quedar el reemplazo entregado sin
devolucion, ni una devolucion liquidada sin el nuevo documento cuando el flujo
exija cambio inseparable. La fiscalidad nunca se resuelve cambiando el item de
un comprobante ya emitido.

## Garantias: limites del diseno futuro

La garantia requiere un expediente independiente vinculado a la venta y a la
pieza: motivo, evidencia, plazo/politica vigente, diagnostico, responsable,
estado y resolucion. Estados iniciales sugeridos: `abierta`, `en_revision`,
`aprobada`, `rechazada`, `resuelta`.

Una pieza de garantia recibida no debe recuperar stock vendible por defecto.
La propuesta debe elegir un modelo de inventario en cuarentena (ubicacion o
estado de inventario) y sus movimientos de kardex. La resolucion puede ser
reparacion, reemplazo, nota de credito/devolucion, devolucion a proveedor o
descarte; cada una tendra su propio efecto de stock y dinero.

## Anulacion/baja fiscal: limite del diseno futuro

La nota de credito ya cubre el reverso economico de una venta aceptada cuando
corresponde. La baja/anulacion fiscal es un proceso distinto y debe modelarse
como una solicitud fiscal durable: documento afectado, causal permitida,
fecha, usuario, payload, identidad idempotente, estado del envio y acuse.

Antes de disenar una migracion se debe obtener del OSE el contrato verificable
para crear, consultar y terminar dicho tramite. La UI solo podra ofrecerlo si
el estado del documento y la causal lo permiten. Hasta entonces, la venta
local conserva su historia y no se marca como anulada para simular una baja.

## Decisiones aprobadas (2026-09-02)

### Fase 1: devolucion operativa y documental

1. El **vendedor** registra la recepcion operativa. Puede ser la misma persona
   que solicito el caso. La solicitud y la recepcion son RPC diferentes:
   `ra_solicitar_devolucion_v1` crea el caso y la nueva
   `ra_registrar_recepcion_devolucion_v1` registra la llegada fisica. La UI
   puede encadenarlas en una atencion, pero nunca se pierde la identidad ni el
   momento de cada acto.
2. Evidencia obligatoria sin Storage en fase 1: `recibido`,
   `condicion_declarada` (`apto_reventa`, `dañado`, `incompleto`,
   `no_recibido`), usuario y fecha. `observacion` es obligatoria salvo para
   `apto_reventa`. No se capturan fotos en esta fase.
3. `reingresa_stock` deja de llegar desde la solicitud. La liquidacion lo
   deriva de la constancia: solo `apto_reventa` mas aprobacion administrativa
   vuelve a stock vendible y produce kardex de entrada. `dañado` e `incompleto`
   no suman stock vendible y quedan auditados; `no_recibido` bloquea la
   liquidacion. El administrador puede optar por el resultado mas conservador
   (no reingreso). Un override hacia reingreso exige `override_motivo` y queda
   auditado.
4. La prueba manual OSE se realiza solo con tenant TEST. Debe emitir boleta y
   factura de prueba, emitir NC vinculadas, verificar `EMITIDA` /
   `sunatAceptada=true`, comprobar replay con la misma `Idempotency-Key` y 409
   con payload distinto. No autoriza emisiones de prueba en produccion.
5. Sin cron en Vercel, la bandeja manual de NC debe presentar y filtrar
   `pending`, `retry`, `dead_letter` y conciliacion requerida. Un administrador
   autorizado sera responsable de revisarla y de reintentar solo estados
   seguros.

### Fase 2: cambio de producto

La solicitud distingue `devolucion`, `cambio_inmediato` y `cambio_diferido`.

- Fase 1 implementa solo `devolucion`.
- `cambio_inmediato` es la capacidad futura `cambio-producto-atomico`: la
  devolucion recibida y la venta nueva son inseparables en una transaccion. Si
  falla el stock, caja, cobro o venta de reemplazo, no queda liquidada la
  devolucion ni entregado el reemplazo.
- `cambio_diferido` es una devolucion normal seguida de una venta comun en otro
  momento; se conserva un vinculo blando para reporte, sin nueva RPC compuesta.

### Fase 3: garantia v1

1. Politica configurable: `ra_garantia_politica.plazo_dias = 30`, editable por
   `superadmin` y aplicable inicialmente a todos los productos. Fase posterior
   puede introducir `categoria_id` sin alterar el flujo.
2. Abrir reclamo exige comprobante original, correspondencia con el catalogo
   vendido (y serie/lote si existe) y estar dentro de 30 dias. Fuera de plazo,
   sin comprobante, pieza no identificable/no correspondiente, dano evidente
   por mal uso o desgaste normal implica rechazo directo.
3. El vendedor recibe la pieza y abre el expediente; el administrador solo
   aprueba documentalmente; el proveedor mediante RMA dicta el aspecto tecnico.
   Allende no realiza peritaje tecnico en v1.
4. La pieza entra en estado de inventario `en_garantia`, fuera del stock
   vendible y no transferible. No vuelve a disponibilidad por defecto.
5. Estados: `abierta -> en_revision -> aprobada|rechazada`; una aprobada pasa
   por `enviada_proveedor -> resuelta`. El resultado incluye
   `repuesta_proveedor`, `nc_proveedor`, `rechazada_proveedor`,
   `resuelta_stock`, `nc_cliente` o `devolucion_cliente`.
6. Se registra el RMA (fecha de envio, referencia/guia, fecha de respuesta y
   resultado), sin integracion automatica con proveedores. Reposicion del
   proveedor entrega pieza al cliente sin NC ni caja; NC/devolucion al cliente
   reutiliza el motor de devoluciones; una NC del proveedor pertenece a CxP y
   no modifica la cuenta del cliente.

### Fase 3: baja/anulacion fiscal

El proveedor OSE es `w3sicad.cloud/osesunat`, servicio Spring Boot en VPS. La
verificacion local de su contrato confirma:

- `POST /api/v1/comprobantes` admite `NOTA_CREDITO`, con idempotencia por
  `Idempotency-Key` e identidad fiscal. El adaptador actual de Allende ya
  transforma el payload almacenado a `notaCredito.comprobanteReferenciadoId`,
  `tipoDocReferenciado`, motivo y descripcion requeridos por el OSE.
- `POST /api/v1/comprobantes/{id}/anular` solo cambia estado local: queda
  prohibido usarlo como baja fiscal.
- La baja de factura usa `POST /api/v1/resumenes/bajas`, la de boleta el
  resumen diario `POST /api/v1/resumenes/boletas`, y la reversion usa
  `POST /api/v1/resumenes/reversion`; el estado se consulta en
  `GET /api/v1/resumenes/{id}`.
- Los endpoints de resumenes todavia no tienen contrato idempotente. Antes de
  produccion se debe incorporar en OSE reserva, hash canonico, replay y
  conflicto; la futura `ra_solicitud_baja_fiscal` mantendra tambien identidad,
  hash y estados propios.
- `RESULTADO_INCIERTO` se modelara como `reconciliation_required`, nunca como
  `retry`; requiere conciliacion humana antes de cualquier reenvio.

Los motivos de NC en fase 1 se mantienen restringidos a `06` (devolucion total)
y `07` (devolucion por item), tal como el tipo actual de Allende. Los motivos
`01` (anulacion de operacion) y `03` (correccion de descripcion) pertenecen a
la capacidad futura de baja/anulacion fiscal: cuando se implemente, se ampliara
el contrato tipado, la validacion OSE y las pruebas en un cambio separado.

La baja fiscal futura sera una solicitud durable con documento afectado,
causal, usuario, payload, clave idempotente, estado y acuse. Nunca cambiara
`ra_ventas.estado` para aparentar una anulacion fiscal. Antes de migrarla se
ejecutara una prueba manual TEST de baja y consulta de acuse.

## Criterio de salida de exploracion

Esta exploracion queda lista para propuestas separadas. La primera debe ser
`operacion-devoluciones-postventa`, porque vuelve utilizable y verificable el
nucleo ya aplicado sin ampliar prematuramente cambio, garantia o baja fiscal.
