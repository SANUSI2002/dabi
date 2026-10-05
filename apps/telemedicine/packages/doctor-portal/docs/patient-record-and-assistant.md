# Patient record consent and portal assistant

The frontend preview now locks medical history in Consultations and Patients. A doctor requests access from Patient Record during an accepted consultation. The separate patient-side preview can grant, decline or revoke; AI-assisted record summaries require a separate optional choice. Consent is keyed to doctor, patient and consultation, expires after one hour from the request, and is revoked on consultation completion. Ending/cancelling the appointment also blocks reads. Assistant conversation content clears when its page/patient/permission context changes.

This is a local demonstration, not a production authorization boundary. Browser storage can be edited, and the preview is accessible to the demo user. It must never hold real patient consent. Live accounts fail closed for records. Replace preview name matching with server-issued patient identifiers.

The assistant is available in every doctor portal layout. Guided preview queries read the current doctor's schedule, draft counts, unread message counts, review counts and hospital queue counts. Medical record extracts show dates, source IDs and authors, and only include shared diagnoses and sent documents. A missing search result does not establish absence of a condition. No medical treatment recommendation or generated clinical note is inserted.

## Required backend integration

- Patient-authenticated consent endpoints: request by authenticated doctor; grant/decline/revoke only by the authenticated patient. Deliver requests through the patient portal/notification service. Store purpose, record scope, AI choice, consultation, request/grant/revoke times, expiry and audit events.
- Enforce both doctor ownership of the consultation and current patient consent on every record read and AI retrieval. Revocation/completion must invalidate access immediately, including in-flight responses. Do not trust IDs, counts, ownership or permissions supplied by the browser.
- Fetch the patient's longitudinal history from a patient-ID-based records API after permission, including records from other authorized providers. Current preview uses doctor-scoped fixtures and is not a complete medical chart.
- The optional VITE_ASSISTANT_API_BASE_URL connects POST /assistant/chat with credentials and JSON {prompt,context}, expecting {answer}. The operational context contains schedule times/types/appointment IDs and aggregate counts; no record text, patient names or messages are uploaded. The server must rederive context from its authenticated doctor session, constrain tools to read-only retrieval and return grounded source references. Keep model credentials on the server.
- Clinical summaries stay as local extracts even with the assistant endpoint configured until a server-authorized clinical retrieval path is implemented. Do not forward browser-provided medical history to a model provider. Configure approved processing, access controls and auditing before using real clinical information.

## Verification

Node tests cover pending access, wrong-patient decisions, duplicate requests, separate AI permission, doctor/consultation isolation, forged patient display names, expiry, revocation, appointment completion, denied assistant retrieval and rejection of live-account demo grants. Browser checks cover dashboard schedule questions, locked records, patient preview granting AI permission, and cited hypertension search.
