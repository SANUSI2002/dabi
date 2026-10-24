import React, { useEffect, useState, useSyncExternalStore, lazy, Suspense } from "react";
import { createBrowserRouter, RouterProvider, Navigate, Route, Routes } from "react-router-dom";
import { getCurrentDoctor, subscribeToDoctorSession, activateDoctorSession, signOutDoctor } from "./store/doctorSession";
import SaveNotice from "./components/SaveNotice";
const DoctorRegistrationPage = lazy(() => import("./pages/auth/DoctorRegistrationPage"));
const ProfessionalRegistrationPage = lazy(() => import("./pages/auth/ProfessionalRegistrationPage"));
const SignInPage = lazy(() => import("./pages/auth/SignInPage"));
const RegistrationStatusPage = lazy(() => import("./pages/auth/RegistrationStatusPage"));
const PortalPreviewPage = lazy(() => import("./pages/auth/PortalPreviewPage"));
import { AUTH_CONFIGURED, PREVIEW_ENABLED, getAuthenticatedSession, signOutAccount, doctorRequest, checkDoctorSession } from "./services/doctorAuth";
import { elsewhereSignInUrl, startSessionWatch } from "../../shared-portal/sessionWatch.js";
import { idleSignInUrl, startIdleTimeout } from "../../shared-portal/idleTimeout.js";
const LiveDoctorWorkspace = lazy(() => import("./live/LiveDoctorWorkspace"));
import PortalErrorBoundary from "./components/PortalErrorBoundary";
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Calendar = lazy(() => import("./pages/calendar/Calendar"));
const Appointments = lazy(() => import("./pages/appointments/Appointments"));
const ManageAvailability = lazy(() => import("./pages/availability/ManageAvailability"));
const PatientAccessPreview = lazy(() => import("./pages/patients/PatientAccessPreview"));
const PatientsPage = lazy(() => import("./pages/patients/PatientsPage"));
const ConsultationsPage = lazy(() => import("./pages/consultations/ConsultationsPage"));
const PrescriptionsPage = lazy(() => import("./pages/prescriptions/PrescriptionsPage"));
const PatientPrescriptionsPage = lazy(() => import("./pages/prescriptions/PatientPrescriptionsPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const MessagesPage = lazy(() => import("./pages/messages/MessagesPage"));
const HospitalWorkspacePage = lazy(() => import("./pages/hospital-workspace/HospitalWorkspacePage"));
const EarningsPage = lazy(() => import("./pages/earnings/EarningsPage"));
const ReviewsPage = lazy(() => import("./pages/reviews/ReviewsPage"));
const NotificationsPage = lazy(() => import("./pages/notifications/NotificationsPage"));
const ProfilePage = lazy(() => import("./pages/profile/ProfilePage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));

import "../../shared-portal/portal-revamp.css";
import "../../shared-portal/premium-pages.css";
// Telemedicine design system: tokens first, then shared components. Loaded last so they win.
import "../../shared-portal/design-system/tokens.css";
import "../../shared-portal/design-system/components.css";

// Five minutes without input ends the session: revoke it on the server, clear it here, and reload
// at the sign-in page so nothing from the signed-in workspace stays in memory.
async function signOutForInactivity() {
  if (AUTH_CONFIGURED) await signOutAccount().catch(() => {}); // local state is cleared regardless
  signOutDoctor();
  window.location.assign(idleSignInUrl(import.meta.env.BASE_URL));
}

// Signed in on another device: this one is signed out at once, and the sign-in page says why.
async function signOutSignedInElsewhere() {
  await signOutAccount().catch(() => {}); // the server already ended the session; this clears the cookie
  signOutDoctor();
  window.location.assign(elsewhereSignInUrl(import.meta.env.BASE_URL));
}

function DoctorApplication() {
  const doctor = useSyncExternalStore(subscribeToDoctorSession, getCurrentDoctor, getCurrentDoctor);
  const [ready, setReady] = useState(!AUTH_CONFIGURED);
  const [sessionError, setSessionError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!AUTH_CONFIGURED) return;
    let cancelled = false;
    setSessionError("");
    getAuthenticatedSession().then((result) => { if (!cancelled) { if (result.doctor) activateDoctorSession(result.doctor); else signOutDoctor(); setReady(true); } }).catch((error) => { if (!cancelled) setSessionError(error.message); });
    return () => { cancelled = true; };
  }, [attempt]);
  useEffect(() => AUTH_CONFIGURED ? startSessionWatch({ check: checkDoctorSession, isSignedIn: () => Boolean(getCurrentDoctor() && !getCurrentDoctor().isDemo),
    onSignedInElsewhere: () => { void signOutSignedInElsewhere(); } }) : undefined, []);
  useEffect(() => startIdleTimeout({ isSignedIn: () => getCurrentDoctor() !== null,
    onActive: () => AUTH_CONFIGURED && !getCurrentDoctor()?.isDemo ? doctorRequest('/auth/me') : undefined,
    onIdle: () => { void signOutForInactivity(); } }), []);
  if (!ready) return <main className="dp-session-page" role="status">{sessionError ? <><h1>We couldn't check your session</h1><p>{sessionError}</p><button className="dp-btn dp-btn-primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button></> : "Loading your account…"}</main>;
  return (
    <>
      <SaveNotice key={`notice:${doctor?.id || "signed-out"}`} />
      <PortalErrorBoundary key={`boundary:${doctor?.id || "signed-out"}`}>
      <Suspense fallback={<main className="dp-session-page" role="status" aria-live="polite">Opening your workspace…</main>}>
      <Routes key={doctor?.id || "signed-out"}>
        <Route path="/register" element={<ProfessionalRegistrationPage />} />
        <Route path="/login" element={<SignInPage />} />
        <Route path="/forgot-password" element={<SignInPage key="recovery" recovery />} />
        <Route path="/registration/status" element={<RegistrationStatusPage />} />
        <Route path="/verify-email" element={<RegistrationStatusPage verification />} />
        <Route path="/verify-email/:uid" element={<RegistrationStatusPage verification />} />
        <Route path="/preview" element={PREVIEW_ENABLED ? <PortalPreviewPage /> : <Navigate to="/login" replace />} />
        <Route path="/switch-doctor" element={<Navigate to="/register" replace />} />
        {doctor ? doctor.isDemo ? <>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route path="/appointments/:id" element={<Appointments />} />
        <Route path="/availability" element={<ManageAvailability />} />
        <Route path="/patient-access-preview" element={<PatientAccessPreview />} />
        <Route path="/patients" element={<PatientsPage />} />
        <Route path="/consultations" element={<ConsultationsPage />} />
        <Route path="/prescriptions" element={<PrescriptionsPage />} />
        <Route path="/patient-prescriptions" element={<PatientPrescriptionsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/hospital-workspace" element={<HospitalWorkspacePage />} />
        <Route path="/earnings" element={<EarningsPage />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </> : <Route path="*" element={<LiveDoctorWorkspace />} /> : <>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>}
      </Routes>
      </Suspense>
      </PortalErrorBoundary>
    </>
  );
}

export default function App() {
  // A data router enables reliable blocking of links AND browser Back for unsaved clinical notes.
  const [router] = useState(() => createBrowserRouter([{ path: '*', element: <DoctorApplication /> }], {
    basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
  }));
  return <RouterProvider router={router} />;
}
