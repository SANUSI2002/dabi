import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, FileText, RefreshCw, Upload } from 'lucide-react';

const labels = { QUEUED: 'Queued for extraction', EXTRACTING: 'Reading your document', NEEDS_REVIEW: 'Ready for your review', READY: 'Reviewed by you', FAILED: 'Extraction could not be completed' };
export default function AiDocumentsPanel({ call, config, uploadDocument, onUse, onBack }) {
  const [documents, setDocuments] = useState([]); const [sources, setSources] = useState([]);
  const [detail, setDetail] = useState(null); const [pages, setPages] = useState([]);
  const [consent, setConsent] = useState(false); const [match, setMatch] = useState(false); const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [status, setStatus] = useState(''); const [refresh, setRefresh] = useState(0);
  const [deleteId, setDeleteId] = useState(null); const mounted = useRef(true); const attempts = useRef(new Map());
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const load = useCallback(async (signal) => {
    const [files, existing] = await Promise.all([call('/source-documents', { signal }), call('/sources', { signal })]);
    if (!signal?.aborted && mounted.current) { setDocuments(files.items); setSources(existing.items); }
  }, [call]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal).catch((e) => { if (!controller.signal.aborted) setError(e.message); }); return () => controller.abort(); }, [load, refresh]);
  const processing = sources.some((s) => ['QUEUED','EXTRACTING'].includes(s.state)) || documents.some((d) => ['PENDING_UPLOAD','PENDING_SCAN'].includes(d.status));
  useEffect(() => {
    if (!processing) return undefined;
    const controller = new AbortController(); let timer;
    const poll = async () => { try { await load(controller.signal); } catch (e) { if (!controller.signal.aborted) setError(e.message); } if (!controller.signal.aborted) timer = setTimeout(poll, 5000); };
    timer = setTimeout(poll, 5000); return () => { controller.abort(); clearTimeout(timer); };
  }, [load, processing]);
  async function action(fn) { setBusy(true); setError(''); try { await fn(); } catch (e) { if (mounted.current) setError(e.message || 'The document action could not be completed.'); } finally { if (mounted.current) setBusy(false); } }
  async function extract(documentId) { await action(async () => {
    if (!attempts.current.has(documentId)) attempts.current.set(documentId, crypto.randomUUID());
    await call('/sources', { method: 'POST', body: { documentId, clientRequestId: attempts.current.get(documentId), consentGiven: true, consentVersion: config.documentConsentVersion } });
    setStatus('Your extraction request was received. Processing continues in the background.'); await load();
  }); }
  async function open(id) { await action(async () => { const source = await call(`/sources/${id}`); if (!mounted.current) return; setDetail(source); setPages(source.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text }))); setMatch(false); setReview(false); }); }
  async function preview(source, pageNumber = 1) { await action(async () => {
    const data = await call(`/sources/${source.id}/preview`, { method: 'POST', body: { pageNumber } }); const url = new URL(data.url);
    if (url.protocol !== 'https:') throw new Error('A secure preview URL was not returned.');
    url.hash = `page=${pageNumber}`; window.open(url.toString(), '_blank', 'noopener,noreferrer');
  }); }
  return <div className="sabi-ai-privacy sabi-ai-documents"><button type="button" className="sabi-ai-secondary" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> Conversation</button>
    <h2>Your document workspace</h2><p>Choose only the files you want Sabi to use. Originals stay in your medical records; the extraction is a separate, reviewable copy—not a diagnosis or signed clinical record.</p>
    {error && <p className="sabi-ai-error" role="alert">{error}</p>}<p role="status">{busy ? 'Working securely…' : status}</p>
    {!config?.documents && <p className="sabi-ai-notice">New document AI processing is unavailable. You can still inspect or remove existing extractions.</p>}
    {detail ? <section><h3>{detail.document.originalFilename}</h3><p>{labels[detail.state]}</p>
      {detail.patientLabels?.length > 0 && <p className="sabi-ai-notice">Names printed in this file: {detail.patientLabels.join(', ')}. Confirm the file belongs to you before using it. Sabi has not verified identity from the file.</p>}
      {pages.map((p, i) => <section className="sabi-ai-source-page" key={p.pageNumber}><h3>Page {p.pageNumber}</h3><button disabled={busy} className="sabi-ai-secondary" onClick={() => preview(detail, p.pageNumber)}>Open original page {p.pageNumber}</button>
        {detail.pages[i].uncertain && <p>Some text may be unclear. Compare it with the original.</p>}
        <label>Review extracted text<textarea rows={9} maxLength={12000} value={p.text} onChange={(e) => setPages((old) => old.map((item) => item.pageNumber === p.pageNumber ? { ...item, text: e.target.value } : item))} /></label>
        {detail.pages[i].fields?.length > 0 && <details><summary>Unverified extracted results</summary><div className="sabi-ai-source-table"><table><thead><tr><th>Printed test</th><th>Value</th><th>Unit</th><th>Printed range</th></tr></thead><tbody>{detail.pages[i].fields.map((f, n) => <tr key={n}><td>{f.label}</td><td>{f.value}</td><td>{f.unit ?? 'Not printed'}</td><td>{f.referenceRange ?? 'Not printed'}</td></tr>)}</tbody></table></div><p>These candidates are not written to your health record. Corrections above apply to the text Sabi can explain, not to this original extraction.</p></details>}
      </section>)}
      {['NEEDS_REVIEW','READY'].includes(detail.state) && <form className="sabi-ai-memory-form" onSubmit={(e) => { e.preventDefault(); void action(async () => { await call(`/sources/${detail.id}/review`, { method: 'POST', body: { revision: detail.revision, patientMatchConfirmed: true, extractionReviewed: true, pages } }); setStatus('Extraction reviewed. You can now choose it in your conversation.'); setDetail(null); await load(); }); }}>
        <label className="sabi-ai-source-check"><input type="checkbox" checked={match} onChange={(e) => setMatch(e.target.checked)} /> This is my document; I checked the printed patient details.</label>
        <label className="sabi-ai-source-check"><input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} /> I compared every extracted page with the original. This does not certify clinical accuracy.</label>
        <button className="sabi-ai-primary" disabled={busy || !match || !review}><Check size={17} aria-hidden="true" /> Save reviewed extraction</button></form>}
      <button className="sabi-ai-secondary" disabled={busy} onClick={() => setDetail(null)}>Back to my documents</button>
    </section> : <>
      {uploadDocument && <section><h3>Add a medical document</h3><label className="sabi-ai-secondary"><Upload size={17} aria-hidden="true" /> Choose a PDF or image<input className="sabi-ai-sr" aria-label="Upload a document for your AI workspace" type="file" accept="application/pdf,image/png,image/jpeg" disabled={busy || !config?.documents} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void action(async () => { await uploadDocument(file); setStatus('File received. Security screening runs automatically before you can request AI extraction.'); await load(); }); }} /></label><p>Up to 3.5 MB; PDFs up to 20 pages. Uploading runs security checks first, not AI extraction.</p></section>}
      <h3>AI extractions</h3>{!sources.length && <p>No AI document copies yet.</p>}
      {sources.map((s) => <article className="sabi-ai-source-card" key={s.id}><FileText size={20} aria-hidden="true" /><div><strong>{s.document.originalFilename}</strong><p>{labels[s.state] || s.state}</p>{s.errorCode && <p>Reference: {s.errorCode}. The original is unchanged. Remove this failed extraction to request a fresh attempt.</p>}</div><div>
        <button className="sabi-ai-secondary" disabled={busy} onClick={() => open(s.id)}>Review</button>{s.state === 'READY' && <button className="sabi-ai-primary" disabled={busy} onClick={() => onUse(s)}>Use in conversation</button>}
        {deleteId === s.id ? <><p>Remove the AI copy and revoke answers based on it? Your original stays in your records.</p><button disabled={busy} onClick={() => void action(async () => { await call(`/sources/${s.id}`, { method: 'DELETE', body: { confirm: true } }); attempts.current.delete(s.documentId); setDeleteId(null); setStatus('AI copy removed. The original file is unchanged.'); await load(); })}>Confirm removal</button><button disabled={busy} onClick={() => setDeleteId(null)}>Keep it</button></> : <button disabled={busy} onClick={() => setDeleteId(s.id)}>Remove AI copy</button>}
      </div></article>)}
      <h3>Files in your records</h3><p>Only screened files can be sent for AI extraction. Files are processed through Sabi’s configured Google AI provider.</p>
      <label className="sabi-ai-source-check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> I agree to send the selected medical file to Google for extraction. It can contain sensitive health information.</label>
      {documents.map((doc) => <article className="sabi-ai-source-card" key={doc.id}><FileText size={20} aria-hidden="true" /><div><strong>{doc.originalFilename}</strong><p>{doc.status === 'CLEAN' ? 'Security screening passed' : doc.status.replaceAll('_',' ').toLowerCase()}</p></div><button className="sabi-ai-secondary" disabled={busy || !consent || !config?.documents || doc.status !== 'CLEAN' || sources.some((s) => s.documentId === doc.id)} onClick={() => extract(doc.id)}>Extract for review</button></article>)}
      {!documents.length && <p>No uploaded medical files yet.</p>}<button className="sabi-ai-secondary" disabled={busy} onClick={() => setRefresh((x) => x + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh documents</button>
    </>}
  </div>;
}
