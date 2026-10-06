# Premium page artwork and typography

## Scope

71 distinct workspace screen templates: 51 patient and 20 professional, including parameterised detail pages. Dynamic records share the illustration for their screen template; no personal data is rendered into artwork. Authentication and registration retain the previously illustrated CareStory layout. Unknown/auth routes never receive workspace banners. Existing role gates, clinical permissions, forms, backend integrations, wallet restrictions, and real account authentication are unchanged.

## Implementation

- Shared `PageBanner.jsx` and route catalog supply page-specific copy, decorative imagery, and two real navigation links. Patient pages use the existing shared Topbar; professional pages use PortalLayout. Removed the duplicate overview heroes.
- Self-hosted [Manrope](https://github.com/google/fonts/tree/main/ofl/manrope) headings and [Inter](https://github.com/google/fonts/tree/main/ofl/inter) body text. Font files and OFL licences are under `shared-portal/assets/fonts`. Font display is swap. No runtime Google Fonts request.
- Heading sizes: workspace 28–34 px, banner 27–40 px, section 17–18 px; body 14–15 px. Compact mobile banners, 44 px action targets, visible focus rings and reduced-motion support.
- WebP copies at quality 88 preserve original dimensions (1536×1024) and scenes. Original PNGs remain in the Imagegen output folder. Total generated originals 178,944,701 bytes; delivery collection 14,817,944 bytes (91.7% reduction). Only the current banner image is mounted/downloaded; eager glob imports resolve URLs, not all image bytes.
- Illustration paths: `apps/telemedicine/packages/shared-portal/assets/page-banners/{audience}-{id}-v1.webp`.
- Preview-only screens do not gain live backend support from this design change. Page actions navigate existing workflows; they never grant permissions, prescribe, approve, transfer funds or submit clinical decisions.

## Imagegen provenance

Used the Imagegen skill and built-in image generation tool: 71 separate calls, one new scene per screen. Generation mode was new-image creation with an existing image supplied only as a style reference (not a scene edit). Reference: `shared-portal/assets/wellness-at-home-v1.png`. No real people or records were provided. No Imagegen CLI fallback was used.

## Verification

- All 71 delivery illustrations visually inspected in a local review gallery. All are unique WebP files with matching catalog IDs.
- 86 banner tests cover template matching, specific/detail route precedence, authentication exclusions, asset integrity and link navigation.
- Computer Use checks confirmed doctor overview/availability action navigation, the actual rendered Manrope heading font, and responsive layouts at 390 px. Patient component review uses no account or medical data; live clinical account permissions were not bypassed to review appearance.
- Desktop and mobile proof screenshots are local QA artifacts, not deployment assets. Local review harnesses are excluded from Git and deployment.
- Release verification and deployment status are recorded separately; creating artwork does not enable preview-only clinical features.

Full prompt template (insert the audience, ID and scene from the table):

> Use case: illustration-story. Asset type: new premium Sabi Health {audience} {id} page banner. Primary request: {scene}. Input image: STYLE AND PALETTE REFERENCE ONLY, not an edit target; create a completely new scene. Match refined hand-painted gouache, subtle paper grain, natural dignified anatomy, sophisticated Nigerian healthcare editorial art. Landscape 3:2 composition; main subject(s) in the right 60%, quiet pale sage space on the left, generous margins. Forest green, warm ivory, sage and restrained terracotta; warm sunlit mood. People are fictional. No writing, lettering, labels, numbers, logos, watermark, interface panels, clinical records, diagnoses or identifiable real people. No glossy 3D or clip art.

| Audience / ID | Screen route | Scene prompt | Primary action |
| --- | --- | --- | --- |
| patient-overview | /dashboard | a Black Nigerian woman relaxing at home with a tablet and a leafy plant | View my appointments → /appointments |
| patient-appointments | /appointments | a Black Nigerian woman writing in an open blank weekly planner at a sunlit table | Find a doctor → /doctor |
| patient-reschedule | /appointments/reschedule/:id | a Black Nigerian man looking at a wristwatch beside a blank desk calendar | My appointments → /appointments |
| patient-records | /records | a Black Nigerian woman organising plain unlabelled folders in an elegant study | View my prescriptions → /prescriptions |
| patient-prescriptions | /prescriptions | a Black Nigerian pharmacist discussing an unlabelled prescription with an adult patient | Explore pharmacies → /pharmacy-market |
| patient-prescription-detail | /prescriptions/:id | close-up of calm hands holding a blank prescription beside an unlabelled medicine box | All prescriptions → /prescriptions |
| patient-select-pharmacy | /prescriptions/:id/select-pharmacy | a welcoming neighbourhood pharmacy entrance with a Black Nigerian pharmacist | Browse pharmacies → /pharmacy-market |
| patient-prescription-quotes | /prescriptions/:id/quotes | hands comparing two blank stationery cards on a sage desktop with medicine packaging | Quote inbox → /pharmacy-quotes |
| patient-dietician | /prescriptions/dietician-table | a Black Nigerian dietitian arranging a colourful wholesome meal of vegetables grains and beans | Find a nutrition professional → /wellness-hub/professionals |
| patient-care-plans | /care-plans | a Black Nigerian adult reflecting in a blank journal in a peaceful garden | Explore wellness care → /wellness-hub |
| patient-vitals | /vitals | a Black Nigerian woman checking a home blood-pressure cuff with no visible display numbers | Add a reading → /vitals/add |
| patient-vital-select | /vitals/add | a tabletop arrangement of simple unlabelled home health measurement devices | View my vitals → /vitals |
| patient-vital-reading | /vitals/add/:type | close-up of a Black Nigerian adult noting a device reading in a blank notebook | Choose another measurement → /vitals/add |
| patient-vital-history | /vitals/history/:type | a Black Nigerian woman thoughtfully reviewing a tablet beside a plain notebook and home monitor | My vitals → /vitals |
| patient-find-doctor | /doctor | two Black Nigerian doctors in an airy clinic warmly conversing, without name badges | My appointments → /appointments |
| patient-consultation-report | /reports/:id | a Black Nigerian patient reading a plain care-summary booklet beside a sunlit window | Health records → /records |
| patient-profile | /profile | a Black Nigerian woman at a mirror in a bright minimal interior with a small plant | Health records → /records |
| patient-family | /family | a multigenerational Black Nigerian family spending a calm afternoon together | Add a family member → /family/add |
| patient-family-add | /family/add | a Black Nigerian mother and adult daughter talking together at a kitchen table | Family care → /family |
| patient-dependent | /family/add/dependent | a Black Nigerian parent and young child seated together in a calm waiting room | Family care → /family |
| patient-family-added | /family/add/success | a Black Nigerian family holding hands in a sunny garden | Family care → /family |
| patient-family-member | /family/member/:memberId | a Black Nigerian older adult and younger relative sharing tea on a veranda | Family care → /family |
| patient-care-calendar | /family/care-calendar | a Black Nigerian family planning their week around a blank calendar | Family care → /family |
| patient-family-hospital | /family/hospital-enrollment | a Black Nigerian family greeted by a hospital receptionist | Browse hospitals → /hospitals |
| patient-marketplace | /pharmacy-market | a Black Nigerian pharmacist arranging unbranded medicine cartons on warm wooden shelves | My prescriptions → /prescriptions |
| patient-storefront | /pharmacy-market/:pharmacyId | a Black Nigerian pharmacy owner at a welcoming counter with unlabelled packages | All pharmacies → /pharmacy-market |
| patient-medicine-prescription | /pharmacy-market/prescription | a paper prescription with no writing beside an unlabelled medicine package and reading glasses | My prescriptions → /prescriptions |
| patient-refill | /pharmacy-market/refill | a Black Nigerian adult organising a neutral weekly pill organiser without labels | My prescriptions → /prescriptions |
| patient-repeat-order | /pharmacy-market/repeat-last-order | a Black Nigerian adult reviewing a small unlabelled pharmacy parcel at home | Quote inbox → /pharmacy-quotes |
| patient-emergency-meds | /pharmacy-market/emergency-meds | a neatly arranged unbranded first-aid pouch and medicine packages on a calm sage table | Browse pharmacies → /pharmacy-market |
| patient-quotes | /pharmacy-quotes | a Black Nigerian woman comparing simple blank cards beside an unbranded pharmacy bag | Browse pharmacies → /pharmacy-market |
| patient-deliveries | /delivery-tracking | a Black Nigerian delivery professional carrying a plain paper pharmacy parcel | Browse pharmacies → /pharmacy-market |
| patient-delivery-detail | /delivery-tracking/:orderId | a small unbranded sealed care parcel on a doorstep with a leafy plant | All deliveries → /delivery-tracking |
| patient-cart | /cart | a woven basket with unbranded health-care packages in a light home setting | Continue shopping → /pharmacy-market |
| patient-checkout | /checkout | a Black Nigerian adult carefully checking a plain care parcel and blank order sheet | Review basket → /cart |
| patient-order-confirmation | /order-confirmation | a neatly sealed unbranded pharmacy parcel on a warm wooden table | Track deliveries → /delivery-tracking |
| patient-hospitals | /hospitals | an airy Nigerian hospital atrium with a Black Nigerian clinician welcoming an adult | My appointments → /appointments |
| patient-hospital-detail | /hospitals/:id | a sunlit hospital garden and modern welcoming entrance | All hospitals → /hospitals |
| patient-hospital-enroll | /hospitals/:id/enroll | a Black Nigerian adult speaking with a hospital registration officer at a clean desk | All hospitals → /hospitals |
| patient-hospital-book | /hospitals/:id/appointment | a Black Nigerian clinician and adult patient in a calm hospital waiting area | My appointments → /appointments |
| patient-hospital-checkin | /hospitals/check-in/:appointmentId | a Black Nigerian adult greeted warmly at a hospital reception desk | My appointments → /appointments |
| patient-wellness | /wellness-hub | a Black Nigerian woman stretching gently in a peaceful leafy garden | Explore professionals → /wellness-hub/professionals |
| patient-professionals | /wellness-hub/professionals | a diverse group of Black Nigerian wellness professionals in a sunlit studio | Wellness Hub → /wellness-hub |
| patient-professional-book | /wellness-hub/professionals/:id | a Black Nigerian counsellor listening to an adult in a warm calm consultation room | All professionals → /wellness-hub/professionals |
| patient-engagements | /wellness-hub/engagements | a Black Nigerian adult with a personal blank planner and yoga mat in a light home | Wellness Hub → /wellness-hub |
| patient-engagement-detail | /wellness-hub/engagements/:engagementId | a Black Nigerian wellness professional discussing a plain journal with an adult | All engagements → /wellness-hub/engagements |
| patient-wellness-category | /wellness-hub/:categoryId | a calm wellbeing studio with a Black Nigerian practitioner and indoor plants | Wellness Hub → /wellness-hub |
| patient-practitioner-detail | /wellness-hub/:categoryId/:practitionerId | a welcoming portrait scene of a fictional Black Nigerian wellness practitioner in a bright office | Wellness Hub → /wellness-hub |
| patient-practitioner-book | /wellness-hub/:categoryId/:practitionerId/book | a Black Nigerian adult choosing a date on a blank calendar beside tea and a plant | My engagements → /wellness-hub/engagements |
| patient-insurance | /insurance | a Black Nigerian adult reading a plain insurance folder at a bright desk | Browse hospitals → /hospitals |
| patient-wallet | /wallet | a Black Nigerian woman reviewing her personal budget in a blank notebook beside a plain wallet | My appointments → /appointments |
| doctor-overview | /dashboard | a Black Nigerian female clinician reviewing a tablet in a serene sunlit clinic | Set your availability → /availability |
| doctor-calendar | /calendar | a Black Nigerian doctor planning a work day beside a blank calendar and tea | Manage availability → /availability |
| doctor-availability | /availability | a Black Nigerian doctor writing in a blank planner with a small desk clock | View calendar → /calendar |
| doctor-appointments | /appointments | a Black Nigerian clinician welcoming an adult patient into a peaceful consulting room | View calendar → /calendar |
| doctor-appointment-detail | /appointments/:id | a Black Nigerian doctor reviewing a plain unlabelled appointment folder | All appointments → /appointments |
| doctor-patients | /patients | a Black Nigerian female clinician talking with an older adult patient in a sunny clinic | My appointments → /appointments |
| doctor-consultations | /consultations | a Black Nigerian doctor holding a remote consultation on a laptop with a generic unrecognisable screen | My appointments → /appointments |
| doctor-prescriptions | /prescriptions | a Black Nigerian doctor writing on a blank prescription pad beside a plain stethoscope | View consultations → /consultations |
| doctor-patient-prescriptions | /patient-prescriptions | a Black Nigerian clinician reviewing an unlabelled medicine carton and plain paper | View patients → /patients |
| doctor-reports | /reports | a Black Nigerian doctor arranging plain report folders beside a leafy plant | View consultations → /consultations |
| doctor-messages | /messages | a Black Nigerian clinician reading a message on a tablet in a comfortable office | My appointments → /appointments |
| doctor-hospital | /hospital-workspace | Black Nigerian clinicians collaborating around a tablet in a bright hospital room | View patients → /patients |
| doctor-earnings | /earnings | a Black Nigerian professional reviewing a blank ledger at a warm tidy desk | My appointments → /appointments |
| doctor-reviews | /reviews | a Black Nigerian clinician thoughtfully reading a plain feedback card beside tea | My profile → /profile |
| doctor-notifications | /notifications | a Black Nigerian clinician checking a tablet beside a desk clock and a plant | My appointments → /appointments |
| doctor-profile | /profile | a fictional Black Nigerian doctor posed naturally in a sunlit minimal consulting room | Manage availability → /availability |
| doctor-settings | /settings | a calm clinical desk with a tablet, plain notebook and stethoscope | My profile → /profile |
| doctor-care-workspace | /care-workspace | a Black Nigerian counsellor and adult discussing a blank reflective journal | My appointments → /appointments |
| doctor-nutrition-workspace | /care-workspace | a Black Nigerian dietitian discussing a balanced meal with an adult in a bright studio | My appointments → /appointments |
| doctor-patient-access | /patient-access-preview | a Black Nigerian clinician explaining a plain consent form to an adult | View patients → /patients |

## Verification

New route/component tests cover every catalog template, static-vs-parameter matching, route aliases, separate nutrition artwork, action navigation, decorative image semantics, no banner on auth/unknown routes, and all 71 unique/nonempty WebP files. Local-only artwork gallery and explicit doctor preview used for visual checks. Release build/test results and deployment evidence are recorded after the exact release checkout is verified.
