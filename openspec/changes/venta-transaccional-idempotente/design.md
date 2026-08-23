# Design: Venta transaccional e idempotente

## Technical Approach

Reemplazar la orquestación de escrituras de `procesarVenta()` por una única RPC PostgreSQL autenticada, transaccional e idempotente. La función deriva el contexto desde `auth.uid()`, normaliza la intención, toma un lock por operación, detecta reintentos/conflictos, bloquea productos en orden determinista, recalcula importes con `numeric` y confirma todo el núcleo de venta en una sola transacción.

Para boleta/factura, la misma transacción crea un trabajo en `ra_sunat_outbox`. Una ruta interna protegida de Next.js consume trabajos reclamados mediante leases atómicos en PostgreSQL, llama al OSE y finaliza el trabajo mediante RPC controladas. Un scheduler externo invoca periódicamente la ruta; el scheduler concreto es configuración de despliegue, no lógica de dominio.

El diseño es aditivo y se despliega por etapas. No se aplica ninguna migración a Supabase remoto durante la implementación sin preflight, staging y aprobación separada.

## Verified Constraints

- Supabase remoto no contiene una RPC transaccional de venta.
- `ra_ventas` no tiene `operation_id` ni huella de solicitud.
- No existe outbox `ra_*`.
- `pgcrypto` 1.3 está instalado y permite SHA-256 con `extensions.digest`.
- `pg_cron` está instalado, pero `pg_net` no; PostgreSQL no llamará directamente al OSE.
- No existe `vercel.json`, cron ni worker configurado en el repositorio.
- `emitirComprobante()` requiere `OSE_SUNAT_URL` y `OSE_SUNAT_API_KEY`, ya disponibles solo en servidor.
- El índice local `idx_ventas_serie_correlativo` no apareció en el inventario remoto.
- El historial remoto de migraciones no coincide con los archivos locales `001`-`037`.

## Architecture Decisions

| Decision | Chosen option | Rejected alternative | Rationale |
|----------|---------------|----------------------|-----------|
| Transaction boundary | One PostgreSQL RPC for the complete sale core | Multiple Supabase calls with compensation | Only the RPC provides real commit/rollback across all effects |
| Idempotency storage | `operation_id` + `request_hash` on `ra_ventas`, unique per company | Separate permanent request table | A successful operation maps one-to-one to a sale; failed transactions leave no effects and can safely retry |
| Concurrency for same operation | Transaction advisory lock scoped by company + operation, backed by unique index | Check-then-insert without lock | Serializes identical attempts and makes replay/conflict deterministic |
| Payload comparison | SHA-256 of canonical server-built JSONB intent | Compare raw JSON text or only `operation_id` | Raw JSON is order/format sensitive; key-only idempotency can silently accept a different cart |
| Duplicate products | Reject duplicate `producto_id` entries | Merge implicitly | Rejection keeps discount and quantity semantics explicit and avoids ambiguous hashes |
| Stock control | `SELECT ... FOR UPDATE` in ascending product UUID order, then checked update | Read/compute/write in Next.js | Provides coherent prior/new stock values for kardex and predictable lock order |
| Monetary authority | Recalculate in PostgreSQL `numeric`; return committed values | Trust totals from browser | Prevents tampering/version drift and keeps DB effects internally consistent |
| Correlative | Allocate under advisory lock inside sale transaction, enforce unique index | Existing separate `ra_siguiente_correlativo` call | Current function releases its lock before the later insert |
| Fiscal delivery | Transactional outbox | Next.js `after()` | Outbox survives process termination and enables retries/audit |
| Outbox execution | Protected Next.js internal route + external scheduler | DB HTTP using `pg_net`; fire-and-forget `after()` | `pg_net` is not installed; Next.js already owns OSE credentials and adapter code |
| Work claiming | DB RPC with lease token and `FOR UPDATE SKIP LOCKED` | Direct select/update from worker | Prevents double claim and allows recovery after worker death |
| OSE uncertain response | Stable fiscal identity + reconcile before resending where provider supports it | Blind resend with new identity | Avoids duplicate logical documents after response loss |
| Client recovery | Persist pending attempt in browser storage, scoped to user/company | Component state only | Survives reload/timeout without creating a new operation |
| Credit limit | Preserve current warn-only behavior provisionally | Introduce new blocking policy | Avoids unapproved business behavior change; remains a pre-design confirmation |

