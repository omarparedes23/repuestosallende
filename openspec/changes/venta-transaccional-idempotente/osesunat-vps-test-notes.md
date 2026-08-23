# Notas operativas: OSE-SUNAT en VPS de pruebas

Fecha: 2026-08-16

## Entorno

- Servicio systemd: `osesunat.service`.
- JAR: `/opt/osesunat/app.jar`.
- Configuración: `/etc/osesunat/app.env`.
- Puerto de pruebas: `8082`.
- Base utilizada para las pruebas: `osesunat`.
- Endpoint SOAP por defecto: ambiente beta de SUNAT.
- Health check: `http://127.0.0.1:8082/actuator/health`.

No guardar aquí API keys, contraseñas, claves Jasypt, credenciales SUNAT ni claves R2.

## Incidencia Flyway V7 y resolución

La base tenía la migración V7 (`comprobante idempotencia`) fallida. La causa era que había comprobantes duplicados para la misma identidad fiscal, por lo que los índices únicos no podían crearse.

Se verificó que no existían claves foráneas desde otras tablas hacia `comprobantes`. Como eran datos de prueba, se eliminaron únicamente las copias redundantes, conservando una fila emitida por cada identidad fiscal. Después se eliminó la fila fallida de V7 en `flyway_schema_history` para que Flyway volviera a ejecutar la migración al reiniciar.

Resultado:

- V1–V7 quedaron con `success=1`.
- El servicio inició correctamente.
- `/actuator/health` devolvió `{"status":"UP"}`.
- V7 creó los índices únicos de identidad fiscal e idempotency key.

## Procedimiento de recuperación

1. Detener el servicio antes de corregir datos:

   `systemctl stop osesunat`

2. Consultar duplicados por tenant, tipo, serie y correlativo.
3. Confirmar dependencias con `information_schema.KEY_COLUMN_USAGE`.
4. En una base de pruebas, conservar la fila emitida más completa y eliminar solo copias redundantes.
5. Comprobar que la consulta de duplicados devuelve `Empty set`.
6. Eliminar únicamente el registro `version=7, success=0` del historial si no hay Flyway CLI disponible.
7. Reiniciar y verificar:

   `systemctl restart osesunat`

   `systemctl status osesunat --no-pager`

   `curl -s http://127.0.0.1:8082/actuator/health`

8. Confirmar el ledger y los índices con MariaDB.

## Tenant y API key

La API key se almacena en `tenants.api_key`; no se configura en `app.env` y no existe endpoint de registro en esta versión. Consultarla únicamente en el VPS y no imprimirla ni compartirla:

```sql
SELECT api_key FROM tenants WHERE ruc='RUC_DE_PRUEBAS';
```

Para emitir realmente ante SUNAT beta, además de la API key deben estar configurados el certificado `.pfx`, su contraseña desencriptable y las credenciales SOL beta. El health check solo confirma que Spring está vivo; no valida una emisión fiscal.

## Seguridad

`app.env` debe tener permisos restrictivos (`chmod 600`). Si una clave fue expuesta en una conversación o terminal compartida, debe rotarse. Al rotar `JASYPT_ENCRYPTOR_PASSWORD`, primero hay que re-encriptar los valores almacenados que dependan de ella.

## Suites de pruebas

- E2E OSE opt-in: `e2e/ose.e2e.test.ts`.
- Configuración aislada: `vitest.e2e.config.ts`.
- Ejecución E2E: `RUN_OSE_E2E=1 npm run test:e2e:ose`.
- Suite normal: pruebas bajo `src/`, ejecutadas con `npm test`; no invoca el OSE real.

## Cierre de sesión 2026-08-16

Trabajo de hoy concluido: migraciones 038–040 verificadas, pruebas autenticadas de Supabase completadas, smoke test E2E contra OSE beta completado y documentación actualizada. Próxima sesión: continuar con los pendientes del roadmap y del `verify-report.md`.
