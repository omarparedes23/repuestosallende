# Especificación — seguridad RPC multitenant

## Requisito: denegación por defecto

Toda función mutable o sensible MUST revocar `EXECUTE` de `PUBLIC` y `anon`,
salvo una excepción pública explícitamente documentada que sea de solo lectura.

### Scenario: llamada anónima a mutación

- GIVEN una sesión anónima
- WHEN invoca confirmar/anular orden, recibir guía, registrar cobro o registrar pago
- THEN PostgreSQL rechaza la ejecución
- AND ninguna tabla cambia

## Requisito: identidad y tenant derivados en base

Toda RPC mutable `SECURITY DEFINER` MUST obtener `auth.uid()` y derivar perfil,
empresa y rol desde tablas confiables. MUST NOT aceptar `empresa_id` o
`usuario_id` del cliente como autoridad.

### Scenario: UUID de otra empresa

- GIVEN un usuario autenticado de la empresa A
- AND un identificador válido perteneciente a la empresa B
- WHEN intenta consultar o mutar mediante una RPC sensible
- THEN la operación no revela si el registro existe
- AND no bloquea ni modifica filas de la empresa B

## Requisito: autorización por capacidad

Cada mutación MUST comprobar en base el rol o capacidad requerida. La
comprobación de una Server Action MUST ser adicional y no sustitutiva.

### Scenario: rol lectura o vendedor sin capacidad

- GIVEN un perfil activo sin permiso administrativo para la operación
- WHEN invoca directamente la RPC
- THEN recibe un código de autorización estable
- AND no existen efectos parciales

## Requisito: contexto SQL seguro

Toda función `SECURITY DEFINER` MUST fijar un `search_path` seguro y usar firmas
exactas en grants. Funciones trigger MUST NOT ser invocables directamente por
roles de cliente.

### Scenario: verificación del catálogo de funciones

- WHEN se inspeccionan `pg_proc`, ACL y configuración de funciones
- THEN ninguna función sensible incumple grants, propietario o `search_path`

## Requisito: compatibilidad controlada

Las correcciones MUST ser forward-only y MUST identificar todos los consumidores
antes de revocar una firma legacy.

### Scenario: flujo legítimo después del hardening

- GIVEN un administrador autorizado de la empresa propietaria
- WHEN ejecuta órdenes, guías, cobros o pagos desde la aplicación
- THEN el flujo conserva su resultado funcional
- AND usa únicamente la firma autorizada

