# Venta Transaccional e Idempotente Specification

## Purpose

El POS confirma cada intento lógico de venta como máximo una vez. Venta, detalle, pagos, caja, crédito, stock, kardex y outbox fiscal aplicable se confirman o revierten juntos en PostgreSQL. Los reintentos recuperan el resultado original, el stock se descuenta de forma segura bajo concurrencia y SUNAT/OSE se procesa mediante una cola durable e idempotente.

## Definitions

- **Intento lógico**: acción del cajero de confirmar una venta concreta, identificada por un `operation_id` UUID estable.
- **Mismo payload**: intención materialmente equivalente después de aplicar una representación canónica definida por el diseño.
- **Conflicto de idempotencia**: reutilización de un `operation_id` con un payload materialmente diferente.
- **Núcleo de venta**: cabecera, ítems, pagos, caja, crédito, stock, kardex y outbox fiscal aplicable.
- **Resultado recuperable**: respuesta persistida o reconstruible que identifica la venta confirmada y permite continuar con la pantalla de éxito/impresión.
- **Fallo definitivo de venta**: rechazo validado antes del commit, por ejemplo falta de permisos, caja cerrada, producto inválido, pago insuficiente o stock insuficiente.
- **Fallo fiscal temporal**: error de red, timeout o indisponibilidad que admite reintento.
- **Fallo fiscal definitivo**: rechazo del documento que requiere intervención o corrección y no se reintenta automáticamente con el mismo contenido.

## Requirements

### Requirement: Identidad estable del intento de venta

El sistema MUST exigir un `operation_id` UUID por cada intento lógico. El POS MUST generarlo antes del primer envío y MUST reutilizarlo en todos los reintentos de esa misma intención. El POS MUST NOT generar otra clave solo porque hubo timeout, recarga o respuesta indeterminada.

#### Scenario: Primer envío de una venta

- GIVEN un carrito listo para cobrar sin intento pendiente
- WHEN el cajero confirma la venta
- THEN el POS genera un `operation_id` UUID antes de invocar el servidor
- AND envía ese mismo identificador con el payload

#### Scenario: Reintento después de timeout

- GIVEN una venta enviada con `operation_id = A`
- AND el POS no sabe si el servidor confirmó la transacción
- WHEN el cajero reintenta o la aplicación recupera el intento
- THEN se vuelve a consultar/enviar usando `operation_id = A`
- AND MUST NOT generarse una nueva clave para esa intención

#### Scenario: Venta nueva después de resultado definitivo

- GIVEN el intento anterior terminó con éxito o fallo definitivo
- WHEN el cajero inicia una venta materialmente nueva
- THEN el POS genera un `operation_id` diferente

### Requirement: Persistencia cliente del intento pendiente

El POS MUST conservar de forma durable en el dispositivo el `operation_id` y la información mínima necesaria para recuperar el resultado mientras el estado sea indeterminado. MUST eliminar o cerrar el intento pendiente únicamente después de obtener éxito confirmado o fallo definitivo. La persistencia MUST estar acotada al usuario/contexto activo y MUST NOT contener secretos.

#### Scenario: Recarga con respuesta indeterminada

- GIVEN un intento enviado cuyo resultado no fue recibido
- WHEN la página se recarga
- THEN el POS recupera el `operation_id` pendiente
- AND consulta el resultado antes de permitir confirmar esa intención con otra clave

#### Scenario: Cambio de usuario

- GIVEN existe un intento pendiente asociado a otro usuario o contexto
- WHEN inicia sesión un usuario diferente
- THEN el POS MUST NOT atribuirle ni reenviar automáticamente ese intento

### Requirement: Semántica de idempotencia

El sistema MUST garantizar unicidad del intento dentro del tenant y MUST asociar el `operation_id` con una huella canónica del payload. Repetir la misma clave y el mismo payload MUST devolver la misma venta y MUST NOT repetir efectos. Repetir la misma clave con un payload diferente MUST devolver un conflicto determinista y MUST NOT alterar datos.

#### Scenario: Reintento secuencial idéntico

