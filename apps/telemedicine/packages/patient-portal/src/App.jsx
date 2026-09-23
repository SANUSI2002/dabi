import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { restoreSession } from "./utils/sabiIdentity";
import "./index.css";
import { ZoomProvider } from "./context/ZoomContext";
import { Dashboard } from "./pages/dashboard/Dashboard";
import { Profile } from "./pages/profile/Profile";
import { Records } from "./pages/records/Records";
import { Appointments } from "./pages/appointments/Appointments";
import { RescheduleAppointment } from "./pages/appointments/RescheduleAppointment";
import { ConsultationReport } from "./pages/reports/ConsultationReport";
import { VitalsHub } from "./pages/vitals/VitalsHub";
import { SelectVitalType } from "./pages/vitals/SelectVitalType";
import { AddVitalReading } from "./pages/vitals/AddVitalReading";
import { VitalHistoryPage } from "./pages/vitals/VitalHistoryPage";
import SabiHealthLogin from "./pages/Onboarding/login";
import AccountTypeSelection from "./pages/Onboarding/AccountTypeSelection";
import CaregiverOnboarding from "./pages/Onboarding/CaregiverOnboarding";
import ProfessionalOnboarding from "./pages/Onboarding/ProfessionalOnboarding";
import OnboardingSubmitted from "./pages/Onboarding/OnboardingSubmitted";
import SignupPage from "./pages/Onboarding/Signup";
import AnimatedAuth from "./pages/Onboarding/AnimatedAuth";
import IdentityVerificationPage from "./pages/Onboarding/IdentityVerification";
import SuccessPage from "./pages/Onboarding/SuccessPage";
import { PrescriptionsPage } from "./pages/prescriptions/PrescriptionsPage";
import { PrescriptionDetailPage } from "./pages/prescriptions/PrescriptionDetailPage";
import { SelectPharmacyPage } from "./pages/prescriptions/SelectPharmacyPage";
import { PharmacyMarketPage } from "./pages/pharmacy-market/PharmacyMarketPage";
import { PharmacyStorefrontPage } from "./pages/pharmacy-market/PharmacyStorefrontPage";
import { PharmacyQuotesPage } from "./pages/pharmacy-quotes/PharmacyQuotesPage";
import { DeliveryListPage } from "./pages/delivery-tracking/DeliveryListPage";
import { DeliveryTrackingPage } from "./pages/delivery-tracking/DeliveryTrackingPage";
import FindYourDoctor from "./pages/doctor/Doctor";
import { WellnessHubPage } from "./pages/wellness/WellnessHubPage";
import { PractitionerListPage } from "./pages/wellness/PractitionerListPage";
import { PractitionerDetailPage } from "./pages/wellness/PractitionerDetailPage";
import { BookPractitionerPage } from "./pages/wellness/BookPractitionerPage";
import { EngagementsPage } from "./pages/wellness/EngagementsPage";
import { EngagementDetailPage } from "./pages/wellness/EngagementDetailPage";

