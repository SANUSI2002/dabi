# Sabi Emergency Card implementation

Entry points: patient dashboard **View Emergency Card** and **Settings → Notifications → Emergency Card**. They use the same settings/preview component and existing Sabi Identity/API/notification infrastructure. This feature is real server-backed functionality, not browser fixtures.

## Changed frontend areas

- `apps/telemedicine/packages/patient-portal/src/emergency/`: patient consent/settings, real QR preview, phone notifications, PNG and printable SVG downloads, controlled responder entry and mobile read-only summary.
- `src/api/emergencyCardApi.js`: existing authorizedRequest adapter for profile Emergency Card endpoints.
- Dashboard EmergencyCard/EmergencyCardModal: replaces decorative QR and unrestricted-sharing wording; same real settings component with keyboard focus trapping/restoration.
- NotificationSettingsPage: includes Emergency Card alongside existing notification controls, with sharing and card notification independent.
- Care Circle data/picker/API: explicit Emergency Summary permission. Existing permissions are preserved server-side; previously automatic grants require fresh owner confirmation.
- Profile EmergencyAccessCard: preserves older record-category preferences and clarifies that they do not grant code-based access.
- App/Login/sabiIdentity: existing sign-in/MFA/session reused for responders; normal patient routes retain patient/caregiver role guards. No authentication bypass.
- Shared push-sw.js: notification click opens only a URL within this Sabi app's origin and scope.
- `src/testing/emergencyCard*.test.*`: consent, permission denial, stable notification tag, no automatic/repeating notifications, confirmation, real QR URL, downloads, denied access and unknown clinical facts.

The UI/UX Pro Max guidance was applied to the existing Sabi design tokens, readable codes, keyboard focus, labelled controls and 44px touch targets; it did not introduce a separate visual system.

Backend changes are in the separate backend repository: `docs/EMERGENCY_CARD.md`, the additive `20261015110000_emergency_card` migration, profile emergency-card routes/service, existing family-care/audit/notification services, and embedded PostgreSQL tests. No copied medical-record store exists.

## Configuration and device limitations

Keep existing `VITE_SABI_IDENTITY_API_URL`, deployment base and trusted browser origins. Apply the backend migration before serving the frontend. No new secret or external provider configuration is needed for local card notifications. Existing web-push secrets remain separate and untouched.

The real application origin/build base is used for QR links; emergency codes are URL fragments, never auth tokens. Card downloads contain no medical details. The patient must manually set the PNG as wallpaper; SVG wallet card prints at actual 85.6 × 54 mm size.

Notification visibility/dismissal is controlled by the phone/browser. iPhone/iPad generally require the Home Screen web app. Unsupported/blocked permission does not disable downloads or sharing. No permanence, lock-screen visibility or removal from all offline devices is guaranteed. Physical Android/iOS notification and camera/printed QR checks must be reported separately from automated tests.

## Verified release checks

- Full frontend regression: 375 tests passed; subsequent final iOS handling and cache-exclusion tests also passed.
- Backend unit regression: 823 tests passed; lint passed.
- Final embedded PostgreSQL regression: all 192 tests passed, with every migration applied; this includes all 15 Emergency Card cases (including fresh owner consent and nurse access).
- Main frontend and telemedicine builds passed. QR preview and summary layout were inspected with synthetic data at 375px portrait and 812px landscape, without horizontal overflow. This is browser viewport testing, not physical-device notification testing.
- No real patient or hospital permissions were changed for QA. Existing patients default to sharing and notification OFF.
