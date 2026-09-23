# Sabi Health / Sabi OS solution architecture

- **Status:** Proposed implementation baseline
- **Version:** 0.1
- **Prepared:** 22 September 2026
- **Scope:** Existing Sabi Health, EMR, Pharmacy, Command Center and Telemedicine frontends; proposed Node.js backend and operational platform
**Decision level:** Architecture proposal, not a claim of production readiness or legal certification

## 1. Executive decision

Build one **modular Node.js API** and one separately scalable **background-worker deployment**, initially backed by one managed PostgreSQL cluster and private object storage. Keep the modules, data ownership and API contracts explicit so a module can be extracted later without changing the public product model. Do not build five unrelated backends for the five frontend deployments.

The API is responsible for identity integration, authorization, tenant isolation, transactional commands and authoritative reads. Workers handle publication, notifications, verification integrations, projections, exports, scheduled work and other operations that can complete after a transaction commits. An operation affecting patient safety, stock integrity or money must not report success until its own authoritative transaction commits. “Asynchronous as possible” means **asynchronous downstream work**, not uncertain outcomes for critical commands.

The supplied backend archive is an early Express/Prisma/PostgreSQL authentication and onboarding codebase. It is the starting point, not a finished backend. The repository also contains a revenue-cycle service contract and SQL migration that are **not mounted as a deployed service**. Backend API requirements and the gap inventory remain useful inputs; this document is the cross-product architecture and acceptance baseline.

### 1.1 Architecture principles

1. Server data, permissions, prices, entitlements, clinical state and financial state are authoritative; browser stores are caches or drafts only.
2. A person may have multiple organization memberships; organization and branch context must be verified for every request.
3. Global identity, tenant-owned clinical records, independent pharmacy records and platform control-plane records have distinct ownership.
4. Every significant state change records an audit event and, when another module must react, an outbox event in the same database transaction.
5. Consumers are idempotent. Assume at-least-once delivery; never promise exactly-once execution across systems.
6. Public/read projections contain only explicitly approved fields. Internal objects are never exposed by serialization of whole database rows.
7. The API is contract-first, versioned and observable. Technical and clinical failures are distinguishable.
8. Design for future isolation of large or regulated tenants without requiring it for the first pilot.

## 2. Current-state inventory and disposition

| Area | Verified current state | Target disposition |
| --- | --- | --- |
| Public Sabi Health | React/TypeScript app in src/public; public landing, service chooser, pricing, roadmap and organization registration | Public API-backed catalog/roadmap; secure application submission; cacheable approved projections |
| Sabi EMR | Many lazy-loaded React routes in src/App.tsx; Zustand stores for clinical, operational and administrative modules | Replace business-state stores incrementally with API-backed services; retain route/UI composition |
| Sabi Pharmacy | Separate operator UI in src/pharmacy with organization offers, stock movements, settings and marketplace configuration stored locally in development | Independent pharmacy tenant APIs, server stock ledger and publication workflow |
| Command Center | src/command-center provides platform catalog, tenants, packages, subscriptions, onboarding, audit and operations views; most state is globally persisted in the browser | Server-owned control plane with least-privilege roles, approval rules and immutable audit |
| Telemedicine | Separate React workspace in apps/telemedicine/packages/patient-portal with its own router, patient screens and marketplace | Reuse visual flow; connect session, patient, appointment, consultation, pharmacy and payment APIs; remove client-only success paths |
| Sign-in | Root Sabi ID adapter uses development fixtures; production declines to create a session. Telemedicine login currently navigates to dashboard without credential verification | One canonical identity contract; no protected route without a verified server session |
| Data/API seam | src/api/client.ts, src/services/backend.ts, src/pharmacy/api.ts and src/billing/api.ts exist; many screens still use browser stores | Generate/verify clients from one OpenAPI contract; migrate screens by vertical slice |
| Billing | src/billing/server contracts/service/HTTP adapter and database/migrations/202609150001_revenue_cycle.sql describe authoritative behavior, but no mounted production API | Move server-only logic into Node backend and implement the real PostgreSQL repository |
| Deployment | Five Vercel frontends from one repo; root app produces Health, EMR, Pharmacy and Command Center; Telemedicine has its own Vite build | Deploy API and workers on a separate managed Node runtime; Vercel remains static frontend hosting |

The current frontend route guards and local tenant keys are UX and prototype isolation only. Separate Vercel origins also separate browser storage; they do **not** synchronize pharmacy inventory, marketplace listings, subscriptions, patient records or login state. Production cross-product exchange must pass through the backend.

## 3. Scope, actors and system boundaries

### 3.1 In scope

- Public prospect, organization application, verification, commercial activation and tenant provisioning.
- Staff identity, patient identity, caregiver delegation, platform-operator identity and membership switching.
- EMR registration, appointments, encounters, notes, orders, laboratory, prescriptions, dispensing handoff and billing.
- Independent pharmacy catalogue, batches/stock, publication, quote, order and fulfilment.
- Telemedicine discovery, booking, session authorization, consultation, prescription and patient follow-up.
- Command Center products, packages, prices, subscriptions, entitlements, tenants, support access, audit and release/public content.
- Public, tenant, patient and platform API surfaces; background processing and integrations.
- Security, observability, availability, backup and data governance controls required before live healthcare data.

### 3.2 Outside the first production slice

- Implementing every existing HR, accounting, equipment, SCADA, insurance and advanced reporting screen at once.
- A universal master patient record automatically visible across organizations.
- Autonomous clinical diagnosis or automatic professional/regulatory approval.
- A general-purpose microservice mesh, enterprise event broker or data lake before load and governance justify it.
- Choosing a payment provider, media vendor, regulatory verification provider or legal retention period without owner decisions.

### 3.3 Actors

Patient; caregiver/delegate; clinician/prescriber; nurse; laboratory professional; cashier/billing officer; pharmacy administrator; pharmacist/dispenser; organization administrator; compliance reviewer; finance operator; platform operator; support operator; external payment provider; communication provider; verification provider; video provider; authorized external healthcare system.

## 4. Assumptions and decisions requiring approval

| ID | Assumption for design | Validation or decision required |
| --- | --- | --- |
| A-01 | PostgreSQL is the primary transactional datastore; Prisma remains useful for ordinary persistence | Confirm managed provider, region, connection pool and migration strategy |
| A-02 | The newest Express/Prisma archive is the canonical starting backend; older archive features are mined and migrated, not run as a parallel authority | Approve consolidation and canonical auth/API contract |
| A-03 | An OIDC-capable identity provider or equivalently reviewed identity service will own credentials, MFA, recovery and session revocation | Choose build-versus-buy and identity provider |
| A-04 | Five frontends remain separately deployed; an API origin and an authorization origin will be added | Agree owned domain, CORS allowlist and redirect URIs |
| A-05 | A shared database with tenant-qualified rows and forced RLS is acceptable for the first pilot | Perform legal/security review; identify customers needing isolated databases |
| A-06 | Patients can have a global Sabi identity, but hospital charts are organization-owned | Approve consent, record-sharing and duplicate-match policy |
| A-07 | Independent pharmacies are tenants separate from hospitals | Confirm referral, prescription visibility, marketplace approval and settlement rules |
| A-08 | A background worker can run continuously alongside the API | Choose managed runtime, queue strategy and operations owner |
| A-09 | Initial availability, latency, RPO and RTO targets in section 13 are proposed pilot targets | Product, clinical and operations owners must approve measured targets |
| A-10 | Data residency, retention, regulator submissions and breach-notification duties require jurisdiction-specific legal review | Legal/privacy officer to approve policy before live patient data |
| A-11 | FHIR mappings are an interoperability boundary, not the internal storage schema | Confirm counterparties and exact FHIR version/profiles |
| A-12 | Existing Vercel deployments are presentation-only and must not be used for real patient or payment data yet | Enforce go-live gate in section 18 |

## 5. Logical and deployment architecture

~~~text
Public Health  EMR  Pharmacy  Command Center  Telemedicine  (five browser origins)
      \        |       |             |              /
           OIDC authorization / session establishment
                          |
            API edge: TLS, origin policy, request ID
                          |
      Node API: authentication context + policy + validation
                          |
    +---------------------+----------------------+
    | identity / tenancy  | clinical / patients  |
    | onboarding / catalog| pharmacy / marketplace|
    | billing / payments  | telemedicine / media  |
    | audit / public read | notifications         |
    +---------------------+----------------------+
             |                              |
     PostgreSQL transactions            private object storage
       + outbox + inbox                    + malware scanning
             |
     worker / scheduler / projections / integrations
             |
   payment, email/SMS, video, verification, FHIR partners
~~~

### 5.1 Deployables

