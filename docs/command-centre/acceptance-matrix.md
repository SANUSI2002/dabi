# Sabi Command Centre — requirements-to-test matrix

Every requirement from the brief maps to automated tests (backend unit, backend real-Postgres "DB",
frontend unit) and, where a browser matters, an end-to-end run on the local stack. Results are from
2026-10-11.

Test files:
- **BU** `backend/sabi-command-centre/test/delivery-pricing.test.js` (pricing engine, 18 tests)
- **BP** `backend/sabi-command-centre/test/emr-db/command-centre.pricing.db.test.js` (9 tests)
- **BO** `backend/sabi-command-centre/test/emr-db/command-centre.oversight.db.test.js` (17 tests)
- **BM** `backend/sabi-command-centre/test/emr-db/pharmacy.marketplace.db.test.js` (existing, updated)
- **FU** `src/command-center/ops/ops.test.tsx` (8 tests) and existing `src/command-center/*.test.tsx`

## Automated

| ID | Requirement | Test(s) | Result |
|---|---|---|---|
| A01 | Delivery = rate per km × km (₦200 × 5 km = ₦1,000), backend-authoritative, itemised | BP "charges 5 km at ₦200/km as ₦1,000…"; BU calculation-order tests | pass |
| A02 | Base fee, included km, minimum, cap, max distance, bands, zones (rate, surcharge, paused, zones-only), small-order fee, surcharges, free delivery, distance and fee rounding, explicit order | BU (18) | pass |
| A03 | Versioned, effective dates, scheduling, cancellation, history; a rate change never alters a confirmed order | BP "…keeps that price after a rate change", "schedules, lists and cancels…" | pass |
| A04 | Quote snapshot per order, quote expiry, price-changed refusal (409), out-of-range explained (422 with reason), road distance with explicit fallback/failure | BP "refuses to place an order at a price the patient was not shown", "explains when an address is out of range…"; BM radius test; BU road fallback | pass |
| A05 | Simulator runs the exact calculation on a draft, saving nothing; UI publishes in kobo with a reason | BP "simulates a draft…"; FU "delivery pricing" (2) | pass |
| A06 | Server-enforced least privilege per role (support, finance, clinical, patient, anonymous) | BO "returns the caller's roles… enforces least privilege"; BP permissions test | pass |
| A07 | Every route names its permission; no Command Centre data cached (`no-store`) | BO least-privilege test; generated OpenAPI lists permissions per operation | pass |
| A08 | UI shows restricted sections with an explanation instead of empty pages | FU "explains when the role cannot see patients…" | pass |
| A09 | Audit: actor, time, action, target, reason, before/after for changes | BP "records every change with who, why, before and after"; BO doctor suspend before/after | pass |
| A10 | Audit trail append-only (database refuses update/delete) | BP append-only assertion; BO case events append-only | pass |
| A11 | Exports audited, need a reason and recent two-step verification; spreadsheet formulas neutralised | BO "filters the audit trail and exports it as CSV, which is itself audited" | pass |
| A12 | Overview: real metrics with definitions, period + time zone, drill-downs, freshness; invalid time zone refused | BO "reports live metrics with definitions and drill-downs…"; FU zone/drill tests | pass |
| A13 | Patient list masks email/phone | BO "lists patients with masked contact details" | pass |
| A14 | Opening a patient needs a reason, is audited and shown to the patient; never a "current" location; addresses with source + time | BO "opens the account view only with a reason…"; FU "asks for a purpose…" | pass |
| A15 | Health info needs clinical permission or time-limited emergency access; emergency access reviewed by someone else, only after it ends | BO "keeps health information behind clinical permission or reviewed, time-limited emergency access" | pass |
| A16 | Prescribed vs purchased vs handed over vs patient-reported medicines; allergies with source and verification | BO emergency/clinical test assertions | pass |
| A17 | Sign a patient out everywhere with a reason (users.manage only) | BO "signs a patient out everywhere with a reason" | pass |
| A18 | Consultation oversight with timeline and attention filters, no clinical content | BO "serves each read endpoint…" (detail asserts no reason text) | pass |
| A19 | Order trace end to end without codes, address or full contact | BO "shows one order end to end without delivery codes…" | pass |
| A20 | Rider dispatch with eligibility rules, reason, once only | BO "dispatches a rider to a ready delivery with a reason, once" | pass |
| A21 | Refund maker-checker; refunded only on provider evidence; provider not configured → blocked, not faked | BO "runs a refund through maker-checker…"; FU "does not offer approval to the person who proposed the refund" | pass |
| A22 | Webhook receipts logged (applied / duplicate / rejected signature) without payloads or secrets | BO refund test (forged webhook 401 + receipt) | pass |
| A23 | Settlements: idempotent preparation, different approver, payment recorded with transfer reference, fulfilment settled once | BO "prepares, approves (by someone else)…, idempotently" | pass |
| A24 | Reconciliation checks state what should be true and list mismatches | BO "flags reconciliation mismatches…" | pass |
| A25 | Support cases: SLA by priority, version-guarded updates, resolution required, append-only history | BO "opens a case with an SLA…" | pass |
| A26 | Retry failed jobs only where safe (not stale notifications, not reminders), audited, permission-gated | BO "retries failed jobs only where a late send is safe…" | pass |
| A27 | Integration status never exposes keys/tokens; alerts evaluated with severities | BO same test (asserts secrets absent) | pass |
| A28 | Doctor suspension/reinstatement needs a reason; licence expiry list | BO "suspends and reinstates a doctor only with a reason…" | pass |
| A29 | Global search returns only permitted groups | BO "searches across products within the caller's permissions" | pass |
| A30 | Reason dialog re-verifies with the authenticator when the server requires it | FU "needs a reason, then asks for the authenticator…" | pass |
| A31 | Unexpected errors return a reference, never internals | covered by BO smoke run (generic `INTERNAL` with reference observed during development) | pass |