import {
  FamilyDashboardPage,
  AddMemberPage,
  SetupDependentPage,
  MemberAddedSuccessPage,
  MemberProfilePage,
} from "./pages/family";
import { CareCalendarPage } from "./pages/family/CareCalendarPage";
import { CartPage } from "./pages/pharmacy-market/CartPage";
import { CheckoutPage } from "./pages/pharmacy-market/CheckoutPage";
import { OrderConfirmationPage } from "./pages/pharmacy-market/OrderConfirmationPage";
import { RefillPrescriptionPage } from "./pages/pharmacy-market/RefillPrescriptionPage";
import { PrescriptionPage } from "./pages/pharmacy-market/PrescriptionPage";
import { RepeatLastOrderPage } from "./pages/pharmacy-market/RepeatLastOrderPage";
import { EmergencyMedsPage } from "./pages/pharmacy-market/EmergencyMedsPage";
import { PharmacyQuotesInboxPage } from "./pages/pharmacy-quotes/PharmacyQuotesInboxPage";
import { FloatingCartButton } from "./pages/pharmacy-market/components";
import { HospitalsPage } from "./pages/hospitals/HospitalsPage";
import { HospitalDetailPage } from "./pages/hospitals/HospitalDetailPage";
import { HospitalEnrollmentWizardPage } from "./pages/hospitals/HospitalEnrollmentWizardPage";
import { BookHospitalAppointmentPage } from "./pages/hospitals/BookHospitalAppointmentPage";
import { CheckInPage } from "./pages/hospitals/CheckInPage";
import { FamilyHospitalEnrollmentPage } from "./pages/hospitals/FamilyHospitalEnrollmentPage";
import { InsurancePage } from "./pages/insurance/InsurancePage";
import ForgotPassword from "./pages/Onboarding/ForgotPassword";
import ResetPassword from "./pages/Onboarding/ResetPassword";
import { HOSPITAL_ONBOARDING_URL } from "./ecosystemLinks";

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
  useEffect(() => { let live = true; restoreSession().then((user) => { if (live) setState(user ? 'ready' : 'denied'); }); return () => { live = false; }; }, []);
  if (state === 'loading') return <div className="grid min-h-screen place-items-center text-sm text-slate-600">Checking Sabi Identity session…</div>;
  return state === 'ready' ? <Outlet /> : <Navigate to="/login" replace />;
}

function Logo() {
  const location = useLocation();

  // Pages where the standalone logo should be visible
  const isSignupFlow = location.pathname.startsWith("/signup");
  const publicRoutes = ["/verify", "/success", "/submitted"];

  // Hide the logo on every other page
  if (!isSignupFlow && !publicRoutes.includes(location.pathname)) {
    return null;
  }

  const isSignup = isSignupFlow;

  return (
    <div className="absolute top-2 left-4 sm:top-3 sm:left-8 z-50">
      <span
        className={`text-2xl sm:text-3xl font-bold tracking-tight ${
          isSignup ? "text-white" : "text-teal-800"
        }`}
      >
        SabiHealth
      </span>
    </div>
  );
}

export default function App() {
  return (
    <ZoomProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
        <div className="min-h-screen bg-slate-50 relative">
          <Logo />

          <main>
           <Routes>
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<SabiHealthLogin />} />
              <Route path="/signup" element={<AccountTypeSelection />} />
              <Route path="/signup/patient" element={<SignupPage />} />
              <Route path="/signup/caregiver" element={<CaregiverOnboarding />} />
              <Route path="/signup/professional/:type" element={<ProfessionalOnboarding />} />
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
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
              <Route path="/pharmacy-market/prescription" element={<PrescriptionPage />} />
              <Route path="/pharmacy-market/refill" element={<RefillPrescriptionPage />} />
              <Route path="/pharmacy-market/repeat-last-order" element={<RepeatLastOrderPage />} />
              <Route path="/pharmacy-market/emergency-meds" element={<EmergencyMedsPage />} />
              <Route path="/family" element={<FamilyDashboardPage />} />
              <Route path="/family/add" element={<AddMemberPage />} />
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
              <Route path="/doctor" element={<FindYourDoctor />} />
              <Route path="/doctors" element={<Navigate to="/dashboard/doctor" replace />} />
              <Route path="/appointments" element={<Appointments />} />
              <Route path="/appointments/reschedule/:id" element={<RescheduleAppointment />} />
              <Route path="/reports/:id" element={<ConsultationReport />} />
              <Route path="/vitals" element={<VitalsHub />} />
              <Route path="/vitals/add" element={<SelectVitalType />} />
              <Route path="/vitals/add/:type" element={<AddVitalReading />} />
              <Route path="/vitals/history/:type" element={<VitalHistoryPage />} />

               <Route path="/wellness-hub" element={<WellnessHubPage />} />
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
          </main>
          <FloatingCartButton />
        </div>
      </BrowserRouter>
    </ZoomProvider>
  );
}
