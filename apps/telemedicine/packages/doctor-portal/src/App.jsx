import React, { useEffect, useState, useSyncExternalStore } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { getCurrentDoctor, subscribeToDoctorSession, activateDoctorSession, signOutDoctor } from "./store/doctorSession";
import SaveNotice from "./components/SaveNotice";
import DoctorRegistrationPage from "./pages/auth/DoctorRegistrationPage";
import ProfessionalRegistrationPage from "./pages/auth/ProfessionalRegistrationPage";
import SignInPage from "./pages/auth/SignInPage";
import RegistrationStatusPage from "./pages/auth/RegistrationStatusPage";
import PortalPreviewPage from "./pages/auth/PortalPreviewPage";
import { AUTH_CONFIGURED, PREVIEW_ENABLED, getAuthenticatedSession, signOutAccount } from "./services/doctorAuth";
import { idleSignInUrl, startIdleTimeout } from "../../shared-portal/idleTimeout.js";
import LiveDoctorWorkspace from "./live/LiveDoctorWorkspace";
import PortalErrorBoundary from "./components/PortalErrorBoundary";
import Dashboard from "./pages/dashboard/Dashboard";
import Calendar from "./pages/calendar/Calendar";
import Appointments from "./pages/appointments/Appointments";
import ManageAvailability from "./pages/availability/ManageAvailability";
import PatientAccessPreview from "./pages/patients/PatientAccessPreview";
import PatientsPage from "./pages/patients/PatientsPage";
import ConsultationsPage from "./pages/consultations/ConsultationsPage";
import PrescriptionsPage from "./pages/prescriptions/PrescriptionsPage";
import PatientPrescriptionsPage from "./pages/prescriptions/PatientPrescriptionsPage";
import ReportsPage from "./pages/reports/ReportsPage";
import MessagesPage from "./pages/messages/MessagesPage";
import HospitalWorkspacePage from "./pages/hospital-workspace/HospitalWorkspacePage";
import EarningsPage from "./pages/earnings/EarningsPage";
import ReviewsPage from "./pages/reviews/ReviewsPage";
import NotificationsPage from "./pages/notifications/NotificationsPage";
import ProfilePage from "./pages/profile/ProfilePage";
import SettingsPage from "./pages/settings/SettingsPage";

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

export default function App() {
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
  useEffect(() => startIdleTimeout({ isSignedIn: () => getCurrentDoctor() !== null, onIdle: () => { void signOutForInactivity(); } }), []);
  if (!ready) return <main className="dp-session-page" role="status">{sessionError ? <><h1>We couldn't check your session</h1><p>{sessionError}</p><button className="dp-btn dp-btn-primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button></> : "Loading your account…"}</main>;
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
      <SaveNotice key={`notice:${doctor?.id || "signed-out"}`} />
      <PortalErrorBoundary key={`boundary:${doctor?.id || "signed-out"}`}>
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
      </PortalErrorBoundary>
    </BrowserRouter>
  );
}