- GIVEN `operation_id = A` ya confirmó la venta `V`
- WHEN llega nuevamente `operation_id = A` con el mismo payload
- THEN el sistema devuelve el resultado de `V`
- AND no inserta otra venta, pago, caja, cargo, kardex ni outbox
- AND no vuelve a descontar stock

#### Scenario: Reintentos concurrentes idénticos

- GIVEN dos solicitudes concurrentes con el mismo `operation_id` y payload
- WHEN ambas intentan confirmar
- THEN se crea exactamente una venta
- AND ambas obtienen esa venta o una respuesta recuperable equivalente

#### Scenario: Misma clave con intención diferente

- GIVEN `operation_id = A` está asociado a un payload
- WHEN se recibe `operation_id = A` con distinto producto, cantidad, descuento, cliente, comprobante, moneda, tipo de cambio, pago o vencimiento
- THEN el sistema devuelve conflicto de idempotencia
- AND no modifica ningún efecto de la operación original

### Requirement: Resultado recuperable

El sistema MUST permitir consultar el resultado de un intento autorizado mediante `operation_id`. La respuesta MUST distinguir al menos entre confirmado, no encontrado/seguro de reintentar, en curso si el diseño materializa ese estado y conflicto/fallo definitivo. Un usuario MUST NOT recuperar operaciones de otra empresa o usuario sin autorización administrativa explícita.

#### Scenario: Commit exitoso con respuesta perdida

- GIVEN la venta fue confirmada en PostgreSQL
- AND la respuesta al POS se perdió
- WHEN el POS consulta el mismo `operation_id`
- THEN recibe el identificador y resultado de la venta confirmada
- AND puede continuar a éxito/impresión sin volver a cobrar

#### Scenario: Operación inexistente

- GIVEN no existe registro para `operation_id = A` dentro del contexto autorizado
- WHEN el POS consulta su resultado
- THEN recibe una respuesta inequívoca de no encontrado
- AND puede reenviar el payload con la misma clave

### Requirement: Transacción única del núcleo de venta

El sistema MUST confirmar el núcleo completo dentro de una sola transacción PostgreSQL. Cualquier excepción antes del commit MUST revertir todos los efectos de esa invocación. La aplicación Next.js MUST NOT reconstruir la atomicidad mediante varias escrituras ni usar `Promise.all()` como sustituto de una transacción.

#### Scenario: Venta exitosa

- GIVEN usuario, caja, cliente, productos, pagos y stock válidos
- WHEN se confirma la venta
- THEN existen cabecera, todos los ítems, todos los pagos y movimientos de caja aplicables
- AND existen cargo de crédito, descuentos de stock, kardex y outbox aplicables
- AND todos pertenecen a la misma venta confirmada

#### Scenario: Fallo inducido después de crear la cabecera

- GIVEN una prueba fuerza un error después de insertar `ra_ventas`
- WHEN la transacción termina
- THEN no existe la cabecera
- AND no existe ningún ítem, pago, movimiento de caja, cargo, kardex ni outbox de ese intento
- AND el stock y saldo del cliente permanecen sin cambios

#### Scenario: Fallo en el último ítem

- GIVEN una venta con varios productos
- AND el procesamiento del último ítem falla
- WHEN PostgreSQL revierte la transacción
- THEN ninguno de los productos queda descontado
- AND no queda kardex parcial ni venta parcial

### Requirement: Autoridad server-side del contexto

El sistema MUST obtener el usuario desde `auth.uid()` y MUST derivar/validar perfil, empresa, sucursal, rol y caja desde la base. MUST NOT confiar en `empresa_id`, `usuario_id`, precio, subtotal, IGV, total, stock o saldo enviados por el cliente. El rol `lectura` MUST NOT confirmar ventas.

#### Scenario: Usuario de solo lectura

- GIVEN un usuario autenticado con rol `lectura`
- WHEN invoca la confirmación
- THEN la operación se rechaza
- AND no crea efectos

#### Scenario: Contexto de otra empresa

- GIVEN un usuario de la empresa A
- WHEN intenta vender un cliente o producto de la empresa B
- THEN la operación se rechaza sin revelar información sensible
- AND no crea efectos

#### Scenario: Sucursal o caja no autorizada

