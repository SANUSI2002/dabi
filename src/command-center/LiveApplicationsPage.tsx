import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ClipboardCheck, Loader2 } from 'lucide-react';
import { livePlatformApplicationDetail, livePlatformApplications, type LivePlatformApplication, type LivePlatformApplicationDetail } from '@/registration/livePlatform';
import { CommandButton, CommandPageHeader, Panel, PanelHeader, StatusPill } from './components/ui';

const filters = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFORMATION', 'REJECTED'] as const;
type Filter = typeof filters[number];

function Fact({ label, value }: { label: string; value?: string | number | null }) {
  return <div className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900">{value || 'Not provided'}</dd></div>;
}

function Detail({ application, back }: { application: LivePlatformApplicationDetail; back: () => void }) {
  const { owner, organization, corporate, regulatoryRegistration, operatingOfficer, facility, selectedProducts } = application.details;
  return <>
    <CommandPageHeader eyebrow="Sabi OS · Verification center" title={application.reference} description="Server-owned application facts for authorized review. This page does not approve or activate a tenant." actions={<CommandButton variant="secondary" onClick={back}><ArrowLeft size={15}/> Back to queue</CommandButton>} />
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle size={18} className="shrink-0"/><span>No compliance evidence has been securely uploaded or verified. Do not approve or provision this organization from these declarations.</span></div>
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
    setSelectedId(''); setDetail(null); setDetailError('');
  }

  function select(id: string) { setSelectedId(id); setDetail(null); setDetailError(''); }
  function back() { setSelectedId(''); setDetail(null); setDetailError(''); }

  if (selectedId) return detail ? <Detail application={detail} back={back}/> : <><CommandPageHeader title="Application detail" actions={<CommandButton variant="secondary" onClick={back}><ArrowLeft size={15}/> Back to queue</CommandButton>}/><Panel><div className="p-5 text-sm" role={detailError ? 'alert' : 'status'}>{detailError || <span className="inline-flex items-center gap-2"><Loader2 size={16} className="animate-spin"/> Loading verified application…</span>}</div></Panel></>;

  return <>
    <CommandPageHeader eyebrow="Sabi OS · Customers" title="Verification center" description="Email-verified hospital applications in the server-owned review queue. Only authorized platform reviewers can see these declarations." />
    <Panel>
      <PanelHeader title="Applications" description="Select a row to inspect declared facts; evidence review and decisions are not connected yet" action={<ClipboardCheck size={18} className="text-emerald-700"/>}/>
      <div className="flex flex-wrap gap-2 border-b border-slate-100 px-4 py-3" role="group" aria-label="Application status">{filters.map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => changeFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${filter === value ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{value.replaceAll('_', ' ')}</button>)}</div>
      {error ? <p role="alert" className="p-5 text-sm text-red-700">{error}</p> : loading && page === 1 ? <p role="status" className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 size={16} className="animate-spin"/> Loading applications…</p> : items.length === 0 ? <p className="p-5 text-sm text-slate-500">No {filter.toLowerCase().replaceAll('_', ' ')} applications.</p> : <div className="divide-y divide-slate-100">{items.map((item) => <button key={item.id} type="button" onClick={() => select(item.id)} className="grid w-full gap-2 px-5 py-4 text-left text-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 sm:grid-cols-[1fr_2fr_1fr]"><span className="font-semibold text-slate-700">{item.reference}</span><span>{item.organizationName}</span><StatusPill status={item.status}/></button>)}</div>}
      {nextPage && <div className="border-t border-slate-100 p-4"><CommandButton variant="secondary" disabled={loading} onClick={() => { setLoading(true); setPage(nextPage); }}>{loading ? 'Loading…' : 'Load more'}</CommandButton></div>}
    </Panel>
  </>;
}
