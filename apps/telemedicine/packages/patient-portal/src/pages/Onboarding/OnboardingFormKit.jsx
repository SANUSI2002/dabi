import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Upload, FileCheck2, X, Loader2 } from "lucide-react";

const VIDEO_SRC = "https://assets.mixkit.co/videos/29933/29933-720.mp4";

// ---------------------------------------------------------------------
// Page shell — same video/glass-card treatment as AccountTypeSelection
// and the patient Signup page, so every onboarding screen feels like
// one continuous flow (spec section 3).
// ---------------------------------------------------------------------
export function OnboardingShell({ children, wide = false }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <video
        className="fixed inset-0 w-full h-full object-cover z-0"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>
      <div className="fixed inset-0 bg-gradient-to-br from-teal-950/80 via-teal-950/60 to-slate-950/70 z-[1]" />

      <div className="relative z-10 min-h-screen w-full flex items-center justify-center p-3 sm:p-4">
        <div
          className={`w-full ${
            wide ? "max-w-3xl" : "max-w-xl"
          } bg-white/95 backdrop-blur-md rounded-3xl border border-white/40 shadow-2xl shadow-black/30 p-5 sm:p-7`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Step progress — "Step X of N" + labeled dots (spec section 50)
// ---------------------------------------------------------------------
export function StepProgress({ steps, currentIndex }) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between text-xs font-medium text-slate-500">
        <span>
          Step {currentIndex + 1} of {steps.length}
        </span>
        <span>{Math.round(((currentIndex + 1) / steps.length) * 100)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-teal-700 transition-all"
          style={{ width: `${((currentIndex + 1) / steps.length) * 100}%` }}
        />
      </div>
      <div className="mt-2.5 hidden sm:flex items-center gap-1.5">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1.5 flex-1">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                i < currentIndex
                  ? "bg-teal-700 text-white"
                  : i === currentIndex
                  ? "border-2 border-teal-700 text-teal-700"
                  : "border border-slate-200 text-slate-300"
              }`}
            >
              {i < currentIndex ? "✓" : i + 1}
            </span>
            <span
              className={`text-[11px] font-medium truncate ${
                i <= currentIndex ? "text-slate-700" : "text-slate-300"
              }`}
            >
              {step.title}
            </span>
            {i < steps.length - 1 && <span className="flex-1 h-px bg-slate-100" />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Field primitives — consistent styling, error state, "why we ask"
// ---------------------------------------------------------------------
const baseInputClasses =
  "w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition-colors";

function fieldBorder(error) {
  return error ? "border-red-300 focus:border-red-400" : "border-slate-200 focus:border-teal-400";
}

export function Field({ label, required, error, hint, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-[11px] text-red-500">{error}</span>}
    </label>
  );
}

export function TextField({ label, required, error, hint, value, onChange, type = "text", placeholder }) {
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInputClasses} ${fieldBorder(error)}`}
      />
    </Field>
  );
}

export function SelectField({ label, required, error, hint, value, onChange, options, placeholder = "Select..." }) {
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInputClasses} ${fieldBorder(error)} appearance-none`}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function PhoneField({ label = "Phone Number", required, error, value, onChange }) {
  return (
    <Field label={label} required={required} error={error} hint="Include country code, e.g. +234 801 234 5678">
      <input
        type="tel"
        value={value}
        placeholder="+234 801 234 5678"
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInputClasses} ${fieldBorder(error)}`}
      />
    </Field>
  );
}

