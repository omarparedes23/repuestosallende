# Operaciones — venta-transaccional-idempotente

Estado: **APROBADO PROVISIONALMENTE**. El propietario del sistema aceptó el 2026-08-23, de forma
provisional, las propuestas de este documento (SLA de `submitted`/`rejected`/`dead_letter`, métricas,
reconciliación y rollback). El scheduler permanece **deshabilitado**: no existe Vercel Cron ni
invocador automático, y su activación futura requiere una nueva decisión explícita.
Corresponde a las tareas 7.5 y 8.5 del change (marcadas con esta misma salvedad).

## 1. Estados del outbox y su tratamiento

Estados terminales correctos: `accepted`, `rejected`, `dead_letter`.
Estado intermedio válido y transitorio: `retry` (con backoff acotado).
Estados que requieren intervención humana según este documento: `submitted` y `dead_letter`,
más `rejected` con causa corregible.

### submitted (RESERVADO / ENVIANDO en el OSE)

- **Propietario propuesto**: Administrador del sistema (dueño del ERP).
- **SLA propuesto**: revisión manual en un máximo de **24 horas** desde la detección. El estado
  `submitted` significa resultado incierto ante SUNAT: la venta queda `completada` con
  `sunat_estado pendiente` y el job NO vuelve a `pending/retry` por diseño (nunca hay reenvío ciego).
- **Tratamiento propuesto**: ejecutar reconciliación por identidad fiscal (sección 3). Si el OSE
  confirma `EMITIDA`, cerrar como aceptada (el flujo normal de finish lo hará en la siguiente pasada
  del worker o mediante operación manual auditada). Si confirma `RECHAZADA`, tratar como rechazado.
- El job en `submitted` no bloquea la operación comercial: la venta ya está cobrada e inventariada.

### rejected (RECHAZADA por el OSE/SUNAT)

- **Propietario propuesto**: Administrador del sistema, con apoyo del responsable de caja cuando la
  corrección implique volver a emitir.
- **Tratamiento propuesto**:
  1. Leer `error_message` / payload del job (`ra_sunat_outbox`) para identificar la causa.
  2. Si la causa es de datos corregibles (documento/razón social/dirección del cliente): corregir
     el maestro correspondiente y anular+reemitir el comprobante siguiendo el flujo de anulaciones
     (cuando exista; hoy, registro manual auditado). La venta original queda `error_sunat`.
  3. Si la causa es de conflicto de identidad fiscal (serie/correlativo ya usado con payload
     distinto, como se demostró en E2E): reconciliar por `/por-numero` para decidir cuál emisión es
     la válida antes de tocar nada.
  4. Nunca editar ni borrar filas del outbox manualmente; el estado `rejected` es evidencia fiscal.
- **SLA propuesto**: revisión semanal junto con el cierre de caja; inmediata si el cliente exige
  comprobante válido.

### dead_letter (agotó los 10 intentos)

- **Propietario propuesto**: Administrador del sistema (notificación técnica al mantenedor del
  sistema/VPS).
- **Alerta propuesta**: consulta diaria de jobs en `dead_letter`; si existe ≥1, notificación al
  administrador (email/WhatsApp del negocio; mecanismo a elegir al habilitar el scheduler).
- **Reintento manual propuesto**: tras corregir la causa raíz (caída prolongada del OSE, cambio de
  URL/key, error de payload), un operador autorizado puede devolver el job a `pending` mediante una
  operación SQL explícita, registrada en un log de auditoría con usuario, motivo y timestamp:

  ```sql
  -- Solo con causa raíz corregida y aprobación explícita. Registrar siempre motivo.
  UPDATE ra_sunat_outbox
  SET status = 'pending', attempt_count = 0, next_attempt_at = now(), lease_token = NULL
  WHERE id = '<job_id>' AND status = 'dead_letter';
  ```

  Antes de reintentar, verificar SIEMPRE por `/por-numero` que el documento no fue emitido en un
  intento previo cuyo resultado se perdió (evitar doble emisión real).
