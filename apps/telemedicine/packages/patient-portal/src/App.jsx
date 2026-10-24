import SabiBrand from "../../shared-portal/SabiBrand";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect, useState } from "react";
import { getCurrentUser, restoreSession, signOut, authorizedRequest, checkSession, mayUsePatientPortal } from "./utils/sabiIdentity";
import { idleSignInUrl, startIdleTimeout } from "../../shared-portal/idleTimeout.js";
import { elsewhereSignInUrl, startSessionWatch } from "../../shared-portal/sessionWatch.js";
import "./index.css";
import { ZoomProvider } from "./context/ZoomContext";
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard").then(m => ({ default: m.Dashboard })));
const Profile = lazy(() => import("./pages/profile/Profile").then(m => ({ default: m.Profile })));
const Records = lazy(() => import("./pages/records/Records").then(m => ({ default: m.Records })));
const Appointments = lazy(() => import("./pages/appointments/Appointments").then(m => ({ default: m.Appointments })));
const RescheduleAppointment = lazy(() => import("./pages/appointments/RescheduleAppointment").then(m => ({ default: m.RescheduleAppointment })));
const ConsultationReport = lazy(() => import("./pages/reports/ConsultationReport").then(m => ({ default: m.ConsultationReport })));
const VitalsHub = lazy(() => import("./pages/vitals/VitalsHub").then(m => ({ default: m.VitalsHub })));
const SelectVitalType = lazy(() => import("./pages/vitals/SelectVitalType").then(m => ({ default: m.SelectVitalType })));
const AddVitalReading = lazy(() => import("./pages/vitals/AddVitalReading").then(m => ({ default: m.AddVitalReading })));
const VitalHistoryPage = lazy(() => import("./pages/vitals/VitalHistoryPage").then(m => ({ default: m.VitalHistoryPage })));
const SabiHealthLogin = lazy(() => import("./pages/Onboarding/login"));
const AccountTypeSelection = lazy(() => import("./pages/Onboarding/AccountTypeSelection"));
const CaregiverOnboarding = lazy(() => import("./pages/Onboarding/CaregiverOnboarding"));
const OnboardingSubmitted = lazy(() => import("./pages/Onboarding/OnboardingSubmitted"));
const SignupPage = lazy(() => import("./pages/Onboarding/Signup"));
const VerifyEmail = lazy(() => import("./pages/Onboarding/VerifyEmail"));
const AnimatedAuth = lazy(() => import("./pages/Onboarding/AnimatedAuth"));
const IdentityVerificationPage = lazy(() => import("./pages/Onboarding/IdentityVerification"));
const SuccessPage = lazy(() => import("./pages/Onboarding/SuccessPage"));
const PrescriptionsPage = lazy(() => import("./pages/prescriptions/PrescriptionsPage").then(m => ({ default: m.PrescriptionsPage })));
const DieticianTablePage = lazy(() => import("./pages/prescriptions/DieticianTablePage").then(m => ({ default: m.DieticianTablePage })));
const ActivityLogPage = lazy(() => import("./pages/activity/ActivityLogPage").then(m => ({ default: m.ActivityLogPage })));
const MedicinesPage = lazy(() => import("./pages/medicines/MedicinesPage").then(m => ({ default: m.MedicinesPage })));
const NotificationSettingsPage = lazy(() => import("./pages/notification-settings/NotificationSettingsPage").then(m => ({ default: m.NotificationSettingsPage })));
const InstallAppPage = lazy(() => import("./pwa/InstallApp").then(m => ({ default: m.InstallAppPage })));
const EmergencyAccessPage = lazy(() => import("./emergency/EmergencyAccessPage"));
const PrescriptionDetailPage = lazy(() => import("./pages/prescriptions/PrescriptionDetailPage").then(m => ({ default: m.PrescriptionDetailPage })));
const SelectPharmacyPage = lazy(() => import("./pages/prescriptions/SelectPharmacyPage").then(m => ({ default: m.SelectPharmacyPage })));
const PharmacyMarketPage = lazy(() => import("./pages/pharmacy-market/PharmacyMarketPage").then(m => ({ default: m.PharmacyMarketPage })));
const PharmacyStorefrontPage = lazy(() => import("./pages/pharmacy-market/PharmacyStorefrontPage").then(m => ({ default: m.PharmacyStorefrontPage })));
const PharmacyQuotesPage = lazy(() => import("./pages/pharmacy-quotes/PharmacyQuotesPage").then(m => ({ default: m.PharmacyQuotesPage })));
const DeliveryListPage = lazy(() => import("./pages/delivery-tracking/DeliveryListPage").then(m => ({ default: m.DeliveryListPage })));
const DeliveryTrackingPage = lazy(() => import("./pages/delivery-tracking/DeliveryTrackingPage").then(m => ({ default: m.DeliveryTrackingPage })));
const FindYourDoctor = lazy(() => import("./pages/doctor/Doctor"));
const WellnessHubPage = lazy(() => import("./pages/wellness/WellnessHubPage").then(m => ({ default: m.WellnessHubPage })));
const ProfessionalBookingPage = lazy(() => import("./pages/wellness/ProfessionalBookingPage"));
const PractitionerListPage = lazy(() => import("./pages/wellness/PractitionerListPage").then(m => ({ default: m.PractitionerListPage })));
const PractitionerDetailPage = lazy(() => import("./pages/wellness/PractitionerDetailPage").then(m => ({ default: m.PractitionerDetailPage })));
const BookPractitionerPage = lazy(() => import("./pages/wellness/BookPractitionerPage").then(m => ({ default: m.BookPractitionerPage })));
const EngagementsPage = lazy(() => import("./pages/wellness/EngagementsPage").then(m => ({ default: m.EngagementsPage })));
const EngagementDetailPage = lazy(() => import("./pages/wellness/EngagementDetailPage").then(m => ({ default: m.EngagementDetailPage })));

