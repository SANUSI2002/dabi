import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link, useLocation, useMatch, useNavigate } from "react-router-dom";
import { Bike, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import {
  liveApiRequest,
  liveSignIn,
  liveSignOut,
  restoreLiveIdentity,
  type LiveIdentity,
  type LiveApiError,
} from "@/identity/liveIdentity";
import { getLive, writeLive } from "./riderApi";
import type {
  RiderApplication,
  RiderRegistrationConfig,
} from "./onboardingTypes";
import "./rider.css";
import { RiderAuthLayout, RiderPasswordField } from "./RiderAuthLayout";
const root = "/api/v1/riders";
function Frame({ children, auth = false, registration = false }: { children: ReactNode; auth?: boolean; registration?: boolean }) {
  if (auth) return <RiderAuthLayout registration={registration}>{children}</RiderAuthLayout>;
  return (
    <div className="sabi-rider rider-application">
      <header>
        <Link className="rider-brand" to="/rider/login">
          <span>
            <Bike size={25} />
          </span>
          <div>
            <strong>Sabi Health</strong>
            <small>RIDER PARTNERS</small>
          </div>
        </Link>
        <Link to="/rider/application">My application</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
type Profile = {
  fullName: string;
  phone: string;
  state: string;
  city: string;
  vehicleType: string;
  licenceExpiresAt: string;
  insuranceExpiresAt: string;
};
const empty: Profile = {
  fullName: "",
  phone: "",
  state: "",
  city: "",
  vehicleType: "MOTORCYCLE",
  licenceExpiresAt: "",
  insuranceExpiresAt: "",
};
function ProfileFields({
  values,
  set,
  disabled,
}: {
  values: Profile;
  set: (value: Profile) => void;
  disabled: boolean;
}) {
  const [minimumExpiry] = useState(() =>
    new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  );
  return (
    <fieldset className="rider-application-grid" disabled={disabled}>
      <legend>Rider and vehicle details</legend>
      {(
        [
          "fullName",
          "phone",
          "state",
          "city",
          "licenceExpiresAt",
          "insuranceExpiresAt",
        ] as const
      ).map((key) => (
        <label key={key}>
          {
            {
              fullName: "Full name",
              phone: "Phone number",
              state: "State",
              city: "City",
              licenceExpiresAt: "Driving licence expiry",
              insuranceExpiresAt: "Insurance expiry",
            }[key]
          }
          <input
            required
            type={
              key.endsWith("ExpiresAt")
                ? "date"
                : key === "phone"
                  ? "tel"
                  : "text"
            }
            min={key.endsWith("ExpiresAt") ? minimumExpiry : undefined}
            maxLength={key === "fullName" ? 160 : key === "phone" ? 30 : 100}
            value={values[key]}
            onChange={(e) => set({ ...values, [key]: e.target.value })}
          />
        </label>
      ))}
      <label>
        Vehicle type
        <select
          value={values.vehicleType}
          onChange={(e) => set({ ...values, vehicleType: e.target.value })}
        >
          <option value="MOTORCYCLE">Motorcycle</option>
          <option value="CAR">Car</option>
        </select>
      </label>
    </fieldset>
  );
}
export default function RiderOnboarding() {
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  const verifyRoute = useMatch("/rider/verify-email/:uid");
  const registering = pathname === "/rider/register";
  const [token, setToken] = useState(hash.slice(1));
  const verifyUid = verifyRoute?.params.uid;
  const [config, setConfig] = useState<RiderRegistrationConfig | null>(null);
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [application, setApplication] = useState<RiderApplication | null>(null);
  const scanning = !!application?.credentials.some(
    (d) => d.scanStatus === "PENDING",
  );
  const [profile, setProfile] = useState<Profile>(empty);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [created, setCreated] = useState(false);
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const gate = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const refresh = useCallback(async () => {
    try {
      setApplication(await getLive<RiderApplication>(`${root}/me`));
    } catch (cause) {
      if ((cause as LiveApiError).status === 404) setApplication(null);
      else throw cause;
    }
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setApplication(null);
    setError("");
    setNotice("");
    setCreated(false);
    setVerified(false);
    (async () => {
      try {
        const settings = await getLive<RiderRegistrationConfig>(
          `${root}/registration-config`,
        );
        if (active) setConfig(settings);
        if (!registering && !verifyUid) {
          const current = await restoreLiveIdentity();
          if (active) {
            setIdentity(current);
            if (current) await refresh();
          }
        }
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load rider registration.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [registering, verifyUid, refresh]);
  useEffect(() => {
    if (verifyUid && hash) navigate(pathname, { replace: true });
  }, [verifyUid, hash, pathname, navigate]);
  useEffect(() => {
    if (!scanning || busy) return;
    let stopped = false,
      polling = false;
    const timer = setInterval(async () => {
      if (polling || gate.current || document.visibilityState !== "visible")
        return;
      polling = true;
      try {
        const app = await getLive<RiderApplication>(`${root}/me`);
        if (!stopped && !gate.current) setApplication(app);
      } catch (cause) {
        if (!stopped)
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to refresh screening.",
          );
      } finally {
        polling = false;
      }
    }, 10000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [busy, scanning]);
  async function run(work: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to save. Please retry.",
      );
    } finally {
      gate.current = false;
      setBusy(false);
    }
  }
  async function upload(kind: string, file: File | undefined) {
    if (!file || !application) return;
    await run(async () => {
      if (!["application/pdf", "image/png", "image/jpeg"].includes(file.type))
        throw new Error("Choose a PDF, PNG or JPEG file.");
      if (!file.size || file.size > application.maxUploadBytes)
        throw new Error(
          `Choose a file up to ${(application.maxUploadBytes / 1024 / 1024).toFixed(1)} MB.`,
        );
      await liveApiRequest(
        `${root}/applications/${application.id}/credentials/${kind}`,
        {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
          signal: AbortSignal.timeout(60000),
        },
      );
      setNotice(
        "Document received. Security screening is running in the background.",
      );
      await refresh();
    });
  }
  const canEdit =
    !!application &&
    [
      "DRAFT",
      "SUBMITTED",
      "CHANGES_REQUESTED",
      "REJECTED",
      "APPROVED",
    ].includes(application.status);
  return (
    <Frame auth={registering || !!verifyRoute || !identity} registration={registering || (!!identity && !application)}>
      <p className="rider-eyebrow">Your next chapter, on the move</p>
      <h1>
        {verifyRoute
          ? "Verify your rider email"
          : registering
            ? "Join the Sabi rider network"
            : "Your rider application"}
      </h1>
      <p className="rider-muted">{registering ? "Start with your details. Verify your email, then add your rider documents for review." : verifyRoute ? "One quick confirmation to secure your rider account." : "Manage your details, documents and application status in one place."}</p>
      {error && (
        <p className="rider-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rider-notice" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">
          <LoaderCircle className="animate-spin" /> Loading application…
        </p>
      ) : verifyRoute ? (
        <section className="rider-card">
          <ShieldCheck />
          <h2>{verified ? "Email verified" : "Confirm your email address"}</h2>
          {verified ? (
            <Link className="rider-button" to="/rider/application">
              Continue to application
            </Link>
          ) : (
            <>
              <p>
                Confirm this link to finish email verification. Links expire
                after 24 hours.
              </p>
              <button
                className="rider-button"
                disabled={busy || !token}
                onClick={() =>
                  run(async () => {
                    await writeLive(`${root}/verify-email`, {
                      uid: verifyRoute.params.uid,
                      token,
                    });
                    setToken("");
                    navigate(pathname, { replace: true });
                    setVerified(true);
                  })
                }
              >
                Verify email
              </button>
              <Link to="/rider/application">
                Request a new verification email
              </Link>
            </>
          )}
        </section>
      ) : created ? (
        <section className="rider-card" role="status">
          <CheckCircle2 />
          <h2>Account created. Check your email.</h2>
          <p>
            Verify your email, then sign in to upload your documents and submit
            your application. Delivery access starts after approval.
          </p>
          <Link className="rider-button" to="/rider/application">
            Continue
          </Link>
        </section>
      ) : registering || (identity && !application) ? (
        <form
          className="rider-card rider-form"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              if (!config?.enabled)
                throw new Error("Registration is temporarily unavailable.");
              const data = {
                ...profile,
                consent: true,
                consentVersion: config.consentVersion,
              };
              if (registering) {
                const result = await writeLive<{ emailSent: boolean }>(
                  `${root}/register`,
                  { ...data, email, password },
                );
                setPassword("");
                setCreated(true);
                if (!result.emailSent)
                  setNotice(
                    "Your account was created, but verification email delivery was interrupted. Request a new email from My application.",
                  );
              } else {
                await writeLive(`${root}/applications`, data);
                await refresh();
                setNotice("Application created. Add your documents below.");
              }
            });
          }}
        >
          {registering && (
            <fieldset className="rider-access-account-fields">
              <legend>Your account</legend>
              <label>
                Email address
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <RiderPasswordField id="rider-signup-password" value={password} onChange={setPassword} disabled={busy} newPassword />
            </fieldset>
          )}
          <ProfileFields values={profile} set={setProfile} disabled={busy} />
          <label className="rider-consent">
            <input
              required
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            I consent to credential verification and malware screening of my
            uploaded documents.
          </label>
          <button
            className="rider-button"
            disabled={busy || !config?.enabled || !consent}
          >
            {busy
              ? "Creating application…"
              : registering
                ? "Create rider account"
                : "Create application"}
          </button>
          {!config?.enabled && (
            <p role="status">
              Registration is temporarily unavailable. Please try again later.
            </p>
          )}
          {registering && (
            <p>
              Already have a Sabi account?{" "}
              <Link to="/rider/application">Sign in to apply</Link>
            </p>
          )}
        </form>
      ) : !identity ? (
        <section className="rider-card">
          <h2>Sign in to continue</h2>
          <form
            className="rider-form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                const result = await liveSignIn(email, password);
                setPassword("");
                if (result.kind === "MFA") {
                        navigate("/mfa?context=rider-onboarding");
                  return;
                }
                setIdentity(result.identity);
                await refresh();
              });
            }}
          >
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
            <RiderPasswordField id="rider-application-password" value={password} onChange={setPassword} disabled={busy} />
            <button className="rider-button" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p>
            <Link to="/forgot-password">Forgot password?</Link> ·{" "}
            <Link to="/rider/register">Create an account</Link>
          </p>
          <button
            className="rider-button-secondary"
            disabled={busy || !email}
            onClick={() =>
              run(async () => {
                const response = await writeLive<{ message: string }>(
                  `${root}/resend-verification`,
                  { email },
                );
                setNotice(response.message);
              })
            }
          >
            Resend verification email
          </button>
        </section>
      ) : (
        application && (
          <>
            <section className="rider-card">
              <div className="rider-row">
                <div>
                  <h2>{application.fullName}</h2>
                  <p>
                    {application.email} · {application.city},{" "}
                    {application.state}
                  </p>
                </div>
                <span className="rider-status">
                  {application.status.replaceAll("_", " ")}
                </span>
              </div>
              <p className="rider-caption">
                Application reference: {application.id}
              </p>
              {application.decisionReason && (
                <p>{application.decisionReason}</p>
              )}
              {application.status === "SUBMITTED" && (
                <p role="status">
                  Your application has been received. We will email you after
                  operations review.
                </p>
              )}
              {application.status === "APPROVED" && (
                <p>
                  Updating your details or replacing a document pauses delivery
                  access until the renewed application is approved.
                </p>
              )}
              {application.status === "APPROVED" && (
                <Link className="rider-button" to="/rider/login">
                  Sign in to deliveries
                </Link>
              )}
              <div className="rider-row">
                <button
                  className="rider-button-secondary"
                  disabled={busy}
                  onClick={() => run(refresh)}
                >
                  Refresh status
                </button>
                <button
                  className="rider-button-secondary"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await liveSignOut();
                      setIdentity(null);
                      setApplication(null);
                    })
                  }
                >
                  Sign out
                </button>
              </div>
            </section>
            <div className="rider-application-grid">
              {application.requirements.map((requirement) => {
                const doc = application.credentials.find(
                  (d) => d.kind === requirement.kind,
                );
                return (
                  <section className="rider-card" key={requirement.kind}>
                    <h2>{requirement.label}</h2>
                    <p>
                      {doc
                        ? `Security screening: ${doc.scanStatus} · Review: ${doc.reviewStatus}`
                        : "No document uploaded yet"}
                    </p>
                    {doc?.scanStatus === "FAILED" && (
                      <p>
                        Security screening could not finish. Operations can
                        retry the check; you may replace the document.
                      </p>
                    )}
                    {doc &&
                      ["INFECTED", "REJECTED"].includes(doc.scanStatus) && (
                        <p role="alert">
                          This file did not pass the security check. Upload a
                          safe replacement.
                        </p>
                      )}
                    {canEdit && (
                      <label>
                        {doc ? "Replace document" : "Choose document"}
                        <input
                          aria-label={`${requirement.label} document`}
                          disabled={busy}
                          type="file"
                          accept="application/pdf,image/png,image/jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            void upload(requirement.kind, file);
                          }}
                        />
                        <small>
                          PDF, PNG or JPEG, up to{" "}
                          {(application.maxUploadBytes / 1024 / 1024).toFixed(
                            1,
                          )}{" "}
                          MB. Upload begins automatically.
                        </small>
                      </label>
                    )}
                  </section>
                );
              })}
            </div>
            {canEdit && (
              <>
                <button
                  className="rider-button"
                  disabled={
                    busy ||
                    application.status === "SUBMITTED" ||
                    application.credentials.length <
                      application.requirements.length
                  }
                  onClick={() =>
                    run(async () => {
                      await writeLive(
                        `${root}/applications/${application.id}/submit`,
                        { version: application.version },
                      );
                      setNotice(
                        `Application submitted successfully. Reference: ${application.id}. We will email you when your review is complete.`,
                      );
                      await refresh();
                    })
                  }
                >
                  {busy
                    ? "Saving…"
                    : application.status === "SUBMITTED"
                      ? "Submitted for review"
                      : "Submit application"}
                </button>
                <details className="rider-card">
                  <summary>Edit rider or expiry details</summary>
                  <DetailsForm
                    application={application}
                    busy={busy}
                    consentVersion={config?.consentVersion || ""}
                    save={(data) =>
                      run(async () => {
                        await writeLive(
                          `${root}/applications/${application.id}`,
                          { ...data, version: application.version },
                          "PATCH",
                        );
                        await refresh();
                        setNotice(
                          "Details updated. Submit your application again after checking your documents.",
                        );
                      })
                    }
                  />
                </details>
              </>
            )}
          </>
        )
      )}
    </Frame>
  );
}
function DetailsForm({
  application,
  busy,
  consentVersion,
  save,
}: {
  application: RiderApplication;
  busy: boolean;
  consentVersion: string;
  save: (data: Profile & { consent: true; consentVersion: string }) => void;
}) {
  const [values, set] = useState<Profile>({
    fullName: application.fullName,
    phone: application.phone,
    state: application.state,
    city: application.city,
    vehicleType: application.vehicleType,
    licenceExpiresAt: application.licenceExpiresAt.slice(0, 10),
    insuranceExpiresAt: application.insuranceExpiresAt.slice(0, 10),
  });
  return (
    <form
      className="rider-form"
      onSubmit={(e) => {
        e.preventDefault();
        save({ ...values, consent: true, consentVersion });
      }}
    >
      <ProfileFields values={values} set={set} disabled={busy} />
      <p>
        Changing details resets the application to draft and requires a new
        document review.
      </p>
      <button className="rider-button-secondary" disabled={busy}>
        Save details
      </button>
    </form>
  );
}
