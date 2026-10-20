import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import AiWorkspace, { type AiRequest } from '../../apps/telemedicine/packages/shared-portal/ai/AiWorkspace.jsx';
import { liveApiRequest, liveSignIn, liveSignOut, liveVerifyMfa, restoreLiveIdentity, type LiveIdentity } from '@/identity/liveIdentity';

let refreshing: Promise<LiveIdentity | null> | null = null;
const request: AiRequest = async (path, options = {}) => {
  const init = { ...options, cache: 'no-store' as const, body: options.body === undefined ? undefined : JSON.stringify(options.body) };
  try { return await liveApiRequest(path, init); }
  catch (error) {
    if ((error as { status?: number }).status !== 401) throw error;
    refreshing ??= restoreLiveIdentity().finally(() => { refreshing = null; });
    if (!await refreshing) throw error;
    return liveApiRequest(path, init);
  }
};

export default function AiEntry() {
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mfa, setMfa] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    document.title = 'Your workspace | Sabi AI';
    restoreLiveIdentity().then((data) => { if (mounted) setIdentity(data); }).catch(() => {}).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (mfa) { setIdentity(await liveVerifyMfa(code)); setCode(''); }
      else {
        const result = await liveSignIn(email.trim(), password);
        setPassword('');
        if (result.kind === 'MFA') setMfa(true); else setIdentity(result.identity);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign-in could not be completed.'); }
    finally { setBusy(false); }
  }
  if (loading) return <main className="grid min-h-dvh place-items-center bg-[#f7f8f4] text-[#14382d]"><p role="status" className="flex items-center gap-3"><Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Opening Sabi AI…</p></main>;
  if (identity) return <div><div className="flex justify-end border-b border-[#d7e2da] bg-[#eef3ed] px-5 py-1"><button type="button" className="min-h-11 text-sm font-semibold text-[#11664f]" onClick={async () => { await liveSignOut(); setIdentity(null); setMfa(false); }}>Sign out</button></div><AiWorkspace key={identity.user.id} request={request} accountName={identity.user.fullName || identity.user.email} homeHref="/ai" embedded /></div>;
  return <main className="flex min-h-dvh items-center justify-center bg-[#f7f8f4] px-5 py-12 text-[#14382d]"><div className="w-full max-w-md"><Link className="mb-10 inline-flex min-h-11 items-center gap-3 text-xl font-semibold" to="/ai"><Sparkles size={25} aria-hidden="true" /> Sabi AI</Link><h1 className="font-display text-4xl font-semibold tracking-tight">A clearer way to care.</h1><p className="mt-4 leading-7 text-[#52675e]">{mfa ? 'Complete your existing Sabi ID two-step verification.' : 'Sign in with your Sabi ID to keep your conversations together.'}</p><form onSubmit={signIn} className="mt-8 space-y-5">{mfa ? <label className="block text-sm font-semibold">Authenticator code<input className="mt-2 min-h-12 w-full rounded-xl border border-[#b4c9bd] bg-white px-4 text-base" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} /></label> : <><label className="block text-sm font-semibold">Email address<input className="mt-2 min-h-12 w-full rounded-xl border border-[#b4c9bd] bg-white px-4 text-base" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><label className="block text-sm font-semibold">Password<input className="mt-2 min-h-12 w-full rounded-xl border border-[#b4c9bd] bg-white px-4 text-base" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label></>}{error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}<button className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#11664f] px-5 font-semibold text-white disabled:opacity-50" disabled={busy} type="submit">{busy && <Loader2 size={18} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}{busy ? 'Checking your account…' : mfa ? 'Verify and continue' : 'Sign in to Sabi AI'}</button></form><div className="mt-6 flex justify-between text-sm text-[#11664f]"><Link className="inline-flex min-h-11 items-center" to="/forgot-password">Forgot password?</Link><Link className="inline-flex min-h-11 items-center" to="/register">Create a Sabi ID</Link></div><p className="mt-6 text-xs leading-6 text-[#52675e]">Existing professional and hospital privileges stay separate. Signing in here does not grant access to patient records or clinical tools.</p></div></main>;
}
