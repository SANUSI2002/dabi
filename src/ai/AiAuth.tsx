import SabiBrand from "@/components/brand/SabiBrand";
import { useEffect, useState, type ReactNode, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Building2, Check, Heart, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import {
  liveSignIn,
  liveVerifyMfa,
  restoreLiveIdentity,
  liveApiRequest,
} from "@/identity/liveIdentity";
import {
  aiAccountGet,
  aiAccountPost,
  type AiAccount,
  type AiEnrollmentInput,
  type AiKind,
  type AiProfession,
} from "./api";
import artwork from "@/assets/landing/sabi-ai-standalone-v1.webp";
import "./standalone.css";
import { IdleSignOutNotice } from "@/identity/IdleSessionGuard";
const kinds = [
  {
    kind: "PERSONAL" as const,
    label: "For myself",
    icon: Heart,
    hint: "Everyday health, made clearer.",
  },
  {
    kind: "PROFESSIONAL" as const,
    label: "Professional",
    icon: Stethoscope,
    hint: "A considered companion for your work.",
  },
  {
    kind: "BUSINESS" as const,
    label: "Hospital / business",
    icon: Building2,
    hint: "Bring your organisation into the picture.",
  },
];
export const AiBrand = () => (
  <Link to="/ai" className="sai-brand">
    <SabiBrand symbol size={32} />
    Sabi <em>AI</em>
  </Link>
);
export function AiAuthShell({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <main className={`sai-auth ${wide ? "sai-auth-wide" : ""}`}>
      <aside className="sai-art">
        <img src={artwork} width="1440" height="960" alt="" />
        <div className="sai-art-shade" />
        <AiBrand />
        <div className="sai-art-copy">
          <p className="sai-eyebrow">
            A LITTLE CLARITY. A LOT MORE POSSIBILITY.
          </p>
          <h1>
            Care begins with
            <br />
            understanding.
          </h1>
          <p>
            For the questions on your mind.
            <br />
            And the people in your care.
          </p>
          <span>
            <ShieldCheck size={17} aria-hidden="true" />
            Your conversations. Your space.
          </span>
        </div>
      </aside>
      <section className="sai-form-pane">
        <div className="sai-mobile-brand">
          <AiBrand />
        </div>
        {children}
        <footer className="sai-auth-footer">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <a href="mailto:support@sabihealth.org">Need a hand?</a>
        </footer>
      </section>
    </main>
  );
}
export function AiLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [mfa, setMfa] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mfa) {
        await liveVerifyMfa(code);
        setCode("");
        navigate("/ai/workspace", { replace: true });
      } else {
        const result = await liveSignIn(email.trim(), password);
        setPassword("");
        if (result.kind === "MFA") setMfa(true);
        else navigate("/ai/workspace", { replace: true });
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign-in could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AiAuthShell>
      <div className="sai-form-content">
        <p className="sai-eyebrow">YOUR HEALTH. A LITTLE CLEARER.</p>
        <IdleSignOutNotice className="mb-5" />
        <h2>{mfa ? "One more check." : "Good to have you here."}</h2>
        <p className="sai-intro">
          {mfa
            ? "Enter your authenticator code to finish signing in."
            : "Sign in to your Sabi AI space. Pick up a conversation, explore a question, find your next step."}
        </p>
        <form onSubmit={submit} className="sai-form">
          {mfa ? (
            <label>
              Authenticator code
              <input
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
          ) : (
            <>
              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <Link className="sai-forgot" to="/forgot-password">
                Forgot password?
              </Link>
            </>
          )}
          {error && (
            <p role="alert" className="sai-error">
              {error}
            </p>
          )}
          <button className="sai-primary" disabled={busy}>
            {busy ? (
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            ) : (
              <ArrowRight size={18} aria-hidden="true" />
            )}
            {busy ? "Checking…" : mfa ? "Verify and continue" : "Sign in"}
          </button>
        </form>
        <p className="sai-switch">
          New to Sabi AI? <Link to="/ai/signup">Create an account</Link>
        </p>
        <p className="sai-fine">
          One Sabi ID works across your existing Sabi services. Your
          professional and hospital permissions stay separate.
        </p>
      </div>
    </AiAuthShell>
  );
}
export function AiEnrollmentFields({
  value,
  onChange,
  professions,
}: {
  value: AiEnrollmentInput;
  onChange: (value: AiEnrollmentInput) => void;
  professions: AiProfession[];
}) {
  const set = (key: string, text: string) =>
    onChange({ ...value, [key]: text });
  const choose = (kind: AiKind) =>
    onChange({ kind, country: "Nigeria", attestation: true });
  return (
    <>
      <fieldset className="sai-kind">
        <legend>How will you use Sabi AI?</legend>
        <div>
          {kinds.map((k) => (
            <button
              type="button"
              key={k.kind}
              aria-pressed={value.kind === k.kind}
              onClick={() => choose(k.kind)}
            >
              <k.icon size={20} aria-hidden="true" />
              <span>{k.label}</span>
              {value.kind === k.kind && <Check size={14} aria-hidden="true" />}
            </button>
          ))}
        </div>
      </fieldset>
      {value.kind !== "PERSONAL" && (
        <div className="sai-detail-fields">
          <p>{kinds.find((k) => k.kind === value.kind)?.hint}</p>
          <label>
            Country of registration
            <input
              required
              value={value.country}
              onChange={(e) => set("country", e.target.value)}
              autoComplete="country-name"
            />
          </label>
          {value.kind === "PROFESSIONAL" ? (
            <>
              <label>
                Professional discipline
                <select
                  required
                  value={value.profession || ""}
                  onChange={(e) => {
                    const p = professions.find((p) => p.id === e.target.value);
                    onChange({
                      ...value,
                      profession: e.target.value,
                      authority:
                        value.country === "Nigeria" ? p?.authority || "" : "",
                    });
                  }}
                >
                  <option value="">Select your discipline</option>
                  {professions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Registration / licence number
                <input
                  required
                  minLength={3}
                  maxLength={100}
                  value={value.licenceNumber || ""}
                  onChange={(e) => set("licenceNumber", e.target.value)}
                />
              </label>
              <label>
                Licence expiry date
                <input
                  type="date"
                  required
                  value={value.expiresAt || ""}
                  onChange={(e) => set("expiresAt", e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label>
                Hospital / organisation name
                <input
                  required
                  autoComplete="organization"
                  value={value.organizationName || ""}
                  onChange={(e) => set("organizationName", e.target.value)}
                />
              </label>
              <label>
                Facility / business registration number
                <input
                  required
                  minLength={3}
                  value={value.registrationNumber || ""}
                  onChange={(e) => set("registrationNumber", e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            {value.kind === "BUSINESS"
              ? "Issuing authority / facility regulator"
              : "Issuing professional body"}
            <input
              required
              minLength={2}
              maxLength={160}
              value={value.authority || ""}
              onChange={(e) => set("authority", e.target.value)}
            />
          </label>
          <p className="sai-fine">
            Sabi reviews your registration with the relevant issuing body. This
            application does not grant patient-record access or prescribing
            permissions.
          </p>
        </div>
      )}
    </>
  );
}
export function AiSignup() {
  const [professions, setProfessions] = useState<AiProfession[]>([]),
    [catalogueError, setCatalogueError] = useState(""),
    [value, setValue] = useState<AiEnrollmentInput>({
      kind: "PERSONAL",
      country: "Nigeria",
      attestation: true,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [notice, setNotice] = useState("");
  useEffect(() => {
    aiAccountGet<{ professions: AiProfession[] }>("/catalogue")
      .then((x) => setProfessions(x.professions))
      .catch(() =>
        setCatalogueError(
          "Professional registration options are unavailable. Reload to retry.",
        ),
      );
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    if (form.get("password") !== form.get("confirmPassword")) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await aiAccountPost<{
        emailSent: boolean;
        message: string;
      }>("/register", {
        email: email.trim(),
        fullName: form.get("fullName"),
        password: form.get("password"),
        consentGiven: true,
        enrollment: value,
      });
      setNotice(result.message);
      setSent(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Registration could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    try {
      const result = await aiAccountPost<{ message: string }>(
        "/resend-verification",
        { email },
      );
      setNotice(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AiAuthShell wide>
      <div className="sai-form-content">
        <p className="sai-eyebrow">A SPACE FOR YOUR NEXT QUESTION.</p>
        <h2>{sent ? "Check your inbox." : "Make yourself at home."}</h2>
        <p className="sai-intro">
          {sent
            ? `We’ve created your account for ${email}. Verify your email, then sign in. Professional and business applications are reviewed separately.`
            : "A health assistant for everyday life. A thoughtful workspace for professionals and organisations."}
        </p>
        {sent ? (
          <div className="sai-success" role="status">
            <Check aria-hidden="true" />
            <p>{notice}</p>
            <button
              className="sai-secondary"
              type="button"
              disabled={busy}
              onClick={resend}
            >
              Resend verification email
            </button>
            <Link className="sai-primary" to="/ai/login">
              Continue to sign in <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <form className="sai-form" onSubmit={submit}>
            <AiEnrollmentFields
              value={value}
              onChange={setValue}
              professions={professions}
            />
            {catalogueError && (
              <p role="alert" className="sai-error">
                {catalogueError}
              </p>
            )}
            <label>
              Full name
              <input
                name="fullName"
                required
                autoComplete="name"
                minLength={2}
                maxLength={120}
              />
            </label>
            <label>
              Email address
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <div className="sai-two">
              <label>
                Password
                <input
                  name="password"
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                />
              </label>
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  required
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                />
              </label>
            </div>
            <p className="sai-fine">
              Use at least 12 characters. Password managers and paste are
              welcome.
            </p>
            <label className="sai-checkbox">
              <input type="checkbox" required />
              <span>
                I confirm these details are mine and agree to Sabi’s{" "}
                <Link to="/terms">Terms</Link> and{" "}
                <Link to="/privacy">Privacy Policy</Link>.
              </span>
            </label>
            {error && (
              <p role="alert" className="sai-error">
                {error}
              </p>
            )}
            <button
              className="sai-primary"
              disabled={
                busy || (value.kind === "PROFESSIONAL" && !professions.length)
              }
            >
              {busy ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <ArrowRight size={18} aria-hidden="true" />
              )}
              {busy ? "Creating your account…" : "Create account"}
            </button>
          </form>
        )}
        <p className="sai-switch">
          Already have a Sabi ID? <Link to="/ai/login">Sign in</Link>
        </p>
      </div>
    </AiAuthShell>
  );
}
export function AiAccountPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<AiAccount | null>(null),
    [value, setValue] = useState<AiEnrollmentInput>({
      kind: "PERSONAL",
      country: "Nigeria",
      attestation: true,
    }),
    [professions, setProfessions] = useState<AiProfession[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    restoreLiveIdentity()
      .then(async (identity) => {
        if (!identity) {
          navigate("/ai/login", { replace: true });
          return;
        }
        const [a, c] = await Promise.all([
          aiAccountGet<AiAccount>("/me"),
          aiAccountGet<{ professions: AiProfession[] }>("/catalogue"),
        ]);
        if (active) {
          setAccount(a);
          setValue(
            a.enrollment?.details || {
              kind: "PERSONAL",
              country: "Nigeria",
              attestation: true,
            },
          );
          setProfessions(c.professions);
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, [navigate]);
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const a = await aiAccountPost<AiAccount>("/enrollment", {
        expectedVersion: account?.enrollment?.version || 0,
        enrollment: value,
      });
      setAccount(a);
      setNotice(
        value.kind === "PERSONAL"
          ? "Personal account selected."
          : "Application submitted for review. Your currently enabled features remain available.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <AiAuthShell wide>
      <div className="sai-form-content">
        <p className="sai-eyebrow">YOUR SABI AI ACCOUNT</p>
        <h2>A space that fits you.</h2>
        <p className="sai-intro">
          Current access: {account?.category.toLowerCase() || "loading…"}.
          Application:{" "}
          {account?.enrollment?.status.toLowerCase() || "not submitted"}.
        </p>
        {account?.enrollment?.decisionReason && (
          <p className="sai-review-note">
            Review note: {account.enrollment.decisionReason}
          </p>
        )}
        <form className="sai-form" onSubmit={save}>
          <AiEnrollmentFields
            value={value}
            onChange={setValue}
            professions={professions}
          />
          <label className="sai-checkbox">
            <input type="checkbox" required />
            <span>
              I confirm these details are accurate and authorise Sabi to verify
              them with the issuing body.
            </span>
          </label>
          {error && (
            <p role="alert" className="sai-error">
              {error}
            </p>
          )}
          {notice && (
            <p className="sai-success" role="status">
              {notice}
            </p>
          )}
          <button className="sai-primary" disabled={busy || !account}>
            {busy ? "Submitting…" : "Save account application"}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </form>
        <Link className="sai-back" to="/ai/workspace">
          Back to your conversations
        </Link>
      </div>
    </AiAuthShell>
  );
}
export function AiVerifyEmail() {
  const { uid } = useParams();
  const location = useLocation();
  const [token] = useState(() => location.hash.slice(1));
  const [state, setState] = useState("Ready to verify your email."),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  useEffect(() => {
    if (location.hash) window.history.replaceState(null, "", location.pathname);
  }, [location.hash, location.pathname]);
  async function verify() {
    setBusy(true);
    try {
      await liveApiRequest("/api/v1/auth/email-verification/confirm", {
        method: "POST",
        body: JSON.stringify({ uid, token }),
      });
      setState("Email verified. You can now sign in to Sabi AI.");
      setDone(true);
    } catch (e) {
      setState(
        e instanceof Error ? e.message : "Verification could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <AiAuthShell>
      <div className="sai-form-content">
        <p className="sai-eyebrow">YOUR SABI ID</p>
        <h2>A quick hello.</h2>
        <p className="sai-intro" role="status">
          {state}
        </p>
        {!done && (
          <button
            className="sai-primary"
            disabled={busy || !token}
            onClick={verify}
          >
            {busy ? "Verifying…" : "Verify my email"}
          </button>
        )}
        <Link className="sai-back" to="/ai/login">
          Continue to sign in
        </Link>
      </div>
    </AiAuthShell>
  );
}
