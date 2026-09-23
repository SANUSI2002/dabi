import { useEffect, useState } from 'react';
import { SectionCard } from '../shared';
import { changePassword, mfaStatus } from '../../../utils/sabiIdentity';

const securityUrl = String(import.meta.env.VITE_SABI_IDENTITY_UI_URL || '').replace(/\/$/, '');

export function SecurityCard() {
  const [status, setStatus] = useState(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!import.meta.env.VITE_SABI_IDENTITY_API_URL) return;
    mfaStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  async function submitPassword(event) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setChangingPassword(false);
      setMessage('Password changed. Other sessions were revoked.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Password change failed.'); }
    finally { setBusy(false); }
  }

  return <SectionCard icon="🛡️" title="Security">
    <div className="sabi-security-grid">
      <div className="sabi-security-row"><div><div className="sabi-security-title">Two-Factor Authentication</div><div className="sabi-security-sub">{status ? status.enabled ? `Authenticator enabled · ${status.recoveryCodesRemaining} recovery codes remain` : 'Authenticator not enabled' : 'Connect Sabi Identity to view security status.'}</div></div>{securityUrl ? <a className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-800" href={`${securityUrl}/identity/mfa`}>Manage authenticator</a> : <span className="text-xs text-slate-500">Sabi ID settings URL not configured</span>}</div>
      <div className="sabi-security-row"><div><div className="sabi-security-title">Change Password</div><div className="sabi-security-sub">Verified by the central identity service.</div></div><button className="rounded-lg border border-emerald-600 px-4 py-2 text-sm font-semibold text-emerald-800" type="button" onClick={() => setChangingPassword(!changingPassword)}>Change password</button></div>
    </div>
    {changingPassword && <form className="mt-5 grid gap-3" onSubmit={submitPassword}><label className="text-sm font-semibold">Current password<input className="mt-1 w-full rounded-lg border p-2" type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></label><label className="text-sm font-semibold">New password<input className="mt-1 w-full rounded-lg border p-2" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label><button className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white" disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button></form>}
    {message && <p role="status" className="mt-4 text-sm text-slate-700">{message}</p>}
  </SectionCard>;
}