- **SLA propuesto**: diagnóstico en 48 horas; reintento solo con causa corregida.

## 2. Métricas y alertas

Consulta operativa agregada (ejecutable con rol admin/service-role; no expone payload fiscal):

```sql
SELECT status,
       count(*)                          AS jobs,
       min(created_at)::date             AS mas_antiguo,
       max(attempt_count)                AS max_intentos
FROM ra_sunat_outbox
GROUP BY status;
```

Métricas mínimas propuestas:

| Métrica | Umbral de alerta | Destinatario |
|---|---|---|
| Jobs `pending/retry` con antigüedad > 1 h | cualquier job | Mantenedor técnico |
| Jobs `submitted` con antigüedad > 24 h | cualquier job | Administrador |
| Jobs `dead_letter` | >= 1 | Administrador + técnico |
| Ventas `completada` con `sunat_estado = 'pendiente'` > 24 h | cualquier venta | Administrador |
| Errores HTTP 5xx de `/api/internal/sunat-outbox` | 3 consecutivos | Mantenedor técnico |

Mecanismo propuesto (a elegir en la activación): el propio scheduler diario invoca primero la
consulta de estados y notifica; alternativa simple externa: monitor HTTP (UptimeRobot/cron del VPS)
que ejecute la consulta vía endpoint autenticado futuro.

## 3. Reconciliación por identidad fiscal (/por-numero)

Cuándo usarla: resultado `uncertain/submitted`, sospecha de doble emisión, o disputa con un cliente
sobre la validez de un comprobante.

Procedimiento:

1. Identificar serie y correlativo de la venta (`ra_ventas.numero_completo`).
2. Consultar al OSE:
   `GET {OSE_SUNAT_URL}/api/v1/comprobantes/por-numero?tipo=BOLETA&serie=<SERIE>&correlativo=<N>`
   con header `X-Api-Key`. (Tipo real según comprobante: BOLETA/FACTURA.)
3. Interpretar:
   - `estado: EMITIDA`, `sunatAceptada: true` → el documento existe y es válido. Si el outbox local
     no está `accepted`, cerrar manualmente con operación auditada usando el `id` retornado.
   - `estado: RECHAZADA` → tratar según sección rejected.
   - 404 / inexistente → nunca se emitió; seguro para reintentar (devolver a `pending` si estaba en
     `dead_letter`).
4. Registrar en el log de auditoría: quién consultó, qué encontró y qué acción tomó.
5. Nunca reenviar a ciegas un documento con resultado incierto: primero reconciliar.

## 4. Rollback (forward-only)

Principios:

- Las migraciones 038–040 son aditivas y forward-only. NO existen scripts de downgrade y no deben
  crearse. Un revert del código sin revert del esquema es seguro: el esquema nuevo tolera el código
  viejo (columnas nulas históricas), pero no al revés.
- El flujo legacy del POS (inserts directos + emisión OSE directa desde la action) fue retirado:
  **no reactivarlo jamás**. No existe fallback y reactivarlo implicaría reintroducir ventas no
  transaccionales.

Ante un incidente grave del pipeline de emisión:

1. **Detener el scheduler** (ver sección despliegue). Las ventas siguen funcionando: quedan
   `completadas` con outbox `pending` acumulado, cobradas e inventariadas correctamente.
2. Diagnosticar con las métricas de la sección 2 y `/por-numero`.
3. Corregir causa y reactivar; el outbox drena solo (SKIP LOCKED, backoff acotado, dead_letter a
   los 10 intentos).
4. Si el incidente es del esquema mismo (improbable): fix forward-only como migración nueva (patrón
   de la 040), nunca revert.

## 5. Checklist de despliegue (tarea 8.5)

### 5.1 Variables requeridas