## High-Level Data Flow

```text
PaymentSheet
  ├─ create/reuse operationId
  ├─ persist PendingSaleAttempt (browser storage)
  └─ procesarVenta(input)
       ├─ authenticate with normal Supabase session
       └─ rpc('ra_confirmar_venta', intent)
            ├─ auth/profile/company/branch/cashbox validation
            ├─ canonical request hash
            ├─ advisory lock company+operation
            ├─ existing operation?
            │    ├─ same hash → return existing result
            │    └─ other hash → IDEMPOTENCY_CONFLICT
            ├─ lock/reprice products in deterministic order
            ├─ calculate totals and validate payments/credit
            ├─ allocate series/correlative
            ├─ insert sale/items/payments/cash/credit
            ├─ update stock + insert kardex
            ├─ insert SUNAT outbox when applicable
            └─ return committed result

Scheduler
  └─ POST /api/internal/sunat-outbox
       ├─ authenticate CRON_SECRET
       ├─ rpc('ra_claim_sunat_outbox') → leased jobs
       ├─ emitirComprobante(job.payload)
       └─ rpc('ra_finish_sunat_outbox')
            ├─ accepted/submitted/rejected/retry/dead_letter
            └─ update ra_ventas fiscal fields atomically
```

## Database Model

### Changes to `ra_ventas`

```sql
ALTER TABLE public.ra_ventas
  ADD COLUMN IF NOT EXISTS operation_id uuid,
  ADD COLUMN IF NOT EXISTS request_hash text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_empresa_operation
  ON public.ra_ventas (empresa_id, operation_id)
  WHERE operation_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_serie_correlativo
  ON public.ra_ventas (empresa_id, serie, correlativo)
  WHERE serie IS NOT NULL AND correlativo IS NOT NULL;
```

Compatibility rules:

- Historical sales keep both new columns `NULL`.
- New RPC-created sales require non-null values by function contract; a later hardening migration may make them globally non-null after the old path is retired.
- `request_hash` is a lowercase 64-character SHA-256 hex string. The migration adds a check for either `NULL` or this shape.
- The partial index permits historical rows while enforcing new operation uniqueness.

### New table `ra_sunat_outbox`

Use `text` plus `CHECK` for status rather than a PostgreSQL enum, so adding a future state does not require enum-transaction choreography.

```sql
CREATE TABLE public.ra_sunat_outbox (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id         uuid NOT NULL REFERENCES public.ra_empresas(id) ON DELETE RESTRICT,
  venta_id           uuid NOT NULL REFERENCES public.ra_ventas(id) ON DELETE RESTRICT,
  document_key       text NOT NULL,
  request_payload    jsonb NOT NULL,
  request_hash       text NOT NULL,
  status             text NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending', 'processing', 'retry', 'submitted',
                       'accepted', 'rejected', 'dead_letter'
                     )),
  attempt_count      integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  next_attempt_at    timestamptz NOT NULL DEFAULT now(),
  lease_token        uuid,
  lease_expires_at   timestamptz,
  last_attempt_at    timestamptz,
  completed_at       timestamptz,
  external_id        text,
  http_status        integer,
  error_code         text,
  error_message      text,
  response_payload   jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venta_id),
  UNIQUE (empresa_id, document_key)
);

CREATE INDEX idx_sunat_outbox_ready
  ON public.ra_sunat_outbox (next_attempt_at, created_at)
  WHERE status IN ('pending', 'retry');

CREATE INDEX idx_sunat_outbox_expired_lease
  ON public.ra_sunat_outbox (lease_expires_at)
  WHERE status = 'processing';
```

`document_key` is stable and human-auditable: `<ruc>:<tipo>:<serie>:<correlativo>`. It MUST NOT change across retries.

`request_payload` is a frozen fiscal snapshot produced during the sale transaction. It contains the fields required by `OseComprobanteInput`; it does not contain credentials. `request_hash` detects accidental mutation. `response_payload` stores only a bounded, sanitized provider response needed for audit.

### RLS

- Enable RLS on `ra_sunat_outbox`.
- Normal authenticated users receive no direct INSERT/UPDATE/DELETE policy.
- Administrators may receive a read-only policy scoped by `empresa_id = ra_empresa_id()` if operational UI is added; v1 can expose status through a controlled sale-detail query instead.
- Worker mutations occur through tightly scoped `SECURITY DEFINER` functions invoked by server-only credentials.

