# Sabi Health revenue-cycle backend boundary

This repository is currently a browser-hosted Vite application. The production boundary introduced here is deliberately framework-neutral:

- `database/migrations/202609150001_revenue_cycle.sql` defines the PostgreSQL data model and database isolation controls.
- `src/billing/server/contracts.ts` defines the transaction/repository contract an API server must implement.
- `src/billing/server/service.ts` contains authorization, validation, idempotency and transaction orchestration.
- `src/billing/server/http.ts` exposes a transport-neutral HTTP handler with consistent status codes and error envelopes.
- `src/billing/api.ts` is the browser-safe HTTP client. It never accepts or sends an organization identifier.

The existing Zustand revenue-cycle store remains the local demonstration adapter until an authenticated API host and PostgreSQL connection are configured.

## Development runtime

`.env.example` keeps `VITE_REVENUE_CYCLE_MODE=local`. `src/billing/localApi.ts` wraps the existing tenant-scoped Zustand implementation behind the same asynchronous `RevenueCycleApi` contract as the HTTP client. `src/billing/runtime.ts` selects the adapter and refuses to enter API mode until both an API URL and authenticated token provider have been configured.

Deterministic fixtures for `org-sabi` and `org-mercy` live in `src/billing/testing/multiTenantFixtures.ts`. They intentionally reuse human document numbers and command keys across organizations to verify that uniqueness is tenant-scoped, while checking partial-payment reconciliation, readiness blockers, branch ownership, and record ownership.

## Trusted request context

The API host must derive `TenantBillingContext` from a verified server session or access token. Never read `organizationId`, actor identity, role, or permissions from request JSON. The selected branch in the request is permitted only when it appears in the trusted context's `branchIds`.

At the start of every database transaction, the PostgreSQL adapter must execute parameterized equivalents of:

```sql
SET LOCAL app.organization_id = $1;
SET LOCAL app.branch_ids = $2;
```

`app.branch_ids` is a comma-separated list of authorized facility identifiers, or `*` only for an explicitly authorized all-branch role. Row-level security is forced on every revenue-cycle table.

## Endpoints

| Method | Path | Permission | Idempotency |
|---|---|---|---|
| `POST` | `/api/v1/billing/patient-accounts` | `billing.account.open` | Encounter uniqueness |
| `POST` | `/api/v1/billing/charges` | `billing.charge.capture` | Required header |
| `POST` | `/api/v1/billing/patient-accounts/:accountId/invoices` | `billing.invoice.issue` | Required header |
| `POST` | `/api/v1/billing/invoices/:invoiceId/payments` | `billing.payment.record` | Required header |
| `POST` | `/api/v1/billing/encounters/:encounterId/readiness` | `billing.charge.capture` | Locked encounter |

Mutation endpoints receive the idempotency value from the `Idempotency-Key` header. The route adapter copies that trusted header into the service command. Repeating the same request returns the originally committed result rather than creating a second charge, invoice, payment, allocation, receipt, or accounting posting.

## Transaction requirements

The repository implementation must provide one real database transaction for every service call. It must:

1. Set tenant and branch context with `SET LOCAL` before querying application tables.
2. Use `SELECT ... FOR UPDATE` for patient accounts, selected billable charges, invoices accepting payment, and sequence rows.
3. Acquire the supplied transaction-scoped advisory locks before checking idempotency or creating an encounter account. This closes the concurrent-request race before a unique constraint is reached.
4. Insert invoice header and lines, then update charges, before committing.
5. Update the locked invoice balance and insert payment, allocation, receipt, and audit events in the same transaction.
6. Insert the accounting integration event into `billing.outbox_events` in the same transaction; a retryable worker publishes it after commit.
7. Roll back the whole operation when any constraint, authorization rule, or downstream write fails.

## Financial invariants

- Money is stored only as integer minor units; floating-point database columns are forbidden.
- Invoice status is derived from total and paid values, never selected by a user.
- Payments, allocations, receipts, invoice lines, and audit events are append-only.
- Corrections use explicit reversal/refund records rather than mutation or deletion.
- Invoice lines preserve the service description and price snapshot used at issue time.
- Clinical source events and request idempotency keys are unique inside an organization.
- Database row-level security is the final isolation layer; UI filtering is not considered a security control.

## HTTP error envelope

Route adapters should map `BillingServiceError` to its HTTP status and return:

```json
{
  "error": {
    "code": "BILLING_NOT_READY",
    "message": "Billing is waiting for: Laboratory: 1 specimen pending.",
    "correlationId": "corr-..."
  }
}
```

Do not log request bodies containing patient identifiers or clinical descriptions. Structured logs should contain the organization, actor, action, resource identifier, result, and correlation identifier only.
