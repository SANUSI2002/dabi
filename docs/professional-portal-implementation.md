# Sabi Health professional portal — implementation and verification

6 October 2026. Nigeria is the initial market. Existing doctor routes/database names are retained for compatibility; they are not evidence that every profession has a doctor's scope.

## Inspected implementation

The Wellness Hub listed caregivers, nutritionists/dietitians, fitness coaches, therapists and health educators. The owner clarified that therapists means **clinical psychologists and counsellors, separately**. The original time-block UI is `doctor-portal/src/pages/availability/ManageAvailability.jsx`, backed by `doctorAvailabilityStore.js`. It was a browser-only preview, while connected accounts used the separate one-slot live availability form. Seeded local hospital hours/blocks are not silently promoted to real server records.

The new connected availability screen is `doctor-portal/src/live/ProfessionalAvailability.jsx`. It saves recurring periods, multiple breaks, consultation types, duration and buffer, publishes dated slots, adds unavailable time blocks and date-specific extra hours. Nigeria times use Africa/Lagos (UTC+1); UTC is the other explicitly supported timezone. Other timezones/DST markets are not yet supported. Blocks refuse active booked conflicts and cancel only unbooked overlapping slots. Removing a block requires republishing; it does not resurrect canceled bookings. A unique active booking index, serializable transactions and shared professional locks protect competing bookings and schedule mutations.

## Role-to-module mapping

| Role / discipline | Verification evidence | Shared tools | Specialised tools / limits |
|---|---|---|---|
| Doctor | MDCN registration and current practising licence | Profile/fees, appointments, calendar, availability, notifications, account security | Existing patient-care consent and medication prescribing; unchanged clinical permissions |
| Dietitian | Qualification plus internship/competence/professional-standing evidence | Same shared tools | **Dietician Table**: assessment, preferences, allergies, history, budget, meals, sourced targets, templates, draft/publish/revise/archive, versions, feedback and private reviews |
| Nutritionist | Relevant qualification and competence evidence | Same shared tools | General nutrition support plans; no dietitian meal-table or medication privilege |
| Clinical psychologist | Clinical psychology qualification and supervised practice / professional-standing evidence | Same shared tools | Intake, agreed care goals/activities, private session notes and follow-up reviews; no medication prescribing |
| Counsellor | Counselling qualification and professional registration/licensing/competence evidence | Same shared tools | Separate counselling workspace, intake, goals, private notes and follow-up; no doctor privileges |
| Non-clinical caregiver | Care training, competence and references | Same shared tools | Support plans, precautions, daily activities and follow-up; not represented as a nurse |
| Registered nurse (caregiver discipline) | Qualification, NMCN registration and dated current licence | Same shared tools | Reviewed caregiver support scope; not general EMR access or prescribing |
| Fitness coach | Coaching qualification, first-aid/competence/reference evidence | Same shared tools | Fitness goals, precautions, activities and progress; not clinical rehabilitation |
| Health educator | Relevant qualification and competence evidence | Same shared tools | Education goals, lifestyle activities and follow-up |
| Community-health practitioner (educator discipline) | Qualification, CHPRBN registration and dated current licence | Same shared tools | Reviewed education/support scope only |

## Research: statutory versus platform requirements

Sources below are primary regulator/professional-body/WHO sources, consulted 6 October 2026. Staff must independently check the awarding institution/regulator and record source, reference and findings. No verification API is fabricated. Malware CLEAN is not professional verification.