- **Frontend builds:** retain current five Vercel projects. No secrets, database access, provider signing keys or authoritative rules in VITE-prefixed variables.
- **API:** one Node.js deployment, initially Express-compatible; organize new code in TypeScript modules with transport, application, domain and infrastructure layers. Use request validation and one OpenAPI description.
- **Worker:** separate process from the same backend source, with independently adjustable replica count and concurrency. It has no public clinical HTTP routes.
- **PostgreSQL:** managed primary with private networking, connection pooling, encrypted backup/PITR, migration job and least-privilege runtime roles.
- **Object store:** private bucket/namespace for evidence, records and reports. Database stores metadata, ownership, checksum and scan state, not raw file bodies.
- **Observability:** central metrics, traces and redacted structured logs; security audit is separately retained and tamper-evident.
- **Optional later components:** durable external queue, search index, read replica or tenant-dedicated database after measurable need. Redis is not the source of truth.

### 5.2 Module ownership

| Module | Owns authoritative data | Publishes/consumes |
| --- | --- | --- |
| Identity | Identity reference, sessions, MFA policy, membership, delegation | SessionRevoked, MembershipChanged |
| Control plane | Organization, branch, product, module, package version, subscription, license, entitlement, feature policy | TenantProvisioned, EntitlementChanged, PackagePublished |
| Onboarding/compliance | Application, evidence metadata, verification case, reviewer decisions | ApplicationSubmitted, VerificationCompleted |
| Clinical | Tenant patient chart, appointment, encounter, note, diagnosis, order, prescription | EncounterClosed, PrescriptionSigned, LabOrderPlaced |
| Pharmacy | Pharmacy tenant, offer, lot, movement, quote, order, dispense | OfferPublished, QuoteIssued, OrderDispensed |
| Telemedicine | Booking, virtual visit, consent, media-session metadata, follow-up | VisitBooked, VisitCompleted |
| Billing | Patient account, charge, invoice, payment, allocation, receipt, adjustment | InvoiceIssued, PaymentRecorded |
| Communications | Template, preference, delivery attempt and status | Consumes selected domain events; NotificationDelivered/Failed |
| Interoperability | External mappings, partner authorization, transfer state | Consumes domain events; ExternalTransferCompleted/Failed |
| Audit | Security and domain audit append, access reason and trace reference | Receives transactional audit append from all modules |

Ownership means one module writes a record; other modules call an application interface or consume a published event. Read projections may join approved data but must not become a second write authority.

## 6. Synchronous versus asynchronous contract

### 6.1 Synchronous commands

Use an HTTP command and one database transaction when the caller needs a definite result immediately: authenticate, select membership, create patient/encounter, sign a prescription, issue invoice, record payment, allocate stock, approve evidence, publish package or revoke access. Return only after commit with the authoritative resource ID, version, status and request ID. For conflicting concurrent changes, return a conflict; never silently overwrite.

### 6.2 Asynchronous work

Use an outbox event and worker for notifications, public catalogue/roadmap projection, marketplace publication, cross-product prescription dispatch, verification-provider calls, document scanning, reports, exports, external FHIR transfer, email/SMS, provider reconciliation and scheduled entitlement/expiry recalculation. Return 202 Accepted with operation ID and a status URL when the requested *business operation itself* cannot finish within the HTTP request.

### 6.3 Event delivery rules

1. Mutating service writes business record, audit event and outbox row in **one** PostgreSQL transaction.
2. Worker claims committed outbox rows in bounded batches (for example, row-locking with SKIP LOCKED), publishes/executes outside the transaction, and records attempts and next retry.
3. Delivery is at least once. Consumer stores an inbox record keyed by event ID and consumer name; duplicate deliveries are no-ops.
4. Ordering is guaranteed only per aggregate key where required (for example, one invoice, order or prescription), not globally.
5. Exponential backoff with jitter, maximum attempts and dead-letter/quarantine state prevent hot loops. Operators can inspect and replay only after correcting the cause; replay is audited.
6. Concurrency limits, circuit breakers and provider-specific rate limits prevent one failed integration from exhausting the API or all workers.
7. Event envelopes contain ID, type, schema version, aggregate type/ID, organization scope when applicable, occurred-at, correlation/causation IDs and a minimal payload. Do not put clinical note text, passwords, payment credentials or full patient demographics on a general event bus.
8. Status endpoints or authorized server-sent events may inform the browser of completion. Clients reconnect and re-fetch authoritative state; they must not infer success from a timer.
9. Every async operation has a timeout, cancellation/expiry policy, retry classification and reconciliation path. Compensation is an explicit new business record, not deletion of a committed fact.

Proposed event names are versioned, such as clinical.prescription.signed.v1 and billing.payment.recorded.v1. A schema registry or checked-in JSON Schemas defines compatibility rules. The database outbox is sufficient at first; introduce a broker only when throughput, fan-out or independent deployment requires it.

### 6.4 Async operation resource

For long-running tasks, the API returns 202 with Location: /api/v1/operations/{id}. The operation record contains a safe status (QUEUED, RUNNING, SUCCEEDED, FAILED, CANCELLED or EXPIRED), submitted/updated times, a result link when authorized and an error code. It must not reveal another tenant's existence. A 202 means **accepted for processing**, not “approved”, “paid”, “dispensed” or “clinically complete”. A retry with the same idempotency key returns the same operation.

### 6.5 Failure classes and recovery

| Failure | Required behavior |
| --- | --- |
| Request validation/authorization fails | No business mutation or outbox event; deterministic 4xx; safe audit of denial |
| Database transaction fails | Roll back business, audit and outbox writes; caller may retry safely |
| Database commits, worker is down | Outbox remains pending; health alert; recover on restart |
| Event delivered twice | Inbox/idempotency key prevents duplicate outcome |
| Provider times out with unknown outcome | Reconcile by provider reference before retry; do not initiate a second payment blindly |
| Permanent provider rejection | Mark operation FAILED with actionable reason; notify authorized owner; no fake completion |
| Projection lags | Serve last known projection with freshness timestamp or explicit unavailable state; do not invent inventory, price or status |
| Worker poison event | Quarantine with correlation ID, alert and approved replay path |

## 7. End-to-end workflows

### 7.1 Organization onboarding and provisioning

1. Applicant creates an application draft on the server; autosave is versioned and authenticated or bound to a secure applicant session. Uploaded evidence goes to quarantine storage with metadata only in the draft.
2. Submission atomically changes DRAFT to SUBMITTED, records applicant attestation and audit, and emits ApplicationSubmitted.
3. Worker scans documents, runs approved external checks and creates reviewer tasks. Automated checks provide evidence, not approval.
4. Compliance reviewer sees only authorized cases and explicitly records each decision and reason. NEEDS_INFORMATION creates an applicant-visible request asynchronously; private reviewer notes never appear in applicant responses.
5. Approval changes the application state only. Commercial module snapshots a published package version, creates a quote and waits for acceptance/payment evidence.
6. Verified payment/contract state permits a provisioning command. One idempotent transaction creates organization, initial branch, administrator membership, subscription, license and entitlements in a non-live state; a worker performs configuration and reports readiness.
7. Activation is a separate audited action after readiness checks. Failure leaves a recoverable provisioning state, never a half-active tenant.

### 7.2 Encounter, prescription and independent pharmacy

1. A clinician with tenant/branch privileges opens the tenant-owned encounter and records a prescription draft.
2. Signing validates clinician eligibility, patient/encounter ownership, required fields and version; commit stores an immutable signed version, audit and PrescriptionSigned event.
3. A worker creates a minimal, consent/authorization-scoped pharmacy request or patient-visible referral. The independent pharmacy receives only what is necessary for fulfilment; it never gains general access to the hospital chart.
4. Pharmacy reviews the request, checks offer/lot availability, issues a versioned quote and waits for patient acceptance/payment where applicable.
5. Dispensing atomically records lot allocation, stock movement, dispensing professional, patient/order reference and audit. Follow-up notification and hospital/patient status projections run asynchronously.
6. A provider outage leaves the prescription signed and dispatch PENDING/FAILED with a retry/reconciliation path; it must not fabricate a pharmacy acknowledgment.

### 7.3 Pharmacy marketplace publication and ordering

1. Pharmacy admin creates an offer and storefront configuration in the pharmacy tenant. Drafts are private.
2. Publication checks verified pharmacy status, approved product/medicine catalog linkage, price, stock/public availability, prescription rules and required approvals. It creates OfferPublished.
3. Worker builds a public-only marketplace projection with tenant/storefront ID, safe offer fields, published price and freshness timestamp. Patient Telemedicine queries this backend projection; cross-origin localStorage is never used for production synchronization.
4. Checkout takes a server-side price and availability snapshot, validates prescription/age/quantity rules, creates an order in PAYMENT_PENDING or REVIEW_PENDING, and obtains a payment intent if needed.
5. A signed provider webhook, not the browser redirect, confirms payment. Order allocation, fulfilment transitions and customer notifications follow their own state machines.
6. Unpublication and recall invalidate public listings and block new orders; existing orders retain their original snapshot and enter a controlled exception workflow if affected.

### 7.4 Billing, payment and accounting

