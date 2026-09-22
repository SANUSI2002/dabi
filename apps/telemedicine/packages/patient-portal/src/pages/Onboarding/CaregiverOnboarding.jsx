import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { HeartHandshake, UserPlus, Link2 } from "lucide-react";
import {
  OnboardingShell,
  StepProgress,
  TextField,
  SelectField,
  PhoneField,
  ConsentCheckbox,
  StepNav,
  BackToPicker,
  PasswordHints,
  validatePassword,
  isValidEmail,
  submitOnboarding,
} from "./OnboardingFormKit";
import { COUNTRIES, CAREGIVER_TYPES } from "./onboardingConfig";

const STEPS = [
  { id: "account", title: "Account" },
  { id: "type", title: "Caregiver Type" },
  { id: "connection", title: "Patient Connection" },
  { id: "consent", title: "Consent" },
];

export default function CaregiverOnboarding() {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [account, setAccount] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    country: "Nigeria",
    state: "",
    city: "",
    password: "",
    confirmPassword: "",
  });

  const [caregiverType, setCaregiverType] = useState("");

  const [connection, setConnection] = useState({
    mode: "invite", // "invite" | "connect"
    inviteContact: "",
    patientId: "",
    relationship: "",
  });

  const [consent, setConsent] = useState({ terms: false, privacy: false });

  const updateAccount = (field) => (value) => setAccount((f) => ({ ...f, [field]: value }));
  const clearError = (field) => setErrors((e) => ({ ...e, [field]: undefined }));

  function validateStep(index) {
    const newErrors = {};
    if (index === 0) {
      if (!account.firstName) newErrors.firstName = "Required";
      if (!account.lastName) newErrors.lastName = "Required";
      if (!account.email || !isValidEmail(account.email)) newErrors.email = "Enter a valid email address";
      if (!account.phone) newErrors.phone = "Required";
      if (!account.dateOfBirth) newErrors.dateOfBirth = "Required";
      if (!account.country) newErrors.country = "Required";
      if (!account.state) newErrors.state = "Required";
      if (!account.city) newErrors.city = "Required";
      if (!validatePassword(account.password).valid) newErrors.password = "Password doesn't meet requirements";
      if (account.confirmPassword !== account.password) newErrors.confirmPassword = "Passwords don't match";
    }
    if (index === 1) {
      if (!caregiverType) newErrors.caregiverType = "Required";
    }
    if (index === 2) {
      if (!connection.relationship) newErrors.relationship = "Required";
      if (connection.mode === "invite" && !connection.inviteContact) newErrors.inviteContact = "Enter an email or phone number";
      if (connection.mode === "connect" && !connection.patientId) newErrors.patientId = "Enter the patient's Sabi Health ID or email";
    }
    if (index === 3) {
      if (!consent.terms) newErrors.terms = "Required";
      if (!consent.privacy) newErrors.privacy = "Required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  const handleBack = () => {
    if (stepIndex === 0) navigate("/signup");
    else setStepIndex((i) => i - 1);
  };

  const handleNext = async () => {
    if (!validateStep(stepIndex)) return;
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }

    setIsSubmitting(true);
    const payload = {
      accountType: "caregiver",
      account,
      caregiverType,
      connection,
      consent: { ...consent, version: "1.0", timestamp: new Date().toISOString() },
    };
    await submitOnboarding(payload, "sabi-pending-registration-caregiver");
    setIsSubmitting(false);

    navigate("/submitted", {
      state: {
        roleLabel: "Caregiver",
        portalName: "Caregiver Portal",
        needsVerification: false,
        caregiverPendingApproval: true,
      },
    });
  };

  return (
    <OnboardingShell>
      <BackToPicker />
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white">
          <HeartHandshake className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Caregiver Registration</h1>
          <p className="text-xs text-slate-500">Manage or assist another person's healthcare.</p>
        </div>
      </div>

      <StepProgress steps={STEPS} currentIndex={stepIndex} />

      {stepIndex === 0 && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="First Name" required value={account.firstName} onChange={(v) => { updateAccount("firstName")(v); clearError("firstName"); }} error={errors.firstName} />
            <TextField label="Last Name" required value={account.lastName} onChange={(v) => { updateAccount("lastName")(v); clearError("lastName"); }} error={errors.lastName} />
          </div>
          <TextField label="Email Address" required type="email" value={account.email} onChange={(v) => { updateAccount("email")(v); clearError("email"); }} error={errors.email} />
          <PhoneField required value={account.phone} onChange={(v) => { updateAccount("phone")(v); clearError("phone"); }} error={errors.phone} />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Date of Birth" required type="date" value={account.dateOfBirth} onChange={(v) => { updateAccount("dateOfBirth")(v); clearError("dateOfBirth"); }} error={errors.dateOfBirth} />
            <TextField label="State" required value={account.state} onChange={(v) => { updateAccount("state")(v); clearError("state"); }} error={errors.state} />
            <TextField label="City" required value={account.city} onChange={(v) => { updateAccount("city")(v); clearError("city"); }} error={errors.city} />
          </div>
          <SelectField label="Country" required value={account.country} onChange={(v) => { updateAccount("country")(v); clearError("country"); }} options={COUNTRIES} error={errors.country} />
          <div>
            <TextField label="Password" required type="password" value={account.password} onChange={(v) => { updateAccount("password")(v); clearError("password"); }} error={errors.password} />
            <PasswordHints pw={account.password} />
          </div>
          <TextField label="Confirm Password" required type="password" value={account.confirmPassword} onChange={(v) => { updateAccount("confirmPassword")(v); clearError("confirmPassword"); }} error={errors.confirmPassword} />
        </div>
      )}

      {stepIndex === 1 && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 -mt-1">What's your relationship to the person you'll be caring for?</p>
          <div className="grid grid-cols-2 gap-2">
            {CAREGIVER_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setCaregiverType(t); clearError("caregiverType"); }}
                className={`rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                  caregiverType === t
                    ? "border-teal-400 bg-teal-50 text-teal-800"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {errors.caregiverType && <p className="text-[11px] text-red-500">{errors.caregiverType}</p>}
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-3.5">
          <TextField
            label="Relationship to Patient"
            required
            placeholder="e.g. Mother, Home nurse, Legal guardian"
            value={connection.relationship}
            onChange={(v) => { setConnection((c) => ({ ...c, relationship: v })); clearError("relationship"); }}
            error={errors.relationship}
          />

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setConnection((c) => ({ ...c, mode: "invite" }))}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                connection.mode === "invite" ? "border-teal-400 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"
              }`}
            >
              <UserPlus className="h-4 w-4 shrink-0" /> Invite patient
            </button>
            <button
              type="button"
              onClick={() => setConnection((c) => ({ ...c, mode: "connect" }))}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-3 text-left text-sm font-medium transition-colors ${
                connection.mode === "connect" ? "border-teal-400 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"
              }`}
            >
              <Link2 className="h-4 w-4 shrink-0" /> Connect to existing patient
            </button>
          </div>

          {connection.mode === "invite" ? (
            <TextField
              label="Patient's Email or Phone Number"
              required
              value={connection.inviteContact}
              onChange={(v) => { setConnection((c) => ({ ...c, inviteContact: v })); clearError("inviteContact"); }}
              error={errors.inviteContact}
              hint="We'll send them an invite to approve you as their caregiver."
            />
          ) : (
            <TextField
              label="Patient's Sabi Health ID or Email"
              required
              value={connection.patientId}
              onChange={(v) => { setConnection((c) => ({ ...c, patientId: v })); clearError("patientId"); }}
              error={errors.patientId}
              hint="They'll receive an approval request before you get any access."
            />
          )}

          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-500">
            Caregiver access is never automatic. Once connected, the patient chooses exactly what
            you can see and do — appointments, prescriptions, medical records, medication
            management, payments, pharmacy orders, or emergency information — and can revoke
            access at any time.
          </div>
        </div>
      )}

      {stepIndex === 3 && (
        <div className="space-y-3.5">
          <ConsentCheckbox checked={consent.terms} onChange={(v) => { setConsent((c) => ({ ...c, terms: v })); clearError("terms"); }} error={errors.terms}>
            I agree to Sabi Health Terms &amp; Conditions.
          </ConsentCheckbox>
          <ConsentCheckbox checked={consent.privacy} onChange={(v) => { setConsent((c) => ({ ...c, privacy: v })); clearError("privacy"); }} error={errors.privacy}>
            I acknowledge the Privacy Policy.
          </ConsentCheckbox>
        </div>
      )}

      <StepNav
        onBack={handleBack}
        onNext={handleNext}
        backLabel={stepIndex === 0 ? "Change account type" : "Back"}
        isLast={stepIndex === STEPS.length - 1}
        isSubmitting={isSubmitting}
      />
    </OnboardingShell>
  );
}
