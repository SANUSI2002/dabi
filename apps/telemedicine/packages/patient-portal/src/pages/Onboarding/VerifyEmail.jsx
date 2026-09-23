import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle2, MailCheck, ShieldCheck } from 'lucide-react';
import { confirmEmailVerification, requestEmailVerification } from '../../utils/sabiIdentity';

export default function VerifyEmail() {
  const { uid } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => window.location.hash.slice(1));
  const [email, setEmail] = useState(location.state?.email || '');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState(location.state?.emailSent === false ? 'We could not send the first email. Request a new link below.' : '');
  const [error, setError] = useState('');

  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  }, []);
  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setTimeout(() => setCooldown((remaining) => remaining - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function verify(event) {
    event.preventDefault();
    if (!uid || !token) return;
    setBusy(true); setError('');
    try {
      await confirmEmailVerification(uid, token);
      navigate('/login', { replace: true, state: { verified: true } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This verification link could not be used.');
    } finally { setBusy(false); }
  }

  async function resend(event) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      await requestEmailVerification(email.trim());
      setMessage('If an unverified account exists, a new link is on its way. Check your inbox and spam folder.');
      setCooldown(60);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not request a new link.');
    } finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-5 py-12">
    <div className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-8 shadow-xl shadow-emerald-950/5">
      <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-800">{uid && token ? <ShieldCheck size={28} /> : <MailCheck size={28} />}</div>
      <p className="text-xs font-extrabold uppercase tracking-[.2em] text-emerald-700">Sabi Health identity</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{uid && token ? 'Verify your email' : 'Check your email'}</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">{uid && token ? 'Confirm your email address to activate your patient account. This link works once and expires after 24 hours.' : 'We sent a verification link after registration. Open it to activate your account before signing in.'}</p>
      {uid && token && <form onSubmit={verify} className="mt-7"><button type="submit" disabled={busy} className="w-full rounded-xl bg-emerald-800 px-5 py-3 font-bold text-white disabled:opacity-60">{busy ? 'Verifying…' : 'Verify email and continue'}</button></form>}
      {message && <p role="status" className="mt-5 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-7 border-t border-slate-100 pt-6">
        <p className="text-sm font-semibold text-slate-800">Need another link?</p>
        <form onSubmit={resend} className="mt-3 space-y-3">
          <label className="block text-xs font-semibold text-slate-600" htmlFor="verification-email">Email address</label>
          <input id="verification-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-600" placeholder="you@example.com" />
          <button type="submit" disabled={busy || cooldown > 0} className="w-full rounded-xl border border-emerald-700 px-5 py-3 text-sm font-bold text-emerald-800 disabled:opacity-50">{cooldown > 0 ? `Try again in ${cooldown}s` : 'Resend verification email'}</button>
        </form>
      </div>
      <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><CheckCircle2 size={16} /> Already verified? Sign in</Link>
    </div>
  </main>;
}
