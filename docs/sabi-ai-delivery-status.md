# Sabi AI implementation ledger

Updated 20 October 2026. User instruction: finish AI first, then migrate production to official Google Cloud. Continue without routine milestone handoffs. The existing Render/Firebase/Vercel/Supabase deployment stack is retained as staging/rollback; do not cut over domains until production verification. The cumulative cloud allowance remains strictly below USD 120, with USD 90 as the operating target.

## Implemented locally and tested

- Durable authenticated general conversations, ownership, consent, idempotency, cancellation, bounded context, provider error handling and originating-session rechecks.
- Shared responsive conversation workspace connected to existing auth in standalone `/ai/workspace`, patient `/sabi-ai`, and professional `/sabi-ai` routes. Landing page links to the real workspace; sample marketing threads remain labelled samples.
- History search within recent conversations, persisted run recovery, bounded polling with backoff, explicit cancellation, safe text rendering, full conversation JSON export, deletion and retention explanation.
- Atomic per-user/day, global/day and cumulative request allowances. These are not provider-dollar hard caps and do not replace the saved Google billing budget.
- Explicit user memory with correction revisions, private ownership, 50-entry/8000-character aggregate bounds, source-conversation linkage, content deletion, and publication-time context revocation checks.
- Answer feedback (helpful, unclear, concern), separate from medical records and signed notes.
- Command Centre metadata-only overview, runs, audited traces, concern filters and a version-checked MFA-protected generation pause.
- Keyless production Vertex adapter using attached-service-identity ADC; compatible development API-key adapter remains server-only.
- Personal document workspace connected to existing patient upload/screening: durable extraction, bounded isolated PDF inspection, strict per-page JSON, missing-value preservation, wrong-patient acknowledgement and owner text corrections. Not clinical verification or writeback.
- Explicit selected-document retrieval with page/source-version references, invalid-citation rejection, and source revocation checks on publication, history, retries, cancellation, exports and subsequent model context. Original document deletion triggers derivative purge.
- First confirmed domain adapter: exact reminder-notification preview, explicit confirmation through the existing medication service, immutable transaction receipt and idempotent recovery. Schedule version/ownership/expiry checks prevent stale or cross-account changes. No dose or prescription modification; no autonomous LLM tool execution.
- Backend container/migration targets and opt-in Firebase proxy cookie compatibility, with existing Render/Vercel defaults preserved.

## Verification evidence

- Full backend regression: **902 tests in 92 files passed**, including isolated parser/provider tests; lint passed.
- AI embedded PostgreSQL lifecycle, document and action suites: **37 tests passed**, including real originating-session revocation, direct composite-FK failures, owner isolation, idempotency, deletion/revocation races, immutable receipts and export/cancel/retry reads.
- Workspace + documents + actions + Command Centre + marketing tests: **19 tests passed**; root TypeScript check passed. Source-inclusive Health build passed after reminder integration, including embedded patient and doctor builds; existing large-chunk warnings remain.
- Prisma 7.10.1 client regenerated against a nonconnecting synthetic URL; additive migrations exercised only in local embedded PostgreSQL. No live database changed.
- **721/721 API route coverage**; OpenAPI validates with one existing unrelated social-provider 4xx warning. Compatible security updates and npm audit report **0 known vulnerabilities**; no Prisma RC/major version installed.
- Windows sandbox blocked localhost HTTP test connections and Prisma client paths; approved non-sandbox tests use synthetic fixtures and embedded PostgreSQL, never a live database.

## Still required for the full specification

The supplied spec is a full multi-phase product, not just a chat page. These remain in scope, not silently removed: licensed reference registry/publication, semantic retrieval and book viewer; delegated patient page context; professional/EMR encounter drafts and domain-authorised writeback; reviewed tool proposals and domain receipts; WhatsApp AI integration; escalation ownership/acknowledgement; speech/languages/avatar; configurable entitlements and immutable monetary usage; clinical evaluation and restore drills. Personal document ingestion/extraction and bounded lexical retrieval now exist; do not describe that as a licensed global medical reference service.

