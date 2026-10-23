import React, { useEffect, useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';

export default function AiPrivacyPanel({ call, usage, sourceSessionId, onBack, memoryEnabled = true }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [content, setContent] = useState('');
  const [kind, setKind] = useState('PREFERENCE');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true);
    call('/memory', { signal: controller.signal }).then((data) => { if (!controller.signal.aborted) setItems(data.items); })
      .catch((e) => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [call, reload]);
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const value = { kind, content: content.trim(), ...(editing ? { revision: editing.revision } : sourceSessionId ? { sourceSessionId } : {}) };
      const row = await call(editing ? `/memory/${editing.id}` : '/memory', { method: editing ? 'PATCH' : 'POST', body: value });
      setItems((old) => [...old.filter((item) => item.id !== row.id), row]); setContent(''); setEditing(null); setNotice('Memory saved. It is user-provided context, not a verified clinical record.');
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove(id) {
    setBusy(true); setError('');
    try {
      await call(`/memory/${id}`, { method: 'DELETE' });
      setItems((old) => old.filter((item) => item.id !== id)); setDeleting(null); setNotice('Memory deleted. A response being prepared from older saved context will not be published.');
      if (editing?.id === id) { setEditing(null); setContent(''); }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="sabi-ai-privacy"><h2>You control what you share.</h2><p>General knowledge conversations do not automatically read your patient records, prescriptions or hospital chart. Replies are AI-generated information, not a diagnosis or a signed clinical record.</p>
    <h3>Conversation processing</h3><p>Messages and memory you explicitly save are sent to Sabi's configured AI processor to prepare a response and stored in your Sabi account. Share only what your question needs. Do not enter another person's identifiable information.</p>
    <h3>Document processing</h3><p>When you separately agree to document extraction, the chosen screened file is sent to the configured Google AI processor. You can review and correct the extracted text, then explicitly select it for a question. This does not certify clinical accuracy or change your medical record. Removing an AI copy revokes its use and hides answers derived from that version; your original document is unchanged.</p>
    <h3>Your usage</h3>{usage && <dl><div><dt>Requests today</dt><dd>{usage.today} / {usage.dailyAllowance}</dd></div><div><dt>Completed responses</dt><dd>{usage.completed}</dd></div><div><dt>Daily allowance resets</dt><dd>{new Date(usage.resetsAt).toLocaleString()}</dd></div></dl>}<p>Failed or cancelled requests count toward request allowances because provider work may already have occurred. AI billing is not enabled; these counts are not a monetary invoice.</p>
    {usage?.allowance && <section aria-label="Token allocation details"><h3>Your token balance</h3><dl><div><dt>Allocated this period</dt><dd>{usage.allowance.tokens.allocated.toLocaleString()}</dd></div><div><dt>Tokens used</dt><dd>{usage.allowance.tokens.used.toLocaleString()}</dd></div><div><dt>Tokens reserved for outstanding work</dt><dd>{usage.allowance.tokens.reserved.toLocaleString()}</dd></div><div><dt>Tokens remaining</dt><dd>{usage.allowance.tokens.remaining.toLocaleString()}</dd></div><div><dt>Token allowance renews</dt><dd>{new Date(usage.allowance.tokens.resetsAt).toLocaleString()}</dd></div></dl><p>One Sabi account shares this balance across all AI workspaces. Tokens include the instructions and conversation context sent to the model, input and generated output. Unused tokens do not roll over. Known unused reservations are released; uncertain provider work remains reserved until reviewed. Your token allowance is separate from money and cloud charges.</p></section>}
    <h3>Saved memory</h3><p>Save preferences or information you report about yourself. It is not independently verified and never changes your medical record. Only you can inspect or correct it here. Up to 50 entries and 8,000 characters in total.</p>
    {loading && <p role="status"><Loader2 size={16} className="sabi-ai-spin" aria-hidden="true" /> Loading your saved memory…</p>}
    {!loading && !items.length && <p>You have not saved any memory.</p>}
    {items.map((item) => <div className="sabi-ai-memory" key={item.id}><p className="sabi-ai-overline">{item.kind === 'PREFERENCE' ? 'Preference' : 'Reported by you · not clinically verified'}</p><p>{item.content}</p><small>Updated {new Date(item.updatedAt).toLocaleString()}{item.sourceSessionId ? ' · linked to its source conversation' : ''}</small><div><button type="button" disabled={busy} onClick={() => { setEditing(item); setContent(item.content); setKind(item.kind); }}><Pencil size={15} aria-hidden="true" /> Correct</button><button type="button" disabled={busy} onClick={() => setDeleting(item.id)}><Trash2 size={15} aria-hidden="true" /> Delete saved memory</button></div>{deleting === item.id && <div role="group" aria-label="Confirm memory deletion"><p>Delete this saved context? It will not be used for future responses.</p><button type="button" disabled={busy} onClick={() => remove(item.id)}>Confirm deletion</button><button type="button" disabled={busy} onClick={() => setDeleting(null)}>Keep memory</button></div>}</div>)}
    {memoryEnabled ? <form className="sabi-ai-memory-form" onSubmit={save}><label>Memory type<select value={kind} onChange={(e) => setKind(e.target.value)} disabled={busy}><option value="PREFERENCE">Preference</option><option value="USER_REPORTED">Information I report about myself</option></select></label><label>{editing ? 'Correct this memory' : 'What would you like Sabi to remember?'}<textarea required maxLength={1000} rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="For example: I prefer short explanations in English." disabled={busy} /></label><p>Saving explicitly allows Sabi to use this text in later AI responses.{sourceSessionId && !editing ? ' Deleting this conversation also deletes memory saved from it.' : ''}</p><div><button className="sabi-ai-primary" type="submit" disabled={loading || busy || !content.trim()}>{busy ? 'Saving…' : editing ? 'Save correction' : 'Save memory'}</button>{editing && <button className="sabi-ai-secondary" type="button" disabled={busy} onClick={() => { setEditing(null); setContent(''); }}>Cancel correction</button>}</div></form> : <p>Saved context is disabled for your account and will not be sent to the AI provider. You can still review or delete earlier entries.</p>}
    {notice && <p role="status" className="sabi-ai-notice">{notice}</p>}{error && <div role="alert" className="sabi-ai-error"><p>{error}</p><button type="button" disabled={busy} onClick={() => { setError(''); setReload((x) => x + 1); }}>Reload memory</button></div>}
    <h3>Export or delete</h3><p>Open a conversation to export its messages and completed action receipts, or delete its messages. Deletion stops future use, cancels pending action previews and deletes memory linked to that conversation. Completed action receipts and minimal audit and usage metadata remain; backups follow their retention policy. Confirmed reminder changes are not undone. This never deletes an independently signed clinical record.</p><button className="sabi-ai-secondary" type="button" onClick={onBack}>Return to conversation</button>
  </div>;
}
