import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { liveBeginMfa, liveConfirmMfa, liveDisableMfa, liveMfaStatus, liveRegenerateRecoveryCodes, liveStepUpMfa, restoreLiveIdentity } from '@/identity/liveIdentity';

type Status = { enabled: boolean; recoveryCodesRemaining: number };

export default function LiveMfaSettingsPage() {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [verified, setVerified] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { restoreLiveIdentity().then((identity) => {
    setSignedIn(!!identity);
    if (identity) liveMfaStatus().then(setStatus).catch((cause) => setError(cause instanceof Error ? cause.message : 'Security status unavailable.'));
  }).catch(() => setSignedIn(false)); }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Security action failed.'); }
    finally { setBusy(false); }
  }

  if (signedIn === false) return <Navigate to="/login" replace />;
  return <main className="min-h-screen bg-[#f4faf6] px-5 py-12 text-slate-900"><div className="mx-auto max-w-xl"><Link className="text-sm font-bold text-emerald-700" to="/identity/account">← Back to Sabi ID</Link><div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-7 shadow-xl"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Account security</p><h1 className="mt-2 font-display text-3xl font-extrabold">Authenticator & recovery</h1><p className="mt-3 text-sm leading-6 text-slate-600">An authenticator code is required at sign-in once enabled. Save recovery codes offline; each works only once.</p>{!status ? <p className="mt-7 text-sm text-slate-500">Checking security status…</p> : <>
    <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Authenticator: {status.enabled ? 'Enabled' : 'Not enabled'}{status.enabled ? ` · ${status.recoveryCodesRemaining} recovery codes remain` : ''}</div>
    {!status.enabled && !secret && <form className="mt-6 space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(async () => { const result = await liveBeginMfa(password); setSecret(result.secret); setPassword(''); }); }}><label className="block text-sm font-semibold">Confirm your password<input className="input mt-2" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy} className="public-button-primary w-full">Start authenticator setup</button></form>}
    {!status.enabled && secret && <form className="mt-6 space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(async () => { const result = await liveConfirmMfa(code); setRecoveryCodes(result.recoveryCodes); setSecret(''); setCode(''); setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length }); setVerified(true); }); }}><p className="text-sm text-slate-600">Add this key to your authenticator app, then enter its six-digit code within ten minutes.</p><code className="block break-all rounded-xl bg-slate-100 p-4 text-sm font-bold tracking-wide">{secret}</code><label className="block text-sm font-semibold">Authenticator code<input className="input mt-2" required inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button disabled={busy || code.length !== 6} className="public-button-primary w-full">Confirm and enable</button></form>}
    {status.enabled && !verified && <form className="mt-6 space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(async () => { await liveStepUpMfa(code, recovery); setVerified(true); setCode(''); }); }}><p className="text-sm text-slate-600">Verify again before changing security settings.</p><label className="block text-sm font-semibold">{recovery ? 'Recovery code' : 'Authenticator code'}<input className="input mt-2" required value={code} onChange={(event) => setCode(recovery ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button disabled={busy || (!recovery && code.length !== 6)} className="public-button-primary w-full">Verify for changes</button><button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => { setRecovery(!recovery); setCode(''); }}>{recovery ? 'Use authenticator app' : 'Use a recovery code'}</button></form>}
    {status.enabled && verified && <div className="mt-6 space-y-4"><button disabled={busy} className="public-button-secondary w-full" onClick={() => void run(async () => { const result = await liveRegenerateRecoveryCodes(); setRecoveryCodes(result.recoveryCodes); setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length }); })}>Replace recovery codes</button><form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(async () => { await liveDisableMfa(password); setStatus({ enabled: false, recoveryCodesRemaining: 0 }); setVerified(false); setRecoveryCodes([]); setPassword(''); }); }}><label className="block text-sm font-semibold">Password required to disable MFA<input className="input mt-2" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy} className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700">Disable authenticator</button></form></div>}
    {recoveryCodes.length > 0 && <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4"><b className="text-sm text-amber-900">Save these codes now. They will not be shown again.</b><ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{recoveryCodes.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
  </>}</div></div></main>;
}