The later 20 October JEV and EMDEX specifications supersede the earlier **“jev later”** decision.
The backend now has a typed TypeSafe adapter, versioned documentation question set, durable
tenant-scoped assessment jobs, source/policy staleness checks and append-only human dispositions.
The first non-blocking review panel is mounted beside saved live-EMR consultation drafts. It queues
an explicit review, tracks status, hides findings for unsaved edits, and records reasoned dispositions
without changing note-signing or prescribing. This is the medicine-history documentation subset
of C12, not all 35 JEV modules. EMDEX has a
tested server-only request transport, but no licensed account or verified response contract has
been supplied; no fake catalogue or prescribing capability is exposed. The complete 35-module
traceability map and remaining EMDEX requirements are in backend `docs/jev-emdex-implementation.md`.
Authorised Standing Orders/EMDEX content is still not supplied. Do not invent licensed content,
clinical thresholds, provider success or clinical approval.

Additional checkpoint verification: **934 backend tests in 94 files passed**, including **32 JEV/EMDEX
adapter tests**. **50 embedded PostgreSQL AI tests passed**, including **13 JEV workflow cases**
(cross-tenant access, duplicates, stale notes, policy revocation, removed membership, shadow mode,
immutable reviews, unavailable provider, interrupted claims and persisted allowance). These are
synthetic fixtures, not claims of clinical validation or live provider execution.

Frontend checkpoint: 20 focused tests across four files passed, including six JEV panel cases and
existing consultation/marketing/Command Centre tests; TypeScript passed. Browser accessibility state
confirmed the synthetic panel rendered, but browser debugger timeouts prevented completing screenshot
and mobile visual verification. Do not report that visual check as passed.

The EMR production build completed successfully, including service-worker generation; existing
large-chunk warnings remain. These are local build results, not a declaration of live deployment.

## Release and migration state

Secret Manager API is enabled in the official project. The approved TypeSafe backend key is stored
as `typesafe-api-key`, version 1; no key was printed, committed or saved in this workspace. No
runtime secret-access IAM permission, live provider invocation or clinical activation is implied.

The user subsequently approved **USD 60/month ongoing hosting**, without a 30-day expiry. Retain
the original cumulative trial-credit cap and USD 90 operating target too; this is not approval for
a paid-billing upgrade or unquoted resources. Quote all database/backup/API/worker/storage/AI costs
against both constraints before provisioning.

Verified checkpoints were committed and pushed to **`codex/sabi-ai-foundation` in both existing repositories** (frontend initial checkpoint `65ec4d4`, backend `60d541a`). They are not merged or deployed live. The frontend checkpoint used an isolated Git index, leaving the user's active master branch/index and unrelated EMR/`.claude` work unchanged. AI working files remain present locally for continued development.

The approved `sabi-ai-production@project-2dfff4eb-ff04-40b1-aff.iam.gserviceaccount.com` identity now exists, with no downloaded keys and only the custom role `projects/project-2dfff4eb-ff04-40b1-aff/roles/sabiAiModelInvoker` containing `aiplatform.endpoints.predict`. The IAM grant was visibly verified. The user accepted the AI API terms and **`aiplatform.googleapis.com` is enabled**, visibly verified. There is still no live model connection, Cloud Run/Cloud SQL provisioning, data migration or DNS cutover. Official Firebase setup remains unfinished at its pricing confirmation. The cumulative USD 90 alerts are not an installed shutdown mechanism.

The user rejected a 30-day rollout expiry on 20 October. Do not add an artificial shutdown, deletion or account expiry. The cumulative less-than-USD-120 cap is still active. The published example of one dedicated vCPU plus 3.75 GiB at USD 0.0413/vCPU-hour and USD 0.007/GiB-hour is approximately USD 48.64 for 720 hours, or USD 145.91 for 2160 hours, **compute only**. This is not a complete regional deployment quote; storage/backups/API/AI/egress/builds need allowance. Do not provision a 90-day plan exceeding the cap or silently substitute test-only shared-core instances. Google also stops free-trial resources at 90 days unless billing is upgraded; no paid upgrade is authorised. An indefinite all-Google paid production baseline needs a continuing funding decision, not a fictitious free hosting promise. See https://cloud.google.com/sql/pricing?hl=en , https://docs.cloud.google.com/sql/docs/postgres/instance-settings and https://docs.cloud.google.com/free/docs/free-cloud-features .

Next engineering work: remaining licensed-reference/context/action vertical slices and official-provider verification, then the production migration. Command Centre AI controls and personal-source services are already implemented. Production scale-to-zero must use durable task/job execution; the present interval workers cannot simply be suspended. Do not provision an always-on full-trial compute plan that exceeds the user's budget.