1. Authorized clinical/lab/pharmacy source captures a charge with a unique source reference; billing creates or locates the encounter account.
2. Invoice issuance locks eligible charges, snapshots item descriptions/prices/taxes and writes immutable invoice lines and audit in one transaction.
3. Cash/bank recording validates amount, currency, authorization, reference and idempotency key; transaction locks invoice/account and writes payment, allocation, receipt, balance and outbox. Status is **derived** from total less valid allocations and reversals.
4. Online payment starts as PENDING. Verified provider webhook drives recording; a return URL is informational only. Unknown webhook results enter reconciliation.
5. Refunds/credits/reversals append compensating records with reason and approval. Original payment and audit entries remain intact.
6. Worker posts an accounting integration event and notifications after commit. Accounting failure does not erase the payment; it creates an exception requiring reconciliation.

### 7.5 Booking, telemedicine and results

- Booking synchronously reserves an available slot with a version/uniqueness constraint; calendar messages are async.
- Video token issuance is short-lived and authorized for the appointment participants. Media provider callbacks update connection metadata, not clinical truth.
- A clinician signs consultation notes and orders in the clinical module; visit-complete notifications and downstream pharmacy/lab workflows are async.
- Laboratory specimen chain-of-custody and final-result approval are transactional and role-separated. Result delivery to patient/clinician runs after approval.
- Patient-facing timelines query consent-filtered server projections; they do not merge every organization's chart automatically.

## 8. Data architecture

### 8.1 Identity and ownership model

The global Identity row represents a person/account, not permission to read all records about that person. Membership connects an identity to organization, role, status and authorized branches. PlatformUser is a separate control-plane persona. PatientProfile is a global patient-facing profile; TenantPatient links or registers a patient inside an organization's chart. Cross-tenant matching/linking requires governed matching evidence, authorization and audit. ConsentGrant or other applicable legal basis governs release to another organization, pharmacy, caregiver or external system. Absence of a grant must not be interpreted as permission.

### 8.2 Suggested PostgreSQL schemas

| Schema | Representative entities | Scope |
| --- | --- | --- |
| identity | identities, external_subjects, memberships, sessions, delegations, MFA/audit references | Global control data; tightly restricted |
| platform | organizations, branches, products, modules, package_versions, subscriptions, licenses, entitlements | Global control plane |
| onboarding | applications, evidence_metadata, checks, verification_cases, provisioning_operations | Applicant/platform case scope |
| clinical | tenant_patients, encounters, notes, observations, orders, prescriptions, lab_results | Organization + branch |
| pharmacy | pharmacy_profiles, drug_catalog, offers, lots, stock_movements, quotes, orders, dispensing | Pharmacy organization + branch; public projection separately |
| billing | patient_accounts, charges, invoices, invoice_lines, payments, allocations, receipts, reversals | Organization + branch |
| telemedicine | bookings, virtual_visits, consents, media_sessions | Patient and authorized organization |
| integration | outbox_events, inbox_receipts, external_transfers, provider_callbacks, operations | Scoped by source/target and operation |
| audit | audit_events, access_events, security_events, export_jobs | Append-only, segregated access |
| public | published_packages, marketplace_listings, published_roadmap, provider_directory | Explicitly published, no private source rows |

Schema separation is a maintainability boundary, not by itself a security boundary. All tenant-owned tables include organization_id; branch-owned tables also include branch_id. Tenant-qualified foreign keys, unique constraints and indices include organization_id where practical. Public projections are generated by controlled publish code and contain only approved fields.

### 8.3 Isolation and transaction context

- API verifies identity and active membership before constructing a trusted request context. The client-selected organization is a requested context, not proof of membership.
- In each database transaction set app.organization_id and authorized branch scope using transaction-local parameters. Never use a global session setting that can leak through a connection pool.
- Enable and FORCE row-level security on tenant tables. Runtime database roles must not own protected tables or have BYPASSRLS. Platform operations use separately authorized paths; ordinary platform operators do not bypass clinical RLS.
- Service methods check resource-specific permission, patient relationship and state-transition rules in addition to RLS. Object IDs from URLs are always looked up in authorized scope.
- Test two tenants with colliding human invoice numbers, patient numbers and idempotency keys. A cross-tenant request must return no data and cause no mutation.
- Dedicated database/schema isolation may be offered later for selected tenants; preserve tenant-aware repository interfaces from the start.

### 8.4 File, financial and audit data

- Documents use a short-lived upload authorization, private object storage, file-size/type checks, checksum, malware scan and status before reviewer/clinician access. Download is time-bound and reauthorized. Never serve arbitrary bucket keys supplied by the browser.
- Money uses integer minor units plus ISO currency; exchange rate and tax rules are versioned. No floating-point money columns.
- Signed clinical notes, final lab results, invoices, payment allocations, stock movements and audit events are immutable business facts. Amendments and reversals create new linked records.
- Audit stores actor, organization, branch, action, target, timestamp, reason, outcome, correlation ID and before/after metadata only where safe. It is not a dump of clinical note bodies or passwords.
- Retention, archival, erasure exceptions and legal holds are policy-driven and jurisdiction-approved; they cannot be finalized solely by engineering.

### 8.5 Database invariants and lifecycle states

Use database constraints as the final guard beneath application policy. Representative constraints include unique (organization_id, mrn), unique (organization_id, invoice_number), unique (provider, provider_event_id), unique (tenant/actor/operation, idempotency_key), tenant-qualified foreign keys, nonnegative monetary amounts where the record type requires them, and check constraints for valid quantity/currency. A stock movement is append-only and references lot, actor, reason and source command. Reservation changes require row locking or serializable conflict handling; a cached stock total is reconciled from the ledger and is never a second authority. All tables that can be accessed by a tenant request are reviewed for RLS coverage, including join tables, search tables and report materializations.

State transitions are explicit application commands, not arbitrary status PATCHes. Suggested initial state machines (subject to domain-owner review):

| Aggregate | Allowed outline | Terminal/exception discipline |
| --- | --- | --- |
| Application | DRAFT → SUBMITTED → IN_REVIEW → NEEDS_INFORMATION / APPROVED / REJECTED | Resubmission preserves earlier submissions and decisions; approval is not activation |
| Tenant | PROVISIONING → READY → ACTIVE → SUSPENDED / TERMINATED | Failed provisioning is recoverable; suspended tenant remains auditable |
| Prescription | DRAFT → SIGNED → DISPATCH_PENDING → DISPATCHED / DISPATCH_FAILED → FULFILLED / CANCELLED | Signed content is immutable; failed dispatch does not undo signing |
| Offer | DRAFT → IN_REVIEW → PUBLISHED → UNPUBLISHED / SUSPENDED / RECALLED | Public projection is derived and may lag; recall blocks new allocation immediately |
| Pharmacy order | REVIEW_PENDING / PAYMENT_PENDING → CONFIRMED → RESERVED → DISPENSED / FULFILLED | Cancel/refund after payment uses explicit compensating transitions |
| Invoice | DRAFT → ISSUED → VOIDED / ADJUSTED | Due/PARTIAL/PAID is calculated from immutable totals and allocations, not manually transitioned |
| Async operation | QUEUED → RUNNING → SUCCEEDED / FAILED / CANCELLED / EXPIRED | Retry creates attempt history; terminal failure remains visible until resolved |

Cross-module references use stable opaque IDs and bounded snapshots. For example a pharmacy order stores the accepted quote version, price/currency and authorized prescription reference but not a copy of the full hospital chart. A payment records provider reference and verification evidence but no raw card data. Public projection rows retain source version and published-at timestamp so consumers can detect lag.

## 9. API and frontend integration contracts

### 9.1 HTTP conventions

- Canonical path family: /api/v1. Existing /api/auth paths may be aliased during migration, but one contract must prevail. Publish OpenAPI and generate/verify TypeScript clients.
- JSON single-resource response: data plus requestId. Lists: items, nextCursor and optional total. Maximum page size is bounded. Timestamps are UTC ISO-8601; display timezone is a frontend concern.
- Error response contains stable error.code, safe message, field details where applicable and requestId. 401 is unauthenticated, 403 forbidden, 404 not found within authorized scope, 409 conflict, 422 validation, 429 rate limit, 503 unavailable.
- Financial, clinical, dispensing and provisioning commands require Idempotency-Key scoped by tenant, operation and actor. Reusing a key with a different payload returns 409.
- Mutable drafts use an ETag/version precondition (If-Match); signed or published versions are amended by explicit commands, not PATCH-overwrite.
- 202 responses carry operationId/statusUrl and never imply completion. Long-running UI polls with backoff or subscribes to an authorized event stream, then re-fetches the resource.
- CORS allows exact known frontend origins. It is not authorization. Central sign-in uses registered redirect URIs and secure cookies or a reviewed browser-session design; browser localStorage is not a cross-origin identity mechanism.

### 9.2 Frontend migration map

