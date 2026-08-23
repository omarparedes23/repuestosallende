# Aplicacion de hardening 039

Archivo a ejecutar:

`supabase/migrations/039_venta_idempotencia_hardening.sql`

## Preflight de solo lectura

Ejecutar antes en el proyecto Supabase remoto de pruebas:

```sql
select count(*) as invalid_request_hashes
from public.ra_ventas
where request_hash is not null
  and request_hash !~ '^[0-9a-f]{64}$';

select to_regprocedure('public.ra_confirmar_venta(uuid,uuid,public.ra_tipo_comprobante,uuid,jsonb,jsonb,character,numeric,date)') as current_confirm;
select to_regclass('public.ra_sunat_outbox') as outbox_table;
```

El primer resultado debe ser `0`. Si no lo es, detenerse y revisar los valores antes de aplicar la restriccion.

## Aplicacion

Ejecutar el archivo completo una sola vez en el proyecto remoto de pruebas. No volver a ejecutar `001`-`038`; `038` ya fue aplicada manualmente y sus objetos existen. La migracion `039` es forward-only e idempotente respecto de columna, constraint, rename y funciones.

## Verificacion posterior

```sql
select column_name
from information_schema.columns
where table_schema='public' and table_name='ra_ventas'
  and column_name='credit_limit_exceeded';

select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid='public.ra_ventas'::regclass
  and conname='ra_ventas_request_hash_shape';

select p.proname, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in ('ra_confirmar_venta','ra_confirmar_venta_v1','ra_venta_resultado');
```

Luego ejecutar las pruebas autenticadas de replay y crédito. En una venta a crédito nueva, guardar el valor de `warnings.creditLimitExceeded`, cambiar el saldo del cliente en otra operación de prueba y consultar el mismo `operation_id`: el valor debe permanecer igual.

No habilitar scheduler ni OSE real durante esta verificacion.
