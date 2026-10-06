# Patient and professional portal UI revamp

Date: 6 October 2026. Frontend-only release; existing API contracts, identity, MFA, credential approval, patient access and professional scope remain authoritative.

## What changed

- One shared visual system: forest-green navigation, warm ivory backgrounds, sage highlights, restrained typography, rounded surfaces, clearer page headings and focus indicators.
- The account chooser and old professional signup routes now lead to the shared professional registration. Family caregiver onboarding remains separate from professional credential registration. Unsupported professions are not silently classified as doctors.
- Patient login and registration use custom Sabi editorial artwork instead of background videos, stock avatars and invented marketing statistics.
- Professional sign-in, registration, recovery and application status share the same artwork and responsive auth layout.
- The doctor/professional shell and patient shell share navigation colours, active states, spacing, cards, tables and form treatments. Existing module layouts are retained rather than replaced by a screenshot.
- Patient dashboard artwork and professional dashboard banner link to existing vitals and availability routes. No new clinical, financial or appointment data is fabricated.
- Professional registration now follows the doctor's four stages: account, professional details, verification, review/submit. Doctors retain their existing wizard; other professions retain their separate discipline-specific questions.
- Nursing/community-health disciplines request current dated regulatory credentials. Counsellors, clinical psychologists and non-clinical caregivers do not inherit doctor prescribing permissions.
- Wizard validation runs before moving forward. Confirmation passwords are not transmitted or stored; API failures retain entered details; a synchronous guard prevents duplicate account creation requests.
- Patient registration labels now identify their inputs. Unconfigured Google/Apple account creation is disabled rather than sending users to placeholder OAuth clients.
- Mobile auth omits decorative artwork and its large image download; forms use legible 16px controls and single-column layouts. Dashboard artwork is decorative, not clinical information.

Shared files: `apps/telemedicine/packages/shared-portal/`. The shared stylesheet is imported last in both portal entry points so earlier legacy page styles do not overwrite it. Shared design tokens live in `apps/telemedicine/packages/design-system/src/tokens.js`.

## Surfaces covered by the shared system

| Surface | Treatment |
| --- | --- |
| Patient account chooser, login and registration | New illustrated account experience, mobile layout and accessible field labels |
| Patient dashboard | New illustrated welcome card, page context, navigation and card styling |
| Appointments, vitals, records, prescriptions, family, profile | Shared shell, tokens, headings, controls and card/table styling; existing workflow structure retained |
| Wellness, care plans, pharmacy marketplace, hospitals, insurance, wallet | Shared shell and visual tokens; existing module-specific layouts and unavailable states retained |
| Professional registration and account screens | Shared illustrated auth shell; four-stage registration for non-doctor professions |
| Professional dashboard, calendar, availability, appointments, consultations | Shared shell, banner, empty states, cards and form styling |
| Professional patients, prescriptions, reports, messages, hospital workspace, earnings, reviews, profile, settings | Shared shell and visual foundation; role-filtered navigation and existing access controls retained |
| Nutrition / support care workspaces | Shared care-card and form/table treatment, unchanged scope and publication flow |

This is a cohesive shared UI revamp, not a claim that every module has been individually rebuilt or that incomplete backend features are complete. The frontend-only wallet remains visibly unavailable; patient legal-policy links need actual approved published policy destinations. OAuth remains unavailable until server OIDC is configured. Existing production bundle-size warnings remain.

## Generated assets and prompts

Used the **imagegen skill**, built-in image-generation mode, with no reference images and no external provider credentials. Artwork depicts fictional people, not real staff, testimonials or medical records. The originals remain in the Codex generated-images directory; versioned copies below are checked into the frontend repository.

### Account illustration

Saved project asset: `apps/telemedicine/packages/shared-portal/assets/care-conversation-v1.png`.

Prompt:

> Use case: illustration-story. Asset type: production portrait illustration for the Sabi Health Nigerian telemedicine patient and healthcare-professional sign-in and registration pages. Create an elegant contemporary editorial illustration of a Black Nigerian female healthcare professional in a simple white coat over deep forest-green scrubs, seated beside a Black adult patient in warm cream clothing, thoughtfully discussing a tablet together in a serene clinic. Stylized hand-painted gouache with subtle grain, sophisticated natural anatomy, warm empathetic faces, not childish or glossy 3D. Portrait composition, subjects in lower two thirds, airy upper area; soft pale sage and warm ivory background, restrained forest green and muted terracotta accents, softly rounded plant leaves and a sunlit arch as background context. Flat balanced shapes with delicate natural shadows. No writing, no letters, no numbers, no logos, no watermark, no interface panels, no medical records visible, no claim of real staff. Intended as decorative UI art behind real HTML copy, not an entire UI screenshot. High quality crisp generous margins.

### Dashboard illustration

Saved project asset: `apps/telemedicine/packages/shared-portal/assets/wellness-at-home-v1.png`.

Prompt:

> Use case: illustration-story. Asset type: production wide decorative banner artwork for Sabi Health patient and professional dashboards. Elegant hand-painted gouache editorial illustration of connected healthcare: a Black Nigerian adult woman at home sitting comfortably with a tablet, with a small leafy plant and a softly abstract sunlit window nearby. Not a real person, no clinical records or diagnoses displayed. Wide landscape 3:2 artwork with the woman and plant arranged predominantly on the right half, quiet pale sage background on the left so a UI can crop the artwork for a dashboard side panel; subjects visible at medium distance and balanced with generous margins. Sophisticated warm natural anatomy and empathetic expression, refined subtle paper texture, flat balanced forms, restrained deep forest green, sage, warm ivory and small muted terracotta accents. Match premium calm Nigerian healthcare editorial illustration, not cartoon, not glossy 3D, not stock-photo collage. No text, numbers, logos, watermark, no UI screenshot or interface panels, no screens with readable data.

## Verification record

- Original workspace: 176 frontend tests passed before the final account-routing assertion; the final focused UI suites passed all 14 tests.
- Doctor workspace Node tests: 33 passed.
- Telemedicine production build passed for patient and professional outputs.
- Browser desktop checks: patient login/registration; explicitly labeled local doctor dashboard and availability.
- Browser mobile checks at 390 × 844: patient registration and professional sign-in/availability. Availability page has no horizontal overflow.
- No real registration, document approval, clinical consultation or payment was created during UI QA.
- Authenticated live module checks require a user-owned session; local doctor checks use the existing explicit preview rather than bypassing live authentication.

Release checks and live confirmation are recorded after the isolated release checkout is built and pushed. Unrelated EMR changes in the original workspace are excluded.