Full suites at the end: backend unit 878/878, backend DB 285/285 (27 files), frontend Command Centre 31/31, `tsc -b` clean, lint clean (warnings only in pre-existing files).

## End to end (local stack, synthetic data, Paystack stand-in — never real Paystack, email, WhatsApp or patients)

| ID | Journey | Result |
|---|---|---|
| E2E-1 | Super admin publishes ₦250/km with a reason; simulator shows 5 km × ₦250 = ₦1,250; scheduled version cancelled | pass |
| E2E-2 | Patient checkout shows "Distance 5 km × ₦200/km = ₦1,000"; admin changes to ₦300/km mid-checkout; Pay is refused server-side, checkout re-quotes to ₦4,000; patient pays; order trace shows version 3 and the frozen ₦1,500 quote | pass |
| E2E-3 | Overview numbers reconcile with seeded orders (fees ₦4,000, average ₦800, GMV ₦16,500); queues show unassigned delivery, refund, failed notification, expiring licence | pass |
| E2E-4 | Patient record opened with purpose; approximate sign-in locations; addresses with source; health view; access history shows staff + purpose | pass |
| E2E-5 | Rider dispatched from the deliveries board; order trace timeline shows the assignment and staff action; no codes on screen | pass |
| E2E-6 | Refund proposed (admin), approve disabled for proposer, approved by second finance user, sent to the stand-in, refunded only after the signed webhook; reconciliation all OK; settlement prepared (₦3,500), approve disabled for preparer | pass |
| E2E-7 | Support starts 15-minute emergency access, opens health info under banner, opens and updates a case (P1 → 4 h target), ends access; admin reviews it from the alert | pass |
| E2E-8 | Failed notification retried; integrations show status only; doctor suspended with reason; global search finds the patient (masked) | pass |
| E2E-9 | No horizontal overflow at 800 px and 375 px on every new page; finance user sees lock icons on Patients and Audit and an explanation on Patients | pass |