## Canonical Request and Hash

The RPC builds the canonical object itself after syntactic validation; it does not hash the raw client JSON.

```json
{
  "operation_id": "uuid",
  "sucursal_id": "uuid",
  "tipo_comprobante": "ticket|boleta|factura",
  "cliente_id": "uuid|null",
  "moneda": "PEN|USD",
  "tipo_cambio": "normalized decimal|null",
  "fecha_vencimiento": "YYYY-MM-DD|null",
  "items": [
    { "producto_id": "uuid", "cantidad": "normalized decimal", "descuento": "normalized decimal" }
  ],
  "pagos": [
    { "metodo_pago": "...", "monto": "normalized decimal", "referencia": "trimmed|null" }
  ]
}
```

Canonicalization rules:

1. Reject duplicate product IDs.
2. Sort items by `producto_id`.
3. Normalize quantity to the supported three decimal places and money to two; reject values that require silent material truncation.
4. Trim references; empty becomes `null`.
5. Sort payment entries by method, reference and amount for hashing. Persistence may retain the normalized submitted order, but order is not material to idempotency.
6. Normalize optional values explicitly to JSON `null`.
7. Compute `encode(extensions.digest(convert_to(canonical_jsonb::text, 'UTF8'), 'sha256'), 'hex')`.

The operation ID is included in the canonical object for audit but uniqueness is still enforced independently.

## Sale RPC Contract

### Function signature

```sql
public.ra_confirmar_venta(
  p_operation_id uuid,
  p_sucursal_id uuid,
  p_tipo_comprobante public.ra_tipo_comprobante,
  p_cliente_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_moneda char(3),
  p_tipo_cambio numeric,
  p_fecha_vencimiento date
) returns jsonb
```

Security attributes:

```sql
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
```

Permissions:

- `REVOKE ALL ... FROM PUBLIC, anon`.
- `GRANT EXECUTE ... TO authenticated`.
- Every call validates `auth.uid()` and an active `ra_perfiles` row with role `administrador` or `vendedor`.

### Input authority

The client supplies intent only. It does not supply company, user, cashbox, prices, catalog snapshots, subtotal, IGV, total, prior/new stock, credit amount, series or correlative.

`p_sucursal_id` is necessary because an administrator selects a branch in a cookie, but the RPC validates it:

- vendedor: must equal `ra_perfiles.sucursal_id`;
- administrador: must be an active branch of the same company;
- any other case: reject.

The open cashbox is selected in the validated company/branch and must be accessible under the current rule: owned by `auth.uid()` or caller is administrator. No silent fallback to another branch is allowed.

### Transaction algorithm

1. Assert authenticated active profile and authorized role.
2. Validate branch and open cashbox.
3. Validate JSON shapes, maximum collection sizes and numeric precision.
4. Build canonical intent and request hash.
5. Acquire transaction advisory lock from company UUID + operation UUID using two stable 32-bit keys or a collision-resistant 64-bit derivation.
6. Query `ra_ventas` by `(empresa_id, operation_id)`:
   - same hash: return `ra_venta_resultado(existing_id)` without new writes;
   - different hash: raise domain error `RA_IDEMPOTENCY_CONFLICT`;
   - absent: continue.
7. Validate customer membership/active state and fiscal document requirements.
8. Lock all requested `ra_productos` rows in ascending UUID order with `FOR UPDATE` and validate company, branch, active state and price availability.
9. Recalculate lines/totals using `numeric`:
   - PEN uses `precio_venta`;
   - USD uses `precio_venta_dolar` and requires positive `p_tipo_cambio`;
   - ticket IGV remains zero under the current application contract;
   - boleta/factura IGV is rounded to two decimals using the existing formula;
   - `0 <= descuento <= precio * cantidad`.
10. Validate payment lines and coverage using the existing tolerance of 0.01. Persist normalized amounts.
11. If credit exists, validate customer credit/vencimiento and lock the customer row before updating its balance.
12. Resolve company series and allocate correlative under the existing company+series advisory lock, now held until the sale transaction commits. The unique index remains the final guard.
13. Insert `ra_ventas` with `operation_id` and `request_hash`.
14. Insert all item snapshots and payments.
15. Insert cash movements only for non-credit payments.
16. Insert exactly one credit charge from the sum of credit payments and update customer balance. Compute `limite_excedido` for the result.
17. For each locked product, checked-decrement stock and insert corresponding kardex.
18. For boleta/factura, build the frozen fiscal snapshot and insert exactly one outbox row.
19. Return `ra_venta_resultado(venta_id)`.