- **Confirmed regulated doctor pathway:** [MDCN Act and regulations](https://mdcn.gov.ng/page/about-us/mdcn-act-other-regulation), [MDCN FAQs](https://mdcn.gov.ng/frequently-asked-questions). Registration and practising eligibility are separate; require current practising evidence.
- **Confirmed nursing pathway:** [NMCN licensing](https://www.nmcn.gov.ng/licensing.html), [registration unit](https://www.nmcn.gov.ng/unitreg.html). Applies to someone claiming registered-nurse scope, not every caregiver.
- **Confirmed community-health practitioner pathway:** [CHPRBN](https://chprbn.gov.ng/), [official registration application](https://app.chprbn.gov.ng/application). Does not make every generic health educator a registered community-health practitioner.
- **Dietitian competence:** [Dietitians Association of Nigeria services/membership](https://dietitiansnigeria.org/our-services), [Institute for Dietetics in Nigeria](https://www.institutefordieteticsinnigeria.org/about/). Degree, supervised internship and professional competence distinguish dietetic practice from an unrestricted nutrition title. These sources do not establish one identical statutory licence for all nutritionists; evidence requirements here are platform requirements, subject to Nigerian legal review.
- **Nutritionist professional standing:** [Nutrition Society of Nigeria constitution](https://nutritionnigeria.org/wp-content/uploads/2026/01/NSN-CONSTITUTION-AS-AMENDED-SEPTEMBER-2025-FINAL-VERSION.pdf). Association membership is not represented as statutory licensure.
- **Counselling:** [CASSON membership categories](https://www.cassonnigeria.org/membership/membership-categories/), [membership requirements](https://cassonnigeria.org/membership/membership-requirements/). Verify actual professional standing, not student/associate membership. Final statutory council/licensing applicability needs legal confirmation; do not treat a generic association certificate as unlimited clinical authority.
- **Clinical psychology:** [Nigerian Association of Clinical Psychologists](https://nacp.com.ng/), [Federal Neuropsychiatric Hospital Aro clinical psychology](https://main.neuroaro.gov.ng/view.php?s=clinical-psychology). Clinical qualifications and supervised experience are reviewed. A universal national psychology licensing API/statutory requirement was not confirmed; this is explicitly not invented.
- **Fitness versus regulated rehabilitation:** [Medical Rehabilitation Therapists Board of Nigeria](https://www.mrtb.gov.ng/Welcome). Generic fitness coaches are not automatically authorised rehabilitation practitioners. Fitness credentials/reference checks are platform requirements.
- **Nutrition workflow:** [WHO healthy diet](https://www.who.int/news-room/fact-sheets/detail/healthy-diet), [nutrition actions in health systems](https://www.who.int/teams/nutrition-and-food-safety/food-and-nutrition-actions-in-health-systems), [WHO primary-care physical activity counselling](https://www.who.int/publications/i/item/9789241515856). Individual assessment, locally appropriate plans, agreed goals and ongoing monitoring informed the workspace. These are workflow sources, not a substitute for each professional's clinical judgement.

## Access and records

1. At `https://telemedicine.sabihealth.org/doctor-portal/register`, choose the actual profession and discipline. Doctors retain their existing detailed registration form; other roles have their own qualification/service/experience questions. Nursing/community-health disciplines require dated licence details. Registration chooses the password; passwords are never emailed.
2. Verify email, sign in, select required credential files. Upload and malware screening run in the background. Submit once all required files are received; a confirmation and reference appear. Application stages are DRAFT, SUBMITTED, PENDING_REVIEW, APPROVED, REJECTED and CHANGES_REQUESTED; professional account approval remains separately enforced.
3. In Command Center → Healthcare professionals, an authorised reviewer with recent MFA previews only CLEAN private documents, records external authenticity findings, and approves, rejects or requests changes. No self-review. Both legacy and Command Center approval endpoints use the same evidence gates. Approval email leads to the shared portal.
4. Approved professionals edit Profile/fees, Manage Availability and their appointments. Patient Wellness Hub → approved professionals shows actual published slots. Professional-backed legacy service links redirect to the slot workflow; the backend refuses arbitrary preferred-time booking for these profiles. Legacy organisation service enquiries remain separate from individual professional schedules.
5. After a confirmed or completed account-holder appointment, the patient grants explicit care-plan permission. This is not consent to all their medical records. Professionals only see consented patients; revocation blocks further professional access/mutations. Existing published copies remain available to the patient.
6. Verified dietitians open **Dietician Table** in the shared portal. Other supported care professionals open their discipline-specific support workspace. Patient **Prescriptions → Dietician Table** displays only their published nutrition versions; **My Care Plans** shows non-medication support plans.
7. Saving a draft never changes the patient's published version. Publish inserts an immutable snapshot and increments its version. Revision checks reject stale tabs. Archive keeps published history but disables further edits/feedback. Private session notes are append-only; corrections are separate notes. Published versions and private notes also have database immutability triggers.
8. Templates are professional-owned. Applying one clears personal intake fields; patient-specific text must still be reviewed. Nutritional targets require reviewed values/units and an HTTPS source; no food composition dataset, AI calorie estimation or fabricated nutrient totals is supplied.

## Tests and release checklist

Release evidence on 6 October: backend implementation commit `006a1bd` is Live on Render; its deployment log confirms both professional application-stage and care-plan migrations applied successfully. The live registration configuration returns all seven profession categories, and the public professional directory returns HTTP 200. Frontend release `17e1453` is pushed and its revised shared registration copy is visible on the custom Telemedicine domain. The exact release checkout passed **159 frontend tests**, and backend test increment `ab17f96` passed **709 tests** plus lint. Nine table-driven, mocked HTTP journeys cover every new discipline through registration, verified email, private evidence, submission, manual review and scoped approval. Scanner transports are tested separately; no real credentials were approved by the agent. Desktop and 390px mobile registration were visually checked; mobile document width equals viewport width. The previous approved professional session expired, so authenticated availability/care-workspace visual checks await a fresh sign-in. These checks do **not** stand in for completing every profession's real email-to-human-review journey.

### Module locations

| Module | Frontend | Backend |
|---|---|---|
| Profession selection and onboarding | `apps/telemedicine/packages/doctor-portal/src/pages/auth/ProfessionalRegistrationPage.jsx`, `RegistrationStatusPage.jsx`, `ApplicationDetailsEditor.jsx` | `src/modules/doctors/onboarding.*`, `src/modules/professionals/professionCatalog.js` |
| Staff review / changes requested | `src/command-center/LiveDoctorsPage.tsx` (existing doctors route now includes healthcare professionals) | `src/modules/doctors/onboarding.routes.js` and `professionals.model.js` |
| Shared availability and time blocks | `apps/telemedicine/packages/doctor-portal/src/live/ProfessionalAvailability.jsx` | `src/modules/doctor-appointments/schedule.*` |
| Actual-slot professional booking | `apps/telemedicine/packages/patient-portal/src/pages/wellness/ProfessionalBookingPage.jsx` | Existing `doctor-appointments` module, shared approved-professional gates |
| Dietician Table / support workspaces | `apps/telemedicine/packages/doctor-portal/src/live/ProfessionalCareWorkspace.jsx` | `src/modules/professional-care/care.*` |
| Patient published plans and progress | `apps/telemedicine/packages/patient-portal/src/pages/prescriptions/DieticianTablePage.jsx` | Same care records; patient-only projections and feedback endpoints |
| Shared meals / theme | `apps/telemedicine/packages/shared-care/MealPlanTable.jsx`, `shared-care/care.css`, `shared-portal-theme.css` | No disconnected local care-plan store |

Backend paths above are relative to the separately deployed backend repository (`backend/doctor-portal-release`); the changes are also synchronized into the original local backend checkout. Frontend paths are relative to the existing workspace. The new migrations are `20261006000100_professional_schedules`, `20261006000200_professional_application_stages` and `20261006000300_professional_care_plans`.

Automated checks cover role/discipline validation, different required evidence, email/approval gates, doctor prescribing regression, breaks/buffers/time conversion, overlapping slots/blocks, booked conflicts, authorised ownership, publication/revision history, stale updates, revoked consent, private-note/draft separation, patient progress and UI interactions. Database schema is validated and generated. Run the backend `npm test` and `npm run lint`; run frontend `npm test` and `npm run build:telemedicine`. Validate Command Center/Health production builds on the release checkout too.

For a complete manual smoke test use dedicated synthetic accounts, not an existing clinician's real bookings: register each discipline, verify email, upload synthetic evidence, have an authorised reviewer record a synthetic review and approval, publish future hours, request and confirm an appointment as a patient, grant care-plan permission, publish/revise a nutrition plan, then revoke consent and try a stale/foreign record URL. An agent must not determine a real clinician's eligibility from their credentials on behalf of staff.

## Boundaries / remaining operational work

- No regulator verification integration was added; external authenticity decisions remain a staff task. Statutory applicability for psychology/counselling and any additional dietetics rules needs Nigerian legal/professional review before broad clinical marketing.
- The existing Render release still uses a disposable test database without a production backup/restore plan. These code changes do not make it production-healthcare-ready.
- Third-party email/scanner/video quotas, delivery and availability remain operational dependencies. Existing Daily settings and no-recording policy are preserved.
- Patient medical-document upload is a separate scoped rollout; these changes do not transmit general patient records to Cloudmersive or confer blanket record access.
- Existing disconnected doctor reports, standalone messages, hospital workspace, earnings and reviews were not falsely marked complete. Appointments/video, profile, security, notifications, availability and the new care workspaces are the connected paths in this increment.
- Nutrition content is clinician-entered; automated nutrient computation would require a licensed/reliable, reviewed food-composition dataset. No invented values are shown.
- Current support tools are an initial structured intake/goals/notes/follow-up workflow, not a validated psychological test battery, crisis service, exercise-prescription medical clearance engine or complete home-care dispatch system.
- Live deployment, mobile/desktop visual checks and real email/credential journeys must be reported separately from mocked automated tests; a Git push alone is not proof that the live release completed.