- GIVEN una caja cerrada, ajena o de otra sucursal
- WHEN el usuario intenta confirmar
- THEN la operación se rechaza
- AND no se usa otra caja como fallback silencioso

### Requirement: Caja abierta válida

Toda venta MUST asociarse a la caja abierta autorizada para la sucursal y usuario según la regla vigente. La caja MUST volver a validarse dentro de la transacción; una validación previa en Next.js no es suficiente.

#### Scenario: Caja se cierra antes del commit

- GIVEN el POS mostró una caja abierta
- AND la caja fue cerrada antes de confirmar la transacción
- WHEN se procesa la venta
- THEN se rechaza como caja no disponible
- AND no se registra ningún efecto

### Requirement: Validación server-side de productos y precios

Cada producto MUST existir, estar activo, pertenecer a la empresa y sucursal autorizadas y corresponder al catálogo esperado. La base MUST seleccionar el precio vigente según la moneda de la venta. Un identificador de catálogo o precio enviado por el cliente MUST NOT sustituir esa fuente.

#### Scenario: Precio alterado en el navegador

- GIVEN el navegador muestra o envía un precio distinto al vigente
- WHEN se confirma la venta
- THEN la base calcula usando el precio vigente autorizado
- AND la respuesta refleja los importes efectivamente confirmados

#### Scenario: Producto duplicado en el payload

- GIVEN el payload contiene el mismo producto en más de una línea
- WHEN se valida la intención
- THEN el sistema aplica una regla canónica determinista definida en diseño, ya sea consolidar o rechazar
- AND MUST NOT descontar el producto de forma ambigua

#### Scenario: Producto USD sin precio USD

- GIVEN una venta USD contiene un producto sin `precio_venta_dolar`
- WHEN se confirma
- THEN la operación se rechaza completamente

### Requirement: Cálculo monetario normativo

La base MUST recalcular precio unitario, subtotal de línea, subtotal, IGV y total con aritmética decimal PostgreSQL `numeric`, respetando el contrato de venta multimoneda. PEN MUST usar `precio_venta`; USD MUST usar `precio_venta_dolar` sin conversión del precio por tipo de cambio. Los importes persistidos MUST ser los calculados por la base.

El descuento por línea MUST ser mayor o igual a cero y MUST NOT exceder el importe bruto de la línea. Hasta que exista una política granular, este cambio MUST NOT introducir límites adicionales por rol.

#### Scenario: Descuento vuelve negativa la línea

- GIVEN precio por cantidad de 100.00
- AND descuento solicitado de 100.01
- WHEN se confirma
- THEN la venta se rechaza completamente

#### Scenario: Divergencia de total cliente-servidor

- GIVEN el cliente calcula un total diferente por manipulación o versión antigua
- WHEN se confirma la venta
- THEN el valor autoritativo es el recalculado por PostgreSQL
- AND los pagos se validan contra ese valor

#### Scenario: Venta USD válida

- GIVEN productos con precio USD y tipo de cambio positivo
- WHEN se confirma una venta USD
- THEN los ítems usan `precio_venta_dolar`
- AND `ra_ventas.moneda = 'USD'`
- AND se congela el tipo de cambio informado y validado

### Requirement: Validación de pagos

La venta MUST contener al menos un pago positivo. La suma decimal de pagos MUST cubrir el total conforme a la tolerancia monetaria documentada. Todo pago no crediticio MUST generar exactamente un movimiento de caja del mismo importe, método y referencia. El método `credito` MUST NOT generar ingreso de caja.

#### Scenario: Pago insuficiente

- GIVEN total autoritativo de 100.00
- AND pagos por 99.98
- WHEN se confirma
- THEN la venta se rechaza completamente según la tolerancia definida

#### Scenario: Pagos divididos

- GIVEN pagos válidos en efectivo y Yape
- WHEN la venta se confirma
- THEN se persisten ambas líneas de pago
- AND se crea un movimiento de caja por cada línea no crediticia

#### Scenario: Pago a crédito

- GIVEN una línea `credito`
- WHEN la venta se confirma
- THEN se persiste la línea de pago
- AND no se crea movimiento de ingreso de caja para esa línea

### Requirement: Crédito atómico