Any raised exception rolls back every step, including advisory locks automatically.

### Domain errors

Do not parse human prose to classify errors. The SQL design uses stable codes, either through a returned error envelope for expected validation failures or exceptions whose message/detail begins with a controlled code.

Recommended codes:

```text
RA_UNAUTHENTICATED
RA_FORBIDDEN
RA_BRANCH_INVALID
RA_CASHBOX_NOT_OPEN
RA_INVALID_INPUT
RA_IDEMPOTENCY_CONFLICT
RA_CUSTOMER_INVALID
RA_CUSTOMER_CREDIT_DISABLED
RA_PRODUCT_INVALID
RA_PRICE_MISSING
RA_DISCOUNT_INVALID
RA_PAYMENT_INSUFFICIENT
RA_STOCK_INSUFFICIENT
RA_INTERNAL_ERROR
```

`procesarVenta()` maps codes to safe Spanish messages. Unexpected database details remain server logs only.

### Success result

```json
{
  "status": "confirmed",
  "replayed": false,
  "operationId": "uuid",
  "sale": {
    "id": "uuid",
    "total": 123.45,
    "tipoComprobante": "ticket",
    "moneda": "PEN",
    "serie": "T001",
    "correlativo": 42,
    "numeroCompleto": "T001-00000042"
  },
  "empresa": {
    "razonSocial": "...",
    "ruc": "...",
    "direccion": "...",
    "telefono": "..."
  },
  "sucursal": { "nombre": "...", "direccion": "..." },
  "warnings": {
    "creditLimitExceeded": false
  },
  "fiscal": {
    "required": false,
    "status": null
  }
}
```

On replay, `replayed=true`; all other committed sale fields are equivalent.

## Result Lookup

Prefer a second RPC rather than direct table queries so authorization and response shape remain identical:

```sql
public.ra_obtener_resultado_venta(p_operation_id uuid) returns jsonb
```

Behavior:

- derive current company/user from `auth.uid()`;
- return the operation when it belongs to the caller, or to the same-company administrator under the chosen support policy;
- return `{status:'not_found'}` without leaking cross-tenant existence;
- build the result from committed tables and current outbox state;
- never mutate or retry the sale.

## POS Integration

### Input schema

`VentaInputSchema` adds:

```ts
operationId: z.string().uuid()
```

It keeps current fast feedback, but database validation remains authoritative. `catalogoId` should be removed from the RPC intent or ignored as authority; the database derives it from `producto_id`.

### Pending attempt persistence

Add a versioned storage record, for example:

```ts
type PendingSaleAttemptV1 = {
  version: 1
  operationId: string
  userId: string
  empresaId: string
  createdAt: string
  payload: VentaInput
  state: 'ready' | 'sending' | 'unknown'
}
```

Storage key includes user/company. The payload contains business data already present in the POS but no auth token or secret. It is removed after confirmed success or a definitive validation failure. On network/unknown errors it remains and the UI attempts `ra_obtener_resultado_venta` before allowing another confirmation.

### `procesarVenta()` responsibilities after refactor

1. Validate authentication with `getSession()`.
2. Parse basic shape with Zod.
3. Invoke `ra_confirmar_venta` using the authenticated Supabase client.
4. Map stable domain codes to `ActionResponse`.
5. Return the committed/replayed `VentaResult`.

It no longer:

- inserts any sale table directly;
- creates an admin Supabase client for stock/kardex;
- calls `ra_registrar_cargo_credito`;
- invokes `after()`;
- calls `emitirComprobante()`.

## Outbox Worker Design

### Internal route

Create:

```text
POST /api/internal/sunat-outbox
```

Authentication:

- require `Authorization: Bearer <SUNAT_OUTBOX_CRON_SECRET>`;
- compare with a timing-safe server-side comparison;
- reject missing/invalid credentials with 401;
- never log the header;
- route is not linked from UI.

The route creates a server-only Supabase admin client. This is an allowed operational use of service role; it is separate from the user sale path and never reaches the browser.

Invocation model:

- scheduler calls every minute initially;
- batch size 10;
- maximum route duration must remain below host timeout;
- jobs may be processed with small bounded concurrency (for example 2), not unbounded `Promise.all`;
- a manual authorized invocation can be used for recovery.

