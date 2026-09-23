import { useEffect, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { liveBeginMfa, liveConfirmMfa, liveDisableMfa, liveMfaStatus, liveRegenerateRecoveryCodes, liveStepUpMfa, restoreLiveIdentity } from '@/identity/liveIdentity';

type Status = { enabled: boolean; recoveryCodesRemaining: number };

export default function LiveMfaSettingsPage() {
  const [searchParams] = useSearchParams();
  const commandCenterNext = searchParams.get('next') === 'command-center';
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [password, setPassword] = useState('');
  const [secret, setSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
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

  async function run(action: () => Promise<void>, explainError?: (cause: unknown) => string) {
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(explainError?.(cause) ?? (cause instanceof Error ? cause.message : 'Security action failed.')); }
    finally { setBusy(false); }
  }

  async function beginSetup() {
    const result = await liveBeginMfa(password);
    setSecret(result.secret);
    setPassword('');
    setQrCode('');
    try {
      const { default: QRCode } = await import('qrcode');
      // Generate the QR image in this browser. Never send the TOTP secret to a QR service.
      setQrCode(await QRCode.toDataURL(result.otpauthUri, { errorCorrectionLevel: 'M', margin: 2, width: 240 }));
    } catch {
      // Manual setup remains available if this device cannot render a QR image.
    }
  }

  if (signedIn === false) return <Navigate to="/login" replace />;
  return <main className="min-h-screen bg-[#f4faf6] px-5 py-12 text-slate-900"><div className="mx-auto max-w-xl"><Link className="text-sm font-bold text-emerald-700" to={commandCenterNext ? '/command-center' : '/identity/account'}>← Back to {commandCenterNext ? 'Command Center' : 'Sabi ID'}</Link><div className="mt-5 rounded-[28px] border border-slate-200 bg-white p-7 shadow-xl"><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Account security</p><h1 className="mt-2 font-display text-3xl font-extrabold">Authenticator & recovery</h1><p className="mt-3 text-sm leading-6 text-slate-600">An authenticator code is required at sign-in once enabled. Save recovery codes offline; each works only once.</p>{!status ? <p className="mt-7 text-sm text-slate-500">Checking security status…</p> : <>
    <div className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Authenticator: {status.enabled ? 'Enabled' : 'Not enabled'}{status.enabled ? ` · ${status.recoveryCodesRemaining} recovery codes remain` : ''}</div>
    {commandCenterNext && status.enabled && verified && <Link className="public-button-primary mt-4 w-full" to="/command-center">Continue to Command Center</Link>}
    {!status.enabled && !secret && <form className="mt-6 space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(beginSetup); }}><label className="block text-sm font-semibold">Confirm your password<input className="input mt-2" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy} className="public-button-primary w-full">Start authenticator setup</button></form>}
    {!status.enabled && secret && <form className="mt-6 space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(async () => { const result = await liveConfirmMfa(code); setRecoveryCodes(result.recoveryCodes); setSecret(''); setQrCode(''); setCode(''); setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length }); setVerified(true); }, (cause) => cause instanceof Error && cause.message === 'Verification failed' ? 'That code did not match. Use the newest six-digit code for this Sabi Health account, check that your phone time is automatic, and try again. If setup has been open for over 10 minutes, start again with a new key.' : cause instanceof Error ? cause.message : 'Authenticator verification failed.'); }}>
      <p className="text-sm text-slate-600">Open an authenticator app on your phone, add an account, and scan this QR code. Choose a time-based code if the app asks. The setup expires after 10 minutes.</p>
      {qrCode && <div className="flex justify-center rounded-2xl border border-slate-200 bg-white p-4"><img src={qrCode} alt="Scan this Sabi Health authenticator setup QR code with your authenticator app" width={240} height={240} /></div>}
      <div className="rounded-xl bg-slate-100 p-4"><p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-600">Cannot scan? Enter this setup key manually</p><code className="block break-all text-sm font-bold tracking-wide">{secret}</code><p className="mt-2 text-xs text-slate-600">Account: Sabi Health · Type: time-based (TOTP) · 6 digits</p></div>
      <label className="block text-sm font-semibold">Newest six-digit code from your app<input className="input mt-2" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} /></label>
      <button disabled={busy || code.length !== 6} className="public-button-primary w-full">Confirm and enable</button>
      <button type="button" className="w-full text-sm font-semibold text-emerald-700" onClick={() => { setSecret(''); setQrCode(''); setCode(''); setError(''); }}>Start again with a new key</button>
    </form>}
    {status.enabled && !verified && <form className="mt-6 space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(async () => { await liveStepUpMfa(code, recovery); setVerified(true); setCode(''); }); }}><p className="text-sm text-slate-600">Verify again before changing security settings.</p><label className="block text-sm font-semibold">{recovery ? 'Recovery code' : 'Authenticator code'}<input className="input mt-2" required value={code} onChange={(event) => setCode(recovery ? event.target.value : event.target.value.replace(/\D/g, '').slice(0, 6))} /></label><button disabled={busy || (!recovery && code.length !== 6)} className="public-button-primary w-full">Verify for changes</button><button type="button" className="text-sm font-semibold text-emerald-700" onClick={() => { setRecovery(!recovery); setCode(''); }}>{recovery ? 'Use authenticator app' : 'Use a recovery code'}</button></form>}
    {status.enabled && verified && <div className="mt-6 space-y-4"><button disabled={busy} className="public-button-secondary w-full" onClick={() => void run(async () => { const result = await liveRegenerateRecoveryCodes(); setRecoveryCodes(result.recoveryCodes); setStatus({ enabled: true, recoveryCodesRemaining: result.recoveryCodes.length }); })}>Replace recovery codes</button><form className="space-y-3" onSubmit={(event: FormEvent) => { event.preventDefault(); void run(async () => { await liveDisableMfa(password); setStatus({ enabled: false, recoveryCodesRemaining: 0 }); setVerified(false); setRecoveryCodes([]); setPassword(''); }); }}><label className="block text-sm font-semibold">Password required to disable MFA<input className="input mt-2" type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={busy} className="w-full rounded-xl border border-red-200 px-4 py-3 text-sm font-bold text-red-700">Disable authenticator</button></form></div>}
    {recoveryCodes.length > 0 && <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4"><b className="text-sm text-amber-900">Save these codes now. They will not be shown again.</b><ul className="mt-3 grid grid-cols-2 gap-2 font-mono text-sm">{recoveryCodes.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p>}
  </>}</div></div></main>;
}
