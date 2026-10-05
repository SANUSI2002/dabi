# Sabi Health doctor portal frontend

This is a local prototype. The doctor registration and sign-in frontend is now the public entry. The separate portal preview uses a sample doctor and is not authentication or authorization. See doctor-registration.md for the authentication API contract.

## Implemented boundaries

- The portal preview session is per browser tab; connected accounts restore their session from the authentication API. Workspace components remount when the doctor changes, so drafts and selected patients do not carry across accounts.
- Browser data and cached snapshots are keyed by doctor ID. Legacy prototype data belongs only to doctor-verma.
- Prescriptions, reports and new diagnoses record the doctor ID. Another active demo doctor cannot update those records through the store functions. Sent documents remain immutable.
- Hospital queues are shared by hospital ID, and claims store the assigned doctor ID. Local claim checks reject a previously assigned record.
- Availability updates create new snapshots. Storage events invalidate affected caches. Invalid JSON and malformed records use safe defaults.
- The UI reports storage write failures and has a rendering error fallback.
- Dates used by calendars are based on the local calendar day, avoiding UTC date shifts.

## Backend requirements before real accounts

1. Replace demo identity with an authenticated server session. Enforce doctor, patient and hospital access checks on every server request; browser keys are not a security boundary.
2. Load doctor-specific appointments, profiles, messages and clinical records from the API. Secondary demo doctors start with empty personal lists deliberately.
3. Use server patient IDs everywhere. Name-based matching remains in parts of the demo, and must not be used to join real patient records with duplicate names.
4. Enforce atomic hospital claims and record revisions on the server. Local storage cannot coordinate simultaneous doctors across devices or provide reliable conflict resolution.
5. Persist clinical drafts and document audit history on the server. Sending currently updates local demo state and a patient-view preview, not a real patient account.
6. Map profile credentials, earnings, security settings and activity from actual account data. Remaining seeded cards and simulated controls are demonstration content.

## Verification

Run npm test and npm run build. Regression tests cover doctor isolation, caches, draft migration, ownership checks, immutable sent records, shared claims, availability snapshots, invalid storage, and draft/finalize/send workflows.