No scheduler is currently configured. Selecting Vercel Cron, another platform scheduler or an external monitor is a deployment gate. The application contract stays the same.

### Claim RPC

```sql
public.ra_claim_sunat_outbox(
  p_worker_id text,
  p_limit integer default 10,
  p_lease_seconds integer default 120
) returns setof ...
```

Algorithm:

1. Requeue expired `processing` rows to `retry`, clearing stale lease fields.
2. Select ready `pending/retry` rows ordered by `next_attempt_at, created_at` with `FOR UPDATE SKIP LOCKED`, bounded to a safe maximum.
3. Set `status='processing'`, increment `attempt_count`, set `last_attempt_at`, fresh `lease_token` and `lease_expires_at`.
4. Return job ID, lease token, document key and frozen request payload.

### Finish RPC

```sql
public.ra_finish_sunat_outbox(
  p_job_id uuid,
  p_lease_token uuid,
  p_outcome text,
  p_external_id text,
  p_http_status integer,
  p_error_code text,
  p_error_message text,
  p_response_payload jsonb
) returns boolean
```

The function locks the row and only accepts a finish from the current unexpired lease token. It updates outbox and `ra_ventas` in the same transaction.

Outcome mapping:

| OSE outcome | Outbox | Sale |
|-------------|--------|------|
| `EMITIDA` | `accepted`, completed timestamp | `estado='completada'`, `sunat_estado='aceptada'`, persist hash/URLs/external ID |
| `RESERVADO` / `ENVIANDO` (HTTP 202) | `submitted` | remain `estado='pendiente'`, persist OSE ID and poll/reconcile by document identity |
| `ERROR_REINTENTABLE` (HTTP 503) | `retry` or `dead_letter` after max attempts | remain `estado='pendiente'`, error summary observable |
| `RESULTADO_INCIERTO` (HTTP 200) or network outcome unknown | `submitted` | remain `estado='pendiente'`; reconcile through `/por-numero`, never blind-resend |
| Definitive reject | `rejected` | `estado='error_sunat'`, `sunat_estado='rechazado'` |

`submitted` MUST NOT be blindly resent. The verified OSE contract exposes `GET /api/v1/comprobantes/por-numero` scoped to its authenticated tenant. The worker uses it with the frozen `tipo`, `serie` and `correlativo`; `RESULTADO_INCIERTO` remains queued for operational reconciliation and is never converted into an automatic resend.

### Retry policy

- Safe automatic retry: OSE `ERROR_REINTENTABLE`/HTTP 503, because OSE durably records that SUNAT was not contacted.
- Indeterminate transport failure without an OSE response: move to `submitted` and query `/por-numero`; do not classify it as safe merely because it was a timeout.
- Definitive: OSE `RECHAZADA`/HTTP 422 or a controlled non-retryable contract error.
- Backoff: `min(5 minutes * 2^(attempt_count-1), 6 hours)` plus bounded jitter.
- Maximum automatic send attempts: 10, then `dead_letter`.
- Manual requeue requires an explicit admin operation and audit reason; UI for it is outside this change unless added later.

`emitirComprobante()` must return structured classification rather than only `{exito,error}`:

```ts
type OseComprobanteResult =
  | { kind: 'accepted'; externalId: string; hash?: string; pdfUrl?: string; xmlUrl?: string; sanitizedResponse?: unknown }
  | { kind: 'submitted'; externalId: string; hash?: string; pdfUrl?: string; xmlUrl?: string; sanitizedResponse?: unknown }
  | { kind: 'uncertain'; externalId?: string; code: 'UNCERTAIN_RESULT_REQUIRES_RECONCILIATION'; message: string }
  | { kind: 'temporary_error'; httpStatus?: number; code: string; message: string }
  | { kind: 'rejected'; httpStatus?: number; code: string; message: string; sanitizedResponse?: unknown }
```

### Verified OSE idempotency contract

The OSE service was updated and independently verified before this design was finalized:

1. `POST /api/v1/comprobantes` accepts `Idempotency-Key` (trimmed, 1..255 chars).
2. OSE also arbitrates duplicates by tenant plus fiscal identity `tipo+serie+correlativo`.
3. Same identity and same canonical payload replays the existing resource; a different payload returns HTTP 409.
4. `GET /api/v1/comprobantes/por-numero` reconciles by fiscal identity.
5. `ERROR_REINTENTABLE`/HTTP 503 means failure before contacting SUNAT and is safe to retry with the same key.
6. `RESULTADO_INCIERTO`/HTTP 200 means SUNAT may have received the document; it is never resent automatically.

