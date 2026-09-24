import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Loader2 } from 'lucide-react';
import { liveAddReviewNote, liveApprovalReadiness, livePlatformApplicationDetail, livePlatformApplications, livePlatformEvidence, liveReviewNotes, liveStartApplicationReview, type LiveApprovalReadiness, type LiveEvidence, type LivePlatformApplication, type LivePlatformApplicationDetail, type LiveReviewNote } from '@/registration/livePlatform';
import { CommandButton, CommandPageHeader, Panel, PanelHeader, StatusPill } from './components/ui';

const filters = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'REJECTED'] as const;
type Filter = typeof filters[number];

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value || 'Not provided'}</dd></div>;
}

function Detail({ application, back, startReview, starting, actionError }: { application: LivePlatformApplicationDetail; back: () => void; startReview: () => void; starting: boolean; actionError: string }) {
  const [confirming, setConfirming] = useState(false);
  const [readiness, setReadiness] = useState<LiveApprovalReadiness | null>(null);
  const [readinessError, setReadinessError] = useState('');
  const [notes, setNotes] = useState<LiveReviewNote[]>([]);
  const [note, setNote] = useState('');
  const [notesError, setNotesError] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [evidence, setEvidence] = useState<LiveEvidence[]>([]);
  const [evidenceError, setEvidenceError] = useState('');
  const [evidenceLoading, setEvidenceLoading] = useState(true);
  useEffect(() => {
    let active = true;
    liveApprovalReadiness(application.id).then((result) => { if (active) setReadiness(result.data); })
      .catch((cause) => { if (active) setReadinessError(cause instanceof Error ? cause.message : 'Could not check approval requirements.'); });
    return () => { active = false; };
  }, [application.id, application.status]);
  useEffect(() => {
    let active = true;
    liveReviewNotes(application.id).then((result) => { if (active) setNotes(result.data.items); })
      .catch((cause) => { if (active) setNotesError(cause instanceof Error ? cause.message : 'Could not load review notes.'); });
    return () => { active = false; };
  }, [application.id]);
  useEffect(() => {
    let active = true;
    livePlatformEvidence(application.id).then((result) => { if (active) setEvidence(result.data.items); })
      .catch((cause) => { if (active) setEvidenceError(cause instanceof Error ? cause.message : 'Could not load evidence metadata.'); })
      .finally(() => { if (active) setEvidenceLoading(false); });
    return () => { active = false; };
  }, [application.id]);
  async function addNote() {
    if (savingNote || note.trim().length < 10) return;
    setSavingNote(true); setNotesError('');
    try {
      const result = await liveAddReviewNote(application.id, note.trim());
      setNotes((current) => [result.data, ...current]);
      setNote('');
    } catch (cause) { setNotesError(cause instanceof Error ? cause.message : 'Could not save review note.'); }
    finally { setSavingNote(false); }
  }
  const { owner, organization, corporate, regulatoryRegistration, operatingOfficer, facility, selectedProducts } = application.details;
  return <>
    <CommandPageHeader eyebrow="Sabi OS · Verification center" title={application.reference} description="Server-owned application facts for authorized review. This page does not approve or activate a tenant." actions={<CommandButton variant="secondary" onClick={back}><ArrowLeft size={15}/> Back to queue</CommandButton>} />
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/><span>Evidence may be present in private quarantine. No file can be previewed or treated as authentic until malware scanning and reviewer verification are enabled. EMR approval remains blocked.</span></div>
    <Panel className="mb-4"><PanelHeader title="EMR approval gates" description="Checked by the backend; no approval, credential email, or tenant activation is available until every gate passes."/><div className="p-5 text-sm">{readinessError ? <p role="alert" className="text-red-700">{readinessError}</p> : !readiness ? <p role="status" className="inline-flex items-center gap-2 text-slate-500"><Loader2 size={16} className="animate-spin"/> Checking requirements…</p> : <><p className="font-semibold text-amber-800">{readiness.ready ? 'Checks passed; final approval workflow remains disabled.' : `${readiness.blockers.length} approval requirement${readiness.blockers.length === 1 ? '' : 's'} outstanding`}</p><ul className="mt-3 grid gap-2 sm:grid-cols-2">{readiness.blockers.map((blocker) => <li key={blocker} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{blocker.replaceAll('_', ' ').replace(':', ': ')}</li>)}</ul></>}</div></Panel>
    <Panel className="mb-4"><PanelHeader title="Submitted evidence" description="Append-only document metadata. File preview and authenticity decisions are deliberately unavailable until scanning and audited review are implemented."/><div className="p-5">{evidenceError ? <p role="alert" className="text-sm text-red-700">{evidenceError}</p> : evidenceLoading ? <p role="status" className="text-sm text-slate-500">Loading evidence history…</p> : evidence.length === 0 ? <p className="text-sm text-slate-500">No evidence submissions recorded.</p> : <ol className="space-y-3">{evidence.map((item) => <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm text-slate-900">{item.requirementKey.replaceAll('_', ' ')}</b><span className="text-xs font-semibold text-amber-800">Scan: {item.scanStatus} · Review: {item.reviewStatus}</span></div><p className="mt-1 text-xs text-slate-500">{item.fileName} · {Math.round(item.sizeBytes / 1024)} KB · {new Date(item.createdAt).toLocaleString()}</p><p className="mt-1 break-all font-mono text-[11px] text-slate-500">SHA-256: {item.sha256}</p></li>)}</ol>}</div></Panel>
    {application.status === 'SUBMITTED' && <Panel className="mb-4"><PanelHeader title="Begin review" description="An authorized reviewer can move this verified submission to Under review. This does not approve the organization."/><div className="flex flex-wrap items-center gap-3 p-4">{confirming ? <><CommandButton disabled={starting} onClick={startReview}>{starting ? 'Starting…' : 'Confirm start review'}</CommandButton><CommandButton variant="secondary" disabled={starting} onClick={() => setConfirming(false)}>Cancel</CommandButton></> : <CommandButton onClick={() => setConfirming(true)}>Begin review</CommandButton>}{actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}</div></Panel>}
    <Panel className="mb-4"><PanelHeader title="Manual review log" description="Record checks and questions for the Sabi team. Notes are server-owned and audited; they do not verify documents or grant EMR access."/><div className="space-y-4 p-5">{application.status === 'UNDER_REVIEW' && <div><label htmlFor="manual-review-note" className="mb-2 block text-sm font-semibold text-slate-800">Reviewer observation</label><textarea id="manual-review-note" className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-500" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Record what was checked, the source, and what still needs verification."/><div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-slate-500">At least 10 characters. Do not paste passwords, identity documents, or medical data.</span><CommandButton disabled={savingNote || note.trim().length < 10} onClick={addNote}>{savingNote ? 'Saving…' : 'Save note'}</CommandButton></div></div>}{notesError && <p role="alert" className="text-sm text-red-700">{notesError}</p>}{notes.length === 0 ? <p className="text-sm text-slate-500">No reviewer notes yet.</p> : <ol className="space-y-3">{notes.map((item) => <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="whitespace-pre-wrap break-words text-sm text-slate-800">{item.note}</p><p className="mt-2 text-xs text-slate-500">{new Date(item.createdAt).toLocaleString()} · Reviewer {item.reviewerId}</p></li>)}</ol>}</div></Panel>
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel><PanelHeader title="Application & package" description="The selected package version is pinned at submission"/><dl className="grid gap-4 p-5 sm:grid-cols-2"><Fact label="Status" value={application.status}/><Fact label="Submitted" value={application.submittedAt ? new Date(application.submittedAt).toLocaleString() : null}/><Fact label="Email verified" value={application.emailVerifiedAt ? new Date(application.emailVerifiedAt).toLocaleString() : null}/><Fact label="Billing cycle" value={application.billingCycle}/><Fact label="Package ID" value={application.packageId}/><Fact label="Package version ID" value={application.packageVersionId}/><Fact label="Products" value={selectedProducts.join(', ')}/></dl></Panel>
      <Panel><PanelHeader title="Applicant" description="Contact details declared by the person submitting"/><dl className="grid gap-4 p-5 sm:grid-cols-2"><Fact label="Name" value={`${owner.firstName} ${owner.lastName}`}/><Fact label="Work email" value={owner.workEmail}/><Fact label="Phone" value={owner.phone}/></dl></Panel>
      <Panel><PanelHeader title="Organization" description="Declared business and facility identity"/><dl className="grid gap-4 p-5 sm:grid-cols-2"><Fact label="Legal name" value={organization.legalName}/><Fact label="Trading name" value={organization.tradingName}/><Fact label="Facility type" value={organization.facilityType}/><Fact label="Ownership" value={organization.ownershipType}/><Fact label="Location" value={[organization.city, organization.state, organization.country].filter(Boolean).join(', ')}/><Fact label="Address" value={organization.address}/><Fact label="Official email" value={organization.officialEmail}/><Fact label="Official phone" value={organization.officialPhone}/><Fact label="Corporate number" value={corporate.registrationNumber}/><Fact label="Registered legal name" value={corporate.registeredLegalName}/></dl></Panel>
      <Panel><PanelHeader title="Regulation & clinical lead" description="Declared credentials require independent verification"/><dl className="grid gap-4 p-5 sm:grid-cols-2"><Fact label="Facility regulator" value={regulatoryRegistration.regulatorId}/><Fact label="Facility licence" value={regulatoryRegistration.registrationNumber}/><Fact label="Licence expiry" value={regulatoryRegistration.expiryDate}/><Fact label="Operating officer" value={operatingOfficer.fullName}/><Fact label="Officer role" value={operatingOfficer.role}/><Fact label="Professional regulator" value={operatingOfficer.regulatorId}/><Fact label="Professional registration" value={operatingOfficer.registrationNumber}/><Fact label="Practising licence" value={operatingOfficer.practisingLicenceNumber}/><Fact label="Practising expiry" value={operatingOfficer.licenceExpiryDate}/><Fact label="Facilities" value={facility.facilities}/><Fact label="Beds" value={facility.beds}/></dl></Panel>
    </div>
  </>;
}

export default function LiveApplicationsPage() {
  const [filter, setFilter] = useState<Filter>('SUBMITTED');
  const [items, setItems] = useState<LivePlatformApplication[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<LivePlatformApplicationDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [actionError, setActionError] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    livePlatformApplications(filter, page).then((result) => {
      if (!active) return;
      setItems((current) => page === 1 ? result.data.items : [...current, ...result.data.items]);
      setNextPage(result.data.nextPage);
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load applications.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [filter, page]);

  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    livePlatformApplicationDetail(selectedId).then((result) => { if (active) setDetail(result.data); })
      .catch((cause) => { if (active) setDetailError(cause instanceof Error ? cause.message : 'Could not load application detail.'); });
    return () => { active = false; };
  }, [selectedId]);

  function changeFilter(value: Filter) {
    setFilter(value); setPage(1); setItems([]); setLoading(true); setError('');
    setSelectedId(''); setDetail(null); setDetailError(''); setActionError('');
  }

  function select(id: string) { setSelectedId(id); setDetail(null); setDetailError(''); setActionError(''); }
  function back() { setSelectedId(''); setDetail(null); setDetailError(''); setActionError(''); }
  async function startReview() {
    if (!detail || starting) return;
    setStarting(true); setActionError('');
    try {
      const result = await liveStartApplicationReview(detail.id);
      setDetail(result.data);
      setItems((current) => filter === 'SUBMITTED' ? current.filter((item) => item.id !== detail.id) : current.map((item) => item.id === detail.id ? { ...item, status: result.data.status } : item));
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not start review. Refresh the application and try again.'); }
    finally { setStarting(false); }
  }

  if (selectedId) return detail ? <Detail key={`${detail.id}:${detail.status}`} application={detail} back={back} startReview={startReview} starting={starting} actionError={actionError}/> : <><CommandPageHeader title="Application detail" actions={<CommandButton variant="secondary" onClick={back}><ArrowLeft size={15}/> Back to queue</CommandButton>}/><Panel><div className="p-5 text-sm" role={detailError ? 'alert' : 'status'}>{detailError || <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin"/> Loading verified application…</span>}</div></Panel></>;

  return <>
    <CommandPageHeader eyebrow="Sabi OS · Customers" title="Verification center" description="Email-verified hospital applications in the server-owned review queue. Only authorized platform reviewers can see these declarations." />
    <Panel>
      <PanelHeader title="Applications" description="Select a row to inspect declarations and record manual review observations. Document evidence and approval remain gated." action={<ClipboardCheck size={18} className="text-emerald-700"/>}/>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3" role="group" aria-label="Application status">{filters.map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => changeFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === value ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value.replaceAll('_', ' ')}</button>)}</div>
      {error ? <p role="alert" className="p-5 text-sm text-red-700">{error}</p> : loading && page === 1 ? <p role="status" className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Loading applications…</p> : items.length === 0 ? <p className="p-5 text-sm text-slate-500">No {filter.toLowerCase().replaceAll('_', ' ')} applications.</p> : <div className="divide-y divide-slate-100">{items.map((item) => <button key={item.id} type="button" onClick={() => select(item.id)} className="grid w-full gap-2 px-5 py-4 text-left text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 sm:grid-cols-[1fr_2fr_1fr]"><span className="font-semibold text-slate-700">{item.reference}</span><span>{item.organizationName}</span><StatusPill status={item.status}/></button>)}</div>}
      {nextPage && <div className="border-t border-slate-100 p-4"><CommandButton variant="secondary" disabled={loading} onClick={() => { setLoading(true); setPage(nextPage); }}>{loading ? 'Loading…' : 'Load more'}</CommandButton></div>}
    </Panel>
  </>;
}
