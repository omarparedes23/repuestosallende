# Preflight remoto read-only — reversos comerciales y fiscales

Fecha: 2026-09-01. Alcance: Supabase TEST, solo metadatos y contratos; no se
leyeron datos personales ni se ejecutaron escrituras.

## Hallazgos

| Área | Evidencia remota | Consecuencia de diseño |
| --- | --- | --- |
| Nota de crédito | No existe ninguna tabla `public.ra_*nota_credito*`. | El agregado, su libro y su outbox deben ser aditivos. |
| Outbox de venta | `ra_sunat_outbox` tiene `UNIQUE(venta_id)` y `tipo_comprobante` de venta; sus estados son `pending`, `processing`, `retry`, `submitted`, `accepted`, `rejected`, `dead_letter`. | No se puede ni debe reutilizar para NC; habrá outbox exclusiva. |
| Series actuales | `ra_empresas` contiene `serie_ticket`, `serie_boleta` y `serie_factura`; no hay series NC. | La migración añade configuración explícita de serie NC por empresa, inicialmente sin asumir valores productivos. |
| Series existentes | `ra_series_documento` ya tiene empresa, sucursal, tipo, serie, `siguiente_correlativo`, fila predeterminada e índices únicos; hoy el tipo está limitado a guías. | NC amplía esa misma tabla con dos tipos y consume/incrementa su correlativo bajo `FOR UPDATE`; no crea una tabla paralela. |
| Worker actual | `ra_claim_sunat_outbox` y `ra_finish_sunat_outbox` tienen `search_path=public, extensions` y ejecución para `service_role`, no para `authenticated`. | El worker NC preservará el mismo aislamiento; navegador no accede a la outbox. |
| Venta | `ra_ventas` mantiene empresa, sucursal, moneda, tipo de cambio, documento y estado SUNAT. | La liquidación puede validar sucursal emisora, moneda y gate fiscal desde datos autoritativos. |

## Decisiones confirmadas

- La NC seguirá el patrón de numeración actual, no un contador nuevo. Por
  decisión posterior del propietario, TEST configura series por sucursal:
  Principal `FC001`/`BC001` y Arriola `FC005`/`BC005`, desde 1.
- Vendedor solicita; el administrador/superadmin realiza aprobación, recepción
  física y liquidación como un único acto atómico.
- La primera versión no impone fecha límite automática: audita antigüedad y
  motivo para decisión administrativa.

## Antes de aplicar en un entorno real

1. Configurar y confirmar las series de nota de crédito de factura y boleta
   para la empresa emisora.
2. Validar con contabilidad los motivos y plazos fiscales que habilitan una NC
   para devolución parcial/total.
3. Aplicar solo la migración nueva, forward-only, después de ejecutar las
   suites de schema, concurrencia, RLS y rollback en TEST aislado.