Una venta con pago a crédito MUST tener cliente asociado, crédito habilitado y fecha de vencimiento. El cargo MUST derivarse de la suma de pagos `credito`, MUST crearse exactamente una vez y MUST actualizar el saldo del cliente dentro de la misma transacción.

Por compatibilidad con el comportamiento vigente, exceder el límite de crédito MUST NOT revertir automáticamente la venta; el resultado MUST informar `limite_excedido` y el nuevo saldo. Esta regla queda sujeta a confirmación antes de cerrar el diseño.

#### Scenario: Crédito sin cliente

- GIVEN una venta contiene pago `credito` sin cliente
- WHEN se confirma
- THEN la venta se rechaza completamente

#### Scenario: Cliente sin crédito habilitado

- GIVEN una venta contiene pago `credito`
- AND el cliente no tiene crédito habilitado
- WHEN se confirma
- THEN la venta se rechaza completamente

#### Scenario: Límite excedido bajo supuesto de compatibilidad

- GIVEN el cargo deja el saldo por encima del límite
- WHEN la venta se confirma
- THEN venta y cargo se confirman una sola vez
- AND el resultado incluye `limite_excedido = true`

#### Scenario: Reintento de venta a crédito

- GIVEN una venta a crédito ya fue confirmada
- WHEN se reintenta con el mismo `operation_id`
- THEN no se crea un segundo cargo
- AND el saldo del cliente no vuelve a incrementarse

### Requirement: Descuento concurrente y seguro de stock

La base MUST validar y descontar stock dentro de la transacción usando bloqueo de filas o actualización condicional atómica. Los productos MUST procesarse en un orden determinista para reducir deadlocks. Ninguna concurrencia aceptada MUST producir stock negativo ni actualización perdida.

#### Scenario: Dos ventas compiten por stock suficiente

- GIVEN stock inicial 10
- AND dos ventas concurrentes solicitan 3 unidades cada una
- WHEN ambas confirman
- THEN ambas pueden tener éxito
- AND stock final es 4
- AND existen dos kardex consecutivos y coherentes

#### Scenario: Dos ventas compiten por stock insuficiente

- GIVEN stock inicial 5
- AND dos ventas concurrentes solicitan 4 unidades cada una
- WHEN ambas compiten
- THEN exactamente una venta confirma
- AND la otra falla por stock insuficiente
- AND stock final es 1

#### Scenario: Reintento no descuenta dos veces

- GIVEN una venta ya descontó 2 unidades
- WHEN se reintenta con el mismo `operation_id`
- THEN el stock permanece igual al resultado del primer commit

### Requirement: Kardex coherente y único por efecto

Cada línea de producto confirmada MUST generar exactamente un movimiento de kardex de tipo `salida`, motivo `venta`, con cantidad y stock anterior/nuevo correspondientes al descuento efectivo. Stock y kardex MUST confirmarse o revertirse juntos.

#### Scenario: Secuencia de kardex

- GIVEN stock bloqueado de 8 y cantidad vendida 3
- WHEN la venta confirma
- THEN el producto queda con stock 5
- AND el kardex registra `stock_anterior = 8`, `stock_nuevo = 5`, `cantidad = 3`
- AND referencia la venta y usuario correctos

#### Scenario: Error al insertar kardex

- GIVEN el descuento de stock se ejecutó dentro de la transacción
- AND falla la inserción de kardex
- WHEN la transacción revierte
- THEN el stock vuelve a su valor anterior
- AND la venta no queda confirmada

### Requirement: Serie y correlativo únicos

La serie y el correlativo MUST asignarse dentro de la misma transacción que inserta la venta. La base MUST imponer unicidad para `(empresa_id, serie, correlativo)` cuando los valores existan. Solicitudes concurrentes MUST NOT producir duplicados. La especificación MUST NOT exigir ausencia absoluta de huecos.

#### Scenario: Dos comprobantes concurrentes de la misma serie

- GIVEN dos ventas concurrentes de la misma empresa y serie
- WHEN ambas confirman
- THEN reciben correlativos distintos
- AND ambas cumplen la restricción única

#### Scenario: Venta revierte después de reservar número

- GIVEN una venta obtiene o calcula un correlativo
- AND luego revierte por un error
- THEN no queda una venta parcial
- AND un eventual hueco no se considera violación