The outbox `document_key` (stable sale UUID or an equally stable derived value, maximum 255 characters) is sent unchanged as `Idempotency-Key` on every attempt. Database outbox idempotency and OSE idempotency therefore compose without claiming formal exactly-once against SUNAT.

## Security Design

### Sale RPC

- `SECURITY DEFINER`, fixed `search_path`.
- Schema-qualify security-critical tables/functions.
- Validate active profile and authorized role on every call.
- Derive company/user; validate branch/cashbox/customer/products.
- Bound JSON arrays (proposed: max 200 items, 20 payment lines) and text lengths.
- Revoke public/anon execution.
- Do not expose raw PostgreSQL errors to the POS.

### Worker

- Cron secret and OSE key remain server-only.
- Service-role client only in internal route/worker module.
- Lease/finish functions accept no arbitrary company or sale mutation.
- Sanitize provider bodies and cap stored response/error size.
- Logs use job ID, sale ID, document key, attempt and outcome; never credentials or unnecessary customer payload.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/038_venta_transaccional_idempotente.sql` | New | Columns/indexes, outbox, RLS, RPCs, grants and helpers |
| `src/lib/types/database.ts` | Modify | Sale idempotency fields, outbox and RPC types |
| `src/app/tablet/(kiosk)/pos/actions.schema.ts` | Modify | `operationId`; align intent contract |
| `src/app/tablet/(kiosk)/pos/actions.ts` | Major refactor | Call transactional RPC; remove direct writes, service role and `after()` |
| `src/app/tablet/(kiosk)/pos/components/PaymentSheet.tsx` | Modify | Create/reuse operation ID, recovery UI and pending-attempt lifecycle |
| `src/app/tablet/stores/posStore.ts` | Modify | Track operation lifecycle or integrate storage helper |
| `src/lib/ventas/pendingSale.ts` | New | Versioned, user-scoped browser persistence |
| `src/lib/facturacion/ose.ts` | Modify | Structured OSE outcome classification |
| `src/lib/facturacion/outbox.ts` | New | Claim/process/finish orchestration with bounded concurrency |
| `src/app/api/internal/sunat-outbox/route.ts` | New | Protected scheduler endpoint |
| tests | New/Modify | SQL integration, concurrency, RPC contract, POS recovery and worker tests |

Names may change slightly during implementation, but responsibilities and trust boundaries must remain.

## Testing Strategy

### Unit tests

- Zod accepts valid UUID and rejects absent/invalid `operationId`.
- Pending-attempt storage reuses ID across retry/reload and isolates users.
- Action maps stable database error codes without leaking details.
- OSE adapter classifies accepted, submitted, transient HTTP/network and rejection.
- Worker validates cron auth and calls finish with the lease token.

### PostgreSQL integration tests

Run against an isolated local/staging Supabase-compatible PostgreSQL instance:

- success for ticket, boleta, factura, PEN, USD and split payments;
- rollback after each critical insertion/update using test-only fault injection or a transaction-local hook unavailable in production;
- repeated identical operation produces one sale/effects;
- conflicting payload produces `RA_IDEMPOTENCY_CONFLICT`;
- two concurrent identical operations produce one sale;
- concurrent sales with sufficient/insufficient stock;
- deterministic multi-product locking completes without inconsistent stock;
- credit charge and balance update exactly once;
- unauthorized role/cross-company/branch/customer/product cases;
- concurrent correlatives remain unique;
- outbox insert rollback and one-row-per-sale constraints;
- two claimers cannot claim the same job;
- expired lease recovery and stale finish rejection.

Assertions compare counts and exact aggregate invariants, not only RPC success messages.

### Worker integration tests

- transient failure schedules retry without changing commercial confirmation;
- accepted result atomically updates outbox and sale fiscal fields;
- rejected result is terminal and auditable;
- worker death leaves an expiring lease recoverable;
- `submitted` is not blindly resent;
- duplicate scheduler invocations do not double-process a current lease.

### Regression

- Existing Vitest suite passes.
- PEN/USD totals match shared contract vectors between Decimal.js and PostgreSQL.
- Ticket success and printing receive the same result shape on first response and replay.
- No new global lint cleanup is mixed into the change; lint only touched files and report global baseline separately.

## Migration and Rollout

### Phase 0: preflight

1. Snapshot definitions of affected remote tables, indexes, functions, policies and grants.
2. Reconcile why remote migration ledger differs from local files.
3. Verify generated `numero_completo`, company series and existing duplicate correlatives before creating the unique index.
4. Verify no existing object conflicts with new names.
5. Re-run the verified OSE contract tests or a staging smoke test for idempotent replay and `/por-numero` reconciliation.
6. Prepare isolated staging and rollback evidence.

### Phase 1: additive database

1. Add nullable compatibility columns and partial unique indexes.
2. Add outbox, RLS and worker RPCs.
3. Add sale RPC and result lookup.
4. Run database security/performance advisors and integration suite.

No remote production application occurs as an incidental implementation step.

### Phase 2: worker dark launch

1. Deploy internal route and scheduler with processing disabled or empty queue.
2. Verify authentication, claiming, lease recovery and monitoring.
3. Enable processing only after the OSE staging smoke test and scheduler secret validation pass.

### Phase 3: application cutover

1. Deploy POS code that generates/persists `operation_id` and calls the RPC.
2. Monitor confirmation errors, replay count, conflicts, stock failures and outbox age.
3. Remove the legacy direct-write/service-role/`after()` path in the same release once RPC is active; do not retain an automatic fallback that could bypass idempotency.

### Phase 4: hardening

After all supported application versions use the RPC:

- consider making operation fields non-null for new rows through a DB constraint/trigger;
- remove obsolete grants/direct insert paths where safe;
- add admin outbox/reconciliation UI in a separate change if required.

## Rollback

Application rollback does not drop schema. It disables new traffic only after assessing whether an old version could create non-idempotent sales. Prefer a forward fix or temporary sale confirmation maintenance mode over silently restoring the unsafe path.

Worker rollback stops scheduler invocation; pending/retry/submitted jobs remain durable. Accepted/rejected history is retained.

Schema removal is deferred until:

- no deployed code references it;
- no pending/processing/retry/submitted/dead-letter jobs remain unresolved;
- confirmed sale data is archived/preserved;
- a separately reviewed destructive migration is approved.

## Observability

Minimum metrics/log dimensions:

- sale RPC: confirmed, replayed, conflict, validation failure by stable code, duration;
- stock: insufficient events and deadlock/serialization failures;
- outbox: count by status, oldest ready age, attempts, lease expirations, dead letters;
- OSE: accepted/submitted/rejected/transient, latency and sanitized status code;
- scheduler: invocation success, claimed count, processed count and duration.

Alerts before production:

- oldest pending/retry exceeds agreed SLA;
- any dead letter/rejected item;
- repeated lease expirations;
- idempotency conflicts above expected near-zero baseline;
- unique/correlative constraint failure;
- database deadlocks in the sale function.

## Resolved Design Decisions

- Persist pending operation across reload, scoped to authenticated user/company.
- Reject duplicate products rather than merge them.
- Preserve warn-only credit-limit behavior until business explicitly changes it.
- Allow discount only within `[0, precio * cantidad]`; no new role matrix.
- Use Next.js internal worker endpoint plus external scheduler, because `pg_net` is not installed and OSE secrets belong server-side.
- The scheduler is required for automatic progress, not for sale atomicity or outbox durability. Use Vercel Cron while hosted on Vercel; on a VPS invoke the same protected route from cron/systemd without changing the application contract.
- Send the stable outbox `document_key` as OSE `Idempotency-Key`; reconcile uncertain outcomes through `/por-numero` and never blind-resend.
- Credit-limit excess warns and does not block, preserving the existing business behavior confirmed for this change.
- Use the explicit migration filename `038_venta_transaccional_idempotente.sql`; remote ledger reconciliation remains a deployment preflight.

## Open Go-Live Decisions

1. Configure the production scheduler target and maximum execution duration (Vercel Cron initially; cron/systemd if moved to VPS).
2. Define operational owners and SLA for `rejected`, `submitted` and `dead_letter` jobs.
3. Reconcile remote migration history before applying local migration `038_venta_transaccional_idempotente.sql`.
4. Classify the six historical kardex entries with sale motive and no current sale reference; no automatic repair is included here.
