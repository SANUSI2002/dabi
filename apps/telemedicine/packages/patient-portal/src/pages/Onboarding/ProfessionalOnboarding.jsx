import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Stethoscope } from "lucide-react";
import {
  OnboardingShell,
  StepProgress,
  TextField,
  SelectField,
  PhoneField,
  DocumentUploadField,
  ConsentCheckbox,
  StepNav,
  BackToPicker,
  PasswordHints,
  validatePassword,
  isValidEmail,
  submitOnboarding,
} from "./OnboardingFormKit";
import { PROFESSIONAL_CONFIGS, COUNTRIES, YEARS_OF_EXPERIENCE, humanizeSlug } from "./onboardingConfig";

const STEPS = [
  { id: "account", title: "Account" },
  { id: "professional", title: "Professional Info" },
  { id: "documents", title: "Documents" },
  { id: "consent", title: "Consent" },
];

export default function ProfessionalOnboarding() {
  const navigate = useNavigate();
  const { type } = useParams();
  const config = PROFESSIONAL_CONFIGS[type] || PROFESSIONAL_CONFIGS.other;

  const [stepIndex, setStepIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [account, setAccount] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    country: "Nigeria",
    password: "",
    confirmPassword: "",
  });

  const [professional, setProfessional] = useState({
    professionName: config.freeformProfession ? "" : config.label,
    specialisation: "",
    yearsOfExperience: "",
    registrationNumber: "",
    licensingBody: "",
    countryOfPractice: "Nigeria",
    practiceState: "",
    practiceCity: "",
  });

  const [documents, setDocuments] = useState({});
  const [consent, setConsent] = useState({ terms: false, privacy: false, healthData: false });

  const set = (setter) => (field) => (value) => setter((f) => ({ ...f, [field]: value }));
  const updateAccount = set(setAccount);
  const updateProfessional = set(setProfessional);

  const clearError = (field) => setErrors((e) => ({ ...e, [field]: undefined }));

  function validateStep(index) {
    const newErrors = {};
    if (index === 0) {
      if (!account.firstName) newErrors.firstName = "Required";
      if (!account.lastName) newErrors.lastName = "Required";
      if (!account.email || !isValidEmail(account.email)) newErrors.email = "Enter a valid email address";
      if (!account.phone) newErrors.phone = "Required";
      if (!account.dateOfBirth) newErrors.dateOfBirth = "Required";
      if (!account.gender) newErrors.gender = "Required";
      if (!account.country) newErrors.country = "Required";
      if (!validatePassword(account.password).valid) newErrors.password = "Password doesn't meet requirements";
      if (account.confirmPassword !== account.password) newErrors.confirmPassword = "Passwords don't match";
    }
    if (index === 1) {
      if (config.freeformProfession && !professional.professionName) newErrors.professionName = "Required";
      if (!professional.specialisation) newErrors.specialisation = "Required";
      if (!professional.yearsOfExperience) newErrors.yearsOfExperience = "Required";
      if (config.requiresRegistration && !professional.registrationNumber)
        newErrors.registrationNumber = "Required for this profession";
      if (config.requiresRegistration && !professional.licensingBody) newErrors.licensingBody = "Required";
      if (!professional.countryOfPractice) newErrors.countryOfPractice = "Required";
      if (!professional.practiceState) newErrors.practiceState = "Required";
      if (!professional.practiceCity) newErrors.practiceCity = "Required";
    }
    if (index === 2) {
      config.documents.forEach((doc) => {
        if (doc.required && !documents[doc.key]) newErrors[doc.key] = "This document is required";
      });
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
      accountType: "professional",
      profession: type,
      account,
      professional,
      documentNames: Object.fromEntries(Object.entries(documents).map(([k, f]) => [k, f?.name || null])),
      consent: { ...consent, version: "1.0", timestamp: new Date().toISOString() },
    };
    await submitOnboarding(payload, "sabi-pending-registration-professional");
    setIsSubmitting(false);

    navigate("/submitted", {
      state: {
        roleLabel: config.freeformProfession ? professional.professionName || "Professional" : config.label,
        portalName: config.portalName,
        needsVerification: true,
        verificationItems: [
          "Add availability",
          "Add consultation fee",
          "Complete your professional biography",
        ],
      },
    });
  };

  return (
    <OnboardingShell wide>
      <BackToPicker />
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white">
          <Stethoscope className="h-4.5 w-4.5" />
        </span>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">
            {config.freeformProfession ? "Other Healthcare Professional" : `${config.label} Registration`}
          </h1>
          <p className="text-xs text-slate-500">Level 1 — required to create and verify your account.</p>
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
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Date of Birth" required type="date" value={account.dateOfBirth} onChange={(v) => { updateAccount("dateOfBirth")(v); clearError("dateOfBirth"); }} error={errors.dateOfBirth} />
            <SelectField label="Gender" required value={account.gender} onChange={(v) => { updateAccount("gender")(v); clearError("gender"); }} options={["Female", "Male", "Other", "Prefer not to say"]} error={errors.gender} />
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
        <div className="space-y-3.5">
          {config.freeformProfession && (
            <TextField
              label="Profession Name"
              required
              placeholder="e.g. Speech Therapist"
              value={professional.professionName}
              onChange={(v) => { updateProfessional("professionName")(v); clearError("professionName"); }}
              error={errors.professionName}
            />
          )}
          {config.specialisationOptions ? (
            <SelectField
              label={config.specialisationLabel}
              required
              value={professional.specialisation}
              onChange={(v) => { updateProfessional("specialisation")(v); clearError("specialisation"); }}
              options={config.specialisationOptions}
              error={errors.specialisation}
            />
          ) : (
            <TextField
              label={config.specialisationLabel}
              required
              value={professional.specialisation}
              onChange={(v) => { updateProfessional("specialisation")(v); clearError("specialisation"); }}
              error={errors.specialisation}
            />
          )}
          <SelectField
            label="Years of Experience"
            required
            value={professional.yearsOfExperience}
            onChange={(v) => { updateProfessional("yearsOfExperience")(v); clearError("yearsOfExperience"); }}
            options={YEARS_OF_EXPERIENCE}
            error={errors.yearsOfExperience}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label={config.registrationLabel}
              required={config.requiresRegistration}
              value={professional.registrationNumber}
              onChange={(v) => { updateProfessional("registrationNumber")(v); clearError("registrationNumber"); }}
              error={errors.registrationNumber}
            />
            <SelectField
              label="Licensing Body"
              required={config.requiresRegistration}
              value={professional.licensingBody}
              onChange={(v) => { updateProfessional("licensingBody")(v); clearError("licensingBody"); }}
              options={config.regulatoryBodies}
              error={errors.licensingBody}
            />
          </div>
          {config.sensitiveNote && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              {config.sensitiveNote}
            </p>
          )}
          <SelectField
            label="Country of Practice"
            required
            value={professional.countryOfPractice}
            onChange={(v) => { updateProfessional("countryOfPractice")(v); clearError("countryOfPractice"); }}
            options={COUNTRIES}
            error={errors.countryOfPractice}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Practice State" required value={professional.practiceState} onChange={(v) => { updateProfessional("practiceState")(v); clearError("practiceState"); }} error={errors.practiceState} />
            <TextField label="Practice City" required value={professional.practiceCity} onChange={(v) => { updateProfessional("practiceCity")(v); clearError("practiceCity"); }} error={errors.practiceCity} />
          </div>
        </div>
      )}

      {stepIndex === 2 && (
        <div className="space-y-3.5">
          <p className="text-xs text-slate-500 -mt-1">
            Not every profession needs every document — we've only marked what applies to {config.label.toLowerCase()}s as required.
          </p>
          {config.documents.map((doc) => (
            <DocumentUploadField
              key={doc.key}
              label={doc.label}
              required={doc.required}
              file={documents[doc.key]}
              error={errors[doc.key]}
              onChange={(file) => {
                setDocuments((d) => ({ ...d, [doc.key]: file }));
                clearError(doc.key);
              }}
            />
          ))}
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
          <ConsentCheckbox checked={consent.healthData} onChange={(v) => setConsent((c) => ({ ...c, healthData: v }))}>
            I consent to Sabi Health processing patient health information I submit through the platform, as required to provide healthcare services.
          </ConsentCheckbox>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-xs text-slate-500">
            After submitting, your account is created immediately and you can access your dashboard.
            {config.requiresRegistration
              ? " Regulated actions (consultations, prescriptions, bookings) stay locked until your credentials are verified."
              : " Your profile becomes fully visible to patients once reviewed."}
          </div>
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