### Requirement: Outbox fiscal atómica

Toda boleta o factura confirmada MUST crear exactamente un trabajo de outbox dentro de la misma transacción. Un ticket MUST NOT crear trabajo fiscal. La outbox MUST tener identidad única por documento/venta y MUST contener información suficiente para construir o reproducir de forma estable la solicitud fiscal sin depender del estado mutable del carrito.

#### Scenario: Boleta confirmada

- GIVEN una venta válida con tipo `boleta`
- WHEN confirma
- THEN existe exactamente una venta y exactamente un trabajo fiscal asociado

#### Scenario: Ticket confirmado

- GIVEN una venta válida con tipo `ticket`
- WHEN confirma
- THEN la venta se confirma
- AND no se crea trabajo fiscal

#### Scenario: No se puede insertar la outbox

- GIVEN una boleta válida
- AND falla la inserción del trabajo fiscal
- WHEN termina la transacción
- THEN la venta completa revierte

### Requirement: Procesamiento durable y reintentable de outbox

El consumidor MUST reclamar trabajos de forma atómica para impedir procesamiento concurrente no coordinado. MUST registrar estado, número de intentos, próxima fecha de intento, timestamps y último error permitido. Un fallo temporal MUST conservar el trabajo y programar reintento con backoff acotado. Un fallo definitivo MUST quedar visible para intervención y MUST NOT perderse.

#### Scenario: OSE temporalmente no disponible

- GIVEN un trabajo pendiente
- WHEN el OSE devuelve timeout o error temporal
- THEN aumenta el contador de intentos
- AND se registra el error sanitizado
- AND se programa `next_attempt_at`
- AND la venta comercial permanece confirmada

#### Scenario: Rechazo fiscal definitivo

- GIVEN el OSE rechaza definitivamente el documento
- WHEN el consumidor registra la respuesta
- THEN la outbox queda en estado terminal de error/rechazo
- AND la venta queda trazable como error fiscal
- AND no se elimina el trabajo ni su evidencia

#### Scenario: Worker termina durante el procesamiento

- GIVEN un trabajo fue reclamado y el consumidor termina sin finalizarlo
- WHEN vence el mecanismo de reclamación definido
- THEN el trabajo vuelve a ser elegible para recuperación/reintento

### Requirement: Idempotencia fiscal

El consumidor MUST usar una identidad externa estable por documento lógico y MUST enviarla al OSE como `Idempotency-Key`. También MUST conservar la identidad fiscal natural `(tenant, tipo, serie, correlativo)` en todos los intentos. Una respuesta perdida MUST NOT provocar intencionalmente un segundo documento fiscal. Ante `RESULTADO_INCIERTO` o una respuesta de red indeterminada, el consumidor MUST consultar el OSE por identidad fiscal antes de decidir cualquier nuevo envío y MUST NOT reenviar automáticamente mientras la incertidumbre permanezca.

#### Scenario: OSE aceptó pero se perdió la respuesta

- GIVEN el OSE procesó el documento
- AND el consumidor no recibió la respuesta
- WHEN se recupera el trabajo
- THEN reutiliza la misma identidad externa
- AND consulta o reintenta de manera idempotente según el contrato del proveedor
- AND no crea voluntariamente otro documento lógico

#### Scenario: Dos consumidores compiten

- GIVEN dos consumidores intentan reclamar el mismo trabajo
- WHEN ejecutan la reclamación
- THEN como máximo uno obtiene permiso vigente para procesarlo

### Requirement: Resultado compatible con POS e impresión

La confirmación y recuperación MUST devolver un contrato estable con al menos identificador de venta, total, tipo de comprobante, moneda, serie, correlativo, número completo, datos de empresa/sucursal necesarios y advertencias comerciales aplicables. Un reintento exitoso MUST producir una respuesta funcionalmente equivalente a la original.

#### Scenario: Recuperación permite imprimir

- GIVEN un ticket fue confirmado pero su respuesta se perdió
- WHEN el POS recupera el resultado por `operation_id`
- THEN recibe los datos necesarios para mostrar éxito e imprimir
- AND no necesita crear otra venta

### Requirement: Seguridad de funciones y RLS

