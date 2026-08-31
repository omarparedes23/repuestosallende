# Diseño — numeración y series de guías

## Modelo propuesto

`ra_series_documento`:

```text
id uuid PK
empresa_id uuid NOT NULL
sucursal_id uuid NOT NULL
tipo_documento text NOT NULL          -- inicio: guia_remision
serie text NOT NULL
siguiente_correlativo integer NOT NULL CHECK (> 0)
activo boolean NOT NULL DEFAULT true
es_predeterminada boolean NOT NULL DEFAULT false
created_at / updated_at
```

Índices/restricciones:

```text
UNIQUE (empresa_id, sucursal_id, tipo_documento, serie)
UNIQUE (empresa_id, tipo_documento, serie)
UNIQUE (empresa_id, sucursal_id, tipo_documento)
  WHERE activo AND es_predeterminada
```

La segunda regla evita usar la misma serie de guía en dos sucursales, que
chocaría con la identidad de guía ya única por empresa/serie/correlativo.

## RPC

`ra_obtener_preview_serie_guia(p_sucursal_id uuid) RETURNS jsonb`:

- autenticada y autorizada por empresa;
- no incrementa ni reserva;
- devuelve serie, siguiente correlativo y `numero_preview`.

`ra_crear_guia` se recrea con firma sin serie/correlativo:

```text
ra_crear_guia(origen uuid, destino uuid, notas text, items jsonb) RETURNS jsonb
```

Después de validar usuario, sucursales e ítems, bloquea la serie predeterminada
de origen con `FOR UPDATE`, toma `siguiente_correlativo`, lo incrementa y crea
la guía con ese número. Todo rollback revierte el incremento.

Respuesta incluye serie, correlativo y número formateado definitivo.

## Aplicación

- El formulario pide preview al cargar/cambiar origen y muestra campos
  deshabilitados.
- `crearGuia` deja de aceptar serie/correlativo y usa la nueva firma RPC.
- La lista selecciona `COALESCE(fecha_emision, created_at)` como fecha.
- La edición de series será administrativa, separada del formulario operativo.

## Rollback

Forward-only: restaurar la firma 050 de `ra_crear_guia` mediante una migración
nueva, desactivar series y no reutilizar correlativos ya asignados.
