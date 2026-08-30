# Propuesta — seguridad RPC multitenant

## Problema

Existen funciones `SECURITY DEFINER` mutables con permisos amplios y sin una
validación uniforme de identidad, empresa y rol. Las comprobaciones en Next.js
no impiden invocaciones directas mediante PostgREST.

## Objetivo

Establecer mínimo privilegio verificable para todas las RPC `ra_*`, empezando
por las mutaciones de compras, guías, cobranzas y pagos.

## Alcance

1. Inventariar firmas, propietario, volatilidad, `search_path`, ACL y consumidores.
2. Clasificar cada función como pública, autenticada, privilegiada, worker,
   trigger o legacy.
3. Revocar `EXECUTE` de `PUBLIC` y `anon` en toda función sensible.
4. Conceder únicamente el rol mínimo necesario sobre la firma exacta.
5. Hacer que cada mutación derive `auth.uid()`, perfil activo, empresa y rol.
6. Validar pertenencia antes de bloquear o mutar registros.
7. Fijar `search_path` seguro y calificar objetos sensibles.
8. Sanitizar errores y evitar filtración de existencia cross-tenant.
9. Añadir pruebas autenticadas y por REST para ACL, roles y aislamiento.
10. Aplicar todo mediante migraciones forward-only nuevas.

## No alcance

- Rediseño visual del panel.
- Cambio de reglas económicas de ventas o compras ya transaccionales.
- Rotación de credenciales o cambios en SQL Server histórico.
- Retiro físico inmediato de todas las funciones legacy.
- Reparación de datos operativos.

## Criterios de éxito

- Ninguna RPC mutable sensible es ejecutable por `PUBLIC` o `anon`.
- Un usuario autenticado sin el rol requerido recibe un error estable y no
  produce efectos.
- Un usuario de otra empresa no puede leer, inferir, bloquear ni mutar el
  registro objetivo.
- Todas las funciones `SECURITY DEFINER` tienen `search_path` fijo.
- Las Server Actions siguen funcionando con los grants mínimos.
- Advisors, inspección de ACL, pruebas REST y pruebas SQL autenticadas coinciden.
- El ledger remoto registra la nueva migración después de ejecución exitosa.

## Rollout propuesto

1. Preflight read-only de consumidores y firmas.
2. Pruebas negativas que demuestren el fallo actual en TEST.
3. Migración forward-only con funciones y ACL corregidas.
4. Reejecución de pruebas por rol y empresa.
5. Smoke tests de órdenes, guías, cobros y pagos desde la aplicación.
6. Advisors y ledger final antes de promover.

