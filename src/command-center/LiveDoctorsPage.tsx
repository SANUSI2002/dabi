import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { liveApiRequest } from '@/identity/liveIdentity';
import { CommandButton, CommandInput, CommandPageHeader, CommandSelect, Panel, PanelHeader, StatusPill } from './components/ui';

const BASE = '/command-center/sabi-health/doctors';
type Credential = { id: string; kind: string; contentType?: string; scanStatus: string; scanErrorCode?: string; reviewStatus: string; sourceName?: string; reference?: string; note?: string; byteSize: number; sha256: string };
type Application = { id: string; userId: string; applicationId?: string; name: string; email: string; emailVerified: boolean; status: string; specialty: string; registrationNumber: string; submittedAt?: string; decisionReason?: string; details?: Record<string, string>; credentials: Credential[]; blockers: string[]; emailSent?: boolean };
type QueueItem = { id: string; specialty: string; verificationStatus: string; user: { full_name: string; email: string; emailVerifiedAt?: string }; doctorApplication?: { submittedAt?: string } };
export function safeCredentialPreview(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co') && !url.username && !url.password && url.pathname.includes('/storage/v1/object/sign/'); } catch { return false; }
}

function CredentialReview({ doc, editable, busy, perform }: { doc: Credential; editable: boolean; busy: boolean; perform: (suffix: string, body?: unknown) => Promise<void> }) {
  const [source, setSource] = useState(doc.sourceName || '');
  const [reference, setReference] = useState(doc.reference || '');
  const [note, setNote] = useState(doc.note || '');
  const [decision, setDecision] = useState('VERIFIED');
  return <Panel><PanelHeader title={doc.kind === 'licence' ? 'Practising licence' : 'MDCN registration certificate'} action={<StatusPill status={doc.scanStatus} />} />
    <div className="space-y-3 p-4 text-sm"><p>Document review: <strong>{doc.reviewStatus === 'VERIFIED' ? 'Accepted' : doc.reviewStatus === 'REJECTED' ? 'Rejected' : 'Awaiting review'}</strong> · {(doc.byteSize / 1024).toFixed(0)} KB</p>
      <CommandButton variant="secondary" disabled={busy || doc.scanStatus !== 'CLEAN'} onClick={() => perform(`/credentials/${doc.id}/preview`)}>Preview document</CommandButton>
      {doc.scanStatus === 'PENDING' && <p role="status" className="rounded-lg bg-blue-50 p-3 text-blue-800">Malware scanning is running in the background. This page updates automatically; preview becomes available when the document passes.</p>}
      {doc.scanErrorCode && <p role="status" className="text-amber-800">Scanner: {doc.scanErrorCode}</p>}
      {doc.scanStatus === 'FAILED' && <CommandButton variant="secondary" disabled={busy} onClick={() => perform(`/credentials/${doc.id}/retry-scan`, {})}>Retry operational scan failure</CommandButton>}
      <p className="text-xs leading-5 text-slate-500">Malware screening does not verify a licence. Check the relevant regulator or issuing authority independently, then record your source, reference and findings. Pending, infected and rejected files cannot be previewed.</p>
      {editable && doc.scanStatus === 'CLEAN' ? <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); perform(`/credentials/${doc.id}/review`, { reviewStatus: decision, sourceName: source, reference, note }); }}>
        <label className="block">Verification source<CommandInput className="mt-1 w-full" required maxLength={160} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Regulator / issuing authority" /></label>
        <label className="block">Verification reference<CommandInput className="mt-1 w-full" required maxLength={250} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Registry reference or verification record" /></label>
        <label className="block">Findings (at least 20 characters)<textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-200 p-3" required minLength={20} maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <label className="block">Authenticity decision<CommandSelect className="ml-2" value={decision} onChange={(event) => setDecision(event.target.value)}><option value="VERIFIED">Verified</option><option value="REJECTED">Rejected</option></CommandSelect></label>
        <CommandButton disabled={busy}>{decision === 'VERIFIED' ? 'Accept document' : 'Reject document'}</CommandButton>
      </form> : doc.note && <p className="rounded-lg bg-slate-50 p-3">{doc.sourceName} · {doc.reference}<br />{doc.note}</p>}
    </div></Panel>;
}