| Current frontend seam | Backend target | Migration rule |
| --- | --- | --- |
| src/identity/service.ts and src/store/useAuth.ts | Identity/session/membership API | Replace local fixtures; keep Sabi ID and organization selector UX; block unauthorized route and API |
| src/registration/repository.ts | Application draft/submit/evidence API | Browser autosave may cache only non-sensitive draft state; server owns submitted case |
| src/command-center/useCommandCenter.ts | Platform catalog, tenant, subscription, audit APIs | Replace global browser authority with HTTP repository; public catalog via approved projection |
| src/store/useTenant.ts and src/platform/persist.ts | Verified active membership/tenant context | Retain client context for navigation only; server derives scope on every command/read |
| src/pharmacy/catalogue.ts, workflow.ts and api.ts | Pharmacy, stock, marketplace and order APIs | Remove production local projection bridge; preserve local fixture adapter only for tests/dev |
| src/billing/runtime.ts, api.ts and server contracts | Mounted billing Node service with PostgreSQL repository | Preserve client contract; move server-only code into backend and validate transactional behavior |
| apps/telemedicine/packages/patient-portal/src | Session, patient, booking, consultation, marketplace APIs | Remove navigation-only login and generated success outcomes before live release |
| src/roadmap/service.ts and usePublicRoadmap.ts | Platform authoring API and public published projection | Preserve publication rules and safe DTO; backend becomes authority |

### 9.3 Initial API groups

Identity/session and memberships; organizations/branches/users/roles; applications/evidence/review/provisioning; catalog/packages/subscriptions/entitlements; patients/appointments/encounters/notes/orders/prescriptions; pharmacy/offers/stock/quotes/orders; billing/invoices/payments/receipts; telemedicine/bookings/visits; public marketplace/catalog/roadmap; operations/audit/reports. The existing docs/BACKEND_API_REQUIREMENTS.md enumerates candidate routes; implementation must reconcile duplicate naming and publish one canonical OpenAPI contract before client migration.

### 9.4 Representative command/query contracts

These are design-level contracts, not a claim that the endpoints already exist. Final paths/DTOs belong in the reviewed OpenAPI specification. The server infers authorized organization context from the validated session/membership; a requested organization selector is checked, never trusted.

| Interaction | Proposed API shape | Commit / async outcome |
| --- | --- | --- |
| Switch organization | POST /api/v1/session/active-organization | Verified membership context; no access merely from client selection |
| Submit application | POST /api/v1/applications/{id}/submit with If-Match | 200/201 after state/audit/outbox commit; scanning/review later |
| Provision tenant | POST /api/v1/applications/{id}/provision with Idempotency-Key | 202 and operation URL if infrastructure setup follows a committed provisioning record |
| Publish package | POST /api/v1/packages/{id}/versions/{version}/publish | New immutable version committed; public cache/projection async |
| Sign prescription | POST /api/v1/prescriptions/{id}/sign with If-Match and Idempotency-Key | Signed version committed; pharmacy dispatch async and separately visible |
| Publish pharmacy offer | POST /api/v1/pharmacy/offers/{id}/publish | Eligible source state committed; public marketplace projection async |
| Reserve order stock | POST /api/v1/pharmacy/orders/{id}/reserve with Idempotency-Key | Reservation and stock ledger committed or conflict; notification async |
| Record payment | POST /api/v1/invoices/{id}/payments with Idempotency-Key | Payment/allocation/receipt committed; derived balance returned; notifications/accounting async |
| Payment provider event | POST /api/v1/webhooks/payments/{provider} | Signature/replay validated, event persisted and reconciled; safe provider acknowledgment |
| Read operation | GET /api/v1/operations/{id} | Authorized status, timestamps, safe error and result link |
| Read marketplace | GET /api/v1/public/marketplace?cursor=... | Approved listing fields and freshness, bounded pagination/cache |

For critical commands, the sequence is: validate identity/context/payload and idempotency; lock or version-check target; enforce state/policy; write authoritative records plus audit and outbox; commit; return the committed version. A synchronous payment command cannot return success before the payment/allocation commit. An asynchronous prescription dispatch cannot change a signed prescription back to draft if a partner is unavailable. APIs expose a stable request ID to connect UI feedback, audit and traces without leaking private data.

## 10. Functional requirements

Priority P0 is the minimum controlled pilot foundation, P1 is the next production increment, and P2 is later/conditional. The IDs are stable and must appear in API specifications, tests and implementation tickets.

### 10.1 Identity, tenancy and control plane

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-001 | P0 | Authenticate patient, organization and platform personas through one canonical server identity contract; reject invalid or revoked sessions. |
| FR-002 | P0 | Support MFA and step-up authentication for platform access, sensitive clinical actions, payment reversal and support access according to policy. |
| FR-003 | P0 | List only memberships available to the authenticated identity and permit explicit active-organization selection. |
| FR-004 | P0 | Enforce role, permission, organization, branch and record relationship on every protected API read and write. |
| FR-005 | P0 | Create, invite, suspend and revoke organization users with auditable lifecycle and scoped roles. |
| FR-006 | P0 | Separate platform roles from tenant roles; platform operations cannot automatically read tenant charts. |
| FR-007 | P0 | Create organization application drafts, autosave versions, submit and resume from another device. |
| FR-008 | P0 | Stage evidence privately, scan it, and expose it only to authorized applicant/reviewer roles. |
| FR-009 | P0 | Resolve applicable compliance requirements from jurisdiction/facility facts; unknown configurations require manual review. |
| FR-010 | P0 | Record reviewer checks, information requests, decisions, reasons and applicant-visible messages with separate visibility. |
| FR-011 | P0 | Provision a tenant once from an approved/paid case and create branch, admin membership, subscription and entitlements atomically or recoverably. |
| FR-012 | P0 | Publish versioned product/module/package/pricing catalog; subscription snapshots do not change when a later package version is edited. |
| FR-013 | P0 | Activate, suspend, renew and terminate subscriptions using server-calculated entitlement state; propagate changes to tenant access. |
| FR-014 | P1 | Permit time-limited, approved, reasoned support access with patient-sensitive access separately controlled and audited. |
| FR-015 | P1 | Expose public catalog/roadmap through reviewed DTOs only; unpublished/private fields are absent, not merely hidden by UI. |
| FR-016 | P1 | Provide session inventory/revocation, recovery, SSO integration and credential-change notifications. |

### 10.2 Clinical and patient

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-017 | P0 | Register tenant patients with unique tenant MRN, demographics, duplicate warnings and provenance; do not automatically merge records. |
| FR-018 | P0 | Book, reschedule and cancel appointments with conflict prevention, participant authorization and state history. |
| FR-019 | P0 | Check in a patient and open a tenant/branch-owned encounter linked to the authorized patient. |
| FR-020 | P0 | Record versioned observations, nursing notes, consultation notes and diagnoses with author, timestamp and encounter linkage. |
| FR-021 | P0 | Sign a clinical note or prescription only with authorized professional role and required validation; preserve signed version and amendment history. |
| FR-022 | P0 | Create laboratory orders, specimen chain-of-custody, draft results and authorized final approval with provenance. |
| FR-023 | P0 | Release patient-visible results and prescriptions only under the approved access policy and consent/legal basis. |
| FR-024 | P1 | Support caregiver/dependent delegation with relationship, scope, expiry, revocation and audit. |
| FR-025 | P1 | Generate authorized cross-organization referral or data-sharing request without opening the whole source chart. |
| FR-026 | P1 | Export interoperable clinical resources through configured FHIR profiles and partner authorization. |

### 10.3 Pharmacy, marketplace and telemedicine

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-027 | P0 | Maintain pharmacy organization profile, branches, verified professional/license status and storefront settings independently of hospital tenancy. |
| FR-028 | P0 | Create/update drug offers with catalog linkage, price, prescription requirement, availability, branch and publication state. |
| FR-029 | P0 | Record lot/batch, expiry, receipt, adjustment, reservation and dispense movements in a server stock ledger; derive balance from movements/reservations. |
| FR-030 | P0 | Publish only approved/eligible offers to a public, minimal and freshness-stamped marketplace projection. |
| FR-031 | P0 | Route an authorized signed prescription request to selected pharmacy participants without exposing unrelated chart data. |
| FR-032 | P0 | Create versioned quotes and patient acceptance; preserve accepted prices and terms. |
| FR-033 | P0 | Create idempotent orders and enforce reviewed fulfilment/dispense transitions with pharmacist attribution. |
| FR-034 | P0 | Authenticate Telemedicine users before dashboard or protected patient operations; eliminate navigation-only login. |
| FR-035 | P1 | Book virtual visits against provider availability and issue short-lived, participant-scoped media tokens. |
| FR-036 | P1 | Link completed virtual encounters, prescriptions and follow-up instructions to the authorized patient timeline. |
| FR-037 | P1 | Support marketplace checkout, delivery tracking, exception handling and order status reconciliation. |
| FR-038 | P2 | Add advanced refill, family purchase, insurer/payer and cross-pharmacy transfer flows after governance review. |

