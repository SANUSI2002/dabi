# Sabi: production / staging migration contract

Decision recorded 20 October 2026. This is the target and cutover checklist, not a statement that the migration has been completed.

## Environment ownership

| Component | Production target | Staging retained |
| --- | --- | --- |
| Google project | `project-2dfff4eb-ff04-40b1-aff` | Existing `sabi-health-dev` Firebase/Google project |
| Web surfaces | Six isolated hosting targets in the official project | Existing Vercel projects and their provider URLs |
| Node API | Cloud Run, immutable image from the backend repository | Existing Render API |
| PostgreSQL | Separate Cloud SQL database, backups and tested restore | Existing Render database; verify retention/expiry before relying on it |
| Private documents | Separate private Google storage buckets and service identities | Existing Supabase project |
| Authentication | Existing Sabi Identity implementation, production-only signing/encryption secrets | Separate staging users, sessions, OAuth client and secrets |
| AI | Official-project Google API, bounded usage, server-side credentials | Separate staging credentials and usage limits |
| Email, video, scanning, payments | Explicit production provider configuration | Separate credentials and test/sandbox modes where the provider supports them |

The public `*.sabihealth.org` domains currently point at the existing deployments. Leave them there until the corresponding production target passes cutover checks. Calling those hosts "staging" in this document does not change DNS or erase their existing user records. Treat existing data as sensitive, even while staging.

The old Firebase project is staging. Firebase added to the **official** Google project would be part of production, not the old staging project. Firebase setup in the official project is still awaiting completion; no user/data migration to Firebase Auth is implied.

Keep frontend source in `SANUSI2002/dabi` and backend source in `SANUSI2002/dabi-backend`. Infrastructure changes belong with the service they deploy. Do not combine the repositories.

## Cost constraint: cumulative, not monthly

- User limit: strictly less than **USD 120 total** of the USD 300 trial credit.
- User rejected a 30-day rollout expiry. There is no automatic 30-day shutdown or deletion. This does not waive the cumulative spending limit or authorise ongoing charges after trial credit ends. An indefinite paid service cannot be promised under a finite lifetime allowance; quote the sustainable baseline and obtain a funding decision before committing to it.
- Operating target: **USD 90 total**, leaving at least USD 30 for delayed billing and variance. Count gross usage before promotional credits; a zero cash bill does not mean no trial credit was consumed.
- A billing-account budget named `Sabi migration - USD 90 total trial budget` was created and verified in the Google console. It begins 19 October 2026, has **no end date**, covers all linked projects/services, excludes savings/credits, and alerts billing admins/users at 50%, 78%, and 100% (approximately USD 45, USD 70, USD 90).
- The budget is **alerts-only**. It is not an installed automatic shutdown mechanism or a guarantee of a maximum bill.
- The account displayed USD 0 reported cost and USD 300 remaining at inspection. Billing is delayed; this is not a real-time meter.
- Do not upgrade the Google Cloud free trial to a full paid billing account, buy commitments, or enroll paid add-ons without a new decision.
- No Cloud Run/Cloud SQL/storage resources or cutover were created by the budget setup.

Before provisioning, record a regional quote covering the **entire intended run duration**, existing usage, build/registry, database compute/storage/backups, API/worker compute, AI tokens, hosting, object operations, network egress, secrets, logs, and migration overlap. Include retained backup/storage cost after compute stops. Do not count the same free allowance separately for each service instance or project.

