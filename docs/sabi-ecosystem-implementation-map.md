# Sabi ecosystem implementation map

## What exists and can be reused

- React 19, Vite, React Router, Tailwind tokens, Framer Motion, shared UI primitives and lazy-loaded application pages.
- Mature Sabi OS product areas covering EMR, diagnostics, workforce, HR, accounting, equipment and reporting.
- A shared product/module catalog with route-level entitlement resolution.
- A separate Command Center with organizations, branches, packages, subscriptions, licenses, entitlements, identity records, documents, themes, onboarding, audit and operations data.
- Tenant context and tenant-qualified browser persistence for the current prototype.

## Authentication and SSO

Phase 3 now uses one frontend Sabi Identity session for platform operators, organization staff and patients. Authentication, MFA, recovery and SSO discovery are behind a replaceable identity-service interface. Organization users receive explicit memberships, select an organization when more than one is available and project the selected membership into the tenant EMR account and entitlement context. Platform operators route to Command Center; patients route to the Beta patient placeholder.

The current adapter remains a local demonstration: it uses seeded identities, does not persist passwords and cannot provide authoritative authorization. Production must replace it with a backend identity provider that issues short-lived sessions, validates MFA, enforces organization membership on every request, revokes sessions server-side and emits immutable security audit events.

## Organization and tenant architecture

The control plane distinguishes organizations, branches, tenant IDs/slugs, subscriptions, licenses and entitlements. The tenant application receives an active tenant context and resolved entitlements. Production must treat browser tenant IDs as hints only and enforce organization membership and tenant scope on every backend query.

## Command Center architecture

`useCommandCenter` currently supplies a persistent local control-plane prototype. Pages consume a repository abstraction rather than reading storage directly, allowing a future HTTP-backed repository. Organization status, document reviews, session revocation, themes and entitlements produce platform audit events.

## Entitlement architecture

The shared model is `Organization → Product → Module → Submodule → Route`. Packages create module snapshots; subscriptions, licenses and entitlement grants resolve into the tenant view. The existing boundary hides and blocks unlicensed routes across EMR, Workforce and Accounting.

## Patient architecture

There is no patient application in the repository. Patient Portal is represented in the catalog as Beta; Telemedicine and Doctor Portal are Planned. Public pages therefore label these directions explicitly instead of presenting them as generally available.

## Route map

- `/` — public Sabi Health homepage
- `/products/sabi-os`, `/products/sabi-health`
- `/solutions/:type`
- `/ai`, `/security`, `/about`, `/pricing`, `/resources`
- `/book-demo`, `/register`
- `/register/organization` — organization application start and saved-draft list
- `/register/organization/:applicationId` — progressive ten-stage application
- `/register/organization/:applicationId/status` — application status, reviewer requests and applicant responses
- `/login` — unified Sabi ID entry
- `/mfa`, `/forgot-password`, `/sso`, `/accept-invite` — identity journeys
- `/choose-organization` — organization membership selection
- `/account/sessions` — Sabi ID session and device management
- `/patient` — authenticated Beta patient placeholder
- `/workspace` — tenant dashboard
- existing clinical, diagnostic, HR, accounting and platform routes remain unchanged
- `/command-center/onboarding` — submitted-application verification queue
- `/command-center/onboarding/:applicationId` — permissioned verification case workspace
- `/command-center/*` — remaining platform control plane

Future phases can add `/onboarding/*`, reviewer verification routes and provisioning routes without disturbing the current route groups.

## Registration state machine

`DRAFT → SUBMITTED → UNDER_REVIEW → NEEDS_INFORMATION → APPROVED | REJECTED | WITHDRAWN`

Application state stays separate from organization lifecycle (`PROSPECT`, `ONBOARDING`, `TRIAL`, `ACTIVE`, `SUSPENDED`, `TERMINATED`, `ARCHIVED`) and provisioning state (`NOT_STARTED`, `QUEUED`, `PROVISIONING`, `CONFIGURING`, `READY`, `FAILED`).

## Verification architecture

