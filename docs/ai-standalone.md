# Standalone Sabi AI

The standalone Sabi AI routes are `/ai/login`, `/ai/signup`, `/ai/workspace`, `/ai/account` and `/ai/verify-email/:uid`. They use Sabi Identity rather than a separate credential store. Existing Sabi users sign in and apply for an AI category; new users verify their email before sign-in. Professional and business approval is separate from email verification and grants no clinical permissions.

`ai.sabihealth.org` is intended to alias the existing Health deployment. Its root opens the standalone workspace, `/login` opens AI login and `/signup` forwards to AI signup. Existing `sabihealth.org` root remains the landing page. AI-prefix routes belong to Health, not EMR. An idle standalone session is revoked and navigates to AI login; private conversation state is discarded.

Command Centre pages: `/command-center/ai/accounts` manages category features, individual overrides and applications; `/command-center/ai/knowledge` manages the private reference library. Both are gated by platform permissions; the knowledge API additionally requires recent MFA. End users never receive the library component, catalogue or book-preview controls through their AI UI. Server authorisation remains authoritative for direct URLs/APIs.

Shared patient, doctor and standalone AI workspaces render book references as non-downloadable bibliographic records. Personal-source previews remain separate. Disabling memory removes its save form and prevents sending saved context to the provider; existing data remains reviewable/deletable.

## Artwork and UI decisions

UI/UX Pro Max informed 44px minimum interactive targets, 16px form inputs, responsive single-column forms, visible labels/focus, stateful confirmations and reduced-motion support. Existing Sabi typography and forest/sage/ivory visual language were retained rather than replacing the entire ecosystem theme.

Generated with the built-in image-generation tool. Production asset: `src/assets/landing/sabi-ai-standalone-v1.webp` (1440px wide, optimised from the generated original). It is used as the auth layout illustration, not as a flattened mockup of the functional UI.

Final generation prompt: “Use case: illustration-story. Asset type: premium Sabi AI standalone health assistant login and welcome artwork for a real website. Create one editorial painterly illustration, landscape 1536x1024 composition: a peaceful contemporary Nigerian home-workspace opening into a sunlit leafy courtyard; a young Black woman in everyday cream clothing seated reading a tablet, a Black healthcare professional in sage scrubs nearby reading a closed-reference notebook, friendly but not posed. Warm sunlight, refined hand-painted paper texture, sophisticated muted sage, forest green, ivory and touches of apricot. Intent is human care and reliable knowledge, not futuristic robots. Spacious composition, beautiful botanical shadows, visually quiet upper left, people placed in right half suitable for responsive cropping. No text, no lettering, no UI mockup, no logos, no watermark. Original premium editorial art, avoid exaggerated medical equipment, neon, glossy plastic or photorealistic stock-photo look.”

## Backend scope

The backend implementation report is `docs/ai-standalone-knowledge.md` in `SANUSI2002/dabi-backend`. Automated OCR, semantic ranking, live external source retrieval, structured drug integration and clinical evaluations are not represented as complete by this release. General assistant access and existing clinical permission boundaries are preserved.
