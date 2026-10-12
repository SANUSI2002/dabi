import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, LoaderCircle, RefreshCw, Share2, Trash2, Upload, X } from 'lucide-react';
import { DOCUMENT_KINDS, documentConfig, documentPage, documentRecipients, documentShares, documentDownloadUrl, uploadDocument, toDocument, shareDocument, revokeDocumentShare, retryDocumentScan, deleteDocument } from '../../../api/recordsApi';
import './DocumentLibrary.css';

const date = (value) => new Date(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
function Dialog({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="sabi-document-dialog" aria-label={title} onCancel={onClose} onClose={onClose}>
    <header><h2>{title}</h2><button type="button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></header>{children}
  </dialog>;
}
export default function DocumentLibrary() {
  const [config, setConfig] = useState(null), [items, setItems] = useState([]), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [kind, setKind] = useState('MEDICAL_RECORD'), [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [preview, setPreview] = useState(null), [sharing, setSharing] = useState(null), [removing, setRemoving] = useState(null);
  const gate = useRef(false), input = useRef(null), generation = useRef(0);
  const load = useCallback(async (quiet = false) => {
    const current = ++generation.current;
    if (!quiet) setLoading(true);
    try {
      const [result, settings] = await Promise.all([documentPage(page, filter), documentConfig()]);
      if (current !== generation.current) return;
      setItems(result.items.map(toDocument)); setTotal(result.total); setConfig(settings);
    } catch (e) { if (current === generation.current) setError(e.message || 'Could not load your documents.'); }
    finally { if (current === generation.current && !quiet) setLoading(false); }
  }, [page, filter]);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  useEffect(() => {
    if (!items.some((d) => d.status === 'PENDING_SCAN' && d.scanAttempts < 5)) return;
    const timer = setInterval(() => { if (!document.hidden) void load(true); }, 10000);
    return () => clearInterval(timer);
  }, [items, load]);
  const run = async (work) => {
    if (gate.current) return;
    gate.current = true; setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(e.message || 'That action could not be completed. Please retry.'); }
    finally { gate.current = false; setBusy(false); }
  };
  const receive = (file) => run(async () => {
    if (!file) return;
    const result = await uploadDocument(file, { kind });
    setMessage(`“${file.name}” received. Security screening is running in the background.`);
    setItems((old) => [toDocument(result), ...old.filter((d) => d.id !== result.id)].slice(0, 12));
    await load(true);
    if (input.current) input.current.value = '';
  });
  const open = (doc) => run(async () => {
    const url = await documentDownloadUrl(doc.id);
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) throw new Error('The private preview could not be opened. Please refresh and retry.');
    setPreview({ ...doc, url });
  });
  const manageSharing = (doc) => run(async () => {
    const [recipients, shares] = await Promise.all([documentRecipients(), documentShares(doc.id)]);
    setSharing({ doc, recipients: recipients.items, shares: shares.items });
  });
  return <section className="sabi-document-library" aria-labelledby="patient-documents-title">
    <header><div><span className="sabi-document-eyebrow">Your files, in your control</span><h2 id="patient-documents-title">Medical documents</h2><p>Lab reports, scans and records—private by default.</p></div><button type="button" className="sabi-document-icon" aria-label="Refresh documents" disabled={busy || loading} onClick={() => load()}><RefreshCw size={18} /></button></header>
    {error && <p className="sabi-document-error" role="alert">{error}</p>}
    {message && <p className="sabi-document-success" role="status">{message}</p>}
    <div className="sabi-document-upload">
      <label htmlFor="document-kind">Document type<select id="document-kind" value={kind} disabled={busy} onChange={(e) => setKind(e.target.value)}>{DOCUMENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
      <label className={`sabi-document-upload-button${busy || !config?.enabled ? ' is-disabled' : ''}`}><Upload size={18} aria-hidden="true" />{busy ? 'Uploading securely…' : 'Choose a document'}<input ref={input} aria-label="Choose a medical document" type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy || !config?.enabled} onChange={(e) => { const file = e.target.files?.[0]; if (file) void receive(file); }} /></label>
      <p>{config ? `PDF, PNG or JPEG · up to ${(config.maxBytes / 1000000).toFixed(1)} MB. Upload and security checks run automatically.` : 'Checking secure upload availability…'}</p>
      {config && <p className="sabi-document-privacy">{config.privacy}</p>}
      {config && !config.enabled && <p role="status">Secure intake is temporarily unavailable. Your existing documents remain accessible.</p>}
    </div>
    <label className="sabi-document-filter">Show<select aria-label="Filter documents by type" value={filter} onChange={(e) => { setPage(1); setFilter(e.target.value); }}>{[{ value: '', label: 'All documents' }, ...DOCUMENT_KINDS].map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></label>
    {loading ? <p className="sabi-document-empty" role="status"><LoaderCircle className="sabi-document-spinner" size={18} />Loading your documents…</p> : items.length ? <div className="sabi-document-grid">{items.map((d) => <article key={d.id} className="sabi-document-card">
      <div className="sabi-document-file"><FileText size={22} aria-hidden="true" /><div><h3>{d.filename}</h3><p>{d.kindLabel} · {Math.ceil(d.byteSize / 1024)} KB · {date(d.createdAt)}</p></div></div>
      <span className={`sabi-document-status ${d.tone}`}>{d.scanErrorCode ? 'Security check delayed' : d.statusLabel}</span>
      {d.scanErrorCode && <p className="sabi-document-hint">The scanner could not finish. The file is still private and cannot be opened.</p>}
      {d.status === 'PENDING_CLINICAL_REVIEW' && <p className="sabi-document-hint">This prescription still needs clinical review before it can be used for dispensing.</p>}
      <div className="sabi-document-actions">{d.downloadable && <><button type="button" disabled={busy} onClick={() => open(d)}>Preview</button><button type="button" disabled={busy} onClick={() => manageSharing(d)}><Share2 size={15} />Share</button></>}
        {d.status === 'PENDING_SCAN' && d.scanErrorCode && d.scanAttempts >= 5 && <button type="button" disabled={busy} onClick={() => run(async () => { await retryDocumentScan(d.id); setMessage('Security check queued again.'); await load(true); })}>Retry security check</button>}
        <button type="button" className="sabi-document-delete" aria-label={`Delete ${d.filename}`} disabled={busy} onClick={() => setRemoving(d)}><Trash2 size={16} /></button></div>
    </article>)}</div> : <p className="sabi-document-empty">{filter ? 'No documents of this type yet.' : 'Add your first document. Selecting a file starts the upload automatically.'}</p>}
    {total > 12 && <nav className="sabi-document-pagination" aria-label="Document pages"><button type="button" disabled={page === 1 || loading} onClick={() => setPage((p) => p - 1)}>Previous</button><span>Page {page} of {Math.ceil(total / 12)}</span><button type="button" disabled={page * 12 >= total || loading} onClick={() => setPage((p) => p + 1)}>Next</button></nav>}
    {preview && <Dialog title={preview.filename} onClose={() => setPreview(null)}><div className="sabi-document-preview">{preview.contentType?.startsWith('image/') ? <img src={preview.url} alt={preview.filename} referrerPolicy="no-referrer" /> : <iframe title={`Preview of ${preview.filename}`} src={preview.url} sandbox="allow-same-origin" referrerPolicy="no-referrer" />}</div><p className="sabi-document-hint">Private access link expires after one minute. Close and reopen to refresh it.</p><a className="sabi-document-open" href={preview.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Open document in a new tab</a></Dialog>}
    {sharing && <SharingDialog state={sharing} busy={busy} error={error} message={message} onClose={() => { if (!busy) setSharing(null); }} onAction={(work) => run(async () => { await work(); const shares = await documentShares(sharing.doc.id); setSharing((old) => old ? { ...old, shares: shares.items } : null); setMessage('Document sharing updated.'); })} />}
    {removing && <Dialog title="Delete document?" onClose={() => setRemoving(null)}><p>“{removing.filename}” will no longer be accessible. Its sharing permissions will be revoked.</p><div className="sabi-document-actions"><button type="button" disabled={busy} onClick={() => setRemoving(null)}>Cancel</button><button type="button" disabled={busy} onClick={() => run(async () => { await deleteDocument(removing.id); setRemoving(null); setMessage('Document deleted; shared access revoked.'); await load(true); })}>{busy ? 'Deleting…' : 'Delete document'}</button></div></Dialog>}
  </section>;
}
function SharingDialog({ state, busy, error, message, onAction, onClose }) {
  const [recipient, setRecipient] = useState(state.recipients[0]?.id || ''), [days, setDays] = useState('7');
  return <Dialog title="Share this document" onClose={onClose}><p>Choose a doctor or caregiver already connected to your care. Access expires automatically and can be revoked at any time.</p>
    {error && <p role="alert" className="sabi-document-error">{error}</p>}{message && <p role="status" className="sabi-document-success">{message}</p>}
    <form onSubmit={(e) => { e.preventDefault(); void onAction(() => shareDocument(state.doc.id, recipient, new Date(Date.now() + Number(days) * 86400000).toISOString())); }}>
      <label>Share with<select value={recipient} required disabled={busy || !state.recipients.length} onChange={(e) => setRecipient(e.target.value)}>{state.recipients.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.type === 'DOCTOR' ? 'Doctor' : 'Caregiver'}</option>)}</select></label>
      <label>Access expires in<select value={days} disabled={busy} onChange={(e) => setDays(e.target.value)}><option value="1">1 day</option><option value="7">7 days</option><option value="30">30 days</option></select></label>
      <button type="submit" disabled={busy || !recipient}>{busy ? 'Saving…' : 'Grant access'}</button>
    </form>{!state.recipients.length && <p>No eligible care connections yet. Connect to a doctor or a caregiver with records permission before sharing.</p>}
    <h3>Sharing history</h3>{state.shares.length ? state.shares.map((s) => <div className="sabi-document-share-row" key={s.id}><div><strong>{s.name}</strong><p>{s.revokedAt ? 'Access revoked' : new Date(s.expiresAt) <= new Date() ? 'Access expired' : `Expires ${date(s.expiresAt)}`}</p></div>{!s.revokedAt && new Date(s.expiresAt) > new Date() && <button type="button" disabled={busy} onClick={() => onAction(() => revokeDocumentShare(state.doc.id, s.id))}>Revoke</button>}</div>) : <p>This document has not been shared.</p>}
  </Dialog>;
}
