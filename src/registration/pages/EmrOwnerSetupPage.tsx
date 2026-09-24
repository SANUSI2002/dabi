import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Building2, Loader2, ShieldCheck } from 'lucide-react';
import { liveCompleteEmrSetup, livePreviewEmrSetup } from '../livePlatform';
import { EMR_SIGN_IN_URL, SABI_HEALTH_URL } from '@/public/ecosystemLinks';

type Preview = { organizationName: string; email: string; setupDeadlineAt: string; existingAccount: boolean };

export default function EmrOwnerSetupPage() {
  const { id } = useParams<{ id: string }>();
  const [token] = useState(() => window.location.hash.slice(1));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Set up Sabi EMR access | Sabi Health';
    if (window.location.hash) window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    if (!id || !/^[a-f0-9]{64}$/.test(token)) return;
    let active = true;
    livePreviewEmrSetup(id, token).then((result) => { if (active) setPreview(result.data); })
      .catch(() => { if (active) setError('This setup link is invalid or expired. Ask Sabi operations for a new link.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, token]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!id || !preview || busy) return;
    setBusy(true); setError('');
    try {
      await liveCompleteEmrSetup(id, token, password, preview.existingAccount ? password : confirmPassword);
      setPassword(''); setConfirmPassword(''); setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Account setup failed. Request a new link if this one has expired.'); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-[#f4faf6] p-5"><div className="w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-7 shadow-xl sm:p-10"><Link to={SABI_HEALTH_URL} className="text-sm font-semibold text-emerald-700">Sabi Health</Link><div className="mt-8 grid h-12 w-12 place-items-center rounded-xl bg-emerald-950 text-emerald-200"><Building2 size={23}/></div><h1 className="mt-5 font-display text-3xl font-extrabold text-slate-950">Set up EMR access</h1>{complete ? <div className="mt-6 space-y-4"><ShieldCheck className="text-emerald-700" size={28}/><p className="text-sm leading-6 text-slate-700">Your EMR access is ready. Sign in with {preview?.existingAccount ? 'your existing Sabi ID password' : 'the password you just created'} to enter your approved organization’s workspace.</p><a className="public-button-primary w-full" href={EMR_SIGN_IN_URL}>Go to EMR sign in <ArrowRight size={16}/></a></div> : loading && id && /^[a-f0-9]{64}$/.test(token) ? <p role="status" className="mt-6 flex items-center gap-2 text-sm text-slate-600"><Loader2 size={16} className="animate-spin"/> Checking your single-use link…</p> : !preview ? <p role="alert" className="mt-6 text-sm text-amber-800">{error || 'This setup link is invalid or expired. Ask Sabi operations for a new link.'}</p> : <><p className="mt-3 text-sm leading-6 text-slate-600">Documents for <b>{preview.organizationName}</b> have been reviewed and approved. {preview.existingAccount ? 'Confirm your existing Sabi ID password to accept owner access. Your password will not change.' : `Set a password for ${preview.email}. Sabi never emails a generated password.`}</p><p className="mt-2 text-xs text-slate-500">Activation deadline: {new Date(preview.setupDeadlineAt).toLocaleString()}.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-slate-700">{preview.existingAccount ? 'Current Sabi ID password' : 'New password'}<input className="input mt-2" type="password" autoComplete={preview.existingAccount ? 'current-password' : 'new-password'} minLength={preview.existingAccount ? 1 : 8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)}/></label>{!preview.existingAccount && <><label className="block text-sm font-semibold text-slate-700">Confirm password<input className="input mt-2" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)}/></label><p className="text-xs text-slate-500">Use at least eight characters, including a number and a symbol.</p></>}{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button className="public-button-primary w-full" disabled={busy || (!preview.existingAccount && password !== confirmPassword)}>{busy ? <Loader2 size={16} className="animate-spin"/> : <ShieldCheck size={16}/>} {busy ? 'Activating…' : 'Activate my Sabi ID'}</button></form></>}</div></main>;
}
