# Sabi Health Backend API Requirements

Status: implementation contract — endpoints marked **BACKEND REQUIRED** do not currently exist in the supplied backend.

## Contract conventions

### Base, versioning and tenancy

- Canonical base: `/api/v1`.
- Authentication routes may remain under `/api/auth` during migration, but one canonical contract must replace the two incompatible supplied auth implementations.
- The backend derives `userId`, roles, organization memberships and active `organizationId` from the verified access token. A client-supplied tenant header is never sufficient authorization.
- Organization resources use path scope: `/organizations/:organizationId/...`. The server must verify active membership and permission on every request.
- Branch-scoped records include `branchId`, which must belong to the authorized organization.
- All list endpoints accept `limit` (1–100) and opaque `cursor`; responses use `{ "items": [], "nextCursor": null }`.
- Dates are ISO-8601 UTC. Monetary amounts are integer minor units plus ISO currency.
- Create commands accept `Idempotency-Key` when retries could duplicate financial, clinical or provisioning records.

### Standard response and errors

Successful single-resource response:

```json
{ "data": {}, "requestId": "req_..." }
```

Standard error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Some submitted information is invalid.",
    "details": [{ "field": "email", "message": "Email is invalid" }]
  },
  "requestId": "req_..."
}
```

Required status handling: `400` malformed request, `401` unauthenticated/expired, `403` unauthorized or tenant mismatch, `404` not found in authorized scope, `409` conflict/idempotency/state transition, `422` field validation, `429` rate limit, `500` internal failure, `503` dependency unavailable.

### Audit and concurrency

- Mutations emit an append-only audit event with actor, tenant, branch, resource, action, before/after summary, reason where required, request ID and timestamp.
- Mutable administrative resources return `version` or `ETag`. Updates require `If-Match` to prevent lost updates.
- Clinical and financial records that have been finalized are corrected by amendment/reversal, never destructive overwrite.

## 1. Authentication

Supplied status: **PARTIAL / CONTRACT CONFLICT**. New archive has `/api/auth/register/patient|professional|facility`, login, refresh, logout and me. Older archive has `/auth/*` plus reset. Main Sabi ID is not connected.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Main and telemedicine login | `POST /api/auth/login` | `{email,password,deviceName?}` | `{accessToken,refreshToken,user:{id,email,name,roles,memberships},mfaChallenge?}` | Public; rate limited | Email/password required; `401 INVALID_CREDENTIALS`; `423 ACCOUNT_LOCKED`; never enumerate users | P0 — normalize existing implementations |
| MFA page | `POST /api/auth/mfa/verify` | `{challengeId,code}` | Same session envelope as login | Public challenge; single use | Six digits; expiry/attempt limits; `401 MFA_INVALID`, `410 MFA_EXPIRED` | P0 — **BACKEND REQUIRED** |
| Token interceptor | `POST /api/auth/refresh` | `{refreshToken}` or secure cookie | `{accessToken,refreshToken?}` | Refresh credential | Rotate and hash tokens; replay revokes family; `401 TOKEN_INVALID` | P0 — improve newest implementation |
| Logout | `POST /api/auth/logout` | `{refreshToken?,allDevices?:false}` | `204` | Authenticated | Idempotent; revoke server session | P0 — available, normalize |
| Session bootstrap | `GET /api/auth/me` | none | `{user,roles,memberships,activeSession}` | Authenticated | `401`; disabled user `403` | P0 — available, extend memberships |
| Forgot password | `POST /api/auth/password/forgot` | `{email}` | `202` | Public; rate limited | Always same response; email validation | P0 — older route exists, normalize |
| Reset password | `POST /api/auth/password/reset` | `{uid,token,password,passwordConfirmation}` | `204` | Signed reset token | Password policy; `410 TOKEN_EXPIRED`; revoke existing sessions | P0 — older route exists, normalize |
| Sessions page | `GET /api/auth/sessions`; `DELETE /api/auth/sessions/:id` | none / `{reason?}` | Session list / `204` | User owns session; security admin may revoke tenant sessions | `404` scoped; cannot forge device | P1 — **BACKEND REQUIRED** |
| SSO page | `POST /api/auth/sso/discover`; `GET /api/auth/sso/callback` | `{email}` / signed provider response | `{redirectUrl}` / server session | Public discovery; organization policy | Domain verified; signed state/nonce; `404 SSO_NOT_CONFIGURED` | P1 — **BACKEND REQUIRED** |

## 2. Users

Supplied status: **PARTIAL**. Older backend supports own profile and patient-ID lookup only.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Profile | `GET/PATCH /api/v1/users/me` | Patch `{firstName,lastName,phone,locale,timezone}` | User profile | Authenticated self | Whitelisted fields; `422`; email change separate | P0 — older equivalent available |
| Command Center users | `GET/POST /api/v1/organizations/:orgId/users` | Filters / `{email,name,roleIds,branchIds}` | User list / pending invitation | `identity.manage`; org-scoped | Unique email membership; license limits; `409` | P0 — **BACKEND REQUIRED** |
| User detail | `GET/PATCH /api/v1/organizations/:orgId/users/:id` | `{status,roleIds,branchIds,reason}` | Membership/user view | `identity.manage`; org-scoped | Cannot remove last owner; reason required | P0 — **BACKEND REQUIRED** |
| Invitation flow | `POST /api/v1/organizations/:orgId/invitations`; `POST /api/v1/invitations/:token/accept` | Invite details / identity confirmation | Invitation / membership | Admin then token subject | Single-use, expiry, role/branch validity | P0 — **BACKEND REQUIRED** |

## 3. Organizations

Supplied status: **PARTIAL**. New facility registration creates a facility immediately but does not implement reviewed organization onboarding.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Registration draft | `POST /api/v1/organization-applications` | Owner, organization, selected package/cycle | `{applicationId,reference,status:"DRAFT",version}` | Applicant access token or signed draft token | Email, legal name, country, facility type; idempotent | P0 — **BACKEND REQUIRED** |
| Registration steps | `GET/PATCH /api/v1/organization-applications/:id` | Section-specific patch + version | Full application and completion map | Applicant owns application; platform reviewer read | State/field validation; `409 VERSION_CONFLICT` | P0 — **BACKEND REQUIRED** |
| Application submission | `POST /api/v1/organization-applications/:id/submit` | `{attestation:true}` | `{status:"SUBMITTED",submittedAt}` | Applicant owner | All required sections/documents; `422`; idempotent | P0 — **BACKEND REQUIRED** |
| Command Center organizations | `GET /api/v1/platform/organizations` | Filters/cursor | Organization summaries, no invented counts | `organizations.view`; platform scope | Field allow-list; `403` | P0 — **BACKEND REQUIRED** |
| Organization 360 | `GET/PATCH /api/v1/platform/organizations/:id` | Administrative patch + reason | Organization with subscription/branches/owners | `organizations.manage`; platform scope | Status transition rules; reason; ETag | P0 — **BACKEND REQUIRED** |

## 4. Hospitals / branches

Supplied status: **MISSING** beyond facility creation.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Telemedicine hospital discovery | `GET /api/v1/hospitals` | Location, service, payer, cursor | Verified public directory | Optional auth; public-safe fields | Valid coordinates/radius; no unpublished facility | P1 — **BACKEND REQUIRED** |
| Hospital detail | `GET /api/v1/hospitals/:id` | none | Facility services, locations, contacts, availability summary | Optional auth | `404` if unpublished | P1 — **BACKEND REQUIRED** |
| Command Center branches | `GET/POST /api/v1/organizations/:orgId/branches` | none / `{name,facilityCode,address,timezone}` | Branch list / branch | `organizations.manage`; org-scoped | Unique facility code; subscription branch limit | P0 — **BACKEND REQUIRED** |
| Branch update | `PATCH /api/v1/organizations/:orgId/branches/:id` | Fields + version | Branch | `organizations.manage`; org-scoped | Cannot move across org; ETag | P1 — **BACKEND REQUIRED** |
| Patient hospital enrolment | `POST /api/v1/hospitals/:id/enrolments` | `{patientId,memberId?,consents}` | `{id,status:"PENDING"}` | Patient/caregiver with consent | Relationship/access checks; no auto-approval | P1 — **BACKEND REQUIRED** |

## 5. Patients

Supplied status: **PARTIAL** patient identity only; EMR patient management missing.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Patient registration | `POST /api/v1/organizations/:orgId/patients` | Demographics, identifiers, contacts, consent | Patient with server MRN | `patient.create`; org/branch scoped | Duplicate/MPI checks; required consent; `409 POSSIBLE_DUPLICATE` | P0 — **BACKEND REQUIRED** |
| Patient search | `GET /api/v1/organizations/:orgId/patients` | Query, DOB, phone, MRN, cursor | Minimal authorized patient list | `patient.view`; org-scoped | Minimum search strength; audited | P0 — **BACKEND REQUIRED** |
| Patient chart banner | `GET /api/v1/organizations/:orgId/patients/:id` | none | Demographics, alerts, payer, version | `patient.view`; org-scoped | Break-glass policy if applicable; `404` scoped | P0 — **BACKEND REQUIRED** |
| Patient update | `PATCH /api/v1/organizations/:orgId/patients/:id` | Allowed fields + version | Updated patient | `patient.update`; org-scoped | Identity field rules; amendment audit | P0 — **BACKEND REQUIRED** |
| Patient-ID lookup | `GET /api/v1/patients/lookup/:sabiHealthId` | none | Minimal consent-safe identity | Authenticated patient/caregiver flow | Rate limit; no clinical data | P1 — older equivalent available |

## 6. Doctors and practitioners

Supplied status: **MISSING**; professional registration exists but not verified directory/availability.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Doctor discovery | `GET /api/v1/practitioners` | Specialty, location, language, availability, cursor | Verified practitioner cards | Patient auth optional; public-safe | Only approved/current licences | P1 — **BACKEND REQUIRED** |
| Doctor profile | `GET /api/v1/practitioners/:id` | none | Credentials, facilities, availability summary | Patient/public-safe | Hide unverified records | P1 — **BACKEND REQUIRED** |
| Credential review | `POST /api/v1/platform/practitioners/:id/reviews` | `{decision,reason,verifiedFields}` | Review + resulting status | `documents.verify`; platform | Four-eyes policy configurable; immutable evidence | P0 — **BACKEND REQUIRED** |
| Availability | `GET/PUT /api/v1/practitioners/:id/availability` | Range / rules+exceptions | Slots/rules | Practitioner self or scheduler | Timezone, overlap and facility membership | P1 — **BACKEND REQUIRED** |

## 7. Appointments, check-in and queue

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Appointment lists | `GET /api/v1/organizations/:orgId/appointments` | Patient/provider/status/date/cursor | Appointment list | `appointment.view`; org/branch scoped | Date range limits | P0 — **BACKEND REQUIRED** |
| Booking | `POST /api/v1/organizations/:orgId/appointments` | `{patientId,providerId,branchId,serviceId,startAt,channel}` | Appointment `BOOKED/PENDING` | Patient self or `appointment.create` | Atomic slot conflict; `409 SLOT_UNAVAILABLE`; idempotent | P0 — **BACKEND REQUIRED** |
| Reschedule/cancel | `POST /api/v1/.../appointments/:id/reschedule|cancel` | New slot/reason | Updated appointment | Patient ownership or scheduler | Policy window; state transition; no timer success | P0 — **BACKEND REQUIRED** |
| Check-in | `POST /api/v1/.../appointments/:id/check-in` | `{arrivedAt,method}` | Encounter/queue ticket | `checkin.manage`; branch scoped | Appointment/branch/status checks | P0 — **BACKEND REQUIRED** |
| Clinical queue | `GET /api/v1/organizations/:orgId/branches/:branchId/queue` | Filters/cursor | Queue entries with server position/estimate if calculable | `queue.view`; branch | No generated estimate when unavailable | P0 — **BACKEND REQUIRED** |
| Queue transition | `POST /api/v1/.../queue/:id/transition` | `{to,reason?}` | Updated queue entry | `queue.manage`; branch | State machine, concurrency | P0 — **BACKEND REQUIRED** |

## 8. Consultations and encounters

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Consultation page | `POST /api/v1/organizations/:orgId/encounters` | `{patientId,appointmentId?,branchId,type,providerId}` | Encounter `OPEN` | `encounter.create`; clinician/branch | Active membership; one active encounter rules | P0 — **BACKEND REQUIRED** |
| Encounter detail | `GET/PATCH /api/v1/.../encounters/:id` | Section patches + version | Encounter composition | `encounter.view/update`; care-team scope | Optimistic concurrency; audit | P0 — **BACKEND REQUIRED** |
| Diagnosis | `POST /api/v1/.../encounters/:id/diagnoses` | `{codeSystem,code,display,type,clinicalStatus}` | Diagnosis | `diagnosis.create`; qualified clinician | Terminology validation; patient/encounter match | P0 — **BACKEND REQUIRED** |
| Sign consultation | `POST /api/v1/.../encounters/:id/sign` | `{attestation}` | Finalized encounter | Responsible clinician | Completeness; immutable after sign; idempotent | P0 — **BACKEND REQUIRED** |
| Amendment | `POST /api/v1/.../encounters/:id/amendments` | `{reason,changes}` | Amendment linked to original | `encounter.amend` | Reason required; never overwrite original | P1 — **BACKEND REQUIRED** |

## 9. Prescriptions

Supplied status: **PARTIAL** in older backend; disconnected and limited to signed-in patient ownership.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| EMR prescription | `POST /api/v1/organizations/:orgId/encounters/:encounterId/prescriptions` | Patient, prescriber, coded items, directions | Signed/draft prescription | `prescription.create`; licensed prescriber | Drug/dose/interaction policy; encounter match | P0 — extend existing module |
| Patient prescriptions | `GET /api/v1/patients/me/prescriptions` | Status/cursor/memberId | Authorized prescriptions | Patient/caregiver grants | Dependent scope and consent | P0 — adapt existing module |
| Send to pharmacy | `POST /api/v1/prescriptions/:id/transmissions` | `{pharmacyIds}` | Transmission attempts | Patient or prescriber policy | Real pharmacy FK; state/consent | P1 — replace opaque IDs |
| Upload extraction | `POST /api/v1/prescription-extractions` | Multipart image/PDF | `{id,status:"PENDING"}` then reviewed structured result | Patient; malware-scanned upload | File limits; OCR confidence never auto-authorizes medication | P2 — **BACKEND REQUIRED** |

## 10. Pharmacy

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Marketplace | `GET /api/v1/pharmacies`; `GET /api/v1/pharmacies/:id/catalog` | Location/filter/cursor | Verified pharmacies / available catalog | Patient auth; public-safe | Stock freshness timestamp required | P1 — **BACKEND REQUIRED** |
| Quote request | `POST /api/v1/pharmacy-quotes` | `{prescriptionId,pharmacyIds,deliveryLocation?}` | Quote request `PENDING` | Patient owns prescription | Pharmacy and prescription validation | P1 — **BACKEND REQUIRED** |
| Quote response | `POST /api/v1/pharmacy-quotes/:id/respond` | Items, prices, expiry, availability | Immutable quote version | `pharmacy.quote`; pharmacy tenant | Currency/expiry/items; cannot edit accepted quote | P1 — **BACKEND REQUIRED** |
| Cart/checkout | `POST /api/v1/pharmacy-orders` | Accepted quote, delivery, payer | Order `PAYMENT_PENDING` | Patient | Idempotent; never mark paid client-side | P1 — **BACKEND REQUIRED** |
| Fulfilment | `POST /api/v1/pharmacy-orders/:id/transition` | `{to,reason?,tracking?}` | Updated order/event | `pharmacy.fulfil`; owning pharmacy | State machine and stock allocation | P1 — **BACKEND REQUIRED** |
| Pharmacy chat | `GET/POST /api/v1/pharmacy-orders/:id/messages` | Cursor / `{text,attachments?}` | Messages | Order participants only | Attachment scan; no auto replies | P2 — **BACKEND REQUIRED** |

## 11. Laboratory

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Lab order | `POST /api/v1/organizations/:orgId/lab-orders` | Encounter, patient, tests, priority, requester | Lab order and accession | `lab.order`; org/branch | Catalog, patient, encounter and duplicate checks | P0 — **BACKEND REQUIRED** |
| Worklist | `GET /api/v1/organizations/:orgId/lab-orders` | Status/date/branch/cursor | Worklist | `lab.view`; branch | Scoped filters | P0 — **BACKEND REQUIRED** |
| Specimen | `POST /api/v1/.../lab-orders/:id/specimens` | Type, barcode, collectedAt, collector | Specimen chain-of-custody | `lab.collect`; branch | Unique barcode; order state | P0 — **BACKEND REQUIRED** |
| Result entry | `POST /api/v1/.../lab-orders/:id/results` | Analytes, units, flags, source/equipment | Draft result | `lab.result`; branch | Test schema/unit validation | P0 — **BACKEND REQUIRED** |
| Result approval | `POST /api/v1/.../lab-results/:id/approve` | `{attestation}` | Final report | `lab.approve`; qualified staff | Separation rules; immutable final | P0 — **BACKEND REQUIRED** |

## 12. Billing and invoices

Supplied status: **PARTIAL CONTRACT ONLY**. The root repository defines these paths and a local implementation, but no deployed HTTP service was supplied.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Patient account | `POST /api/v1/billing/patient-accounts` | `{patientId,encounterId?,appointmentId?,branchId,visitType,payer}` | Patient account | `billing.account.create`; org/branch from token | Tenant/branch/patient match; idempotent | P0 — implement existing contract |
| Charge capture | `POST /api/v1/billing/charges` | `{accountId,sourceType,sourceId,code,description,quantity,unitPrice,tax}` | Charge + account totals | Authorized source service or `billing.charge` | Idempotency; signed source; nonnegative values | P0 — implement existing contract |
| Readiness | `POST /api/v1/billing/encounters/:id/readiness` | `{reasons:[]}` | Account/readiness | Clinical/billing workflow authority | Reason codes; encounter scope | P0 — implement existing contract |
| Consolidated invoice | `POST /api/v1/billing/patient-accounts/:id/invoices` | `{chargeIds,dueDate,payer}` | Immutable invoice | `billing.invoice.issue` | Only unbilled eligible charges; idempotent | P0 — implement existing contract |
| Invoice detail | `GET /api/v1/billing/invoices/:id` | none | Invoice, allocations, balance, status, transaction history | `billing.view`; patient self where allowed | Scoped `404`; immutable history | P0 — **BACKEND REQUIRED** read route |
| Void/credit | `POST /api/v1/billing/invoices/:id/adjustments` | `{type,amount,reason,lines?}` | Adjustment + recalculated balance | `billing.adjust`; approval thresholds | Cannot delete invoice/payment; reason; limits | P1 — **BACKEND REQUIRED** |

## 13. Payments

Supplied status: **MISSING**. Browser-local record payment is not authoritative.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Record cash/bank payment | `POST /api/v1/billing/invoices/:id/payments` | `{amount,currency,method,reference,transactionAt,idempotencyKey}` | Immutable payment, allocation, receipt, updated invoice | `payment.record`; org/branch | Positive amount, reference rules, overpayment policy | P0 — implement typed contract |
| Online payment intent | `POST /api/v1/payments/intents` | `{invoiceId,amount,provider,returnUrl}` | `{intentId,status:"PENDING",authorizationUrl}` | Patient/cashier | Amount/balance; provider allow-list; idempotent | P1 — **BACKEND REQUIRED** |
| Provider webhook | `POST /api/v1/payments/webhooks/:provider` | Provider-signed payload | `202` | Provider signature, no user token | Signature, replay/idempotency, raw-body verification | P0 — **BACKEND REQUIRED** |
| Refund/reversal | `POST /api/v1/payments/:id/reversals` | `{amount,reason}` | Reversal and new invoice balance | `payment.reverse`; approval policy | Cannot mutate original; limits; idempotent | P1 — **BACKEND REQUIRED** |
| Receipt | `GET /api/v1/payments/:id/receipt` | none | Receipt document/data | `payment.view` or patient owner | Scoped; stable receipt number | P1 — **BACKEND REQUIRED** |

## 14. Packages, checkout, subscriptions and entitlements

Supplied status: **MISSING**. Current catalog and lifecycle are local Command Center state.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Public pricing | `GET /api/v1/catalog/packages` | Currency/country | Published packages and immutable versions | Public | Only published/effective versions | P0 — **BACKEND REQUIRED** |
| Command Center packages | `POST/PATCH /api/v1/platform/packages` | Code/name/limits/prices/modules/version | Draft package/version | `catalog.manage` + `pricing.manage` as applicable | Unique code; dependencies; ETag | P0 — **BACKEND REQUIRED** |
| Publish package | `POST /api/v1/platform/packages/:id/versions/:versionId/publish` | `{effectiveFrom,reason}` | Published immutable version | `catalog.manage` and `pricing.manage` | Completeness/dependency checks; no overwrite | P0 — **BACKEND REQUIRED** |
| Checkout | `POST /api/v1/subscription-checkouts` | `{applicationId,packageVersionId,billingCycle,organizationId?}` | `{checkoutId,status:"PENDING",paymentUrl?}` | Applicant/organization owner | Application/package validity; no activation | P0 — **BACKEND REQUIRED** |
| Checkout status | `GET /api/v1/subscription-checkouts/:id` | none | `PENDING/PAID/FAILED/EXPIRED` | Checkout owner/platform finance | Server/payment provider source only | P0 — **BACKEND REQUIRED** |
| Subscription | `GET/PATCH /api/v1/organizations/:orgId/subscription` | Change request with version/reason | Subscription and version snapshot | `subscriptions.manage`; org/platform policy | Effective date, proration, state machine | P0 — **BACKEND REQUIRED** |
| Entitlements | `GET /api/v1/organizations/:orgId/entitlements` | none | Effective route/feature/module entitlements | Authenticated org member/platform | Derived server-side from subscription/overrides | P0 — **BACKEND REQUIRED** |

## 15. Inventory

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Item catalog | `GET/POST /api/v1/organizations/:orgId/inventory/items` | Filters / item definition | Items | `inventory.view/manage`; org | Unique SKU; units; controlled flags | P1 — **BACKEND REQUIRED** |
| Stock ledger | `GET /api/v1/organizations/:orgId/inventory/ledger` | Item/location/date/cursor | Immutable movements and balances | `inventory.view`; branch/location | Server-calculated balances | P1 — **BACKEND REQUIRED** |
| Stock movement | `POST /api/v1/organizations/:orgId/inventory/movements` | `{itemId,lotId,from,to,quantity,type,sourceId}` | Movement + resulting balances | `inventory.move`; location scope | Positive qty, available stock, idempotent | P1 — **BACKEND REQUIRED** |
| Lots/expiry | `POST /api/v1/.../inventory/lots`; `GET /api/v1/.../inventory/expiring` | Lot details / horizon | Lot / expiring list | `inventory.manage/view` | Batch uniqueness, dates | P1 — **BACKEND REQUIRED** |

## 16. Procurement

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Requisition | `POST /api/v1/organizations/:orgId/procurement/requisitions` | Lines, needBy, department, justification | Requisition `DRAFT/SUBMITTED` | `procurement.request`; org/branch | Catalog/vendor/budget rules | P1 — **BACKEND REQUIRED** |
| Approval | `POST /api/v1/.../requisitions/:id/decision` | `{decision,reason}` | Decision and state | Assigned approver | Separation, threshold, immutable decision | P1 — **BACKEND REQUIRED** |
| Purchase order | `POST /api/v1/.../purchase-orders` | Approved requisition/vendor/terms | PO | `procurement.order` | Approval prerequisite; version | P1 — **BACKEND REQUIRED** |
| Goods receipt | `POST /api/v1/.../purchase-orders/:id/receipts` | Lines/lots/receivedAt | Receipt + stock movements | `procurement.receive`; branch | Quantity tolerance; idempotent | P1 — **BACKEND REQUIRED** |
| Three-way match | `POST /api/v1/.../supplier-invoices/:id/match` | none/reason overrides | Match result/exceptions | `procurement.match` | PO/receipt/invoice comparison | P2 — **BACKEND REQUIRED** |

## 17. Accounting

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Chart of accounts | `GET/POST/PATCH /api/v1/organizations/:orgId/accounting/accounts` | Account definition/version | Accounts | `accounting.configure`; org | Unique number, type, no unsafe delete | P1 — **BACKEND REQUIRED** |
| Journal entry | `POST /api/v1/organizations/:orgId/accounting/journals` | Date, memo, currency, balanced lines, source | Posted/draft journal | `accounting.post`; org/branch | Debits=credits; open period; idempotent | P0 — **BACKEND REQUIRED** |
| General ledger | `GET /api/v1/organizations/:orgId/accounting/ledger` | Account/date/branch/cursor | Ledger rows and server balance | `accounting.view`; org | Date bounds; no client totals as authority | P1 — **BACKEND REQUIRED** |
| Fiscal periods | `POST /api/v1/.../accounting/periods/:id/close|reopen` | `{reason,attestation}` | Period/status | `accounting.close`; elevated approval | Blocking checks; immutable audit | P1 — **BACKEND REQUIRED** |
| Bank reconciliation | `POST /api/v1/.../bank-reconciliations` | Account, statement period/balance/items | Reconciliation | `accounting.reconcile` | Statement uniqueness; balance rules | P1 — **BACKEND REQUIRED** |
| Reports | `GET /api/v1/.../accounting/reports/:type` | Period/branch/currency | Trial balance/P&L/balance sheet | `accounting.view` | Server-derived, generation timestamp | P1 — **BACKEND REQUIRED** |

## 18. HR and workforce

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Employee directory | `GET/POST /api/v1/organizations/:orgId/employees` | Filters / employee + user linkage | Employees | `hr.view/manage`; org | Employee ID unique; PII field permissions | P1 — **BACKEND REQUIRED** |
| Attendance | `POST /api/v1/.../attendance/events` | `{employeeId,type,occurredAt,location?,deviceId?}` | Attendance event | Employee self/device/`attendance.manage` | Time sequence, device trust, idempotent | P1 — **BACKEND REQUIRED** |
| Leave | `POST /api/v1/.../leave-requests`; `POST .../:id/decision` | Dates/type/reason / decision | Request/state | Employee / assigned approver | Balance/overlap/policy | P1 — **BACKEND REQUIRED** |
| Scheduling | `GET/POST/PATCH /api/v1/.../shifts` | Shift/assignments/version | Schedule | `workforce.schedule`; org/branch | Overlap, qualification, rest rules | P1 — **BACKEND REQUIRED** |
| Payroll | `POST /api/v1/.../payroll-runs`; `POST .../:id/finalize` | Period/settings / attestation | Run/results/status | `payroll.manage/finalize` | Closed period, approvals, immutable final | P2 — **BACKEND REQUIRED** |

## 19. Equipment and SCADA

Supplied status: **MISSING**. Development simulator is not production data.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Equipment register | `GET/POST/PATCH /api/v1/organizations/:orgId/equipment` | Asset, serial, location, integration metadata | Equipment record | `equipment.view/manage`; org/branch | Unique serial/equipment ID; ETag | P1 — **BACKEND REQUIRED** |
| Gateway enrolment | `POST /api/v1/organizations/:orgId/equipment-gateways` | `{name,branchId,publicKey,protocol}` | Gateway credential metadata | `equipment.integrate`; org | Key/protocol allow-list; secrets never returned again | P1 — **BACKEND REQUIRED** |
| Telemetry ingestion | `POST /api/v1/equipment-ingestion/telemetry` | Signed batch `{gatewayId,readings[]}` | `202` with accepted/rejected counts | mTLS/signed gateway, not user token | Timestamp skew, schema, device ownership, idempotency | P1 — **BACKEND REQUIRED** |
| Telemetry query | `GET /api/v1/organizations/:orgId/equipment/:id/telemetry` | Parameters/range/resolution | Time-series + freshness | `equipment.telemetry.view`; org | Range/resolution limits; no generated points | P1 — **BACKEND REQUIRED** |
| Alarm lifecycle | `GET /api/v1/.../equipment-alarms`; `POST .../:id/transition` | Filters / status, note, assignee | Alarm/event | `equipment.alarm.view/manage` | State machine; reason for suppress/close | P1 — **BACKEND REQUIRED** |
| Maintenance | `POST /api/v1/.../equipment/:id/work-orders` | Type, priority, fault, schedule | Work order | `equipment.maintenance` | Equipment scope; dates; immutable completion evidence | P1 — **BACKEND REQUIRED** |

## 20. Notifications

Supplied status: **MISSING**.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Notification centre | `GET /api/v1/notifications` | Status/cursor | User notifications | Authenticated self | User scoped | P1 — **BACKEND REQUIRED** |
| Read state | `POST /api/v1/notifications/:id/read` | none | Updated notification | Owner | Idempotent | P1 — **BACKEND REQUIRED** |
| Preferences | `GET/PATCH /api/v1/notification-preferences` | Channel/topic choices | Preferences | Authenticated self | Required transactional notices cannot be disabled | P1 — **BACKEND REQUIRED** |
| Templates | `GET/POST/PATCH /api/v1/platform/notification-templates` | Key, subject/body, channels, version | Versioned template | `notifications.manage`; platform | Unique key, variables validated, no secret leakage | P1 — **BACKEND REQUIRED** |
| Delivery request | `POST /api/v1/internal/notifications` | Recipient/topic/template/data/idempotency | `202` delivery IDs | Trusted services only | Consent/routing/rate limits | P1 — **BACKEND REQUIRED** |

## 21. Command Center operations

Supplied status: **MISSING** except backend `/health` for a single service.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Platform activity | `GET /api/v1/platform/activity` | Type/org/date/cursor | Real platform events | `platform.view`; platform | No fabricated aggregates | P1 — **BACKEND REQUIRED** |
| Service health | `GET /api/v1/platform/services/health` | none | Service/dependency health + checkedAt | `operations.manage` or view permission | Bounded dependency checks; unavailable explicit | P1 — **BACKEND REQUIRED** |
| Incidents | `GET/POST/PATCH /api/v1/platform/incidents` | Incident fields/status/version | Incident | `operations.manage`; platform | Severity/state/ETag; audit | P1 — **BACKEND REQUIRED** |
| Integrations | `GET/POST/PATCH /api/v1/organizations/:orgId/integrations` | Provider/category/config references | Integration metadata/health | `integrations.manage`; org/platform | Secrets in vault; test result truthful | P1 — **BACKEND REQUIRED** |
| Support access | `POST /api/v1/platform/support-access-requests`; `POST .../:id/decision` | Org/reason/duration / decision | Time-bound grant | request+approve permissions; different actors where required | Maximum duration; MFA; full audit | P0 — **BACKEND REQUIRED** |
| Provision tenant | `POST /api/v1/platform/provisioning-jobs` | Approved application + package version | Job/status | `onboarding.manage`; platform | Idempotent transaction; rollback-safe | P0 — **BACKEND REQUIRED** |

## 22. Audit

Supplied status: **MISSING**. Frontend events are not authoritative.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Audit log | `GET /api/v1/organizations/:orgId/audit-events` | Actor/action/resource/date/cursor | Append-only scoped events | `audit.view`; org | Field-level PHI redaction and export limits | P0 — **BACKEND REQUIRED** |
| Platform audit | `GET /api/v1/platform/audit-events` | Org/actor/action/date/cursor | Platform events | `audit.view`; platform | Stronger scope; support access included | P0 — **BACKEND REQUIRED** |
| Audit export | `POST /api/v1/.../audit-exports` | Filters/format | Async job then signed download | `audit.export` | Reason, range limits, expiry, full audit | P1 — **BACKEND REQUIRED** |
| Internal event ingestion | `POST /api/v1/internal/audit-events` | Actor/tenant/resource/action/outcome/request metadata | `202` | Trusted services only | Schema, idempotency, tamper-evident storage | P0 — **BACKEND REQUIRED** |

## 23. Reports and analytics

Supplied status: **MISSING**. Current metrics derive from local/seed data.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Operational dashboard | `GET /api/v1/organizations/:orgId/analytics/overview` | Date range/branch/timezone | Metrics with numerator, denominator and generatedAt | `analytics.view`; org/branch | Range limits; `dataAvailable:false` when absent | P2 — **BACKEND REQUIRED** |
| Clinical reports | `POST /api/v1/organizations/:orgId/reports` | Report key, filters, format | Async report job | Report-specific permission | Valid filters; PHI minimum necessary | P2 — **BACKEND REQUIRED** |
| Report job | `GET /api/v1/.../reports/:id`; `GET .../:id/download` | none | Status / signed expiring file | Requester or authorized report viewer | Scoped; expiry; generation errors explicit | P2 — **BACKEND REQUIRED** |
| Platform analytics | `GET /api/v1/platform/analytics` | Metric/date/product/package/cursor | Real aggregates + freshness | `platform.analytics.view` | Tenant privacy thresholds; no seed fallback | P2 — **BACKEND REQUIRED** |

## Integration acceptance criteria

An integration may be marked **BACKEND CONNECTED** only when all of the following are true:

1. the frontend calls the canonical endpoint through the centralized API/service layer;
2. authentication and tenant authorization are enforced server-side;
3. loading, empty, unavailable, validation and retry states are visible and tested;
4. no mock/seed/timer fallback runs in production;
5. mutations are idempotent where retryable and emit backend audit records;
6. tests cover success, validation, unauthorized, forbidden, tenant mismatch, conflict and dependency failure;
7. the frontend does not infer authoritative payment, subscription, approval or clinical-finalization status from a click.

## 24. Multi-tenant pharmacy catalogue and marketplace

Supplied status: **FRONTEND CONTRACT ADDED; BACKEND REQUIRED**. The pharmacy operator workspace now models a global master drug list separately from each pharmacy organization's offer. The browser fixture is development-only and must not be treated as production inventory or pricing.

| Frontend page | Method and required endpoint | Request payload | Expected response | Auth / role / tenant | Validation and errors | Priority |
|---|---|---|---|---|---|---|
| Pharmacy catalogue | `GET /api/v1/pharmacy/catalogue` | `branchId`, search, cursor | Master drugs plus tenant-owned offers | Pharmacy employee; derive `organizationId` from session; branch scope | Never return another tenant's offers; cursor pagination | P0 — **BACKEND REQUIRED** |
| Add offer | `POST /api/v1/pharmacy/offers` | `masterDrugId`, branch, SKU, pack, price, stock policy, prescription flag, pickup/delivery | Offer with server ID, version and audit reference | `pharmacy.catalogue.manage`; organization membership | Unique SKU per organization/branch; currency and non-negative price; idempotency key | P0 — **BACKEND REQUIRED** |
| Edit offer | `PATCH /api/v1/pharmacy/offers/:offerId` | Versioned changed fields | Updated offer/version | Same tenant and permitted branch | ETag/If-Match conflict; price and stock history retained | P0 — **BACKEND REQUIRED** |
| Inventory movement ledger | `GET /api/v1/pharmacy/inventory/movements` | `branchId`, `offerId`, cursor | Append-only stock movements and balances | `pharmacy.inventory.view`; organization and branch scope | Never return another tenant's movements; cursor pagination | P0 — **BACKEND REQUIRED** |
| Receive or adjust stock | `POST /api/v1/pharmacy/inventory/movements` | Offer, branch, movement type, quantity, reference, notes | Movement, resulting balance and audit reference | `pharmacy.inventory.manage`; organization and branch scope | Idempotency key; reject negative balances; transactionally update stock | P0 — **BACKEND REQUIRED** |
| Publication | `POST /api/v1/pharmacy/offers/:offerId/publication` | `status`: `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `PAUSED` | Publication decision and audit event | Pharmacy administrator; compliance review when required | Only eligible/licensed products may publish; rejected state is server-controlled | P0 — **BACKEND REQUIRED** |
| Pharmacy profile/settings | `GET/PATCH /api/v1/pharmacy/settings/profile` | Legal name, PCN licence, superintendent, contacts, address, stock policy, receipt footer | Versioned tenant profile | Pharmacy administrator; organization scope | Licence format and contact validation; audit every change | P1 — **BACKEND REQUIRED** |
| Storefront settings | `GET/PATCH /api/v1/pharmacy/marketplace/config` | Store name, listing toggle, price visibility, pickup/delivery, lead time | Organization storefront config | Pharmacy administrator; organization scope | Do not expose contact/PHI fields publicly; audit every change | P1 — **BACKEND REQUIRED** |
| Patient marketplace directory | `GET /api/v1/marketplace/pharmacies` | location, category, cursor | Public pharmacy cards with freshness | Public/patient; only verified public organizations | Include `dataAvailable`, not fabricated ratings/stock | P0 — **BACKEND REQUIRED** |
| Patient storefront | `GET /api/v1/marketplace/pharmacies/:pharmacyId/products` | category, search, cursor | Published offers only, with price/availability snapshots | Public/patient | Filter `PUBLISHED` + public listing server-side; never trust client organization IDs | P0 — **BACKEND REQUIRED** |

The marketplace must be fed by published offer snapshots, not by the EMR dispensary catalogue directly. A pharmacy may use the same regulated master drug vocabulary as a hospital, but stock, price, branch availability, prescription requirements, publication state and order fulfilment remain tenant-owned records. Patient cart and checkout must snapshot `offerId`, price, currency, branch and stock reservation at order creation; a later price or stock change must not rewrite an existing order. All offer creation, edits, publication changes, stock reservations and storefront configuration changes must emit append-only tenant audit events.