### 10.4 Revenue, communications and operations

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-039 | P0 | Open a patient account and capture charges using unique source references and tenant-scoped idempotency. |
| FR-040 | P0 | Issue immutable invoices from eligible charges with price/tax snapshot and derived balance/status. |
| FR-041 | P0 | Record cash/bank payments as immutable payment, allocation and receipt records in one transaction. |
| FR-042 | P0 | Verify provider webhooks before recording online payment; browser return alone cannot mark paid. |
| FR-043 | P0 | Handle reversal/refund/credit as append-only compensating records with authorization and reason. |
| FR-044 | P0 | Record security, patient access, clinical, pharmacy, commercial and financial audit events from server-side action context. |
| FR-045 | P0 | Enqueue and deliver idempotent asynchronous work with operation status, retry history, quarantine and operator replay. |
| FR-046 | P1 | Deliver consent- and preference-aware email/SMS/in-app notices; never include detailed PHI in unsafe channels. |
| FR-047 | P1 | Produce authorized reports and exports asynchronously, with secure download expiry and access audit. |
| FR-048 | P1 | Reconcile provider payments, stock, outbox, publication and accounting exceptions through operational queues. |
| FR-049 | P1 | Expose tenant-filtered Command Center health, incidents and worker lag without disclosing clinical content. |
| FR-050 | P2 | Add equipment, HR, accounting, insurer and external public-health integrations behind their own approved module contracts. |

### 10.5 Frontend experience requirements

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-051 | P0 | Each existing frontend displays loading, empty, unauthorized, error and retry states from real API outcomes; no generated success timer. |
| FR-052 | P0 | The active organization/branch and current entitlement set are visible and refreshed after membership or subscription changes. |
| FR-053 | P0 | A command submitted twice by click/retry uses one idempotency key and resolves to one authoritative resource. |
| FR-054 | P0 | Asynchronous screens show accepted, processing, completed and failed distinctly, with refresh/reconnect support. |
| FR-055 | P0 | Public Health, Pharmacy, EMR, Command Center and Telemedicine links resolve to their own configured origins and return safely after OIDC sign-in. |
| FR-056 | P1 | Public pages identify genuinely unavailable services accurately and never render seed fixtures as production records. |

## 11. Business rules and invariants

| ID | Rule |
| --- | --- |
| BR-001 | A platform identity, patient identity and organization membership are distinct; none implies another. |
| BR-002 | A user may hold multiple memberships, but each request has exactly one verified active organization context unless it is a separately authorized platform/public operation. |
| BR-003 | Branch access is a subset of organization access. A valid organization membership does not imply all-branch rights. |
| BR-004 | Application approval does not itself create an active tenant. Commercial acceptance, payment evidence, provisioning and go-live checks are separate states. |
| BR-005 | Automated corporate, facility, professional or document checks cannot be the sole authoritative approval. |
| BR-006 | A published package version and an accepted quote are immutable; new terms require a new version. |
| BR-007 | Subscription entitlement is calculated from active contract, effective version, license, explicit grants and status; the browser cannot grant it. |
| BR-008 | A hospital chart belongs to its organization. A global patient identity is not automatic consent to aggregate or share charts. |
| BR-009 | Signed notes, prescriptions and final lab results are corrected through amendment/addendum with provenance, not silent overwrite. |
| BR-010 | Only a qualified, authorized professional may sign the corresponding clinical order/result or record dispensing. |
| BR-011 | Pharmacy tenant access to a prescription is limited to the authorized referral/order and minimum fulfilment data. |
| BR-012 | Private drafts, unpublished offers, quarantined products and internal roadmap items never appear in public projections. |
| BR-013 | An out-of-stock, expired, recalled or otherwise prohibited lot cannot be allocated or dispensed. |
| BR-014 | Stock available to sell equals valid on-hand less active reservations, using server-side serialized/locked updates. |
| BR-015 | An order snapshots accepted offer price, currency, quantity, tax/fees and pharmacy identity; later catalogue edits do not reprice it. |
| BR-016 | Invoice status is derived from totals and valid allocations/reversals; staff cannot choose Paid manually. |
| BR-017 | A payment is recorded only from verified cash/bank evidence or an authenticated provider event; an HTTP redirect is not payment proof. |
| BR-018 | Payment, allocation, receipt and original invoice lines are immutable; adjustment/reversal is a new linked record. |
| BR-019 | The same command key with the same payload returns the same committed result; reuse with a different payload is a conflict. |
| BR-020 | A 202 response confirms queue acceptance only. Pending, failed and expired are never displayed as completed. |
| BR-021 | Notifications, FHIR exports and marketplace publication may lag authoritative commands; each projection exposes freshness and recovery state. |
| BR-022 | Consent/delegation revocation blocks future access promptly and is audited; historical disclosure remains in the audit record. |
| BR-023 | Break-glass/support access requires policy eligibility, reason, limited duration, explicit scope, notification/review and full access audit. |
| BR-024 | Public IDs and references may be unique within a tenant; database uniqueness constraints must include tenant scope where appropriate. |
| BR-025 | No protected resource existence, data or error detail is disclosed to an unauthorized tenant. |
| BR-026 | Clinical/financial audit records are append-only and not editable by ordinary application roles. |
| BR-027 | A failed downstream integration cannot silently reverse or erase a committed clinical/financial transaction. |
| BR-028 | Data deletion/retention is governed by approved policy and legal hold, not a generic browser delete action. |

## 12. Security, privacy and trust architecture

### 12.1 Threat model and trust boundaries

The browser, public internet, third-party providers, uploaded files and cross-organization referrals are untrusted boundaries. Frontend route guards, hidden buttons, tenant IDs in URLs and Vercel environment variables are not authorization controls. The Node API authenticates each request, resolves active organization and branch from server-validated membership, evaluates resource-specific policy and scopes its database transaction accordingly. A valid login alone never authorizes access to a patient chart, pharmacy order, subscription or platform operation. Broken object-level authorization is a primary test target.

| Boundary | Required controls |
| --- | --- |
| Browser to API | TLS, strict origin allowlist, secure session/token handling, request validation, CSRF protection if cookie-authenticated, rate limiting, safe errors |
| API to database | Least-privilege roles, parameterized queries, transaction-scoped tenant context, forced RLS, no application superuser/BYPASSRLS |
| API to object storage | Short-lived scoped upload/download grants, owner and purpose checks, checksum, malware scan, private ACL |
| API/worker to providers | Authenticated service credentials, allowlisted endpoints, timeouts, egress control, signed webhook verification and replay defense |
| Control plane to tenant plane | Separately authorized operations; support access requires case, reason, expiry and audit; no implicit chart visibility |
| Hospital to independent pharmacy | Purpose-limited referral/order data and consent or other approved legal basis; no unrestricted chart joins |
| Public projection | Explicit DTO allowlist, publication approval and tenant-safe caching; never reuse internal serializers |

### 12.2 Authentication and sessions

Prefer a reviewed OpenID Connect provider using authorization code with PKCE for browser sign-in. Register each frontend origin and exact redirect URI; use state/nonce and a strict post-login return-path allowlist. MFA is mandatory for platform, finance, pharmacy and clinical privileged roles and available for patients. The selected session model must avoid long-lived browser-accessible secrets; a BFF/secure HttpOnly cookie pattern is preferred where practical. If cross-site cookies are required, explicitly validate SameSite, CSRF and browser behavior; do not assume one localStorage token creates SSO across five origins. Access tokens are short-lived and audience-bound; refresh credentials are rotated and revocable. Telemedicine and Pharmacy must use the same identity authority while retaining separate role and organization checks. Password reset, account recovery, session revocation and suspicious-login notifications are server-owned.

### 12.3 Authorization policy

Authorization checks combine subject, tenant membership, branch assignment, role, entitlement, patient relationship, resource state, purpose and (where relevant) consent/delegation. Policy is evaluated in application services and reinforced by PostgreSQL RLS for tenant-owned tables. Platform operators are not automatically clinicians or pharmacy professionals. A deny-by-default policy covers unknown roles, missing tenant context, expired membership and suspended subscriptions. Every object read, list query and mutation is tested for cross-tenant and cross-branch access; list filtering alone is insufficient.

| Actor | Permitted baseline | Explicitly not implied |
| --- | --- | --- |
| Patient | Own authorized record, appointment, quote/order and payment views | Other patients' data or a complete hospital chart solely from shared Sabi identity |
| Clinician | Assigned/authorized patient encounter and permitted signing actions | Every branch, another organization or pharmacy inventory |
| Pharmacy professional | Own pharmacy inventory/order and minimum authorized referral data | Source hospital chart, another pharmacy's offers or platform package editing |
| Organization administrator | Own organization membership/settings/entitlements | Unrestricted clinical content or platform-wide audit |
| Command Center operator | Scoped platform catalog/onboarding/subscription workflows | Patient chart by default; support access must be separately approved |
| Support operator | Time-limited task-specific access under ticket and reason | Standing superuser access or silent PHI viewing |

