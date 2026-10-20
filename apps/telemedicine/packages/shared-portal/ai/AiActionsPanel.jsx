import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bell, CheckCircle2 } from 'lucide-react';
export default function AiActionsPanel({ call, sessionId, onBack }) {
  const [targets, setTargets] = useState([]); const [actions, setActions] = useState([]); const [proposal, setProposal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const attempts = useRef(new Map());
  const load = useCallback(async (signal) => {
    const [t, a] = await Promise.all([call('/action-targets/reminders', { signal }), call(`/sessions/${sessionId}/actions`, { signal })]);
    if (!signal?.aborted) { setTargets(t.items); setActions(a.items); setLoading(false); }
  }, [call, sessionId]);
  useEffect(() => { const controller = new AbortController(); setLoading(true); load(controller.signal).catch((e) => { if (!controller.signal.aborted) { setError(e.message); setLoading(false); } }); return () => controller.abort(); }, [load]);
  async function action(fn) { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e.message || 'This action could not be completed.'); } finally { setBusy(false); } }
  function prepare(target) { void action(async () => {
    const scope = `${target.id}:${target.version}:${!target.remindersEnabled}`;
    if (!attempts.current.has(scope)) attempts.current.set(scope, crypto.randomUUID());
    const data = await call(`/sessions/${sessionId}/actions/reminders`, { method: 'POST', body: { clientRequestId: attempts.current.get(scope), scheduleId: target.id, expectedVersion: target.version, enableReminders: !target.remindersEnabled } });
    setProposal(data); await load();
  }); }
  function confirm(item) { void action(async () => {
    const receipt = await call(`/actions/${item.id}/confirm`, { method: 'POST', body: { confirm: true } });
    setNotice(`Reminder setting saved. Receipt ${receipt.id.slice(0, 8)} · ${new Date(receipt.createdAt).toLocaleString()}.`); setProposal(null); await load();
  }); }
  function cancel(item) { void action(async () => { await call(`/actions/${item.id}/cancel`, { method: 'POST', body: {} }); setProposal(null); setNotice('Change cancelled. Your reminder settings were not changed.'); await load(); }); }
  const pending = (proposal?.status === 'PENDING' && new Date(proposal.expiresAt) > new Date() ? proposal : null) || actions.find((a) => a.status === 'PENDING' && new Date(a.expiresAt) > new Date());
  return <div className="sabi-ai-privacy"><button className="sabi-ai-secondary" type="button" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Conversation</button><h2>Your reminder controls</h2><p>These are your existing medicine reminders. Review and confirm a notification change here. It does not change a prescription, dose, treatment plan or record whether medicine was taken.</p>
    {error && <p role="alert" className="sabi-ai-error">{error}</p>}{notice && <p role="status" className="sabi-ai-notice">{notice}</p>}
    {pending && <section className="sabi-ai-action-preview" aria-label="Confirm reminder change"><h3>Review this change</h3><p><strong>{targets.find((t) => t.id === pending.scheduleId)?.name || 'Selected existing reminder'}</strong></p><p>Turn reminder notifications <strong>{pending.enableReminders ? 'on' : 'off'}</strong>. Times and treatment instructions stay unchanged.</p><p className="sabi-ai-muted">Preview valid until {new Date(pending.expiresAt).toLocaleTimeString()}. Changed settings require a fresh preview.</p><div><button className="sabi-ai-primary" type="button" disabled={busy} onClick={() => confirm(pending)}>Confirm reminder change</button><button className="sabi-ai-secondary" type="button" disabled={busy} onClick={() => cancel(pending)}>Cancel change</button></div></section>}
    <h3>Active scheduled medicines</h3>{loading && <p role="status">Loading your existing reminder settings…</p>}{!loading && !error && !targets.length && <p>No active scheduled reminders are available. No medicines are invented or added by this tool.</p>}
    {targets.map((target) => <article key={target.id} className="sabi-ai-source-card"><Bell size={19} aria-hidden="true" /><div><strong>{target.name}</strong><p>Notifications {target.remindersEnabled ? 'on' : 'off'} · {target.timezone}</p></div><button className="sabi-ai-secondary" disabled={busy || Boolean(pending)} onClick={() => prepare(target)}>Review turning {target.remindersEnabled ? 'off' : 'on'}</button></article>)}
    <h3>Completed action receipts</h3>{!actions.some((a) => a.receipt) && <p>No completed actions in this conversation.</p>}
    {actions.filter((a) => a.receipt).map((a) => <article className="sabi-ai-source-card" key={a.receipt.id}><CheckCircle2 size={19} aria-hidden="true" /><div><strong>Reminder notifications {a.receipt.result.remindersEnabled ? 'enabled' : 'disabled'}</strong><p>{new Date(a.receipt.createdAt).toLocaleString()} · schedule version {a.receipt.result.scheduleVersion}</p><p className="sabi-ai-muted">Receipt {a.receipt.id}. This records the completed change, not necessarily the latest setting.</p></div></article>)}
    <button className="sabi-ai-secondary" disabled={busy} type="button" onClick={() => void action(() => load())}>Refresh reminder settings</button>
  </div>;
}
