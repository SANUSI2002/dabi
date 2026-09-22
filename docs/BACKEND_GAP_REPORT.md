# Sabi Health Backend Gap Report

Audit date: 2026-09-16

## Scope and evidence

This report covers:

- the main Sabi OS / EMR and Command Center in `src/`;
- the Sabi Health patient/telemedicine frontend in `apps/telemedicine/packages/patient-portal/`;
- `sabi-health-backend-feature-onboarding-auth.zip` (newest supplied backend archive);
- `sabi-health-backend (2).zip` (older, broader supplied backend archive);
- the browser-local revenue-cycle implementation and SQL migration in this repository.

The supplied backend is not one consolidated, mounted service. The newest archive contains a Prisma authentication/onboarding service. The older archive contains a separate PostgreSQL/Express service for authentication, users, family, vitals, records and prescriptions. Neither archive is part of the current root application runtime, and no backend process is started by `npm run dev`.

## Status vocabulary

- **Available and working**: implemented with tests in a supplied backend archive. This does not imply the frontend calls it.
- **Available but incomplete**: implemented but missing required behavior, ownership model or production controls.
- **Available but broken**: frontend and backend contracts are known to disagree.
- **Partially implemented**: only part of the required workflow exists.
- **Missing / backend required**: no supplied backend implementation was found.
- **Frontend mocked**: frontend behavior uses local stores, seeds, timers or generated outcomes.
- **Frontend hard-coded**: records are imported from static source files.

## Executive findings

1. The main EMR and Command Center are frontend applications backed primarily by Zustand stores, source-controlled seed arrays and `localStorage`. Those stores are useful implementation scaffolding, but they are not server-authoritative or secure multi-tenant storage.
2. Main Sabi ID authentication is local seeded identity logic. It does not call either supplied authentication backend. Frontend RBAC therefore controls UX only.
3. The telemedicine frontend contains many complete screens but most domain actions remain local-store workflows. Existing backend modules for records, vitals, family and prescriptions are not wired to those screens.
4. The newest auth backend and older auth backend use different routes and response shapes. Telemedicine registration currently posts to `/api/auth/register`, while the newest backend exposes `/api/auth/register/patient`; this is an integration mismatch.
5. Billing has the strongest contract boundary in the main repository. It includes typed commands, an HTTP adapter and a local adapter, plus a database migration. The HTTP service itself is not supplied and local browser execution must not be treated as a completed payment integration.
6. Equipment/SCADA generated telemetry automatically. It is now restricted to development fixtures; production receives empty/unavailable states until a gateway is connected.
7. Package selection previously navigated to a consultation page and lost the selection. It now carries `plan` and billing frequency into an organization draft. It does not activate a subscription or report payment success.
8. Production and development browser persistence are now separated. Command Center and equipment seed records are excluded from production builds at runtime.

## Actual system matrix

