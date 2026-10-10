import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { Pill, ShieldCheck } from "lucide-react";
import { apiConfigured } from "@/config/runtime";
import { getLive, writeLive, type PharmacyTier } from "./liveApi";
const input =
  "mt-1 min-h-11 w-full rounded-xl border border-[#cfe0d8] bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#0b8a63]";
const button =
  "min-h-11 rounded-xl bg-[#0d2c22] px-5 py-3 text-sm font-bold text-white disabled:opacity-50";
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f5f8f4] px-4 py-8 text-[#17342a]">
      <div className="mx-auto max-w-3xl">
        <Link
          to="/pharmacy/login"
          className="mb-7 inline-flex min-h-11 items-center gap-3 font-display text-xl font-bold"
        >
          <Pill className="text-[#0b8a63]" />
          Sabi Pharmacy
        </Link>
        <section className="rounded-3xl border border-[#dbe9e2] bg-white p-5 shadow-sm sm:p-8">
          {children}
        </section>
      </div>
    </main>
  );
}
export default function PharmacyRegistrationPage() {
  const [tiers, setTiers] = useState<PharmacyTier[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(""),
    [email, setEmail] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (apiConfigured)
      getLive<{ tiers: PharmacyTier[] }>(
        "/api/v1/pharmacy-portal/registration-config",
      )
        .then((r) => setTiers(r.tiers))
        .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const values = new FormData(e.currentTarget);
    const email = String(values.get("email")).trim();
    setEmail(email);
    try {
      const result = await writeLive<{ message: string }>(
        "/api/v1/pharmacy-portal/register",
        {
          email,
          password: values.get("password"),
          fullName: values.get("fullName"),
          phoneNumber: values.get("phone"),
          name: values.get("name"),
          address: values.get("address"),
          country: "Nigeria",
          state: values.get("state"),
          city: values.get("city"),
          contactEmail: values.get("contactEmail"),
          contactPhone: values.get("contactPhone"),
          tierLevel: Number(values.get("tierLevel")),
          regulatory: {
            cacNumber: values.get("cac"),
            superintendentName: values.get("superintendent"),
            superintendentRegistrationNumber: values.get("pcn"),
            superintendentLicenceExpiresAt: new Date(
              `${values.get("expiry")}T23:59:59.999Z`,
            ).toISOString(),
          },
          termsAccepted: values.get("terms") === "on",
          privacyAccepted: values.get("privacy") === "on",
        },
      );
      setDone(result.message);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Registration failed. Please check your information.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      await writeLive("/api/v1/pharmacy-portal/resend-verification", { email });
      setDone(
        "If this account needs email verification, a fresh link has been requested.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not request verification.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout>
      <p className="text-xs font-bold uppercase tracking-widest text-[#5b766a]">
        For pharmacy organizations
      </p>
      <h1 className="mt-3 font-display text-3xl font-bold">
        Register your pharmacy
      </h1>
      <p className="mt-3 text-base leading-7 text-[#5b766a]">
        Create your business account, verify your email, then submit your
        credentials and branch licences for independent review. Registration
        does not grant marketplace approval.
      </p>
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800 outline-none"
        >
          {error}
        </p>
      )}
      {!apiConfigured ? (
        <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          This local-storage preview does not create live pharmacy accounts. The
          connected registration workflow is available on the pharmacy
          deployment.
        </p>
      ) : done ? (
        <div className="mt-6 space-y-4">
          <div
            role="status"
            className="rounded-xl bg-emerald-50 p-5 text-emerald-900"
          >
            <ShieldCheck aria-hidden="true" />
            <h2 className="mt-3 font-bold">Registration received</h2>
            <p className="mt-2 text-sm leading-6">{done}</p>
            <p className="mt-2 text-sm">Email: {email}</p>
          </div>
          <button disabled={busy} className={button} onClick={resend}>
            Resend verification email
          </button>
          <Link
            className="ml-4 inline-flex min-h-11 items-center text-sm font-bold"
            to="/pharmacy/login"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-7">
          <fieldset>
            <legend className="text-lg font-bold">Organization</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["name", "Registered pharmacy name", "text"],
                ["address", "Registered business address", "text"],
                ["state", "State", "text"],
                ["city", "City", "text"],
                ["contactEmail", "Business email", "email"],
                ["contactPhone", "Business phone", "tel"],
                ["cac", "CAC registration number", "text"],
              ].map(([name, label, type]) => (
                <label className="text-sm font-semibold" key={name}>
                  {label}
                  <input
                    required
                    name={name}
                    type={type}
                    maxLength={name === "address" ? 300 : 160}
                    className={input}
                  />
                </label>
              ))}
              <label className="text-sm font-semibold">
                Requested tier
                <select required name="tierLevel" className={input}>
                  {tiers.map((tier) => (
                    <option key={tier.level} value={tier.level}>
                      Tier {tier.level}: {tier.commissionBps / 100}% ·{" "}
                      {tier.deliveryRadiusKm} km ·{" "}
                      {tier.maxBranches ?? "multiple"} branches
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-lg font-bold">
              Superintendent pharmacist
            </legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["superintendent", "Full name", "text"],
                ["pcn", "PCN registration number", "text"],
                ["expiry", "Current licence expiry", "date"],
              ].map(([name, label, type]) => (
                <label className="text-sm font-semibold" key={name}>
                  {label}
                  <input required name={name} type={type} className={input} />
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="text-lg font-bold">Administrator account</legend>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {[
                ["fullName", "Administrator name", "text"],
                ["email", "Sabi ID email", "email"],
                ["phone", "Phone number", "tel"],
                ["password", "Create password", "password"],
              ].map(([name, label, type]) => (
                <label className="text-sm font-semibold" key={name}>
                  {label}
                  <input
                    required
                    name={name}
                    type={type}
                    minLength={name === "password" ? 12 : undefined}
                    maxLength={name === "password" ? 128 : 160}
                    autoComplete={
                      name === "password"
                        ? "new-password"
                        : name === "email"
                          ? "email"
                          : undefined
                    }
                    className={input}
                  />
                </label>
              ))}
            </div>
            <p className="mt-3 text-sm text-[#5b766a]">
              Password: at least 12 characters, with an uppercase letter,
              lowercase letter and number. Existing Sabi account holders should
              contact support rather than create a duplicate identity.
            </p>
          </fieldset>
          <div className="space-y-3 text-sm">
            <label className="flex min-h-11 items-center gap-3">
              <input required type="checkbox" name="terms" />I accept the Sabi
              platform terms and attest that these business details are
              accurate.
            </label>
            <label className="flex min-h-11 items-center gap-3">
              <input required type="checkbox" name="privacy" />I accept the
              privacy policy and processing of business credentials for
              verification. Credential files are stored privately in Supabase
              and sent to Cloudmersive for malware screening.
            </label>
          </div>
          <button
            disabled={busy || !tiers.length}
            className={`${button} w-full`}
          >
            {busy ? "Creating your account…" : "Create pharmacy account"}
          </button>
          <Link
            to="/pharmacy/login"
            className="inline-flex min-h-11 items-center text-sm font-semibold"
          >
            Already registered? Sign in
          </Link>
        </form>
      )}
    </Layout>
  );
}
export function PharmacyVerifyEmailPage() {
  const { uid } = useParams();
  const [token] = useState(() => window.location.hash.slice(1));
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState(""),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await writeLive("/api/v1/pharmacy-portal/verify-email", { uid, token });
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Verification could not be completed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Layout>
      <ShieldCheck className="text-[#0b8a63]" aria-hidden="true" />
      <h1 className="mt-4 font-display text-3xl font-bold">
        {done ? "Email verified" : "Verify your pharmacy email"}
      </h1>
      <p className="mt-3 text-base leading-7 text-[#5b766a]">
        {done
          ? "Your administrator account is ready. Sign in to submit business credentials and premises licences for review."
          : "Confirm this email address to continue your pharmacy registration."}
      </p>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm">
          {message}
        </p>
      )}
      {done ? (
        <Link
          to="/pharmacy/login"
          className={`${button} mt-5 inline-flex items-center`}
        >
          Sign in to pharmacy
        </Link>
      ) : (
        <>
          <button
            disabled={busy || !token || !uid || !apiConfigured}
            className={`${button} mt-5`}
            onClick={confirm}
          >
            {busy ? "Verifying…" : "Confirm email"}
          </button>
          <form
            className="mt-7 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              try {
                await writeLive("/api/v1/pharmacy-portal/resend-verification", {
                  email,
                });
                setMessage(
                  "If verification is needed, a new link has been requested.",
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Could not request email.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm font-semibold">
              Need a fresh link?
              <input
                required
                type="email"
                autoComplete="email"
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <button
              disabled={busy || !apiConfigured}
              className="min-h-11 rounded-lg border px-4 text-sm font-semibold"
            >
              Resend verification
            </button>
          </form>
        </>
      )}
    </Layout>
  );
}
