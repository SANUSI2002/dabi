import CareStory from "../../../../shared-portal/CareStory";
import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  HeartPulse,
} from "lucide-react";
import { restoreSession, signIn, verifyMfaLogin } from "../../utils/sabiIdentity";
import { useEffect } from "react";
import { DOCTOR_PORTAL_URL } from "../../ecosystemLinks";
import { signedOutForInactivity } from "../../../../shared-portal/idleTimeout.js";

export default function SabiHealthLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaValue, setMfaValue] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  useEffect(() => { restoreSession().then((user) => { if (user) navigate('/dashboard', { replace: true }); }, () => { /* server busy: stay on the sign-in page */ }); }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setError(""); setVerificationRequired(false);
    try {
      if (mfaRequired) { await verifyMfaLogin(mfaValue, useRecovery); navigate('/dashboard', { replace: true }); }
      else {
        const result = await signIn(email, password);
        if (result.mfaRequired) setMfaRequired(true);
        else navigate("/dashboard", { replace: true });
      }
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Sign-in failed.'); setVerificationRequired(cause?.code === 'EMAIL_VERIFICATION_REQUIRED'); }
    finally { setBusy(false); }
  };

  return (
    <div className="sabi-patient-login min-h-screen w-full flex bg-white relative overflow-hidden">
      {/* Ambient decorative blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 w-[32rem] h-[32rem] rounded-full bg-emerald-100/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 w-96 h-96 rounded-full bg-teal-50 blur-3xl" />

      {/* Left panel - form */}
      <div className="sabi-patient-login-form w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-10 lg:px-14 py-6 relative z-10">
        <div className="w-full max-w-sm mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-900/20">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-900 to-emerald-600 bg-clip-text text-transparent">
              Sabi Health
            </h1>
          </div>
          <p className="mt-2 text-sm text-gray-500 italic">Precision Care, Compassionate Vision.</p>

          <div className="mt-4">
            <h2 className="text-xl font-bold text-gray-900">Welcome back 👋</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter your credentials to access your health dashboard.
            </p>
          </div>

          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="patient-login-email" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 group-focus-within:text-emerald-700 transition-colors" />
                <input
                  id="patient-login-email"
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label htmlFor="patient-login-password" className="block text-sm font-semibold text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500 group-focus-within:text-emerald-700 transition-colors" />
                <input
                  id="patient-login-password"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-700 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span className="text-sm text-gray-600">Remember me</span>
              </label>
           <Link
            to="/forgot-password"
            className="text-xs text-emerald-700 font-semibold hover:underline"
          >
            Forgot password?
          </Link>
            </div>

            {mfaRequired && <div><label htmlFor="patient-login-mfa" className="block text-sm font-semibold text-gray-700 mb-1.5">{useRecovery ? 'Recovery code' : 'Six-digit authenticator code'}</label><input id="patient-login-mfa" className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm" autoComplete="one-time-code" required value={mfaValue} onChange={(event) => setMfaValue(useRecovery ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))} /><button type="button" className="mt-2 text-xs font-semibold text-emerald-700" onClick={() => { setUseRecovery(!useRecovery); setMfaValue(''); setError(''); }}>{useRecovery ? 'Use authenticator app' : 'Use a recovery code'}</button></div>}

            {location.state?.verified && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Your email is verified. Sign in to continue.</p>}
            {signedOutForInactivity(location.search) && <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">For your security, you were signed out after 5 minutes of inactivity. Please sign in again.</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            {verificationRequired && <Link to="/verify-email" state={{ email }} className="inline-block text-sm font-semibold text-emerald-700 underline">Request a new verification email</Link>}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-800 to-teal-700 text-white font-semibold text-sm shadow-md shadow-emerald-900/25 hover:shadow-lg hover:shadow-emerald-900/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              {busy ? 'Checking identity…' : mfaRequired ? 'Verify and Sign In' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] font-semibold tracking-widest text-gray-400 whitespace-nowrap">
              OR CONTINUE WITH
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled
              title="Available when Sabi Identity OIDC is configured"
              aria-describedby="patient-login-social-note"
              className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-gray-200 bg-white opacity-60 cursor-not-allowed"
            >
              <GoogleIcon />
              <span className="font-semibold text-sm text-gray-800">Google</span>
            </button>
            <button
              type="button"
              disabled
              title="Available when Sabi Identity OIDC is configured"
              aria-describedby="patient-login-social-note"
              className="flex items-center justify-center gap-2 min-h-[44px] rounded-xl border border-gray-200 bg-white opacity-60 cursor-not-allowed"
            >
              <AppleIcon />
              <span className="font-semibold text-sm text-gray-800">Apple</span>
            </button>
          </div>

          <p id="patient-login-social-note" className="text-center text-xs text-gray-500 mt-2">Google and Apple sign-in are coming soon. Use your email and password for now.</p>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => navigate("/signup")}
              className="text-emerald-700 font-bold hover:underline"
            >
              Sign up
            </button>
          </p>

          <p className="mt-4 text-center text-sm text-gray-500">Healthcare professional? <a href={`${DOCTOR_PORTAL_URL}/login`} className="font-semibold text-emerald-700 hover:underline">Open Professional Portal</a></p>
          <div className="flex items-center justify-center gap-1.5 mt-4 text-gray-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[11px] font-medium tracking-wide">SECURE SABI IDENTITY SIGN-IN</span>
          </div>
        </div>
      </div>

      <CareStory />
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28V6.61H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.39l4-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.61l4 3.11C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 384 512" fill="black">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
    </svg>
  );
}