### 12.4 Data protection and integrity

Classify public, internal, confidential, patient/clinical, financial and secret data. Encrypt all transport and managed storage, control keys in a managed key service, rotate secrets, separate environments and prohibit production PHI in development fixtures or test screenshots. Logs, traces, metrics and event payloads use allowlisted fields and redact names, clinical text, credentials and payment details. Never store card PAN/CVV; use a payment provider token/reference and verified server webhook. Financial and clinical signed records are append-only with amendments/compensation. Audit records include who, what, when, organization, purpose, resource reference, result, request/correlation ID and source; they are tamper-evident and separately access-controlled. Time is stored in UTC with original timezone when clinically or financially relevant.

Uploaded documents enter a private quarantine, are validated for size/type/checksum, scanned before release and served through short-lived authorized URLs. Export jobs use the same object policy and expire. Retention, erasure, legal hold, patient rights, cross-border transfer and incident-notification periods are policy decisions requiring legal/privacy approval; this architecture makes them configurable and auditable, not assumed.

### 12.5 Security operations and release gates

- Maintain a threat model per vertical slice, dependency inventory/SBOM, secret scanning, SAST, dependency and container scanning, and reviewed migrations.
- Test authorization at API and SQL/RLS levels, including role escalation, ID enumeration, pagination/search leaks, indirect references and cache-key isolation.
- Verify webhook signatures over the original request body, timestamp window, event ID uniqueness and provider account scope before changing financial state.
- Require dual control for high-risk actions such as refund approval, price/package publishing, broad support access and tenant suspension, based on risk policy.
- Rotate/revoke compromised credentials; document incident triage, containment, forensic preservation, disclosure escalation and restore procedures.
- Backups are encrypted and restore-tested. Audit and backups have retention and access controls independent from ordinary operator permissions.
- Commission an independent penetration test and jurisdiction-specific privacy/security review before live patient data or production payment activation.

## 13. Non-functional requirements and proposed service objectives

These are **proposed pilot targets**, not current performance claims or approved SLAs. Measure them against a documented pilot load profile (initial planning envelope: up to 100 organizations, 1,000 simultaneously active users, 100 requests/second sustained API traffic and 10,000 queued jobs/day). Load figures and target percentiles must be approved and revised from real sizing before a contractual promise. Exclude client network time from server latency; report both separately. Patient-safety and payment workflows retain correctness when a performance target is missed.

| ID | Category | Proposed measurable requirement |
| --- | --- | --- |
| NFR-001 | Availability | API monthly availability >=99.9% for the pilot, excluding approved maintenance; publish incident and error-budget reports. |
| NFR-002 | API latency | Under the approved pilot profile, 95% of ordinary authenticated reads <=500 ms and 95% of transactional writes <=1,000 ms at the API edge, excluding external-provider completion. |
| NFR-003 | Async latency | Under normal provider availability, 95% of ready jobs begin within 10 seconds and 99% within 60 seconds; user-facing status exposes longer delays. |
| NFR-004 | Recovery | Proposed database RPO <=5 minutes and service RTO <=60 minutes; demonstrate with quarterly restore/failover exercise, not configuration screenshots. |
| NFR-005 | Durability | No acknowledged clinical, stock or financial command is lost after commit; outbox backlog survives worker restarts and is reconciled. |
| NFR-006 | Consistency | Critical write results are read-after-write consistent from the authoritative API; async projections state freshness and may be temporarily stale. |
| NFR-007 | Concurrency | Concurrent bookings, payments and stock allocations enforce database constraints/versioning; no oversell, double allocation or double charge. |
| NFR-008 | Scalability | API and worker replicas scale independently; database pool, queue concurrency and provider limits are bounded and observable. |
| NFR-009 | Tenant isolation | All protected list, detail, mutation, export, cache and event consumers enforce tenant and branch scope; automated negative tests must pass. |
| NFR-010 | Security | TLS for all external traffic; at-rest encryption and managed keys; privileged MFA; rotation/revocation; no secrets in browser builds or logs. |
| NFR-011 | Privacy | Collect and expose minimum necessary data; record purpose and consent/delegation where required; retention/erasure configurable after legal sign-off. |
| NFR-012 | Auditability | 100% of privileged, clinical-signing, access-denial, billing and support-access actions produce attributable server audit evidence. |
| NFR-013 | Observability | Every request/job has correlation ID and structured redacted logs, metrics and trace context; dashboards show p95 latency, errors, queue lag and tenant-safe health. |
| NFR-014 | Alerting | Page on unavailability, failed payment reconciliation, stuck outbox, backup failure, suspicious access and irreversible data-integrity anomalies; documented owner and response runbook. |
| NFR-015 | Accessibility | Target WCAG 2.2 AA for critical journeys; keyboard, screen reader, contrast, error summary and focus behavior verified before release. |
| NFR-016 | Usability | All five frontends show loading, empty, error, unauthorized and retry states; long operations show accepted/processing/completed/failed distinctly. |
| NFR-017 | Compatibility | Support agreed current Chrome, Edge, Firefox and mobile browser versions; test separate-origin login, redirects and session expiry. |
| NFR-018 | API evolution | Publish OpenAPI 3.1 contract; additive changes remain backward-compatible within v1; breaking changes require version/migration window. |
| NFR-019 | Event evolution | Version event schemas; consumers ignore unknown optional fields and reject incompatible schema with quarantine rather than corrupt state. |
| NFR-020 | Deployment | Zero-secret static frontend builds, migration-before-traffic checks, health/readiness gates, canary/rollback plan and per-environment separation. |
| NFR-021 | Testability | CI runs unit, contract, integration, RLS, concurrency and end-to-end critical journeys against disposable test infrastructure. |
| NFR-022 | Cost control | Track API, database, object, provider and queue costs by environment/product/tenant where practical; set budgets and rate limits. |
| NFR-023 | Localization | Persist UTC instants and ISO currency; render date, timezone and currency for user/tenant; do not infer tax or legal terms from browser locale. |
| NFR-024 | Data portability | Authorized exports are complete, encrypted, time-limited, reproducible and audit-linked; importing cannot bypass validation or provenance. |
| NFR-025 | Operability | Runbooks exist for stuck jobs, webhook ambiguity, failed migrations, stock discrepancy, account compromise, tenant suspension and restore. |
| NFR-026 | Resilience | External-provider timeout does not exhaust API workers; retry only safe operations, use circuit breakers and reconcile unknown outcomes. |

Service-level indicators must specify numerator/denominator, sampling window, exclusions and instrumentation before approval. Job-lag targets do not apply to provider outages, but outage and backlog remain visible and alertable. A 99.9% availability target does not relax zero-tolerance integrity invariants.

## 14. Acceptance criteria and verification

The following are release-verifiable Given/When/Then criteria. Test automation should provision at least two hospital organizations, two independent pharmacies, multiple branches, a shared user with different memberships, patients with colliding display identifiers, and a platform operator without clinical permission. Tests must run against the real API and PostgreSQL policies, not only mocked frontend services.

