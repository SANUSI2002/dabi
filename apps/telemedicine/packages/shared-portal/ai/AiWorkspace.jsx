import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Download, FileText, Loader2, MessageCircle, Plus, RefreshCw, Search, ShieldCheck, Sparkles, Square, Trash2, X } from 'lucide-react';
import './ai-workspace.css';
import './ai-allowances.css';
import AiPrivacyPanel from './AiPrivacyPanel.jsx';
import AiDocumentsPanel from './AiDocumentsPanel.jsx';
import AiActionsPanel from './AiActionsPanel.jsx';

const ACTIVE = new Set(['QUEUED', 'RUNNING']);
const suggestions = ['Help me prepare questions for a consultation', 'Explain a health term in plain language', 'How can I keep a useful symptom diary?'];
const messageOf = (error) => error?.message || 'Sabi could not complete that request. Please try again.';

/** Shared UI; the host supplies its existing authenticated transport. No new token store. */
export default function AiWorkspace({ request, accountName = 'Your workspace', homeHref = '/', embedded = false, uploadDocument }) {
  const [config, setConfig] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [current, setCurrent] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshingBalance, setRefreshingBalance] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [consent, setConsent] = useState(false);
  const [view, setView] = useState('chat');
  const [selectedSources, setSelectedSources] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const pendingMessage = useRef(null);
  const epoch = useRef(0);
  const mounted = useRef(true);
  const feed = useRef(null);
  const composer = useRef(null);
  const dialog = useRef(null);
  const call = useCallback(async (path, options = {}) => {
    const response = await request(`/api/v1/ai${path}`, options);
    if (response?.status !== 'success' || response.data === undefined) throw new Error('The AI service returned an unexpected response.');
    return response.data;
  }, [request]);
  const loadSessions = useCallback(async (signal) => {
    const data = await call('/sessions', { signal });
    if (!signal?.aborted && mounted.current) setSessions(data.items);
  }, [call]);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; epoch.current += 1; }; }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    Promise.all([call('/config', { signal: controller.signal }), call('/sessions', { signal: controller.signal }), call('/usage', { signal: controller.signal })])
      .then(([c, list, u]) => { if (!controller.signal.aborted) { setConfig(c); setSessions(list.items); setUsage(u); } })
      .catch((e) => { if (!controller.signal.aborted) setError(messageOf(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [call, refresh]);

  const activeRun = current?.runs?.find((run) => ACTIVE.has(run.status));
  useEffect(() => {
    if (!usage?.allowance) return undefined;
    const next = Math.min(new Date(usage.allowance.requests.resetsAt).getTime(), new Date(usage.allowance.tokens.resetsAt).getTime());
    if (!Number.isFinite(next)) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(() => { call('/usage', { signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setUsage(value); }).catch(() => {}); }, Math.min(86400000, Math.max(1000, next - Date.now() + 500)));
    return () => { controller.abort(); clearTimeout(timer); };
  }, [usage, call]);
  const activeRunId = activeRun?.id;
  useEffect(() => {
    if (!activeRunId) return undefined;
    const controller = new AbortController(); let timer; let failures = 0;
    const poll = async () => {
      try {
        const run = await call(`/runs/${activeRunId}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        failures = 0;
        if (!ACTIVE.has(run.status)) {
          const updated = await call(`/sessions/${run.sessionId}`, { signal: controller.signal });
          if (controller.signal.aborted) return;
          setCurrent((old) => old?.id === run.sessionId ? updated : old);
          setStatus(run.status === 'SUCCEEDED' ? 'Your response is ready.' : run.status === 'CANCELLED' ? 'Response cancelled.' : 'This response could not be completed. You can send your question again.');
          if (run.status === 'FAILED') setError(run.errorCode === 'AI_TOKEN_QUOTA' ? 'This question and its context need more tokens than the available request allocation. Check Usage & reset times, or start a shorter conversation. Unused tokens from this preflight check were released.' : 'Sabi could not finish this response. No completed answer was saved.');
          call('/usage', { signal: controller.signal }).then((u) => { if (!controller.signal.aborted) setUsage(u); }).catch(() => {});
          return;
        }
        setStatus(run.status === 'RUNNING' ? 'Sabi is working on your response…' : 'Your question is queued…');
      } catch (e) {
        if (controller.signal.aborted) return;
        failures += 1;
        setStatus('Connection interrupted. Checking the same response again; your question has not been resent.');
        if (e?.status === 401 || e?.status === 403 || e?.status === 404) { setError(messageOf(e)); return; }
      }
      timer = setTimeout(poll, Math.min(10000, 1500 * (1 + failures)));
    };
    timer = setTimeout(poll, 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [activeRunId, call]);
  useEffect(() => { feed.current?.scrollIntoView?.({ block: 'nearest', behavior: 'auto' }); }, [current?.messages?.length, activeRun?.id]);
  useEffect(() => { if (confirmDelete) dialog.current?.showModal(); }, [confirmDelete]);

  async function openSession(id) {
    const generation = ++epoch.current; setBusy(true); setError(''); setView('chat');
    try {
      const session = await call(`/sessions/${id}`);
      if (mounted.current && generation === epoch.current) { setCurrent(session); setSelectedSources([]); setMessage(''); setHistoryOpen(false); pendingMessage.current = null; setStatus('Conversation opened.'); }
    } catch (e) { if (mounted.current && generation === epoch.current) setError(messageOf(e)); }
    finally { if (mounted.current && generation === epoch.current) setBusy(false); }
  }
  async function send(event) {
    event.preventDefault(); if (disabled || activeRun || !message.trim()) return;
    setBusy(true); setError(''); const text = message.trim(); const generation = epoch.current;
    try {
      let session = current;
      if (!session) {
        if (!consent) throw new Error('Please agree to AI processing before starting your conversation.');
        session = await call('/sessions', { method: 'POST', body: { consentGiven: true, consentVersion: config.consentVersion, mode: 'GENERAL', title: text.slice(0, 80) } });
        if (!mounted.current || generation !== epoch.current) return;
        setCurrent({ ...session, messages: [], runs: [] });
      }
      if (!pendingMessage.current || pendingMessage.current.message !== text || pendingMessage.current.sessionId !== session.id) {
        pendingMessage.current = { sessionId: session.id, clientMessageId: crypto.randomUUID(), message: text, sourceIds: selectedSources.map((s) => s.id) };
      }
      const { clientMessageId } = pendingMessage.current;
      await call(`/sessions/${session.id}/messages`, { method: 'POST', body: { clientMessageId, message: text, ...(pendingMessage.current.sourceIds.length ? { sourceIds: pendingMessage.current.sourceIds } : {}) } });
      const canonical = await call(`/sessions/${session.id}`);
      if (!mounted.current || generation !== epoch.current) return;
      setCurrent(canonical); setMessage(''); pendingMessage.current = null; setStatus('Your question has been received.');
      await loadSessions();
      const latestUsage = await call('/usage'); if (mounted.current && generation === epoch.current) setUsage(latestUsage);
    } catch (e) { if (mounted.current && generation === epoch.current) setError(messageOf(e)); }
    finally { if (mounted.current && generation === epoch.current) setBusy(false); }
  }
  async function cancel() {
    if (!activeRun) return; setBusy(true); setError(''); const id = current.id;
    try {
      await call(`/runs/${activeRun.id}/cancel`, { method: 'POST', body: {} });
      const canonical = await call(`/sessions/${id}`);
      if (mounted.current) { setCurrent((old) => old?.id === id ? canonical : old); setStatus('Response cancelled. Provider work already performed may still count toward usage.'); }
      const latestUsage = await call('/usage'); if (mounted.current) setUsage(latestUsage);
    } catch (e) { if (mounted.current) setError(messageOf(e)); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function refreshBalance() {
    setRefreshingBalance(true); setError('');
    try { const latest = await call('/usage'); if (mounted.current) { setUsage(latest); setStatus('Your allowance is up to date.'); } }
    catch (e) { if (mounted.current) setError(messageOf(e)); }
    finally { if (mounted.current) setRefreshingBalance(false); }
  }
  async function exportConversation() {
    if (!current) return; setBusy(true); setError('');
    try {
      const data = await call(`/sessions/${current.id}/export`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const anchor = document.createElement('a'); anchor.href = url; anchor.download = `sabi-conversation-${current.id}.json`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('Conversation exported. Store the downloaded file securely.');
    } catch (e) { setError(messageOf(e)); } finally { if (mounted.current) setBusy(false); }
  }
  async function removeConversation() {
    if (!current) return; setBusy(true); setError('');
    try {
      const data = await call(`/sessions/${current.id}`, { method: 'DELETE', body: { confirm: true } });
      epoch.current += 1; setCurrent(null); setMessage(''); pendingMessage.current = null; setStatus(data.retained); await loadSessions();
    } catch (e) { setError(messageOf(e)); }
    finally { if (mounted.current) { setBusy(false); setConfirmDelete(false); } }
  }
  async function feedback(runId, value) {
    setBusy(true); setError('');
    try {
      await call(`/runs/${runId}/feedback`, { method: 'POST', body: { feedback: value } });
      if (mounted.current) { setCurrent((old) => old ? { ...old, runs: old.runs?.map((run) => run.id === runId ? { ...run, feedback: value } : run) } : old); setStatus('Feedback saved. Thank you for helping improve Sabi.'); }
    } catch (e) { if (mounted.current) setError(messageOf(e)); } finally { if (mounted.current) setBusy(false); }
  }
  function startNew() { epoch.current += 1; setCurrent(null); setSelectedSources([]); setMessage(''); setError(''); setStatus(''); setView('chat'); pendingMessage.current = null; composer.current?.focus(); }
  async function previewCitation(citation) {
    setError('');
    try { const data = await call(`/sources/${citation.sourceId}/preview`, { method: 'POST', body: { pageNumber: citation.pageNumber } }); const url = new URL(data.url); if (url.protocol !== 'https:') throw new Error('Secure preview unavailable.'); url.hash = `page=${citation.pageNumber}`; window.open(url.toString(), '_blank', 'noopener,noreferrer'); }
    catch (e) { setError(messageOf(e)); }
  }
  function useSource(source) {
    if (!selectedSources.some((s) => s.id === source.id) && selectedSources.length >= 3) { setError('Choose up to three documents for one question.'); return; }
    setSelectedSources((old) => old.some((s) => s.id === source.id) ? old : [...old, source]); pendingMessage.current = null; setView('chat');
  }
  const exhausted = usage?.allowance && (usage.allowance.requests.remaining < 1 || usage.allowance.tokens.remaining < 128);
  const disabled = loading || busy || !config?.enabled || exhausted;
  const filtered = sessions.filter((session) => session.title.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  return <section className={`sabi-ai-workspace${embedded ? ' sabi-ai-embedded' : ''}`} aria-label="Sabi AI workspace">
    <aside className={`sabi-ai-rail${historyOpen ? ' sabi-ai-history-open' : ''}`}>
      <a className="sabi-ai-brand" href={homeHref}><span><Sparkles size={20} aria-hidden="true" /></span><b>Sabi AI</b></a>
      <button type="button" className="sabi-ai-primary" onClick={startNew} disabled={busy}><Plus size={18} aria-hidden="true" /> New conversation</button>
      <label className="sabi-ai-search"><Search size={16} aria-hidden="true" /><span className="sabi-ai-sr">Search your conversations</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search conversations" /></label>
      <nav aria-label="Your conversations"><p className="sabi-ai-overline">Recent conversations</p>
        {!loading && !filtered.length && <p className="sabi-ai-muted">{search ? 'No matching conversations.' : 'Your conversations will appear here.'}</p>}
        {filtered.map((session) => <button type="button" key={session.id} disabled={busy} className={current?.id === session.id ? 'is-current' : ''} aria-current={current?.id === session.id ? 'page' : undefined} onClick={() => openSession(session.id)}><MessageCircle size={16} aria-hidden="true" /><span>{session.title}</span></button>)}
      </nav>
      <div className="sabi-ai-rail-footer"><button type="button" className="sabi-ai-history-toggle" aria-label="Show conversation history" aria-expanded={historyOpen} onClick={() => setHistoryOpen((value) => !value)}><MessageCircle size={17} aria-hidden="true" /> History</button><button type="button" disabled={busy} onClick={() => setView(view === 'documents' ? 'chat' : 'documents')}><FileText size={17} aria-hidden="true" /> Documents</button><button type="button" onClick={() => setView(view === 'privacy' ? 'chat' : 'privacy')}><ShieldCheck size={17} aria-hidden="true" /> Privacy & usage</button><p>{accountName}</p><a href={homeHref}>Back to Sabi</a></div>
    </aside>
    <div className="sabi-ai-main">
      <header className="sabi-ai-header"><div><p className="sabi-ai-overline">Your space for clearer understanding</p><h1>{view === 'privacy' ? 'Privacy & usage' : view === 'documents' ? 'Your documents' : view === 'actions' ? 'Reminder controls' : current?.title || 'A little clarity goes a long way.'}</h1></div><span className="sabi-ai-mode"><ShieldCheck size={15} aria-hidden="true" /> {selectedSources.length ? 'Selected personal documents' : 'General knowledge'}</span></header>
      <div className="sabi-ai-status" role="status" aria-live="polite">{loading ? <><Loader2 className="sabi-ai-spin" size={16} aria-hidden="true" /> Opening your workspace…</> : status}</div>
{usage?.allowance && <div className="sabi-ai-budget" aria-label="Your AI allowance"><span><strong>{usage.allowance.tokens.remaining.toLocaleString()} tokens left</strong> · {usage.allowance.requests.remaining} requests left today</span><div><button type="button" onClick={() => setView('privacy')}>Usage & reset times</button><button type="button" disabled={refreshingBalance} onClick={refreshBalance} aria-label="Refresh balance"><RefreshCw size={15} aria-hidden="true" /> {refreshingBalance ? 'Refreshing…' : 'Refresh balance'}</button></div>{usage.allowance.tokens.status !== 'AVAILABLE' && <span role="status">{usage.allowance.tokens.status === 'EXHAUSTED' ? 'No tokens are available for a new request.' : 'Your token allocation is running low.'}</span>}</div>}
      {error && <div className="sabi-ai-error" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={() => setRefresh((x) => x + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh connection</button></div>}
      {!loading && config && !config.enabled && <p className="sabi-ai-notice">New AI responses are temporarily unavailable. Your saved conversations and normal Sabi services remain available.</p>}
      {view === 'privacy' ? <AiPrivacyPanel call={call} usage={usage} sourceSessionId={current?.id} onBack={() => setView('chat')} memoryEnabled={config?.access?.features?.memory !== false} />
      : view === 'documents' ? <AiDocumentsPanel call={call} config={config} uploadDocument={uploadDocument} onUse={useSource} onBack={() => setView('chat')} />
      : view === 'actions' && current ? <AiActionsPanel key={current.id} call={call} sessionId={current.id} onBack={() => setView('chat')} />
      : <><div className="sabi-ai-feed" role="log" aria-label="Conversation" aria-live="polite">
        {!current?.messages?.length && !loading && <div className="sabi-ai-welcome"><span className="sabi-ai-welcome-icon"><Sparkles size={28} aria-hidden="true" /></span><h2>What would you like to understand?</h2><p>Bring a question. We’ll work through it together, one clear step at a time.</p><div className="sabi-ai-suggestions">{suggestions.map((text) => <button key={text} type="button" onClick={() => { setMessage(text); composer.current?.focus(); }} disabled={disabled}>{text}<ArrowUp size={16} aria-hidden="true" /></button>)}</div></div>}
        {current?.messages?.map((item) => <article className={`sabi-ai-message sabi-ai-message-${item.role}`} key={item.id}><p className="sabi-ai-message-author">{item.role === 'user' ? 'You' : 'Sabi AI'} <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></p><div>{item.content}</div>{item.citations?.length > 0 && <div className="sabi-ai-citations" aria-label="References">{item.citations.map((c) => c.kind==='KNOWLEDGE_REFERENCE'?<span className="sabi-ai-book-reference" key={c.label}>[{c.label}] {c.sourceTitle} · {c.edition} · {c.locator}<small>{c.author}{c.publicationDate?` · ${c.publicationDate}`:''}</small></span>:<button type="button" key={c.label} onClick={() => previewCitation(c)}>{c.label} · Page {c.pageNumber}</button>)}</div>}{item.role === 'assistant' && item.runId && <div className="sabi-ai-feedback" aria-label="Response feedback">{[['HELPFUL', 'Helpful'], ['UNCLEAR', 'Unclear'], ['UNSAFE', 'Report a concern']].map(([value, label]) => <button key={value} type="button" disabled={busy} aria-pressed={current.runs?.find((run) => run.id === item.runId)?.feedback === value} onClick={() => feedback(item.runId, value)}>{label}</button>)}</div>}</article>)}
        {activeRun && <div className="sabi-ai-working"><Loader2 className="sabi-ai-spin" size={18} aria-hidden="true" /> {activeRun.status === 'QUEUED' ? 'Your question is queued' : 'Thinking through your question'}<button type="button" disabled={busy} onClick={cancel}><Square size={13} aria-hidden="true" /> Stop response</button></div>}
        <div ref={feed} />
      </div>
      <div className="sabi-ai-composer-wrap">{current && <div className="sabi-ai-conversation-actions">{config?.actions?.includes('REMINDER_TOGGLE') && <button disabled={busy} onClick={() => setView('actions')} type="button">Reminder controls</button>}<button disabled={busy} onClick={exportConversation} type="button"><Download size={15} aria-hidden="true" /> Export</button><button disabled={busy} onClick={() => setConfirmDelete(true)} type="button"><Trash2 size={15} aria-hidden="true" /> Delete conversation</button></div>}
        {selectedSources.length > 0 && <div className="sabi-ai-selected-sources" aria-label="Documents selected for your next question">{selectedSources.map((s) => <button key={s.id} type="button" disabled={busy} aria-label={`Remove ${s.document.originalFilename} from this question`} onClick={() => { setSelectedSources((old) => old.filter((item) => item.id !== s.id)); pendingMessage.current = null; }}>{s.document.originalFilename}<X size={14} aria-hidden="true" /></button>)}</div>}
        {!current && <label className="sabi-ai-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I agree to AI processing of the messages I choose to send. <button type="button" onClick={() => setView('privacy')}>Privacy details</button></span></label>}
        <form className="sabi-ai-composer" onSubmit={send}><label className="sabi-ai-sr" htmlFor="sabi-ai-message">Your message to Sabi</label><textarea ref={composer} id="sabi-ai-message" rows={2} maxLength={4000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask Sabi a health question…" disabled={loading || busy || Boolean(activeRun)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (message.trim() && !disabled && !activeRun && (current || consent)) e.currentTarget.form?.requestSubmit(); } }} /><button type="submit" aria-label="Send message" disabled={disabled || Boolean(activeRun) || !message.trim() || (!current && !consent)}>{busy ? <Loader2 className="sabi-ai-spin" size={20} aria-hidden="true" /> : <ArrowUp size={21} aria-hidden="true" />}</button></form>
        <p className="sabi-ai-disclaimer">AI can make mistakes. Confirm important health information with a qualified professional. For an emergency, seek urgent local care.</p>
      </div></>}
    </div>
    {confirmDelete && <dialog className="sabi-ai-dialog" ref={dialog} aria-labelledby="sabi-ai-delete-title" onCancel={(e) => { e.preventDefault(); if (!busy) setConfirmDelete(false); }}><h2 id="sabi-ai-delete-title">Delete this conversation?</h2><p>Its messages will be removed and unfinished responses and action previews cancelled. Completed action receipts, minimal audit and usage metadata remain. Previously confirmed reminder changes and signed clinical records are not undone.</p><div><button type="button" disabled={busy} className="sabi-ai-secondary" autoFocus onClick={() => setConfirmDelete(false)}><X size={16} aria-hidden="true" /> Keep conversation</button><button type="button" disabled={busy} className="sabi-ai-primary" onClick={removeConversation}>{busy ? <Loader2 className="sabi-ai-spin" size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />} Delete messages</button></div></dialog>}
  </section>;
}
