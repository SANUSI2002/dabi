import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, TrendingUp, Phone, Mail, Lock, Eye, EyeOff, ArrowRight, IdCard, X } from "lucide-react";
import { registerPatient } from "../../utils/sabiIdentity";
// If you want a local video, create `packages/patient-portal/public/signup-bg-video.mp4`.
// Otherwise this fallback uses a hosted video URL that works immediately.
const VIDEO_SRC = "https://assets.mixkit.co/videos/29933/29933-720.mp4";

export default function SignupPage() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showDependentPassword, setShowDependentPassword] = useState(false);
  const [showDependentConfirmPassword, setShowDependentConfirmPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // Account type is chosen on the screen before this one now
  // (AccountTypeSelection) — this route is only reached for "Patient".
  const role = "patient";
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [showDependentModal, setShowDependentModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDependentSubmitting, setIsDependentSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [dependentErrors, setDependentErrors] = useState({});
  const [dependentForm, setDependentForm] = useState({
    dependentId: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  const updateDependent = (field) => (e) => {
    setDependentForm((f) => ({ ...f, [field]: e.target.value }));
    setDependentErrors((errors) => ({ ...errors, [field]: undefined }));
  };

  const completedSteps = [
    Boolean(role),
    Boolean(form.firstName),
    Boolean(form.lastName),
    Boolean(form.phone),
    Boolean(form.email),
    Boolean(form.password),
    Boolean(form.confirmPassword),
    agreed,
  ].filter(Boolean).length;

  const totalSteps = 8;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);
  const progressText = `${completedSteps}/${totalSteps} completed`;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || form.phone.trim().length < 7) {
      setSubmitError("Enter your name, a valid phone number and email address.");
      return;
    }
    if (form.password.length < 8 || form.password !== form.confirmPassword) {
      setSubmitError("Use a password of at least 8 characters and confirm it exactly.");
      return;
    }
    if (!agreed) {
      setSubmitError("Accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    setIsSubmitting(true);

    try {
      const result = await registerPatient({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phone.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      navigate("/verify-email", { replace: true, state: { email: form.email.trim().toLowerCase(), emailSent: result.emailSent } });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not create your account right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- OAuth handlers ---
  // Replace GOOGLE_CLIENT_ID / APPLE_CLIENT_ID / redirect URIs with your own
  // values (from Google Cloud Console and Apple Developer > Sign in with Apple config).
  const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com";
  const APPLE_CLIENT_ID = "com.yourcompany.sabihealth";
  const REDIRECT_URI = `${window.location.origin}/auth/callback`;

  const handleGoogleAuth = () => {
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "consent",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleAppleAuth = () => {
    const params = new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code id_token",
      scope: "name email",
      response_mode: "form_post",
    });
    window.location.href = `https://appleid.apple.com/auth/authorize?${params.toString()}`;
  };

  const passwordRule = /^(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  const validateDependentForm = () => {
    const errors = {};

    if (!dependentForm.dependentId.trim()) {
      errors.dependentId = "Dependent ID is required.";
    }

    if (!dependentForm.phone.trim()) {
      errors.phone = "Phone number is required.";
    }

    if (!dependentForm.email.trim()) {
      errors.email = "Email address is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(dependentForm.email)) {
      errors.email = "Please enter a valid email address.";
    }

    if (!dependentForm.password) {
      errors.password = "Password is required.";
    } else if (!passwordRule.test(dependentForm.password)) {
      errors.password = "Password must be at least 8 characters and include a number and a symbol.";
    }

    if (!dependentForm.confirmPassword) {
      errors.confirmPassword = "Please confirm your password.";
    } else if (dependentForm.password !== dependentForm.confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
  };

  const handleDependentIdCard = () => {
    setDependentErrors({});
    setDependentForm({
      dependentId: "",
      phone: "",
      email: "",
      password: "",
      confirmPassword: "",
    });
    setShowDependentModal(true);
  };

  const handleDependentSubmit = (e) => {
    e.preventDefault();

    const errors = validateDependentForm();
    setDependentErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setIsDependentSubmitting(true);

    try {
      const payload = {
        accountType: "dependent",
        dependentId: dependentForm.dependentId,
        phone: dependentForm.phone,
        email: dependentForm.email,
        password: dependentForm.password,
      };
      localStorage.setItem("sabi-pending-dependent-registration", JSON.stringify(payload));
      setShowDependentModal(false);
      setDependentErrors({});
      setDependentForm({
        dependentId: "",
        phone: "",
        email: "",
        password: "",
        confirmPassword: "",
      });
      setShowDependentPassword(false);
      setShowDependentConfirmPassword(false);
      navigate("/verify", { state: { registrationPayload: payload } });
    } finally {
      setIsDependentSubmitting(false);
    }
  };

  const dialogRef = useRef(null);

  useEffect(() => {
    if (!showDependentModal) {
      return undefined;
    }

    const dialog = dialogRef.current;
    if (dialog) {
      dialog.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setShowDependentModal(false);
        return;
      }

      if (event.key === "Tab" && dialog) {
        const focusable = dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );

        if (!focusable.length) {
          event.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showDependentModal]);

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Full-page video background */}
      <video
        className="fixed inset-0 w-full h-full object-cover z-0"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        onError={(e) => console.error("Background video failed to load:", e.currentTarget.error)}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      {/* Darkening overlay for legibility */}
      <div className="fixed inset-0 bg-gradient-to-br from-teal-950/80 via-teal-950/60 to-slate-950/70 z-[1]" />

      {/* Content */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-center p-2 sm:p-2.5 md:p-3 lg:p-4">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-3 md:gap-4 lg:gap-5">
          {/* LEFT: copy over video */}
          <div className="flex flex-col justify-center gap-3 py-1 sm:py-2">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl leading-[1.05] font-semibold text-white tracking-tight drop-shadow-sm">
                Start your journey to
                <br />
                precision health.
              </h1>
              <p className="mt-2 text-base text-teal-50/90 max-w-md">
                Join SabiHealth today and gain access to secure records,
                personalized insights, and professional care coordination.
              </p>
            </div>

            <div className="space-y-2">
              <FeatureCard
                icon={<Shield className="w-5 h-5 text-white" />}
                iconBg="bg-teal-600"
                title="Secure & Private"
                body="Your medical data is encrypted with enterprise-grade security protocols."
              />
              <FeatureCard
                icon={<TrendingUp className="w-5 h-5 text-teal-800" />}
                iconBg="bg-teal-100"
                title="Health Insights"
                body="Track your vitals and receive proactive recommendations from our AI engine."
              />
            </div>
          </div>

          {/* RIGHT: signup card, glassy over the video */}
          <div className="flex items-center">
            <div className="w-full bg-white/95 backdrop-blur-md rounded-3xl border border-white/40 shadow-2xl shadow-black/30 p-3 sm:p-4 md:p-5 lg:p-5">
            {/* progress */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-teal-800">Patient account details</span>
              <span className="text-sm text-slate-500">{progressText}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 mb-3 overflow-hidden">
              <div className={`h-full rounded-full bg-teal-800 transition-all`} style={{ width: `${progressPercent}%` }} />
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">Create your account</h2>
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 underline underline-offset-2"
              >
                Not a patient?
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">Please provide your details to get started.</p>

            <form className="mt-3 space-y-2.5" onSubmit={handleSubmit}>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="First Name">
                  <input
                    type="text"
                    placeholder="John"
                    value={form.firstName}
                    onChange={update("firstName")}
                    className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                  />
                </Field>

                <Field label="Last Name">
                  <input
                    type="text"
                    placeholder="Doe"
                    value={form.lastName}
                    onChange={update("lastName")}
                    className="flex-1 bg-transparent outline-none text-base text-slate-800 placeholder:text-slate-400"
                  />
                </Field>
              </div>

              <Field label="Phone Number" className="-mt-1">
                <Phone className="w-5 h-5 text-slate-400" />
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={update("phone")}
                  className="flex-1 bg-transparent outline-none text-base text-slate-800 placeholder:text-slate-400"
                />
              </Field>

              <Field label="Email Address">
                <Mail className="w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={update("email")}
                  className="flex-1 bg-transparent outline-none text-base text-slate-800 placeholder:text-slate-400"
                />
              </Field>

              <div>
                <Field label="Password">
                  <Lock className="w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={form.password}
                    onChange={update("password")}
                    className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    className="text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </Field>
                <Field label="Confirm Password" className="mt-3">
                  <Lock className="w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={form.confirmPassword}
                    onChange={update("confirmPassword")}
                    className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                  />
                </Field>
                <p className="mt-2 text-sm text-slate-400">
                  Must be at least 8 characters with a symbol and number.
                </p>
              </div>

              <label className="flex items-start gap-3 text-sm text-slate-600 pt-0.5">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-slate-300 text-teal-800 focus:ring-teal-700"
                />
                <span>
                  I agree to the{" "}
                  <a href="#" className="text-teal-800 underline underline-offset-2">
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" className="text-teal-800 underline underline-offset-2">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-teal-800 hover:bg-teal-900 transition-colors text-white text-sm font-medium py-2.5 mt-1 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Creating account..." : "Create Account"}
                {!isSubmitting ? <ArrowRight className="w-5 h-5" /> : null}
              </button>
            </form>

            {submitError ? (
              <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {submitError}
              </div>
            ) : null}

            <div className="flex items-center gap-3 my-3">
              <div className="h-px flex-1 bg-slate-200" />
              <span className="text-sm text-slate-400">or continue with</span>
              <div className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              <SocialButton label="Google" onClick={handleGoogleAuth}>
                <GoogleIcon />
              </SocialButton>
              <SocialButton label="Apple" onClick={handleAppleAuth}>
                <AppleIcon />
              </SocialButton>
              <SocialButton label="Dependent ID" onClick={handleDependentIdCard}>
                <IdCard className="h-4 w-4 text-teal-700" />
              </SocialButton>
            </div>

            <p className="mt-2 flex flex-wrap items-center justify-center gap-1.5 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-semibold text-teal-700 hover:underline"
              >
                Log In
              </button>
            </p>
          </div>
          </div>
        </div>
      </div>

      {showDependentModal ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 sm:p-4"
          onClick={() => setShowDependentModal(false)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dependent-modal-title"
            className="w-full max-w-2xl max-h-[calc(100vh-2rem)] overflow-y-auto rounded-3xl border border-white/40 bg-white/95 p-4 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-5 md:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">
                  Dependent Access
                </p>
                <h3 id="dependent-modal-title" className="mt-1 text-xl font-semibold text-slate-900">
                  Register with Dependent ID
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDependentModal(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close dependent registration modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleDependentSubmit}>
              <Field label="Dependent ID" error={dependentErrors.dependentId}>
                <IdCard className="h-5 w-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter dependent ID"
                  value={dependentForm.dependentId}
                  onChange={updateDependent("dependentId")}
                  className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                  autoComplete="off"
                />
              </Field>

              <Field label="Phone Number" error={dependentErrors.phone}>
                <Phone className="h-5 w-5 text-slate-400" />
                <input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={dependentForm.phone}
                  onChange={updateDependent("phone")}
                  className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                  autoComplete="tel"
                />
              </Field>

              <Field label="Email Address" error={dependentErrors.email}>
                <Mail className="h-5 w-5 text-slate-400" />
                <input
                  type="email"
                  placeholder="dependent@example.com"
                  value={dependentForm.email}
                  onChange={updateDependent("email")}
                  className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                  autoComplete="email"
                />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Password" error={dependentErrors.password}>
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    type={showDependentPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={dependentForm.password}
                    onChange={updateDependent("password")}
                    className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDependentPassword((value) => !value)}
                    className="text-slate-400 transition hover:text-slate-600"
                    aria-label={showDependentPassword ? "Hide password" : "Show password"}
                  >
                    {showDependentPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </Field>

                <Field label="Confirm Password" error={dependentErrors.confirmPassword}>
                  <Lock className="h-5 w-5 text-slate-400" />
                  <input
                    type={showDependentConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={dependentForm.confirmPassword}
                    onChange={updateDependent("confirmPassword")}
                    className="flex-1 bg-transparent outline-none text-lg text-slate-800 placeholder:text-slate-400"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDependentConfirmPassword((value) => !value)}
                    className="text-slate-400 transition hover:text-slate-600"
                    aria-label={showDependentConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showDependentConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </Field>
              </div>

              <p className="text-sm text-slate-400">
                Passwords must be at least 8 characters and include a number and a symbol.
              </p>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowDependentModal(false)}
                  className="rounded-2xl border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDependentSubmitting}
                  className="rounded-2xl bg-teal-800 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isDependentSubmitting ? "Submitting..." : "Continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FeatureCard({ icon, iconBg, title, body }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur-md p-5 flex gap-4">
      <div className={`w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <div className="font-semibold text-lg text-white">{title}</div>
        <p className="text-teal-50/80 text-base mt-0.5">{body}</p>
      </div>
    </div>
  );
}

function Field({ label, children, className = "", error }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div
        className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition ${
          error
            ? "border-rose-400 focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500"
            : "border-slate-200 focus-within:border-teal-700 focus-within:ring-1 focus-within:ring-teal-700"
        }`}
      >
        {children}
      </div>
      {error ? <p className="mt-1.5 text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}

function SocialButton({ label, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
    >
      {children}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.98v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.68 9c0-.59.1-1.17.27-1.7V4.97H.98A9 9 0 0 0 0 9c0 1.45.35 2.83.98 4.03l2.97-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .98 4.97l2.97 2.33C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg width="16" height="18" viewBox="0 0 384 512" fill="currentColor">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
