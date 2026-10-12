# Rider, patient-document and Command Centre completion

Started 12 October 2026. Existing frontend `cb4f264`, backend `4b91583`.

## Scope and decisions

- Preserve existing rider onboarding and two-code handover; add availability, dispatch, location publishing, exceptions, earnings and payout workflow.
- Rider pay uses the delivery's frozen kilometre distance × quoted rate/km × configured rider share. The owner clarified an 80% rider / 20% platform example on 12 October. The policy remains a draft until published by an operator. Rider APIs expose only the final offered earning, not the percentage or pricing breakdown.
- The owner explicitly approved Cloudmersive processing of patient medical document contents on 12 October 2026. Private Supabase remains storage; Sabi Auth remains identity. No public document buckets or blanket staff access.
- Complete existing patient record upload/scan/preview and named, expiring, revocable sharing. External prescriptions still require clinical review before dispensing.
- Command Centre scope: subscription invoices/payment reconciliation, server-owned settings and tenant presentation, operational failures/recovery. SSO integrations and unrelated CRM/roadmap functionality are not implied by this scope.
- No real funds, approvals, medical files or user accounts are used in automated verification. Hosted acceptance and third-party configuration must be reported separately from implementation.

## Work ledger

| Slice | Status | Acceptance |
| --- | --- | --- |
| Patient private intake + asynchronous scanner | Implemented; database/UI acceptance passed | bounded upload, durable leases/retries, unsafe file inaccessible, receive confirmation and processing status |
| Patient preview + scoped sharing | Implemented; database/UI acceptance passed | only CLEAN previews, owner/recipient isolation, expiry/revocation and relationship re-check for lists and downloads |
| Rider availability + dispatch | Implemented; draft policy until published | eligibility/expiry/capacity checked atomically; nearest fresh location; no duplicate assignments; selected branch pickup snapshot |
| Rider live location + delivery exceptions | Implemented; foreground GPS only | opt-in active-delivery tracking; explicit failures, no delivered override; timed location retention |
| Rider earning snapshots + payouts | Implemented; provider activation required | immutable NGN earning, no double allocation/payment, independent approval, provider-verified payout and reversal reconciliation |
| Subscription invoices/payments | Implemented; configured provider required | accepted price snapshot, no overlapping periods, provider-verified amount/currency, stable checkout reference, email outbox |
| Server-owned settings/branding | Implemented; tenant/RBAC tests passed | strict safe schemas, readable accent colours, role/tenant scope, optimistic concurrency and audit; actual public/EMR consumers |
| Command Centre failures/recovery | Implemented | metadata only, safe retry, bounded pagination, MFA and audit; patient scan retries cannot mark CLEAN; transfer retries cannot send money |
| Regression/build/deploy acceptance | Regression passed; deployment pending | 503 frontend, 878 backend unit and 328 PostgreSQL tests passed; live revision/aliases under verification |

## Rider pricing contract

Command Centre → Delivery pricing controls the published kilometre rate. Rider operations controls the rider percentage (basis points), pickup radius, open-job capacity, offer-response expiry and automatic dispatch. Neither policy is published automatically by this release.

At order creation, the selected branch and delivery quote are frozen. At assignment, the distance and rate from that quote are combined with the then-published rider share. Round distance to metres; round gross kilometre price to kobo; round rider share to the nearest kobo, half up. Platform remainder = gross − rider earning. Example: 5 km × ₦1,000/km = ₦5,000; 80% → ₦4,000 for the rider and ₦1,000 remainder.

The rider sees only the final earning on the offer and an in-app notification, then accepts or rejects it. Commission percentages, platform remainder, rate/km and internal policy versions are never returned by rider endpoints. Existing offers and completed earnings cannot be edited in the database. Earnings are recorded atomically only after the recipient delivery code confirms completion. An unresolved delivery issue never bypasses that code.

The quote's underlying kilometre price is used; promotional customer delivery discounts do not silently reduce the rider offer. Older deliveries lacking a priced offer are not backfilled. Publishing a policy does not fabricate earnings on historic completed jobs.

## Payment and privacy boundaries

- Payout bank ownership is verified with Paystack against the approved rider name; Sabi retains a recipient reference and last four digits, not the full account number. Payout allocation is append-only. Uncertain transfers must be reconciled; a new transfer attempt is permitted only after definitive failure or reversal and renewed independent approval.
- Subscription invoices use the hospital's accepted package version/cycle, not browser-supplied prices. A checkout redirect or signed webhook alone is not evidence of payment. Independent verification matches the reference, amount and NGN currency. There is no automatic card debit or automatic clinical-access suspension.
- No financial transaction was sent during automated acceptance. Paystack bank resolution/transfer/payment configuration, provider balance, recipient permissions and independent finance approval must be available for actual payouts/collections. Provider transfer OTP is separate from Sabi MFA.
- Documents are private Supabase objects; patient file contents are sent to Cloudmersive under the owner's explicit approval. Pending, infected and rejected files are inaccessible. External prescriptions remain pending clinical review and are not converted into issued prescriptions.
- Location sharing is browser foreground only—not a native always-on/background tracking service. Expired/offline dispatch locations are cleared, and completed-delivery points are pruned according to the versioned retention setting. Delivery proof and financial history are retained.
- Notifications are durable in-app offers. Native/offline push activation for the rider portal is not represented as complete.
- The existing Render deployment/database classification is unchanged. This work does not create backups, migrate the database or certify healthcare/regulatory compliance.

## Acceptance evidence

- Frontend: 503 tests passed across 78 files; TypeScript passed; lint passed with existing non-blocking warnings.
- Backend: 878 unit tests passed across 89 files; ESLint passed; 684 documented API operations; OpenAPI validation passed.
- Embedded PostgreSQL: 328 tests passed across 33 files, including existing clinical/RLS workflows. New tests cover scan verdicts/retries/deletion/size limits, grant expiry/revocation, tenant isolation, price/period snapshots, independent payment verification, immutable rider pay and payout allocation, maker/checker, wrong provider amounts and reversals.
- Pharmacy/rider, telemedicine (including nested doctor) and Command Centre production builds passed.
- Local synthetic browser QA: 375px document intake and sharing dialog; rider earnings/availability; Command Centre private 80/20 policy. Existing Sabi typography/palette/layout retained using the UI/UX skill's loading, touch-target and accessible-colour guidance. QA harness is excluded from release commits.

## Operator activation (not silently performed)

Publish the chosen delivery pricing and rider percentage/capacity/expiry policy from Command Centre. Enable automatic dispatch only when approved riders have current location consent and are online. Assign separate finance approver and manager roles before actual withdrawals. Provider errors remain visible in Jobs, Invoices and Rider payouts; recovery cannot fabricate CLEAN files or PAID money.
