# Exploración — seguridad RPC multitenant

Fecha: 2026-08-30
Estado: exploración de solo lectura; no se aplicaron cambios remotos

## Objetivo de la exploración

Determinar el alcance necesario para que ninguna función RPC mutable pueda
escalar privilegios, operar sobre otra empresa o quedar expuesta por los
permisos por defecto de PostgreSQL.

## Evidencia actual

La revisión read-only del Supabase remoto confirmó que varias funciones
`SECURITY DEFINER` conservan permisos más amplios que su intención funcional.
El advisor reportó 11 funciones `ra_*` ejecutables por `anon` y 20 ejecutables
por `authenticated`.

No todo aviso implica por sí solo una vulnerabilidad: algunas funciones de
consulta pública, como el buscador del chatbot, pueden estar expuestas de forma
intencional. El problema crítico son las funciones mutables o sensibles.

### Hallazgos críticos confirmados

| Función | ACL remota observada | Validación interna observada | Riesgo |
|---|---|---|---|
| `ra_confirmar_orden_compra` | `PUBLIC`, `anon`, `authenticated`, `service_role` | Sin `auth.uid()`, empresa ni rol | Mutación anónima por UUID conocido |
| `ra_anular_orden_compra` | `PUBLIC`, `anon`, `authenticated`, `service_role` | Sin `auth.uid()`, empresa ni rol | Mutación anónima por UUID conocido |
| `ra_registrar_cobro` | `PUBLIC`, `anon`, `authenticated`, `service_role` | Usa `auth.uid()` solo como dato de auditoría; no valida empresa/rol | Usuario autenticado podría afectar otra empresa |
| `ra_recibir_guia` | `PUBLIC`, `anon`, `authenticated`, `service_role` | No deriva ni valida empresa/rol | Escalada entre empresas; el fallo de un `auth.uid()` nulo no sustituye autorización |
| `ra_registrar_cargo_credito` | `PUBLIC`, `anon`, `authenticated`, `service_role` | Sin validación completa de empresa/rol | Superficie legacy innecesaria tras la venta atómica |
| `ra_registrar_pago_proveedor` | `authenticated`, `service_role` | No valida empresa ni rol dentro de la RPC | Cualquier usuario autenticado podría intentar pagar una compra ajena |

Fuentes locales relacionadas:

- `supabase/migrations/009_guias.sql`
- `supabase/migrations/032_cuentas_corrientes.sql`
- `supabase/migrations/033_ordenes_compra.sql`
- `supabase/migrations/035_cuentas_por_pagar.sql`
- `supabase/migrations/038_venta_transaccional_idempotente.sql`
- `supabase/migrations/041_compra_cuenta_pagar_atomica.sql`

Las RPC modernas `ra_confirmar_venta` y `ra_confirmar_compra` ya muestran el
patrón que debe generalizarse: identidad desde `auth.uid()`, perfil activo,
empresa y rol derivados en base, `search_path` fijo, aislamiento cross-tenant y
grants explícitos.

## Causa estructural

PostgreSQL concede `EXECUTE` sobre funciones nuevas a `PUBLIC` salvo que se
revoque explícitamente. RLS no protege una función `SECURITY DEFINER` del mismo
modo que una consulta normal: la función debe aplicar sus propias invariantes de
autorización.

Los controles en Server Actions de Next.js mejoran la experiencia, pero no son
una frontera de seguridad porque PostgREST permite invocar una RPC directamente.

## Clasificación requerida

Cada función `ra_*` debe clasificarse en una matriz versionada:

1. Consulta pública intencional.
2. Consulta autenticada y aislada por empresa.
3. Mutación autenticada con rol explícito.
4. Operación exclusiva de `service_role`/worker.
5. Función trigger no invocable por clientes.
6. Legacy que debe revocarse o retirarse mediante migración forward-only.

## Riesgos de la corrección

- Revocar una firma que la aplicación todavía utiliza puede interrumpir un flujo.
- Corregir solo el grant, sin autorización interna, deja una defensa incompleta.
- Corregir solo la función, sin revocar `PUBLIC`, conserva superficie innecesaria.
- Cambiar funciones aplicadas in-place perdería trazabilidad; debe usarse una
  migración nueva, nunca editar migraciones 001–044 ya aplicadas.
- Los nombres sobrecargados exigen usar la firma exacta en `REVOKE`/`GRANT`.

## Preguntas resueltas

- La UI no se considera frontera de autorización.
- Las RPC mutables no serán públicas.
- `service_role` no se usará desde el navegador.
- Una consulta cross-tenant no debe revelar si el UUID existe.
- La reparación se probará con roles anónimo, lectura, vendedor,
  administrador, superadmin y usuario de otra empresa.

## Preguntas abiertas para diseño

- Confirmar qué consultas de catálogo/chatbot deben seguir disponibles para
  `anon` y cuáles deben migrar a funciones `SECURITY INVOKER`.
- Decidir si las RPC legacy de cargo/compra se mantienen revocadas por
  compatibilidad interna o se retiran en una fase posterior.
