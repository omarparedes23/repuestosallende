-- 044_deprecar_ra_registrar_compra.sql
-- Change: compra-cuenta-por-pagar-atomica (Fase 4, tarea 4.4)
--
-- Forward-only. No elimina ni cambia permisos o comportamiento de la RPC
-- legacy: añade únicamente metadatos explícitos de deprecación para impedir
-- que nuevos consumidores adopten el flujo no atómico.
--
-- IMPORTANTE: migración local pendiente de revisión. No ha sido aplicada ni
-- registrada en el ledger remoto.

COMMENT ON FUNCTION public.ra_registrar_compra(
  uuid, uuid, uuid, text, text, jsonb, uuid, character, numeric
) IS 'DEPRECATED: flujo no atomico. No usar en codigo nuevo; consumir public.ra_confirmar_compra. Se conserva temporalmente solo por compatibilidad.';