Las funciones sensibles MUST ejecutarse con permisos mínimos. Toda función `SECURITY DEFINER` MUST fijar `search_path`, validar `auth.uid()`, pertenencia y rol, y MUST NOT confiar en identificadores de tenant aportados como autoridad por el cliente. Las tablas nuevas MUST tener RLS habilitada y no deberán permitir mutación directa amplia por usuarios autenticados.

#### Scenario: Ejecución anónima

- GIVEN una sesión no autenticada
- WHEN intenta confirmar o consultar una operación
- THEN el acceso se rechaza

#### Scenario: Lectura cruzada de outbox

- GIVEN un usuario normal autenticado
- WHEN intenta leer trabajos fiscales de otra empresa
- THEN RLS o la función controlada rechaza el acceso

### Requirement: Observabilidad y datos sensibles

El sistema MUST registrar identificadores técnicos, estados, intentos y errores sanitizados suficientes para investigar una operación. MUST NOT registrar tokens, service-role keys, secretos del OSE ni payloads con datos personales innecesarios. Los mensajes al cajero MUST distinguir error definitivo de resultado indeterminado/reintentable.

#### Scenario: Error transitorio al confirmar

- GIVEN el POS recibe timeout sin saber si hubo commit
- WHEN muestra el resultado
- THEN no afirma que la venta falló definitivamente
- AND ofrece/ejecuta recuperación usando el mismo `operation_id`

#### Scenario: Error fiscal registrado

- GIVEN un intento OSE falla
- WHEN se persiste el diagnóstico
- THEN quedan código, categoría, timestamps e intento suficientes para soporte
- AND no quedan credenciales en logs ni outbox

### Requirement: Compatibilidad y despliegue seguro

La migración MUST ser aditiva e idempotente y MUST estar precedida por un preflight contra el esquema real. El despliegue MUST permitir que la base nueva exista antes de activar el código nuevo. Un rollback operativo MUST conservar ventas confirmadas y trabajos outbox pendientes.

#### Scenario: Esquema remoto difiere del local

- GIVEN el índice o función esperado ya existe con definición distinta o no existe remotamente
- WHEN se ejecuta el preflight
- THEN la diferencia se reporta antes de mutar producción
- AND la migración se adapta o se detiene de forma segura

#### Scenario: Rollback de aplicación con outbox pendiente

- GIVEN existen ventas nuevas y trabajos fiscales pendientes
- WHEN se revierte la aplicación
- THEN no se eliminan columnas, restricciones ni trabajos pendientes
- AND los datos siguen disponibles para recuperación

### Requirement: Verificación automatizada crítica

El cambio MUST incluir pruebas reproducibles de contrato monetario, rollback, autorización, idempotencia secuencial/concurrente, stock concurrente, correlativos y ciclo de outbox. Las pruebas de integración MUST ejecutarse en un entorno aislado y MUST NOT escribir en el SQL Server histórico ni usar producción como banco de pruebas.

#### Scenario: Suite de concurrencia

- GIVEN una base aislada con stock conocido
- WHEN la suite lanza solicitudes paralelas controladas
- THEN verifica conteos, stock, kardex, ventas y errores esperados
- AND puede repetirse sin depender de datos personales reales

#### Scenario: Suite de rollback

- GIVEN puntos de fallo inducibles dentro del flujo de prueba
- WHEN falla cada etapa crítica
- THEN la suite demuestra ausencia de efectos parciales

## Provisional Business Decisions

- Exceder el límite de crédito registra la venta y devuelve advertencia; no bloquea. Debe confirmarse antes de cerrar `design.md`.
- Sin matriz nueva de aprobación de descuentos en este cambio. Se exige como mínimo `0 <= descuento <= precio * cantidad`.
- El ejecutor concreto de outbox se decide en `design.md`; esta especificación exige su comportamiento durable, concurrente e idempotente independientemente de la plataforma elegida.

## Out of Scope

Contabilidad, devoluciones, notas de crédito, anulaciones, reservas, inventario físico, compras/cuentas por pagar, liquidación de caja, reparación automática de históricos, matriz granular de descuentos, sustitución del proveedor OSE y garantía de correlativos sin huecos.