Introduce replaceable `CorporateVerificationProvider`, `FacilityVerificationProvider`, `ProfessionalVerificationProvider` and `DocumentVerificationProvider` interfaces. Providers return evidence and non-authoritative results; reviewer/backend workflows own authoritative transitions. Regulatory requirements should resolve from jurisdiction, facility type and application facts through configurable requirement sets managed in Command Center.

## Proposed model additions

`SabiIdentity`, `OrganizationMembership`, `OrganizationApplication`, `FacilityType`, `Jurisdiction`, `Regulator`, `RegulatoryRegistration`, `Professional`, `ProfessionalCredential`, `ComplianceRequirement`, `ComplianceRequirementSet`, `ComplianceDocument`, `VerificationCase`, `VerificationCheck`, `TenantProvisioning`, `DemoRequest` and application-specific audit events.

## Phase 2 files

Created:

- `src/public/PublicShell.tsx`
- `src/public/components.tsx`
- `src/public/content.ts`
- `src/public/pages/HomePage.tsx`
- `src/public/pages/ContentPages.tsx`

Modified:

- `src/App.tsx`
- `src/index.css`
- `index.html`
- the EMR dashboard route references in navigation, entitlement mapping and tenant entry actions

## Phase 3 identity implementation

Created:

- `src/identity/domain.ts`
- `src/identity/seed.ts`
- `src/identity/service.ts`
- `src/identity/tenantProjection.ts`
- `src/identity/pages/IdentityPages.tsx`

Modified:

- `src/store/useAuth.ts` — central Sabi ID session, MFA challenge and organization activation
- `src/App.tsx` — identity routes plus membership-aware tenant and platform gates
- `src/components/layout/TopBar.tsx` — Sabi ID session controls and organization switching
- `src/command-center/components/CommandCenterShell.tsx`
- `src/command-center/components/CommandPalette.tsx`
- `src/command-center/access.ts`
- `src/command-center/pages/Tenant360.tsx`
- `src/pages/auth/LoginDoor.tsx` — compatibility export for the unified sign-in page

The phase deliberately removes frontend account impersonation and the unrestricted Command Center-to-EMR shortcut. Cross-tenant support access should be implemented later as an approved, reasoned, time-bound backend grant with complete auditing.

## Phase 4 organization registration

Created:

- `src/registration/domain.ts` — application states, step model, facility types and draft schema
- `src/registration/repository.ts` — replaceable browser draft repository and non-authoritative duplicate hints
- `src/registration/useRegistration.ts` — autosave, resume, step completion and submission state
- `src/registration/pages/OrganizationRegistration.tsx` — start, six-stage wizard and receipt

The flow collects the account owner, organization, operating profile, product preferences and package preference before review. Package data comes from Command Center. Password values remain in component memory and are never written into the saved draft. Regulatory documents are not collected or stored in browser storage.

Submitting creates only an `OrganizationApplication` receipt. It does not create an `Organization`, membership, subscription, entitlement, license or tenant. Those transitions remain behind the later compliance, reviewer and provisioning phases.

## Phase 5 compliance engine

Created:

- `src/compliance/domain.ts` — jurisdictions, regulators, requirements, versioned requirement sets, verification results and staged-document metadata
- `src/compliance/rules.ts` — fact-based requirement resolution with Nigeria and Lagos configuration baselines
- `src/compliance/providers.ts` — replaceable corporate, facility, professional and document verification interfaces
- `src/compliance/useComplianceUploads.ts` — session-only document staging with type and size validation
- `src/registration/pages/ComplianceSteps.tsx` — corporate, facility-regulation, operating-officer and dynamic-document stages

The organization application is now ten stages. Lagos private-hospital applications resolve both the Nigeria corporate baseline and the Lagos facility baseline, then condition individual requirements by ownership, facility type and whether the facility is new or existing. Other jurisdictions fall back to explicit manual review rather than silently applying Nigerian rules.

Local verification adapters can return only non-authoritative review states. They never produce a government-verified result. Files are retained only in an in-memory session vault; filenames, file bodies and fabricated storage identifiers are not written into the application draft. Reloading a draft after the document stage sends the applicant back to reattach evidence until a secure backend object-storage adapter exists.