En el entorno de despliegue (Vercel producción hoy):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ya presentes).
- `SUPABASE_SERVICE_ROLE_KEY` (ya presente; usada SOLO por el worker del outbox).
- `OSE_SUNAT_URL`, `OSE_SUNAT_API_KEY` (ya presentes; apuntan al OSE beta del VPS).
- **Nueva**: `SUNAT_OUTBOX_CRON_SECRET` — secreto aleatorio de alta entropía (>= 32 bytes),
  generado fuera del repo, cargado solo en el entorno de despliegue. Nunca en `.env.local`
  commiteado ni en logs.

### 5.2 Pre-condiciones

- [ ] Migraciones 038–040 aplicadas y registradas en el ledger (hecho 2026-08-23).
- [ ] Suite E2E OSE verde en beta (`RUN_OSE_E2E=1 npm run test:e2e:ose`).
- [ ] Suite E2E HTTP verde (`e2e/sunat-outbox-http.e2e.test.ts` contra servidor con secreto).
- [ ] `npm test` completo en verde.
- [ ] Decisión explícita del propietario sobre SLA (sección 1) y activación del scheduler.

### 5.3 Verificación del endpoint (post-despliegue, scheduler aún OFF)

```bash
# Sin secreto -> debe responder 401 {"error":"Unauthorized"}
curl -i -X POST https://<dominio>/api/internal/sunat-outbox

# Con secreto -> debe responder 200 {"claimed":N,"processed":N} (N=0 si cola vacía)
curl -i -X POST https://<dominio>/api/internal/sunat-outbox \
  -H "Authorization: Bearer <SUNAT_OUTBOX_CRON_SECRET>" -H "Content-Type: application/json" -d '{}'
```

- [ ] 401 confirmado sin header y con header incorrecto.
- [ ] 200 confirmado con secreto y cola vacía (`claimed:0, processed:0`).
- [ ] El header Authorization nunca aparece en logs (revisar configuración de logging).

### 5.4 Activación del scheduler (requiere decisión del propietario)

- Vercel Cron: crear `vercel.json` con un cron que invoque **GET**
  `/api/internal/sunat-outbox` cada minuto (o el intervalo acordado). Vercel añade automáticamente
  `Authorization: Bearer $CRON_SECRET` si existe la variable `CRON_SECRET`; configurar
  `CRON_SECRET` con el MISMO valor de `SUNAT_OUTBOX_CRON_SECRET`.
- Alternativa VPS (systemd timer / crontab): curl autenticado al mismo endpoint POST.
- Frecuencia propuesta inicial: cada minuto, batch máximo 10 (ya acotado en la ruta).
- [ ] Tras activar, verificar en 15 min que `pending` baja y no aparecen `dead_letter`.

### 5.5 Desactivación rápida (kill switch)

- Vercel: eliminar/comentar el bloque `crons` de `vercel.json` y redeployar (o deshabilitar el cron
  desde el dashboard).
- VPS: `systemctl stop <timer>` / comentar la línea de crontab.
- Alternativa inmediata sin deploy: vaciar (rotar) `SUNAT_OUTBOX_CRON_SECRET`/`CRON_SECRET` en el
  entorno → todas las invocaciones pasan a 401.
- La parada es segura por diseño: ventas y outbox permanecen durables; la emisión solo deja de
  avanzar.

### 5.6 Comprobaciones posteriores al despliegue

- [ ] Una venta boleta real de prueba confirmada vía POS/RPC queda con outbox `accepted` y venta
      `completada/aceptada` en < 5 minutos.
- [ ] Replay de la misma operación no genera segundo job.
- [ ] Consulta de métricas (sección 2) sin errores y sin exposición de payloads.
- [ ] Alertas configuradas probadas (forzar una de prueba).
- [ ] Registrar fecha/hora de activación y responsable en este documento.

### Registro de activación

| Fecha | Acción | Responsable | Nota |
|---|---|---|---|
| 2026-08-23 | Decisión operativa provisional del propietario: SLA/tratamientos aprobados; scheduler sigue deshabilitado | Propietario del sistema | No se habilitó Vercel Cron ni se modificaron migraciones 001–037 |
| — | Pendiente: activación del scheduler | — | Requiere nueva decisión explícita |