Cost sanity check, **not a deployment quote**: one continuously allocated Cloud Run instance at 1 vCPU and 0.5 GiB for 90 days is 7,776,000 seconds. At the published Tier 1 on-demand example rates of USD 0.000018/vCPU-second and USD 0.000002/GiB-second, compute alone is about **USD 147.74 before free allowances**. This excludes the database and every other service. Do not deploy the existing combined API/interval-worker process continuously for the whole trial and assume it fits the USD 90 operating target. Use the durable, on-demand worker design below and quote actual expected load, or obtain a different duration/budget decision. No commitment discount is authorized. [Google rate reference](https://docs.cloud.google.com/run/cud).

Google now documents monthly, per-project/per-service spend caps for certain APIs, including Cloud Run and Gemini/Vertex. Verify availability and configure conservative caps where appropriate. They reset monthly, enforcement is not instant, and persistent-resource costs can continue. They cannot replace cumulative accounting or be described as a whole-project USD 120 hard cap.

At the USD 70 warning, review the full remaining-duration forecast before additional provisioning. At the USD 90 operating target, stop new cost-incurring rollout work and obtain direction. Do not abruptly disable billing, delete databases, or stop a live clinical service as an unreviewed budget reaction. Plan a safe rollback/maintenance response before cutover.

## Production architecture and prerequisites

1. **Web:** reuse the six existing surface builds. Separate production API/origin/redirect configuration from staging. No secret may be a `VITE_` variable. If Firebase Hosting proxies `/api`, explicitly enable its `__session` refresh-cookie compatibility in the production API; keep staging's existing cookie configuration. Do not cache authenticated API responses or private documents in a CDN/service worker.
2. **API:** stateless Cloud Run instances, bounded concurrency and database connection pools, explicit proxy trust, exact CORS origins, security headers, health/readiness checks, graceful shutdown and immutable release IDs. Compute the total connection budget across replicas and workers.
3. **Background work:** current `src/index.js` starts interval workers for scanners, reminders, expiry, dispatch, payments, runtime events, AI and video cleanup. Request-billed scale-to-zero alone would suspend that work. Refactor to authenticated Cloud Tasks/Pub/Sub/Scheduler handlers or dedicated jobs, with persisted state, leases, idempotency, retry/backoff and dead-letter handling. Until this is done, any continuously running worker capacity must be included in the quote. Do not silently turn workers off to reduce cost.
4. **Horizontal scale:** current process-local limiters are not a distributed enforcement mechanism. Add shared/atomic rate limits before increasing replicas. Financial mutations, inventory, prescription fulfilment, delivery proofs and onboarding decisions must remain transactionally enforced in PostgreSQL, not process memory.
5. **Database:** separate production credentials and database, TLS, least-privilege runtime identity, reviewed schema migration job, automated backups/PITR as supported by the selected edition, restore drill and measured recovery objectives. Use a tier fit for the workload; do not call a shared-core/no-SLA trial database a highly available production database.
6. **Storage:** private quarantine and clean buckets, tenant/patient authorization through Sabi API, short-lived previews, scanner workflow, checksums, retention and access logs. Current Supabase storage calls require a real Google storage adapter; do not switch only the URL. Keep source objects until reconciled and rollback retention is approved.
7. **Identity:** preserve Sabi Auth, RBAC/tenant checks, MFA and approval flows. Use distinct OAuth clients, JWT secrets, MFA keys, scanner callback secrets and session stores per environment. No production origin on staging's trusted-origin list after cutover. Avoid parent-domain cookies shared across production and staging.
8. **External integrations:** separate webhook destinations/signing secrets; verify Daily, Resend, Cloudmersive, payment and push configuration. Never let staging send real charges, production reminders or duplicate fulfilment events. Preserve any required MFA encryption compatibility during a deliberate data migration; do not merely rotate an encryption key while retaining ciphertext encrypted under the old one.
9. **Operations:** structured redacted logs, alerting, metrics, trace/request IDs, incident procedure, audit integrity, least-privilege IAM and explicit data-region/privacy review. Do not log tokens, document contents, medical prompts or provider error bodies.

## Delivery and cutover sequence

1. Inventory current resources, database size/extensions, private object counts, provider settings and existing spend. Confirm source backups and a safe maintenance/export window.
2. Quote a capacity/region/duration plan within the cumulative allowance. If the minimum safe design does not fit, request a scope/budget decision; do not weaken security or backups without disclosure.
3. Build and test the same commit/artifact in staging. Use `NODE_ENV=production` for secure hosted staging too; identify the environment separately, not by turning off production cookie/security behavior.
4. Create isolated production resources and server-only secret versions. Use workload identity rather than downloaded long-lived service-account keys where supported.
5. Run schema migrations once using a dedicated migration identity. Import only authorized, reviewed records; staging users do not automatically become production administrators. Reconcile counts, constraints, financial totals and file hashes. Freeze writes or capture a reviewed final delta at cutover—do not introduce silent dual writes.
6. Validate all six surfaces plus rider routes: registration, verification/resets, login/refresh/logout, MFA, tenant isolation, evidence uploads/scanning/review, approved workspace access, calls, prescriptions, stock, checkout, payments/webhooks, delivery proofs, earnings, reminders and AI queue/cancellation. Validate failure paths and restore/rollback, not just page loads.
7. Promote a reviewed image by digest; perform canary/blue-green checks before DNS and provider callbacks move. Keep previous images and a compatible schema for rollback. A binary rollback alone is insufficient after incompatible database changes or new production writes.
8. Move public domains to production only after verification. Keep staging on separate provider/staging hostnames. Verify TLS, PWA updates, OAuth/reset/invite links, cookies, CORS and webhook ownership after DNS propagation.
9. Remove production trust/secrets from staging deliberately, without destroying the retained environment. Re-run staging tests with its own accounts and sandbox settings. Production promotions must be explicit; an arbitrary developer push should not deploy an unverified change to live.

## Current status

Completed here: environment boundary recorded; cumulative USD 90 alerts saved and verified; backend container packaging and opt-in Firebase cookie compatibility prepared locally (see backend migration notes).

Not completed: regional cost quote, resource provisioning, async worker migration, distributed limits, Cloud SQL backup/restore validation, Google storage adapter/data copy, official OAuth/AI credential connection, production deployment or DNS cutover. Existing live behavior is unchanged.

References checked during planning:

- [Google budgets and alerts](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- [Spend-cap coverage, monthly resets and limitations](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps)
- [Cloud Run billing and background processing](https://docs.cloud.google.com/run/docs/configuring/billing-settings)
- [Firebase proxy cookie behavior](https://firebase.google.com/docs/hosting/manage-cache)
- [Cloud SQL pricing and shared-core SLA limitations](https://cloud.google.com/sql/pricing)