const FamilyDashboardPage = lazy(() => import("./pages/family").then(m => ({ default: m.FamilyDashboardPage })));
const AddMemberPage = lazy(() => import("./pages/family").then(m => ({ default: m.AddMemberPage })));
const SetupDependentPage = lazy(() => import("./pages/family").then(m => ({ default: m.SetupDependentPage })));
const MemberAddedSuccessPage = lazy(() => import("./pages/family").then(m => ({ default: m.MemberAddedSuccessPage })));
const MemberProfilePage = lazy(() => import("./pages/family").then(m => ({ default: m.MemberProfilePage })));
const CareCalendarPage = lazy(() => import("./pages/family/CareCalendarPage").then(m => ({ default: m.CareCalendarPage })));
const CartPage = lazy(() => import("./pages/pharmacy-market/CartPage").then(m => ({ default: m.CartPage })));
const CheckoutPage = lazy(() => import("./pages/pharmacy-market/CheckoutPage").then(m => ({ default: m.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import("./pages/pharmacy-market/OrderConfirmationPage").then(m => ({ default: m.OrderConfirmationPage })));
const RefillPrescriptionPage = lazy(() => import("./pages/pharmacy-market/RefillPrescriptionPage").then(m => ({ default: m.RefillPrescriptionPage })));
const PrescriptionPage = lazy(() => import("./pages/pharmacy-market/PrescriptionPage").then(m => ({ default: m.PrescriptionPage })));
const RepeatLastOrderPage = lazy(() => import("./pages/pharmacy-market/RepeatLastOrderPage").then(m => ({ default: m.RepeatLastOrderPage })));
const EmergencyMedsPage = lazy(() => import("./pages/pharmacy-market/EmergencyMedsPage").then(m => ({ default: m.EmergencyMedsPage })));
const PharmacyQuotesInboxPage = lazy(() => import("./pages/pharmacy-quotes/PharmacyQuotesInboxPage").then(m => ({ default: m.PharmacyQuotesInboxPage })));
import { FloatingCartButton } from "./pages/pharmacy-market/components/FloatingCartButton";
const HospitalsPage = lazy(() => import("./pages/hospitals/HospitalsPage").then(m => ({ default: m.HospitalsPage })));
const HospitalDetailPage = lazy(() => import("./pages/hospitals/HospitalDetailPage").then(m => ({ default: m.HospitalDetailPage })));
const HospitalEnrollmentWizardPage = lazy(() => import("./pages/hospitals/HospitalEnrollmentWizardPage").then(m => ({ default: m.HospitalEnrollmentWizardPage })));
const BookHospitalAppointmentPage = lazy(() => import("./pages/hospitals/BookHospitalAppointmentPage").then(m => ({ default: m.BookHospitalAppointmentPage })));
const CheckInPage = lazy(() => import("./pages/hospitals/CheckInPage").then(m => ({ default: m.CheckInPage })));
const FamilyHospitalEnrollmentPage = lazy(() => import("./pages/hospitals/FamilyHospitalEnrollmentPage").then(m => ({ default: m.FamilyHospitalEnrollmentPage })));
const InsurancePage = lazy(() => import("./pages/insurance/InsurancePage").then(m => ({ default: m.InsurancePage })));
const WalletPage = lazy(() => import("./pages/wallet/WalletPage").then(m => ({ default: m.WalletPage })));
const SabiAiPage = lazy(() => import('./pages/ai/SabiAiPage'));
const ForgotPassword = lazy(() => import("./pages/Onboarding/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/Onboarding/ResetPassword"));
import { HOSPITAL_ONBOARDING_URL, DOCTOR_PORTAL_URL } from "./ecosystemLinks";

import "../../shared-portal/portal-revamp.css";
import "../../shared-portal/premium-pages.css";
// Telemedicine design system: tokens first, then shared components. Loaded last so they win.
import "../../shared-portal/design-system/tokens.css";
import "../../shared-portal/design-system/components.css";

function ProfessionalRegistrationRedirect() {
  useEffect(() => { window.location.replace(`${DOCTOR_PORTAL_URL}/register`); }, []);
  return <div className="grid min-h-screen place-items-center"><a href={`${DOCTOR_PORTAL_URL}/register`}>Continue to professional registration</a></div>;
}

function HospitalOnboardingRedirect() {
  useEffect(() => {
    window.location.replace(HOSPITAL_ONBOARDING_URL);
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-6 text-center">
      <div>
        <p className="text-sm font-semibold text-teal-800">Opening Sabi hospital onboarding…</p>
        <a className="mt-3 inline-block text-sm text-teal-700 underline" href={HOSPITAL_ONBOARDING_URL}>
          Continue manually
        </a>
      </div>
    </div>
  );
}

function RequirePatientSession() {
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    let timer;
    restoreSession().then(
      (user) => { if (live) setState(mayUsePatientPortal(user) ? 'ready' : 'denied'); },
      // Server busy or unreachable: keep the session and try again rather than signing out.
      () => { if (live) { setState('unavailable'); timer = setTimeout(() => setAttempt((n) => n + 1), 8000); } },
    );
    return () => { live = false; clearTimeout(timer); };
  }, [attempt]);
  if (state === 'loading') return <div className="grid min-h-screen place-items-center text-sm text-slate-600">Checking Sabi Identity session…</div>;
  if (state === 'unavailable') {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center text-sm text-slate-600" role="status">
        <div>
          <p className="mb-3">Sabi Health is busy right now. Retrying automatically…</p>
          <button type="button" className="rounded-lg border border-emerald-600 px-4 py-2 font-semibold text-emerald-800" onClick={() => { setState('loading'); setAttempt((n) => n + 1); }}>Try now</button>
        </div>
      </div>
    );
  }
  return state === 'ready' ? <Outlet /> : <Navigate to="/login" replace />;
}

function Logo() {
  const location = useLocation();

  // Pages where the standalone logo should be visible
  const isSignupFlow = location.pathname.startsWith("/signup");
  const publicRoutes = ["/verify", "/success", "/submitted"];

  // Redesigned patient registration has its own responsive brand.
  if (location.pathname === "/signup/patient" || location.pathname === "/signup") return null;

  // Hide the logo on every other page
  if (!isSignupFlow && !publicRoutes.includes(location.pathname)) {
    return null;
  }

  const isSignup = isSignupFlow;

  return (
    <div className="absolute top-2 left-4 sm:top-3 sm:left-8 z-50">
      <SabiBrand width={170} inverse={isSignup} />
    </div>
  );
}

// Five minutes without input ends the session: revoke it on the server, clear it here, and reload
// at the sign-in page so nothing from the signed-in account stays in memory.
async function signOutForInactivity() {
  await signOut();
  window.location.assign(idleSignInUrl(import.meta.env.BASE_URL));
}

// Signed in on another device: this one is signed out at once, and the sign-in page says why.
async function signOutSignedInElsewhere() {
  await signOut();
  window.location.assign(elsewhereSignInUrl(import.meta.env.BASE_URL));
}

export default function App() {
  useEffect(() => startSessionWatch({ check: checkSession, isSignedIn: () => getCurrentUser() !== null,
    onSignedInElsewhere: () => { void signOutSignedInElsewhere(); } }), []);
  useEffect(() => startIdleTimeout({ isSignedIn: () => getCurrentUser() !== null,
    onActive: () => authorizedRequest('/api/v1/auth/me', { signal: AbortSignal.timeout(30_000) }),
    onIdle: () => { void signOutForInactivity(); } }), []);
  return (
    <ZoomProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
        <div className="min-h-screen bg-slate-50 relative">
          <Logo />

          <main>
          <Suspense fallback={<div className="sabi-route-loading" role="status" aria-live="polite">Opening Sabi Health…</div>}>
          <Routes>
            <Route path="/emergency-access" element={<EmergencyAccessPage />} />
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<SabiHealthLogin />} />
              <Route path="/signup" element={<AccountTypeSelection />} />
              <Route path="/signup/patient" element={<SignupPage />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify-email/:uid" element={<VerifyEmail />} />
              <Route path="/signup/caregiver" element={<CaregiverOnboarding />} />
              <Route path="/signup/professional/doctor" element={<ProfessionalRegistrationRedirect />} />
              <Route path="/signup/professional/:type" element={<ProfessionalRegistrationRedirect />} />
              <Route path="/signup/organisation/:type" element={<HospitalOnboardingRedirect />} />
              <Route path="/signup/organization/:type" element={<HospitalOnboardingRedirect />} />
              <Route path="/submitted" element={<OnboardingSubmitted />} />
              <Route path="/auth" element={<AnimatedAuth />} />
              <Route path="/verify" element={<IdentityVerificationPage />} />
              <Route path="/success" element={<SuccessPage />} />
              <Route element={<RequirePatientSession />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/records" element={<Records />} />
              <Route path="/prescriptions" element={<PrescriptionsPage />} />
              <Route path="/prescriptions/dietician-table" element={<DieticianTablePage />} />
              <Route path="/care-plans" element={<DieticianTablePage support />} />
              <Route path="/activity" element={<ActivityLogPage />} />
              <Route path="/medications" element={<MedicinesPage />} />
              <Route path="/sabi-ai" element={<Suspense fallback={<p role="status" className="p-6">Opening Sabi AI…</p>}><SabiAiPage /></Suspense>} />
              <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
              <Route path="/install" element={<InstallAppPage />} />
              <Route path="/prescriptions/:id" element={<PrescriptionDetailPage />} />
              <Route path="/prescriptions/:id/select-pharmacy" element={<SelectPharmacyPage />} />
              <Route path="/prescriptions/:id/quotes" element={<PharmacyQuotesPage />} />
              <Route path="/pharmacy-market" element={<PharmacyMarketPage />} />
              <Route path="/pharmacy-market/:pharmacyId" element={<PharmacyStorefrontPage />} />
              <Route path="/pharmacy-quotes" element={<PharmacyQuotesInboxPage />} />
              <Route path="/delivery-tracking" element={<DeliveryListPage />} />
              <Route path="/delivery-tracking/:orderId" element={<DeliveryTrackingPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order-confirmation" element={<OrderConfirmationPage />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/pharmacy-market/prescription" element={<PrescriptionPage />} />
              <Route path="/pharmacy-market/refill" element={<RefillPrescriptionPage />} />
              <Route path="/pharmacy-market/repeat-last-order" element={<RepeatLastOrderPage />} />
              <Route path="/pharmacy-market/emergency-meds" element={<EmergencyMedsPage />} />
              <Route path="/family" element={<FamilyDashboardPage />} />
              <Route path="/family/add" element={<AddMemberPage />} />
              <Route path="/family/join" element={<AddMemberPage />} />
              <Route path="/family/add/dependent" element={<SetupDependentPage />} />
              <Route path="/family/add/success" element={<MemberAddedSuccessPage />} />
              <Route path="/family/member/:memberId" element={<MemberProfilePage />} />
              <Route path="/family/care-calendar" element={<CareCalendarPage />} />
              <Route path="/hospitals" element={<HospitalsPage />} />
              <Route path="/hospitals/:id" element={<HospitalDetailPage />} />
              <Route path="/hospitals/:id/enroll" element={<HospitalEnrollmentWizardPage />} />
              <Route path="/hospitals/:id/appointment" element={<BookHospitalAppointmentPage />} />
              <Route path="/hospitals/check-in/:appointmentId" element={<CheckInPage />} />
              <Route path="/family/hospital-enrollment" element={<FamilyHospitalEnrollmentPage />} />
              <Route path="/insurance" element={<InsurancePage />} />
              <Route path="/wallet" element={<WalletPage />} />
              <Route path="/doctor" element={<FindYourDoctor />} />
              <Route path="/doctors" element={<Navigate to="/doctor" replace />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/appointments/reschedule/:id" element={<RescheduleAppointment />} />
              <Route path="/reports/:id" element={<ConsultationReport />} />
              <Route path="/vitals" element={<VitalsHub />} />
              <Route path="/vitals/add" element={<SelectVitalType />} />
              <Route path="/vitals/add/:type" element={<AddVitalReading />} />
              <Route path="/vitals/history/:type" element={<VitalHistoryPage />} />

               <Route path="/wellness-hub" element={<WellnessHubPage />} />
              <Route path="/wellness-hub/professionals" element={<ProfessionalBookingPage />} />
              <Route path="/wellness-hub/professionals/:id" element={<ProfessionalBookingPage />} />
              <Route path="/wellness-hub/engagements" element={<EngagementsPage />} />
              <Route path="/wellness-hub/engagements/:engagementId" element={<EngagementDetailPage />} />
              <Route path="/wellness-hub/:categoryId" element={<PractitionerListPage />} />
              <Route path="/wellness-hub/:categoryId/:practitionerId" element={<PractitionerDetailPage />} />
              <Route path="/wellness-hub/:categoryId/:practitionerId/book" element={<BookPractitionerPage />} />
              </Route>

              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
          </main>
          <FloatingCartButton />
        </div>
      </BrowserRouter>
    </ZoomProvider>
  );
}