## Phase 6 verification center

Created:

- `src/compliance/useVerificationCenter.ts` — persistent review metadata, permissioned transitions, approval preconditions, applicant requests and immutable case history
- `src/command-center/pages/VerificationCenter.tsx` — cross-application reviewer queue, risk filters and complete review workspace

Modified:

- `src/compliance/domain.ts` — verification cases, checks, notes, information requests and audit-event contracts
- `src/registration/pages/OrganizationRegistration.tsx` — live case status, applicant-visible notes and information-request responses
- `src/command-center/access.ts` — compliance-officer case-management permission
- `src/command-center/navigation.ts` and `src/App.tsx` — Verification Center navigation and list/detail routes

Submitted applications are joined into the reviewer queue by application ID rather than copied into a second customer record. Automated flags surface possible duplicates, legal-name mismatch, missing jurisdiction configuration and apparent credential expiry, but never approve, reject or merge applications. Reviewers explicitly decide corporate, facility, officer and document checks with mandatory reasons.

The enforced review lifecycle is `SUBMITTED → UNDER_REVIEW → NEEDS_INFORMATION → UNDER_REVIEW → APPROVED | REJECTED`. Applicant responses and applicant-visible notes are isolated from internal notes. Approval requires all mandatory checks to be verified, every information request resolved and core regulatory metadata present. It changes only the application and verification-case status: it does not create an organization, subscription, membership, entitlement, license or tenant.

As in Phase 5, regulatory file bodies are not persisted in browser storage. Review cases record only requirement/check metadata and explicitly disclose when evidence is unavailable to this frontend prototype. Production must move review authorization, transitions, audit append operations, applicant access tokens and evidence retrieval to backend services.

## Phase 7 commercial activation

Created:

- `src/commercial/domain.ts` — pre-provisioning commercial agreement, quote, payment and audit contracts
- `src/commercial/useCommercialOnboarding.ts` — approved-application intake, versioned quotation calculation, acceptance, payment authorization and activation guards
- `src/commercial/CommercialApplicantPanel.tsx` — applicant quotation and signed-name acceptance experience
- `src/command-center/pages/CommercialOnboarding.tsx` — deals queue, configuration, pricing, payment and immutable commercial history workspace

Modified:

- `src/command-center/navigation.ts` and `src/App.tsx` — Deals & activation list/detail routes
- `src/registration/pages/OrganizationRegistration.tsx` — approved-application commercial progress and quote acceptance

Only `APPROVED` applications enter the commercial pipeline. The lifecycle is `DRAFT → QUOTED → ACCEPTED → PAYMENT_PENDING → ACTIVE`. Reconfiguration supersedes an open quote instead of rewriting it, and unaccepted quotes expire according to their issued validity. Prices snapshot a published package version and explicitly calculate capacity add-ons, authorized discounts and tax. Discounting requires `pricing.manage`; payment confirmation requires `billing.manage`; activation requires both billing and subscription authority.

Applicant quote acceptance records the signer and timestamp, but the local prototype is not a legal-signature service. Production must require an authenticated applicant session and server-generated acceptance evidence. Trial, invoice and manual-transfer paths remain distinct, and a commercial agreement cannot become active without confirmed payment or an authorized trial waiver.

An `ACTIVE` commercial agreement is only an input to Phase 8. Phase 7 does not create an organization, tenant, subscription, license, entitlement or membership.

## Phase 8 tenant provisioning

Created:

- `src/provisioning/domain.ts` — provisioning job, step, status and audit contracts
- `src/provisioning/useTenantProvisioning.ts` — active-agreement intake, queueing, retry-safe orchestration, integrity verification and first-run handoff
- `src/provisioning/ProvisioningApplicantPanel.tsx` — applicant-visible provisioning progress without exposing internal configuration
- `src/command-center/pages/TenantProvisioning.tsx` — platform provisioning queue and job workspace

Modified:

- `src/command-center/domain.ts` — atomic provisioning payload and idempotency-commit contracts
- `src/command-center/useCommandCenter.ts` — atomic creation of organization, primary branch, subscription, license and invited owner records
- `src/command-center/navigation.ts` and `src/App.tsx` — provisioning list/detail routes
- `src/registration/pages/OrganizationRegistration.tsx` — approved applicant provisioning status

Only an `ACTIVE` commercial agreement backed by an `APPROVED` application and accepted quote can create a provisioning job. The job lifecycle is `NOT_STARTED → QUEUED → PROVISIONING → CONFIGURING → READY | FAILED`. Each application/agreement pair receives a stable idempotency key. The Command Center stores a provisioning commit against that key and returns the original organization on retry instead of creating duplicate records.

The control-plane write is atomic in the current adapter: organization, main branch, subscription snapshot, license and first-owner invitation are assembled and committed together. Post-commit integrity checks require all records to exist and confirm that the organization is still `Onboarding`, its branch is `Opening`, and its owner is `Invited`. A failed pre-commit job may be reset; once a commit exists, recovery is idempotent retry or explicit manual remediation rather than destructive automatic rollback.

`READY` means ready for Phase 9 first-run setup, not live clinical access. No Sabi Identity organization membership is activated, and the organization is not moved to `Active` by provisioning.

## Phase 9 first-run experience

Created:

- `src/tenant-setup/domain.ts` — module-aware setup steps, configuration snapshot, readiness checks and immutable setup-event contracts
- `src/tenant-setup/useTenantSetup.ts` — provisioning handoff, tenant-admin configuration, review decisions and controlled activation state machine
- `src/tenant-setup/TenantFirstRunSetup.tsx` — restricted hospital administrator setup experience at `/workspace/setup`
- `src/command-center/pages/TenantSetupManagement.tsx` — Sabi implementation review and go-live control at `/command-center/setup`

Modified:

- `src/command-center/useCommandCenter.ts` — atomic post-approval activation of the organization, primary branch and organization owner
- `src/provisioning/useTenantProvisioning.ts` — creates the Phase 9 handoff immediately after a successful provisioning job
- `src/identity/tenantProjection.ts` — permits a restricted onboarding workspace only for organization administrators with a first-run record
- `src/App.tsx` — first-run and Command Center setup routes plus a tenant-workspace gate that blocks every clinical route before go-live
- `src/command-center/navigation.ts` — Go-live setup navigation

First-run setup is generated from the immutable licensed module snapshot. Pharmacy, laboratory, billing and patient-migration steps appear only when their owning modules are licensed. Organization and subscription facts are read-only provisioning evidence; the tenant administrator supplies departments, services, staff-import intent, safe patient-migration intent, operational defaults, branding and training acknowledgement.

The lifecycle is `NOT_STARTED → IN_PROGRESS → READY_FOR_REVIEW → APPROVED → LIVE`, with `CHANGES_REQUESTED` returning the record to tenant administration. Submission is not activation. Sabi implementation users need both onboarding and organization permissions to approve readiness, then perform a separate reasoned activation action. Activation revalidates the organization, subscription, license, branch and owner before changing the organization to `Trial` or `Active`, onboarding to `Live`, the primary branch to `Active`, and the owner projection to `Active` in one control-plane write.

An organization administrator with an onboarding tenant is redirected to `/workspace/setup`; all clinical, workforce and accounting routes remain inaccessible until the setup record is `LIVE`. The setup state stores configuration and counts only. It does not store staff credentials, patient identifiers, clinical data or imported files. Invitation-token verification, identity membership creation and import execution remain secure-backend responsibilities rather than frontend simulation.

## Main risks

- Accidentally exposing tenant routes while introducing public routes.
- Treating frontend session or verification state as authoritative.
- Duplicating package prices or product statuses outside Command Center.
- Presenting roadmap patient or AI capabilities as live.
- Breaking the existing dashboard root route.
- Increasing the initial bundle through public-site dependencies.

The current implementation addresses these by separating public and protected route groups, moving the dashboard entry to `/workspace`, retaining all clinical deep links, sourcing pricing/status from shared catalog state, labelling product maturity, and lazy-loading public pages.
