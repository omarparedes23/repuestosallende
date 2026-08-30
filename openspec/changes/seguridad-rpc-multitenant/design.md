# Diseño — seguridad RPC multitenant

## Enfoque técnico

Aplicar una migración forward-only que convierta el catálogo de RPC en una
superficie de denegación por defecto. El cambio comienza con un inventario del
esquema remoto real y clasifica cada firma antes de revocar permisos. Las
funciones mutables conservadas validarán identidad, perfil activo, empresa,
sucursal y capacidad dentro de PostgreSQL.

Este cambio se ejecuta antes de las nuevas RPC de tesorería. Las funciones de
cobro, pago, apertura, movimiento, cierre y revisión nacen cumpliendo el mismo
contrato y se verifican también desde este change.

## Restricciones verificadas

- Existen funciones `SECURITY DEFINER` mutables ejecutables por `anon` o
  `PUBLIC` en el esquema remoto observado.
- RLS no sustituye la autorización interna de una función `SECURITY DEFINER`.
- Server Actions no constituyen una frontera contra invocación RPC directa.
- Las firmas locales y el ledger remoto pueden divergir; el remoto es autoridad
  antes de asignar número o contenido definitivo a una migración.
- Las migraciones ya aplicadas no se editan.
- SQL Server histórico permanece estrictamente read-only y fuera de alcance.

## Decisiones de arquitectura

| Decisión | Opción elegida | Motivo |
|---|---|---|
| Política base | Denegar `PUBLIC`/`anon` en toda mutación | El permiso público de funciones nuevas no es seguro por defecto |
| Unidad de inventario | Firma exacta, no solo nombre | PostgreSQL permite sobrecargas con ACL independientes |
| Autoridad de identidad | `auth.uid()` + perfil activo en DB | Evita confiar en empresa, usuario o rol del cliente |
| Aislamiento | Comprobar pertenencia antes de lock/mutación | Evita efectos y filtraciones cross-tenant |
| Autorización | Capacidad/rol explícito por función | `authenticated` solo prueba sesión, no permiso funcional |
| Contexto SQL | `SECURITY DEFINER` con `search_path` fijo | Reduce secuestro de nombres y ejecución accidental |
| Errores | Códigos de dominio estables y mensajes sanitizados | No exponer UUID, SQL ni existencia de otra empresa |
| Legacy | Revocar primero; retirar después | Mantiene rollback forward-only y permite smoke tests |
| Verificación | Catálogo + REST + SQL autenticado + aplicación | Un único nivel de prueba no demuestra el control completo |

## Matriz de clasificación

El preflight producirá una fila por firma con:

```text
schema
nombre
argumentos_identidad
propietario
security_definer
search_path
volatilidad
ACL PUBLIC/anon/authenticated/service_role
tipo: publica | autenticada | mutable | worker | trigger | legacy
roles/capacidades permitidos
consumidores TypeScript/SQL
acción de migración
```

Reglas:

1. Consulta pública intencional: solo lectura, payload acotado y documentado.
2. Consulta autenticada: tenant derivado en DB y sin mutación.
3. Mutación: sin `PUBLIC`/`anon`, autorización interna obligatoria.
4. Worker: solo credencial de servidor y contrato explícito.
5. Trigger/helper interno: no ejecutable por roles cliente.
6. Legacy sin consumidor: revocado; eliminación física diferida.

## Patrón obligatorio de función mutable

Cada RPC mutable deberá:

1. Rechazar `auth.uid()` nulo con `RA_UNAUTHENTICATED`.
2. Resolver exactamente un perfil activo.
3. Derivar `empresa_id`, rol y sucursal autorizada desde tablas confiables.
4. Validar la capacidad antes de consultar el objetivo por UUID.
5. Consultar/bloquear siempre con predicado de empresa.
6. Devolver el mismo resultado externo para UUID inexistente o cross-tenant.
7. Usar objetos calificados y `SET search_path = public, extensions` cuando
   requiera `pgcrypto`; en otro caso el mínimo necesario.
8. Revocar la firma exacta a `PUBLIC` y `anon` y conceder solo el rol requerido.
9. No aceptar `empresa_id`, `usuario_id`, rol, saldo o totales del cliente como
   autoridad.
10. No incluir detalles internos en errores inesperados.

## Orden de migración

1. Preflight remoto read-only y matriz de consumidores.
2. Pruebas negativas que demuestren los grants o controles inseguros en TEST.
3. Crear/reemplazar las funciones conservadas dentro de una migración nueva.
4. Ejecutar `REVOKE`/`GRANT` por firma exacta después de cada definición.
5. Revocar funciones legacy no consumidas.
6. Verificar funciones nuevas de tesorería bajo la misma matriz.
7. Ejecutar smoke tests de todos los consumidores legítimos.
8. Repetir catálogo, advisors y ledger.

No se asignará número de migración hasta reconciliar el ledger remoto.

## Autorización inicial por dominio

| Dominio | Capacidad inicial |
|---|---|
| Confirmar/anular orden de compra | administrador/superadmin de la empresa |
| Recibir guía | administrador/superadmin; ampliar solo con decisión explícita |
| Cobrar cliente | administrador/superadmin |
| Pagar proveedor | administrador/superadmin |
| Abrir/cerrar/revisar caja | administrador/superadmin |
| Venta POS | vendedor o administrador dentro de sucursal autorizada |
| Chatbot/catálogo público | solo consultas específicamente aprobadas |

## Estrategia de pruebas

Por cada mutación crítica se ejecutará la matriz:

```text
anon                         → denegado, cero efectos
authenticated sin perfil    → denegado, cero efectos
lectura                      → denegado, cero efectos
vendedor sin capacidad      → denegado, cero efectos
rol autorizado misma empresa→ éxito esperado
rol autorizado otra empresa → not_found/forbidden sin fuga, cero efectos
service_role                → solo donde esté documentado
```

Las pruebas inspeccionarán tanto la respuesta como conteos/ledgers posteriores.

## Rollback y recuperación

El rollback no reabrirá permisos anónimos. Ante una regresión de consumidor se
publicará otra migración que restaure únicamente la firma autenticada necesaria,
con autorización interna intacta. Nunca se editará una migración aplicada ni se
usará `GRANT ... TO PUBLIC` como recuperación rápida.

## Dependencia con tesorería

Este change bloquea la promoción del change
`tesoreria-idempotente-cierre-atomico`. Las nuevas RPC pueden desarrollarse en
paralelo en archivos, pero no se consideran desplegables hasta que la matriz de
seguridad y sus pruebas negativas estén en verde.