export default function LiveDoctorsPage({ canApprove, userId }: { canApprove: boolean; userId: string }) {
  const location = useLocation();
  const id = location.pathname.slice(BASE.length + 1).split('/')[0];
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [preview, setPreview] = useState<{ url: string; label: string; contentType?: string } | null>(null);
  async function load(silent = false) {
    if (!silent) setLoading(true);
    setError('');
    try {
      if (id) { const result = await liveApiRequest<{ data: Application }>(`/api/v1/platform/doctors/${id}`); setApplication(result.data); }
      else { const result = await liveApiRequest<{ data: { items: QueueItem[]; nextPage: number | null } }>(`/api/v1/platform/doctors?status=${status}&page=${page}`); setQueue(result.data.items); setNextPage(result.data.nextPage); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Doctor applications could not be loaded.'); }
    finally { if (!silent) setLoading(false); }
  }
  useEffect(() => { setApplication(null); setConfirm(false); setNotice(''); load(); }, [id, status, page]);
  useEffect(() => {
    if (!id || busy || error || !application?.credentials.some((doc) => doc.scanStatus === 'PENDING')) return;
    let stopped = false, polling = false;
    const timer = setInterval(async () => {
      if (polling || document.visibilityState !== 'visible') return;
      polling = true;
      try {
        const result = await liveApiRequest<{ data: Application }>(`/api/v1/platform/doctors/${id}`);
        if (!stopped) setApplication(result.data);
      } catch (cause) { if (!stopped) setError(cause instanceof Error ? cause.message : 'Status refresh failed.'); }
      finally { polling = false; }
    }, 10000);
    return () => { stopped = true; clearInterval(timer); };
  }, [id, busy, !!error, application?.credentials.some((doc) => doc.scanStatus === 'PENDING')]);
  useEffect(() => { setPreview(null); }, [id]);
  useEffect(() => {
    if (!preview) return;
    const timeout = setTimeout(() => { setPreview(null); setNotice('Document preview expired. Click Preview document to reopen it.'); }, 60000);
    return () => clearTimeout(timeout);
  }, [preview]);
  async function perform(suffix: string, body?: unknown) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      if (suffix.endsWith('/preview')) {
        const result = await liveApiRequest<{ data: { url: string } }>(`/api/v1/platform/doctors/${id}${suffix}`);
        if (!safeCredentialPreview(result.data.url)) throw new Error('The private preview link was not trusted.');
        const doc = application?.credentials.find((item) => suffix.includes(`/credentials/${item.id}/`));
        setPreview({ url: result.data.url, label: doc?.kind === 'licence' ? 'Practising licence' : 'MDCN registration certificate', contentType: doc?.contentType });
      } else {
        const result = await liveApiRequest<{ data: Application & { emailSent?: boolean } }>(`/api/v1/platform/doctors/${id}${suffix}`, { method: 'POST', body: JSON.stringify(body || {}) });
        await load(); setConfirm(false);
        setNotice(result.data.emailSent === false ? 'Decision saved, but approval email failed. Use resend approval email.' : 'Action saved and audited.');
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'This action could not be completed.'); }
    finally { setBusy(false); }
  }
  const self = application?.userId === userId;
  const editable = canApprove && !self && !!application?.submittedAt && ['PENDING', 'REJECTED'].includes(application?.status || '');
  return <>
    <CommandPageHeader eyebrow="Sabi Health · Professional verification" title={application?.name || 'Doctor applications'} description="View uploaded documents, preview them after the automatic security check, and record your review." actions={id ? <div className="flex gap-3"><CommandButton variant="secondary" disabled={loading || busy} onClick={() => load()}>Refresh status</CommandButton><Link to={BASE}>Back to doctor queue</Link></div> : <CommandButton variant="secondary" disabled={loading} onClick={() => load()}>Refresh queue</CommandButton>} />
    {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}<div className="mt-2 flex gap-4"><button disabled={loading} onClick={() => load()}>Retry loading</button><Link to="/identity/mfa?next=command-center">Verify authenticator again</Link></div></div>}
    {notice && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</p>}
    {preview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><section role="dialog" aria-modal="true" aria-label={preview.label} className="flex h-[85vh] w-full max-w-5xl flex-col rounded-xl bg-white p-4"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">{preview.label}</h2><CommandButton autoFocus variant="secondary" onClick={() => setPreview(null)}>Close preview</CommandButton></div>{preview.contentType?.startsWith('image/') ? <img src={preview.url} alt={preview.label} className="min-h-0 flex-1 object-contain" /> : <iframe title={preview.label} src={preview.url} sandbox="allow-same-origin" className="min-h-0 w-full flex-1 rounded-lg border" />}<p className="mt-2 text-xs text-slate-500">Authorized preview · expires after 60 seconds. Close this preview to record your review.</p></section></div>}
    {loading ? <p role="status">Loading server-owned applications…</p> : !id ? <Panel><PanelHeader title="Doctor review queue" action={<CommandSelect aria-label="Application status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} >{['PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED'].map((value) => <option key={value}>{value}</option>)}</CommandSelect>} />
      {queue.length ? <div className="divide-y divide-slate-100">{queue.map((item) => <Link key={item.id} to={`${BASE}/${item.id}`} className="grid gap-2 p-4 text-sm hover:bg-slate-50 sm:grid-cols-[2fr_1fr_1fr]"><span className="font-semibold">{item.user.full_name}<small className="block font-normal text-slate-500">{item.user.email}</small></span><span>{item.specialty}<small className="block text-slate-500">{item.doctorApplication?.submittedAt ? 'Documents submitted' : 'Awaiting applicant'}</small></span><span><StatusPill status={item.verificationStatus} /></span></Link>)}</div> : !error && <p className="p-5 text-sm text-slate-500">No doctor applications with this status.</p>}
      <div className="flex items-center gap-3 p-4"><CommandButton variant="secondary" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Previous</CommandButton><span className="text-sm">Page {page}</span><CommandButton variant="secondary" disabled={!nextPage} onClick={() => nextPage && setPage(nextPage)}>Next</CommandButton></div>
    </Panel> : application && <div className="space-y-4">
      <Panel><PanelHeader title="Application facts" action={<StatusPill status={application.status} />} /><dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">{Object.entries({ Email: application.email, 'Email verification': application.emailVerified ? 'Complete' : 'Pending', Specialty: application.specialty, 'MDCN registration': application.registrationNumber, Qualification: application.details?.qualification, University: application.details?.university, 'Licence type': application.details?.licenceType, 'Licence expiry': application.details?.licenceExpiry, Location: application.details ? `${application.details.city}, ${application.details.practiceState}` : undefined, 'Application reference': application.applicationId }).map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words font-medium">{value || 'Not supplied'}</dd></div>)}</dl></Panel>
      {application.blockers.length > 0 && application.status !== 'VERIFIED' && <Panel><PanelHeader title="Outstanding approval requirements" /><ul className="list-inside list-disc space-y-2 p-4 text-sm text-amber-800">{application.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></Panel>}
      <div className="grid gap-4 xl:grid-cols-2">{application.credentials.map((doc) => <CredentialReview key={doc.id} doc={doc} editable={editable} busy={busy} perform={perform} />)}</div>
      {!application.credentials.length && <Panel><p className="p-5 text-sm text-slate-500">No credentials uploaded. The doctor must verify their email, sign in and upload both documents.</p></Panel>}
      <Panel><PanelHeader title="Workspace access decision" description="Approval checks the latest documents again on the server. No passwords are sent by email." /><div className="space-y-3 p-4 text-sm">
        {self && <p>You cannot review or approve your own application.</p>}
        {!canApprove && <p>Your role can inspect the queue but cannot record authenticity decisions or approve access.</p>}
        {application.decisionReason && <p>Previous decision: {application.decisionReason}</p>}
        {editable && <><label className="flex items-start gap-2"><input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} /><span>I independently verified both credentials and confirm this doctor is eligible for clinical access.</span></label><CommandButton disabled={busy || !confirm || application.blockers.length > 0} onClick={() => perform('/approve', {})}>Approve doctor workspace</CommandButton>
          {application.status === 'PENDING' && <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); perform('/reject', { reason }); }}><label className="block">Reason sent to the applicant in their application status<textarea className="mt-1 min-h-20 w-full rounded-lg border p-3" required minLength={20} maxLength={2000} value={reason} onChange={(event) => setReason(event.target.value)} /></label><CommandButton variant="danger" disabled={busy}>Reject application</CommandButton></form>}
        </>}
        {application.status === 'VERIFIED' && canApprove && !self && <CommandButton variant="secondary" disabled={busy} onClick={() => perform('/resend-approval', {})}>Resend approval email</CommandButton>}
      </div></Panel>
    </div>}
  </>;
}