export function TextAreaField({ label, required, error, hint, value, onChange, rows = 3, placeholder }) {
  return (
    <Field label={label} required={required} error={error} hint={hint}>
      <textarea
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${baseInputClasses} ${fieldBorder(error)} resize-none`}
      />
    </Field>
  );
}

export function CheckboxGrid({ label, options, values, onToggle }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {options.map((opt) => {
          const checked = values.includes(opt);
          return (
            <label
              key={opt}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer transition-colors ${
                checked
                  ? "border-teal-400 bg-teal-50 text-teal-800"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(opt)}
                className="h-3.5 w-3.5 accent-teal-700"
              />
              {opt}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// Document upload — file input only, no real upload wiring yet (frontend
// phase; backend integration is a separate pass per the project plan).
export function DocumentUploadField({ label, required, file, onChange, error, accept = ".pdf,.jpg,.jpeg,.png" }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {!file ? (
        <label
          className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-4 text-xs font-medium cursor-pointer transition-colors ${
            error ? "border-red-300 text-red-500" : "border-slate-200 text-slate-500 hover:border-teal-300 hover:text-teal-700"
          }`}
        >
          <Upload className="h-4 w-4" />
          Take photo, choose from device, or upload PDF
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onChange(f);
            }}
          />
        </label>
      ) : (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-3.5 py-2.5">
          <span className="flex items-center gap-2 text-xs font-medium text-teal-800 truncate">
            <FileCheck2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{file.name}</span>
          </span>
          <button type="button" onClick={() => onChange(null)} className="text-teal-700 hover:text-teal-900 shrink-0">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {error && <span className="mt-1 block text-[11px] text-red-500">{error}</span>}
      <span className="mt-1 block text-[11px] text-slate-400">PDF, JPG, JPEG, or PNG. Max 10MB.</span>
    </div>
  );
}

export function ConsentCheckbox({ checked, onChange, children, error }) {
  return (
    <label className="flex items-start gap-2.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-0.5 h-4 w-4 shrink-0 accent-teal-700 ${error ? "outline outline-1 outline-red-400 rounded" : ""}`}
      />
      <span className="text-xs text-slate-600 leading-relaxed">{children}</span>
    </label>
  );
}

// ---------------------------------------------------------------------
// Step navigation footer
// ---------------------------------------------------------------------
export function StepNav({ onBack, onNext, backLabel = "Back", nextLabel = "Save & Continue", isSubmitting, isLast, onSkip }) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ChevronLeft className="h-4 w-4" />
        {backLabel}
      </button>
      <div className="flex items-center gap-2.5">
        {onSkip && (
          <button type="button" onClick={onSkip} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Skip for now
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
            </>
          ) : (
            <>
              {isLast ? "Submit" : nextLabel}
              {!isLast && <ChevronRight className="h-4 w-4" />}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function BackToPicker() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/signup")}
      className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-800"
    >
      <ChevronLeft className="h-4 w-4" />
      Choose a different account type
    </button>
  );
}

// ---------------------------------------------------------------------
// Password requirements (spec section 5) — shared by every role since
// every account type creates a password at Step 2.
// ---------------------------------------------------------------------
export function validatePassword(pw) {
  const checks = {
    length: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
  };
  const valid = Object.values(checks).every(Boolean);
  return { valid, checks };
}

export function PasswordHints({ pw }) {
  const { checks } = validatePassword(pw || "");
  const items = [
    ["length", "8+ characters"],
    ["upper", "1 uppercase letter"],
    ["lower", "1 lowercase letter"],
    ["number", "1 number"],
    ["special", "1 special character"],
  ];
  return (
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
      {items.map(([key, text]) => (
        <span key={key} className={`text-[10px] font-medium ${checks[key] ? "text-teal-600" : "text-slate-400"}`}>
          {checks[key] ? "✓" : "○"} {text}
        </span>
      ))}
    </div>
  );
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Best-effort submit: try the real API, fall back to localStorage so the
// flow never dead-ends before the backend exists (matches the pattern
// already used by the patient Signup page).
export async function submitOnboarding(payload, storageKey) {
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Registration endpoint returned an error.");
    return { ok: true };
  } catch (error) {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...payload, createdAt: new Date().toISOString() })
    );
    console.warn("Registration endpoint unavailable, using local fallback.", error);
    return { ok: false, fellBackToLocal: true };
  }
}
