import { useLocation, useNavigate } from "react-router-dom";
import { Clock, CheckCircle2, ArrowRight, FileCheck2 } from "lucide-react";
import { OnboardingShell } from "./OnboardingFormKit";

// Shown after a professional or caregiver submits registration.
// Verification is deliberately separate from onboarding (spec section 58):
// this screen represents "onboarding complete, verification pending" and
// still lets the user into a dashboard with restricted functionality
// (spec section 16) rather than blocking them entirely.
export default function OnboardingSubmitted() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    portalName = "Dashboard",
    roleLabel = "Account",
    needsVerification = true,
    verificationItems = [],
    caregiverPendingApproval = false,
  } = location.state || {};

  return (
    <OnboardingShell>
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700 mb-3">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">
          {roleLabel} account created
        </h1>
        <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
          {caregiverPendingApproval
            ? "We've created your account and sent your patient connection request. Once they approve it, you'll be able to help manage their care."
            : needsVerification
            ? "You're in. Some features stay locked until your credentials are verified — you can explore and complete your profile in the meantime."
            : "You're all set. Welcome to Sabi Health."}
        </p>
      </div>

      {needsVerification && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-amber-800">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-semibold">Verification status: Pending</span>
          </div>
          <p className="mt-1.5 text-xs text-amber-700">
            We're reviewing the documents you submitted. This usually takes 1–3 business days.
            You can use your dashboard now, but regulated actions (consultations, prescriptions,
            bookings) stay locked until you're verified.
          </p>
        </div>
      )}

      {verificationItems.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-2">
            <FileCheck2 className="h-3.5 w-3.5" /> Recommended next steps
          </span>
          <ul className="space-y-1">
            {verificationItems.map((item) => (
              <li key={item} className="text-xs text-slate-500">
                ○ {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="mt-6 w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white hover:bg-teal-800"
      >
        Go to {portalName}
        <ArrowRight className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => navigate("/login")}
        className="mt-2.5 w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600"
      >
        I'll finish setting up later — take me to sign in
      </button>
    </OnboardingShell>
  );
}