| ID | Related requirements | Acceptance criterion | Verification |
| --- | --- | --- | --- |
| AC-001 | FR-001, FR-034 | Given no valid session, when any protected EMR, Pharmacy, Command Center or Telemedicine route/API is opened, then protected data is absent and API returns 401; a navigation-only Telemedicine login cannot enter the dashboard. | Browser E2E + API |
| AC-002 | FR-001, FR-002 | Given an invalid, expired or revoked credential, when a login or privileged command is attempted, then it is rejected, existing sessions follow revocation policy and a safe security event is recorded. | Identity integration |
| AC-003 | FR-003, FR-004 | Given a user belongs to organizations A and B, when A is selected, then all protected reads/writes are scoped to A; changing a request header/path to B without valid membership cannot bypass policy. | API + RLS |
| AC-004 | FR-004, NFR-009 | Given tenant A and tenant B own colliding resource IDs/references, when A lists, fetches, updates, exports or guesses B's resource URL, then no B data or existence detail is returned and no B mutation occurs. | Negative API/RLS matrix |
| AC-005 | FR-004, BR-003 | Given a user is assigned only branch A1, when querying or mutating A2, then access is denied even though both branches belong to A. | API + SQL integration |
| AC-006 | FR-006, FR-014 | Given a platform operator lacks an approved support case, when requesting a tenant chart, then access is denied; approved time-boxed access requires reason, scope, expiry and audit, and stops at expiry/revocation. | Policy + audit integration |
| AC-007 | FR-007–FR-010 | Given an application draft and private evidence, when it is resumed on another device and submitted, then server versions persist, document scan status is visible, and applicant never receives reviewer-private notes. | E2E + API |
| AC-008 | FR-011–FR-013 | Given an approved application and commercial prerequisites, when provisioning is requested twice or worker restarts, then exactly one organization/initial branch/admin/subscription exists and activation waits for readiness. | Concurrency + recovery integration |
| AC-009 | FR-012 | Given an accepted package version, when an operator edits pricing, then a new version is published and existing quote/subscription snapshots remain unchanged. | Contract + database |
| AC-010 | FR-015, FR-030 | Given unpublished package, roadmap item or pharmacy offer, when public endpoints are queried, then private fields and unpublished records are absent from payload, search result and cache. | Public API snapshot/security |
| AC-011 | FR-017–FR-021 | Given a signed note/prescription, when a user attempts direct update/delete, then the operation is rejected; an authorized amendment creates a linked new version preserving original author/time. | Clinical API + database |
| AC-012 | FR-022, FR-023 | Given a lab result is draft, when a patient views results, then it is hidden; after qualified approval and authorized release it is visible with provenance and access audit. | Clinical E2E |
| AC-013 | FR-024, BR-022 | Given a caregiver's scoped delegation expires or is revoked, when that caregiver retries patient access, then future reads are denied and prior disclosures remain auditable. | Policy + clock-bound integration |
| AC-014 | FR-031 | Given a signed prescription routed to pharmacy P1, when P1 reads the referral, then only minimum fulfilment data is present; pharmacy P2 and P1's unrelated users cannot read it. | Cross-tenant API |
| AC-015 | FR-028–FR-030 | Given a pharmacy publishes an eligible offer, when publication worker completes, then Telemedicine marketplace shows the approved price, seller and freshness; private/expired/disabled products are not shown. | Cross-origin E2E |
| AC-016 | FR-029, FR-033 | Given one saleable unit and two concurrent orders, when both attempt reservation, then at most one succeeds and stock ledger reconciles without negative available stock. | Database concurrency |
| AC-017 | FR-032, FR-033 | Given an accepted quote, when the offer price later changes, then the existing order retains accepted version/price/currency and a new order sees the current offer. | Order integration |
| AC-018 | FR-034–FR-036 | Given a booked virtual visit, when an unauthorized identity requests a media token or visit record, then access is denied; authorized participants receive time-limited tokens and signed clinical output appears in the authorized timeline. | E2E + provider stub |
| AC-019 | FR-039–FR-041 | Given charges and a partial payment, when invoice is issued and payment recorded, then amount, allocation, receipt and derived PARTIAL/outstanding balance agree; staff cannot submit a free-form Paid status. | Billing integration |
| AC-020 | FR-041–FR-043 | Given a payment command or provider webhook is repeated, when replayed with the same key/event ID, then only one financial effect exists; changed payload with reused key is 409. | Idempotency + webhook |
| AC-021 | FR-042 | Given an unsigned/invalid/replayed webhook or browser success redirect, when received, then invoice remains unpaid and a safe rejection/reconciliation event is recorded. | Payment security |
| AC-022 | FR-043–FR-044 | Given an approved reversal, when completed, then original invoice/payment/audit remain intact, a new compensating record exists and balance/status recompute correctly. | Ledger/audit integration |
| AC-023 | FR-045, NFR-005 | Given the API commits a command and the worker crashes before processing, when it restarts, then the outbox event is eventually processed without duplicate domain effect. | Fault injection |
| AC-024 | FR-045, FR-054 | Given a long-running operation returns 202, when it is queued, running, failed or complete, then the authorized status endpoint and UI distinguish each state; retries return the same operation. | API + browser E2E |
| AC-025 | FR-045, NFR-019 | Given an incompatible/poison event, when retries are exhausted, then it is quarantined with alert, tenant-safe details and audited operator replay; other tenants' jobs continue. | Worker integration |
| AC-026 | FR-046–FR-047 | Given notification/export failure, when provider/object store is unavailable, then core command remains committed, status shows failure/retry and no PHI enters SMS/email/log payloads. | Fault injection + payload inspection |
| AC-027 | FR-051–FR-056 | Given API latency, 401, 403, 409, 422, 429, 503 and network loss, when each existing frontend performs a critical action, then it shows the correct loading/error/retry state without fabricating completion. | Five-frontend E2E |
| AC-028 | NFR-001–NFR-004 | Given approved pilot load and a failover exercise, when measured over agreed windows, then latency/availability/queue objectives and restore RPO/RTO meet approved targets, or release is blocked with documented waiver. | Load + disaster-recovery drill |
| AC-029 | NFR-010–NFR-014 | Given a production-like request, when traced through API and worker, then correlation is preserved, protected data is redacted, required audit exists and alarms fire for simulated stuck jobs/backup failures. | Security + observability drill |
| AC-030 | NFR-015–NFR-025 | Given each critical onboarding, clinical, pharmacy and payment journey, when tested with keyboard/screen reader and supported browsers, then accessibility and compatibility criteria pass; environment/restore/runbooks are signed off. | Accessibility + release review |

An acceptance test is complete only when the UI, API response, database state, outbox/inbox state and audit evidence agree. A mocked frontend success or a green unit suite alone does not satisfy a cross-product criterion. Clinical and financial edge cases need sign-off from designated domain owners, not engineering alone.

## 15. Delivery architecture, testing and operations

### 15.1 Backend code structure

Consolidate the Express/Prisma starting backend into one maintained source tree, whether retained as a separate backend repository or moved into this repo after an ADR. Suggested modules: identity, tenancy, onboarding, catalog, clinical, pharmacy, billing, telemedicine, public, audit and integrations. Each module has transport/controller, validated command/query contracts, application service, domain rules, repository and event handlers. Shared infrastructure supplies authentication context, transaction manager, outbox, idempotency, audit, object storage, HTTP client and observability. Domain modules cannot query another module's tables directly outside an approved read projection; expose an application interface/event contract.

Use Prisma for routine typed persistence where it is reliable, but review generated migrations and use explicit PostgreSQL SQL for RLS policies, tenant-qualified constraints, advisory/row locking, outbox claiming and other invariants Prisma cannot safely express. Backend startup fails if required migrations or RLS policies are missing. Production database credentials have neither schema-owner nor bypass-RLS privileges. The worker uses the same versioned code and module contracts, deployed separately. An operation table and outbox/inbox tables belong in the first backend increment.

### 15.2 Repository, API and environment topology

The present frontend repo already has five build targets. Recommended environment topology is development, staging (production-like test data only) and production, each with separate API, worker, PostgreSQL, object store, provider credentials and frontend environment variables. Placeholder domains can be health.example, emr.example, pharmacy.example, command.example, telemedicine.example, api.example and auth.example until actual domains are approved. Each frontend points to one environment's API/authorization origins; mixing staging/prod origins fails CI deployment checks. Do not put service secrets in Vercel static build variables.

Maintain one OpenAPI contract and consumer-driven contract tests. For each vertical slice, migrate existing TypeScript service adapters to the real endpoint behind an explicit environment-specific development fixture toggle. Production builds reject fixture mode and endpoints that route to localhost. Seed data is for local/staging environments and is labeled as such. Backfill/migrate browser-only data only through a reviewed import with owner mapping, duplicate detection and audit; never silently promote localStorage into production.

### 15.3 CI/CD and change management

1. Pull request: formatting/typecheck, unit tests, API schema compatibility, dependency/secret scan, and frontend builds for all five targets.
2. Disposable PostgreSQL integration: migrations from blank database, RLS negative tests, transactional/outbox tests, concurrency tests and webhook replay tests.
3. Staging deployment: migration dry-run/backup check, API/worker health, smoke tests across five origins, synthetic monitor, fault injection and approved test data.
4. Production rollout: reviewed change, backup/PITR verification, backward-compatible migration, API/worker canary, frontend deployment, live telemetry watch and rollback decision.
5. Schema changes use expand/migrate/contract: add compatible schema, deploy dual-compatible code, backfill in bounded audited jobs, then remove old fields in a later release. A frontend rollback must remain compatible with the API during the rollout window.

Use feature flags for vertical migration, not for authorization. A disabled screen must still be blocked by backend entitlement/policy. All production configuration is reviewed and tracked; emergency changes and access are time-bound and audited.

### 15.4 Test layers and operational runbooks

Unit tests cover domain state machines, policy rules, tax/amount calculations and event payload minimization. Integration tests exercise real PostgreSQL constraints/RLS, object storage adapters and provider stubs. Contract tests compare generated clients to OpenAPI and event schemas. Browser E2E covers each frontend origin, sign-in, tenant switching and a connected cross-product journey. Security tests include BOLA, CSRF/session, IDOR, upload, webhook and cache isolation. Load tests use realistic tenant skew and worker backlog; chaos tests terminate workers after commit and disconnect external providers. Restore tests verify both recoverability and data integrity. Runbooks name owner, trigger, diagnosis, safe replay/reconciliation, escalation and post-incident review.

