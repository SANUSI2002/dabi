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
- Backend container/migration targets and opt-in Firebase proxy cookie compatibility, with existing Render/Vercel defaults preserved.

## Verification evidence

- Full backend regression: **902 tests in 92 files passed**, including isolated parser/provider tests; lint passed.
- AI embedded PostgreSQL lifecycle and document suites: **32 tests passed**, including real originating-session revocation, direct composite-FK failures, owner isolation, idempotency, deletion/revocation races and export/cancel/retry reads.
- Workspace + documents + Command Centre + marketing tests: **17 tests passed**; root TypeScript check passed. Source-inclusive Health build passed, including embedded patient and doctor builds; existing large-chunk warnings remain.
- Prisma 7.10.1 client regenerated against a nonconnecting synthetic URL; additive migrations exercised only in local embedded PostgreSQL. No live database changed.
- **716/716 API route coverage**; OpenAPI validates with one existing unrelated social-provider 4xx warning. Compatible security updates and npm audit report **0 known vulnerabilities**; no Prisma RC/major version installed.
- Windows sandbox blocked localhost HTTP test connections and Prisma client paths; approved non-sandbox tests use synthetic fixtures and embedded PostgreSQL, never a live database.

## Still required for the full specification

The supplied spec is a full multi-phase product, not just a chat page. These remain in scope, not silently removed: licensed reference registry/publication, semantic retrieval and book viewer; delegated patient page context; professional/EMR encounter drafts and domain-authorised writeback; reviewed tool proposals and domain receipts; WhatsApp AI integration; escalation ownership/acknowledgement; speech/languages/avatar; configurable entitlements and immutable monetary usage; clinical evaluation and restore drills. Personal document ingestion/extraction and bounded lexical retrieval now exist; do not describe that as a licensed global medical reference service.

The supplied ZIP has no JEV adapter/model contract or licensed reference collections. The user explicitly replied **“jev later”** on 20 October: defer JEV, do not use its absence to block independent work. Authorised Standing Orders/EMDEX content is still not supplied. Do not invent licensed content, clinical thresholds, model credentials, provider success or clinical approval.

## Release and migration state

All new AI changes currently remain local in the frontend and `backend/sabi-social-login` worktree (`codex/sabi-ai-foundation`). Keep changes in their separate existing repositories. Preserve the user's ongoing EMR programme edits and `.claude` changes; do not stage all files blindly.

The approved `sabi-ai-production@project-2dfff4eb-ff04-40b1-aff.iam.gserviceaccount.com` identity now exists, with no downloaded keys and only the custom role `projects/project-2dfff4eb-ff04-40b1-aff/roles/sabiAiModelInvoker` containing `aiplatform.endpoints.predict`. The IAM grant was visibly verified. API terms activation is awaiting the user's action-time confirmation. There is still no live model connection, Cloud Run/Cloud SQL provisioning, data migration or DNS cutover. Official Firebase setup remains unfinished at its pricing confirmation. The cumulative USD 90 alerts are not an installed shutdown mechanism.

Next engineering work: remaining licensed-reference/context/action vertical slices and official-provider verification, then the production migration. Command Centre AI controls and personal-source services are already implemented. Production scale-to-zero must use durable task/job execution; the present interval workers cannot simply be suspended. Do not provision an always-on full-trial compute plan that exceeds the user's budget.