| Module | Frontend | Supplied backend | Mock / hard-coded data | Production status | Required action |
|---|---|---|---|---|---|
| Main Sabi ID authentication | UI ready | Separate auth implementations exist; neither integrated | Seed identities, local sessions, fixed dev MFA | Partial | Select canonical auth service, map roles/memberships, integrate tokens |
| Patient authentication | UI ready | Available in both archives with incompatible contracts | Telemedicine login state is frontend-managed | Broken integration | Normalize `/api/auth/*` contract and connect client |
| Password reset | UI ready | Older backend route available | Main app returns local success in dev | Partial | Connect both clients; configure email delivery |
| Professional/facility registration | UI ready | New backend endpoints available but untested | Frontend onboarding has separate local draft model | Partial | Contract mapping, object storage and verification workflow |
| Package selection | Fixed | Missing | Catalog is dev fixture/local Command Center state | Frontend ready | Add catalog and application APIs |
| Subscription checkout | UI contract only | Missing | No fake activation added | Backend required | Server checkout, payment provider, webhook and entitlement activation |
| Organization onboarding | Comprehensive UI | Facility registration only; no matching application workflow | Browser draft and staged files | Partial | Application, document, review and provisioning APIs |
| Tenant provisioning | UI workflow | Missing | Local Command Center mutation | Backend required | Transactional tenant provisioning and idempotent activation |
| Organizations / hospitals | UI ready | Facility create only in newest archive | Command Center seed organizations | Backend required | Tenant CRUD, branch hierarchy and membership APIs |
| Users | UI ready | Older `/users/me` and patient lookup available | Main user/admin data seeded | Partial | Tenant user lifecycle, invitations and staff profiles |
| Roles / permissions | UI ready | Basic role rows/JWT claims only | Frontend permission arrays | Backend required | Policy model, enforcement and audit |
| Patient management | UI ready | Patient account/profile only | EMR patients hard-coded/local | Backend required | Tenant-scoped MPI/patient APIs |
| Appointments | UI ready | Missing | Local/static calendars and appointment stores | Backend required | Scheduling, availability, status and conflict APIs |
| Check-in / queue | UI ready | Missing | Local state and generated queue values | Backend required | Encounter/check-in/queue APIs |
| Nursing / vitals | UI ready | Older patient-self vitals available | EMR nursing local; telemedicine route mismatch | Partial / disconnected | Integrate patient vitals; add encounter/dependent vitals |
| Consultation / diagnosis | UI ready | Missing | Local encounter and coding data | Backend required | Encounter note, diagnosis, sign/amend APIs |
| Prescriptions | UI ready | Older structured prescription API available | Both frontends use local prescription state | Backend partial / disconnected | Connect API; add clinician authorization, dependents and OCR separately |
| Medical records | UI ready | Older patient-self records API available | Static/local frontend records | Backend partial / disconnected | Connect API; add upload storage, provenance and dependent scope |
| Family / caregivers | UI ready | Older family API available | Invite lookup and acceptance also exist locally | Backend partial / disconnected | Connect API and reconcile dependent clinical ownership |
| Doctor discovery | UI ready | Missing | Static doctor directory | Backend required | Practitioner directory, credentials and availability |
| Telemedicine consultation | UI ready | Missing | Local booking outcomes | Backend required | Session, media token, consent and encounter APIs |
| Hospital discovery/enrolment | UI ready | Missing | Local hospital store with generated approvals | Backend required | Directory, enrolment, approval and check-in APIs |
| Pharmacy marketplace | UI ready | Missing | Static inventory, generated quotes/orders/chat | Not production | Pharmacy, catalog, cart, quote, order and delivery APIs |
| Laboratory | UI ready | Missing | EMR lab store and settings data | Backend required | Orders, specimens, results, approval and audit APIs |
| Billing / invoices | UI ready | Typed contract + SQL migration only; no deployed API | Local async adapter persists in browser | Partial architecture | Implement authoritative service from contract |
| Payments | Record-payment UI ready | Missing | Local ledger can record payments | Backend required | Provider intent, webhook, immutable allocation and receipt APIs |
| HMO / insurance | UI ready | Missing | Static payer data | Backend required | Eligibility, authorization, claim and remittance APIs |
| Inventory | UI ready | Missing | Static/local stock state | Backend required | Stock ledger, lot, expiry and movement APIs |
| Procurement | UI ready | Missing | Local requisition/PO/receipt state | Backend required | Approval and three-way-match APIs |
| Accounting | Broad UI | Missing | Seed ledgers and local postings | Backend required | Immutable double-entry ledger and period controls |
| HR / workforce | Broad UI | Missing | Seed employees, attendance and payroll | Backend required | Staff, attendance, leave, payroll and approval APIs |
| Departments / wards | UI ready | Missing | Seed configuration | Backend required | Organization-scoped configuration APIs |
| Equipment register | UI ready | Missing | Development-only fixtures | Backend required | Equipment asset and integration APIs |
| SCADA telemetry | UI ready | Missing | Simulator now development-only | Unavailable | Gateway ingestion, time-series queries, alarms and health APIs |
| Notifications | UI ready | Missing | Local notification stores | Backend required | Preferences, templates, delivery and read-state APIs |
| Audit | UI ready | Missing | Browser-local events | Not authoritative | Append-only backend audit API and export |
| Reports / analytics | UI ready | Missing | Derived seed metrics | Unavailable without data | Server reports, aggregates and authorization |
| Command Center catalog | UI ready; buttons operate locally | Missing | Seed modules/packages/prices | Frontend ready only | Catalog/versioning APIs |
| Command Center subscriptions | UI ready | Missing | Seed subscriptions and mutations | Backend required | Lifecycle and entitlement authority |
| Command Center system health | UI ready | Health endpoints only | Seed health/incidents | Backend required | Aggregated service health and incident APIs |

## Supplied backend route inventory

### Newest onboarding/auth archive

Base routes are mounted at `/api/auth`:

| Route | Classification | Notes |
|---|---|---|
| `POST /api/auth/register/patient` | Available but incomplete | Creates patient, profile and role. No email verification. No transaction wrapper is visible in the controller. |
| `POST /api/auth/register/professional` | Available but incomplete | Multipart local-disk upload; no external object storage, malware scan or reviewer workflow. |
| `POST /api/auth/register/facility` | Available but incomplete | Creates facility/admin directly; does not match the frontend’s multi-stage application/review/provisioning model. |
| `POST /api/auth/login` | Available but incomplete | Returns access and refresh tokens; contract differs from the main Sabi ID membership model. |
| `POST /api/auth/refresh` | Available but incomplete | Refresh token is stored directly in the database rather than hashed/rotated. |
| `POST /api/auth/logout` | Available | Deletes matching refresh-token rows. |
| `GET /api/auth/me` | Available | Bearer authentication required. |
| `GET /health` | Available | Database health check. |

The archive has no automated tests (`npm test` deliberately exits with failure). It should therefore not be classified as verified working in CI.

### Older broader backend archive

The older archive contains integration tests and exposes:

- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`;
- `/forgot-password`, `/reset-password/:uid/:token`;
- `/users/me`, `/users/lookup/:sabiHealthId`;
- full `/family` member/request/invite/join routes;
- `/vitals/summary`, `/vitals/readings` and reading deletion;
- `/records/categories` and `/records/records` filing routes;
- `/prescriptions`, status changes and send history.

These routes are **available in an older standalone archive**, not in the newest auth service and not in the running frontend workspace. Records, vitals and prescriptions are limited to the authenticated user and do not support non-login dependents. Prescription send targets are opaque pharmacy IDs. OCR, pharmacy marketplace, appointments, hospitals, notifications and emergency access are explicitly absent.

## Authentication audit

### Main Sabi OS / Command Center

- Users and memberships come from `src/identity/seed.ts`.
- Password checking, MFA and SSO discovery are implemented by `LocalSabiIdentityService`.
- The session is written to environment-separated browser storage.
- Route gates and role checks are UX controls, not security boundaries.
- Development identities are displayed only in development.
- In production, the local service refuses to create a session and reports that authentication is not connected.
- Logout clears only the browser session.
- Password reset and SSO require backend integration.

### Telemedicine

- The existing visual login is preserved.
- Password reset uses direct relative `fetch` calls.
- Registration posts to `/api/auth/register`, which does not match the newest backend’s `/api/auth/register/patient` path.
- Many protected-looking pages are client routes without a verified server session boundary.
- Tokens, refresh, roles and caregiver authorization require consolidation around the selected canonical backend.

## Simulation and fixture classification

| Classification | Locations / behavior | Decision |
|---|---|---|
| TEST ONLY | `*.test.ts(x)`, `src/billing/testing/*`, `src/roadmap/testing/*` | Keep; excluded from application behavior |
| DEV ONLY | `src/identity/seed.ts`, Command Center `seed.ts`, equipment seeds/simulator | Kept behind `import.meta.env.DEV`; production persistence is separate |
| REMOVE | Public “beta/prototype/demo” labels, automatic production telemetry, package CTA that discarded selection | Removed or replaced with truthful availability copy |
| REPLACE WITH SERVICE | Main Zustand domain stores, telemedicine family/hospital/pharmacy/wellness stores | Migrate incrementally to service interfaces |
| REAL IMPLEMENTATION | Pure validation, calculations, UI state, typed billing contracts, immutable in-browser payment history behavior | Keep, but do not call browser persistence authoritative |
| BACKEND REQUIRED | Authentication authority, tenant isolation, all cross-user workflows, payments, telemetry, audit, analytics | Defined in `BACKEND_API_REQUIREMENTS.md` |

`Math.random()` used solely for non-authoritative client IDs is not itself fake business data, but those IDs must be replaced by server IDs when records become persistent. Timers used to clear toasts or focus inputs are UI behavior and may remain. Timers that create approvals, replies, scans, queue numbers, payment success or other external outcomes must be removed when each affected telemedicine workflow is connected.

## Remaining high-risk frontend-only outcomes

The following are identified and must not be enabled as production truth:

- telemedicine wellness practitioner auto-responses;
- hospital enrolment/appointment auto-approval and generated queue estimates;
- pharmacy chat auto-replies, generated prescription extraction, quotes, checkout and delivery state;
- appointment family-member auto-response;
- main accounting invoice scanning that invents vendor, amount and confidence;
- NHMIS transfer timers without DHIS2/SORMAS integration;
- local Command Center payment/subscription/tenant activation mutations;
- browser-only audit events.

They are recorded as backend-required work, not claimed as completed integrations.

## Changes completed in this pass

- Added a centralized API client with base URL configuration, bearer token support, refresh hook, timeout, normalized 401/403/404/422/5xx errors and unavailable-service behavior.
- Added service contracts for authentication and subscription checkout.
- Fixed package selection so the plan and billing frequency survive navigation into organization onboarding.
- Kept subscription activation server-authoritative; no click produces payment success.
- Separated development and production browser persistence.
- Prevented Command Center and equipment seed data from initializing in production.
- Restricted local Sabi identity sign-in and equipment simulation to development.
- Replaced public beta/prototype messaging in the touched package and patient entry flows.
- Added truthful equipment/SCADA empty states.

## Recommended implementation order

1. Consolidate the two backend archives into one versioned API and select the canonical auth contract.
2. Connect authentication, organization application submission and secure document upload.
3. Implement tenant/user/role enforcement and append-only audit before connecting administrative mutations.
4. Implement package catalog, checkout, subscription and entitlements as one server-authoritative transaction chain.
5. Connect core clinical sequence: patient → appointment → encounter → orders/prescription → bill.
6. Add lab, pharmacy, inventory and HMO integrations.
7. Connect telemedicine cross-user workflows and media sessions.
8. Connect equipment gateways and remove simulator code from deployable bundles if it is not needed for engineering environments.
9. Build reporting only after authoritative operational data exists.

### Pharmacy marketplace follow-up

The operator portal now has a development-only tenant catalogue and storefront configuration surface. It intentionally does not claim live inventory, pricing, publication approval, ratings or checkout. The backend still needs the multi-tenant offer/publication endpoints in `BACKEND_API_REQUIREMENTS.md`; once those are available, the local projection bridge in the patient marketplace should be replaced by the canonical marketplace API.
