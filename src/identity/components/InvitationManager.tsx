import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, MailPlus } from 'lucide-react';
import { liveCreateInvitation, liveInvitationRoles, liveListInvitations, liveRevokeInvitation, type LiveInvitation } from '@/identity/liveIdentity';

export default function InvitationManager({ organizationId, title = 'Team invitations' }: { organizationId?: string; title?: string }) {
  const [roles, setRoles] = useState<string[]>([]);
  const [items, setItems] = useState<LiveInvitation[]>([]);
  const [email, setEmail] = useState('');
  const [roleCode, setRoleCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    const [available, listed] = await Promise.all([liveInvitationRoles(organizationId), liveListInvitations(organizationId)]);
    setRoles(available.data.roles);
    setRoleCode((current) => available.data.roles.includes(current) ? current : available.data.roles[0] ?? '');
    setItems(listed.data.items);
  }
  useEffect(() => { let active = true; Promise.all([liveInvitationRoles(organizationId), liveListInvitations(organizationId)]).then(([available, listed]) => {
    if (!active) return;
    setRoles(available.data.roles); setRoleCode(available.data.roles[0] ?? ''); setItems(listed.data.items);
  }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Invitation service unavailable.'); }); return () => { active = false; }; }, [organizationId]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !roleCode) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await liveCreateInvitation(email.trim(), roleCode, organizationId);
      setEmail(''); setMessage('Invitation email sent. Access begins only after the recipient accepts.'); await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not send invitation.'); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    setBusy(true); setError(''); setMessage('');
    try { await liveRevokeInvitation(id, organizationId); setMessage('Invitation revoked.'); await refresh(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not revoke invitation.'); }
    finally { setBusy(false); }
  }
  return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><MailPlus size={18} className="text-emerald-700"/><h2 className="font-bold text-slate-900">{title}</h2></div><p className="mt-2 text-sm text-slate-500">Invite by email with a limited role. Links expire after 48 hours and can be used once. Clinical professional roles use the separate credential-verification process.</p>
    {roles.length > 0 && <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,.6fr)_auto]"><label className="text-xs font-semibold text-slate-600">Email address<input required type="email" maxLength={320} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="colleague@example.com"/></label><label className="text-xs font-semibold text-slate-600">Role<select value={roleCode} onChange={(event) => setRoleCode(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{roles.map((role) => <option value={role} key={role}>{role.replaceAll('_', ' ')}</option>)}</select></label><button type="submit" disabled={busy} className="self-end rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={17}/> : 'Send invite'}</button></form>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100">{items.length === 0 ? <p className="py-4 text-sm text-slate-500">No invitation history yet.</p> : items.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div><p className="font-semibold text-slate-900">{item.email}</p><p className="text-xs text-slate-500">{item.roleCode.replaceAll('_', ' ')} · {item.status.toLowerCase()} · expires {new Date(item.expiresAt).toLocaleDateString()}</p></div>{item.status === 'PENDING' && <button type="button" disabled={busy} onClick={() => revoke(item.id)} className="text-xs font-bold text-red-700 disabled:opacity-50">Revoke</button>}</div>)}</div>
  </section>;
}