## 16. Phased implementation and migration plan

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| 0. Architecture decisions | Confirm identity provider, legal jurisdiction, deployment ownership, data residency, provider choices, pilot load and clinical/financial sign-off roles | Approved ADRs, threat model and scoped pilot |
| 1. Foundation | Consolidated Node API; OpenAPI; OIDC/session; PostgreSQL migrations/RLS; memberships/branches; audit; idempotency; outbox/inbox; worker; CI/telemetry | AC-001–AC-006, AC-023–AC-025 in staging |
| 2. Control plane/onboarding | Server application/evidence/review, package versions, entitlements, provisioning and public catalog; migrate Command Center and registration flows | AC-007–AC-010, tenant lifecycle drill |
| 3. One clinical vertical slice | Patient registration, appointment, encounter, signed note/prescription, minimum lab/result and role policy in EMR | AC-011–AC-013; clinician review |
| 4. Pharmacy/marketplace | Independent pharmacy tenancy, offers, stock ledger, publication, referral, quote, order and Telemedicine marketplace read | AC-014–AC-017; stock and referral review |
| 5. Billing/telemedicine | Invoice/payment ledger, verified provider flow, virtual visit and patient timeline; migrate existing billing UI and Telemedicine login | AC-018–AC-022; financial reconciliation |
| 6. Harden and pilot | Accessibility, load, incident/restore drills, operational dashboards, privacy/legal and penetration-test remediation; limited tenant pilot | AC-026–AC-030, go-live gates in section 18 |
| 7. Expand | HR/accounting/insurance and FHIR partners one governed module at a time | New contract/acceptance set per module |

Phases can overlap for independent frontend work, but dependency gates remain: no cross-tenant marketplace without server identity and isolation; no payment status without verified payment ledger; no live patient records before security/privacy gates. Keep existing visuals and routes where they work; replace authority behind the screens slice by slice.

## 17. Decision log, dependencies and principal risks

### 17.1 Decisions to record as ADRs before implementation

| ADR | Proposed default | Decision owner / unresolved question |
| --- | --- | --- |
| ADR-01 Backend repository | One consolidated Node source, API and worker builds; location may be separate repo or this repo | Engineering owner to choose Git topology, deployment pipeline and ownership |
| ADR-02 Identity | Managed OIDC authorization code + PKCE and MFA | Security/product to select provider, SSO model, cost and migration of existing test accounts |
| ADR-03 Tenant isolation | Shared PostgreSQL with tenant-qualified constraints and FORCE RLS; isolation upgrade path | Security/legal to approve tenant classes and dedicated-database triggers |
| ADR-04 Async transport | PostgreSQL outbox/inbox initially; broker only when quantified need appears | Operations to size queue lag and worker deployment |
| ADR-05 Payment | Provider-hosted/tokenized checkout plus signed webhooks and reconciliation | Finance to choose provider, settlement accounts and refunds policy |
| ADR-06 Clinical interoperability | Internal domain model with a versioned FHIR adapter | Clinical/integration owners to choose R4/R5/profile and counterparties |
| ADR-07 Pharmacy network | Independent pharmacy tenant and minimal referral sharing | Clinical/pharmacy/legal owners to approve prescription, consent and dispense policy |
| ADR-08 Data policy | Configurable retention, residency, legal hold, erasure and consent | Privacy/legal officer to specify jurisdiction and lawful basis |
| ADR-09 Pilot objectives | Targets in section 13 | Product/operations to confirm pilot size, SLOs and on-call cover |
| ADR-10 Subdomains | Five frontend origins plus api/auth origins | Domain owner to choose real names, certificates and redirect allowlist |

### 17.2 Major risks and mitigations

| Risk | Why it matters | Mitigation / evidence |
| --- | --- | --- |
| Existing UI appears complete while authority is in localStorage | False readiness, lost data, cross-origin inconsistency | Inventory each route's data source; production fixture gate; migrate vertical slices and verify API/database/audit |
| Multiple backend archives/contracts diverge | Duplicate identity, incompatible DTOs and state machines | Pick canonical repo and OpenAPI; archive obsolete endpoints; contract tests |
| Shared database tenant error | Possible cross-organization disclosure | Forced RLS, tenant-qualified foreign keys, non-owner runtime role, negative tests and penetration test |
| Over-asynchronizing critical operations | Incorrect “paid”, “dispensed” or “signed” outcomes | Synchronous authoritative commit; only downstream fan-out async; explicit 202 status |
| At-least-once delivery and webhook retries | Duplicate money, stock or messages | Idempotency keys, inbox receipts, unique provider event IDs and reconciliation |
| Pharmacy/EMR patient identity mismatch | Wrong referral or unauthorized chart release | Governed linkage, patient verification, explicit recipient authorization and audit |
| External provider outage | Backlog and unknown financial outcome | Timeouts, circuit breaker, status visibility, dead-letter and provider reconciliation |
| Regulatory variation | Wrong retention, consent, professional eligibility or tax behavior | Jurisdiction-configured policy and formal legal/clinical sign-off before pilot |
| Insufficient operational capacity | Incident/backup/queue failures go undetected | Dashboards, alerts, on-call ownership, restore and incident drills |
| Unsafe migration of prototype data | Duplicate or misattributed records | No automatic localStorage promotion; reviewed import, provenance and rollback |

### 17.3 External dependencies

Before a live pilot, appoint named owners for clinical safety, pharmacy professional rules, finance/reconciliation, privacy/legal, security, product decisions and 24/7 operational escalation. Select managed PostgreSQL, object storage, identity, payment, communication and video providers with region, availability, data-processing and incident commitments reviewed. Provider selection is not an excuse to weaken domain invariants or defer testable acceptance criteria.

## 18. Go-live gates and definition of done

This is a **gate**, not a statement that the current repository is ready for live healthcare deployment. A phase is done only after its relevant acceptance criteria, documented operational controls and domain-owner sign-off pass in staging.

1. **Product and policy:** approved pilot scope, user roles, pharmacy/referral rules, pricing/tax, consent/legal basis, retention/residency and patient-safety escalation. Unknown rules are disabled or manually reviewed.
2. **Identity and isolation:** all five frontends use verified sign-in; no navigation-only login, production fixtures or localStorage authority. API object authorization and forced RLS pass cross-tenant/branch tests.
3. **Clinical safety:** qualified role enforcement, signed/amended record provenance, result-release policy, prescription/dispense states and exception handling approved by clinical/pharmacy owners.
4. **Financial integrity:** immutable invoice/payment/stock ledgers, derived balances, webhook verification, idempotency, refund/reversal dual control and daily reconciliation proven with duplicate/concurrent/failure tests.
5. **Async reliability:** outbox/inbox, operations status, alerting, retries, quarantine and audited replay proven with worker-crash and provider-outage drills. No UI reports completion from 202 or a timer.
6. **Privacy and security:** threat model, independent security assessment, remediation of critical/high findings, key/secret management, data-processing agreements and approved jurisdictional policy.
7. **Operations:** monitored SLOs, on-call rota, incident/runbooks, tested backup restore against proposed RPO/RTO, deployment rollback and access reviews.
8. **Frontend quality:** critical five-origin journeys, accessibility, browser compatibility, loading/error/empty/retry states and correct public-versus-private projections pass E2E review.
9. **Release decision:** product, clinical, pharmacy, finance, security/privacy and operations owners sign a release record with residual risks and expiry of any waiver. No waiver may permit known cross-tenant disclosure or financial/clinical integrity failure.

## 19. Source basis and related repository documents

The design is grounded in the current repository inventory and the following local documents, which remain detailed implementation inputs rather than evidence of a deployed backend:

- docs/BACKEND_GAP_REPORT.md — observed backend/frontend gap inventory.
- docs/BACKEND_API_REQUIREMENTS.md — candidate endpoint/DTO catalogue to reconcile into one OpenAPI contract.
- docs/revenue-cycle-backend.md and database/migrations/202609150001_revenue_cycle.sql — proposed billing invariants and database design.
- docs/product-roadmap-architecture.md — publication/visibility model.
- src/App.tsx, scripts/build-vercel.mjs, src/identity/service.ts, src/pharmacy/catalogue.ts, src/billing/runtime.ts and apps/telemedicine/packages/patient-portal/src — current frontend and integration seams.

Primary standards/guidance for the proposed controls:

- PostgreSQL 18 row security documentation: https://www.postgresql.org/docs/18/ddl-rowsecurity.html
- OWASP API1:2023 Broken Object Level Authorization: https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/
- OAuth 2.0 Security Best Current Practice (RFC 9700): https://www.rfc-editor.org/rfc/rfc9700
- AWS transactional outbox pattern guidance: https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html
- OpenAPI Specification 3.1.1: https://spec.openapis.org/oas/v3.1.1.html
- OpenTelemetry signals: https://opentelemetry.io/docs/concepts/signals/
- HL7 FHIR R4 MedicationRequest resource: https://hl7.org/fhir/R4/medicationrequest.html
- CloudEvents specification overview: https://cloudevents.io/

The cited standards inform engineering choices; they do not establish that Sabi currently complies with them. Legal, clinical and security sign-off is separate from this architecture proposal.
