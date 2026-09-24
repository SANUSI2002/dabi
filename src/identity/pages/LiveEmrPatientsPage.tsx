import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Search, UserRoundPlus } from 'lucide-react';
import { liveApiRequest, liveSelectEmrOrganization, restoreLiveIdentity, type LiveEmrAccess } from '../liveIdentity';

type Patient = {
  id: string; medicalRecordNumber: string; givenName: string; familyName: string;
  dateOfBirth: string; sex: 'FEMALE' | 'MALE' | 'OTHER' | 'UNKNOWN'; createdAt: string;
};
type ListResponse = { data: { items: Patient[]; nextPage: number | null } };
const emptyForm = { medicalRecordNumber: '', givenName: '', familyName: '', dateOfBirth: '', sex: 'UNKNOWN' as Patient['sex'] };

export default function LiveEmrPatientsPage() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const [access, setAccess] = useState<LiveEmrAccess | null>(null);
  const [items, setItems] = useState<Patient[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Patient registry | Sabi EMR';
    let active = true;
    async function verify() {
      try {
        const identity = await restoreLiveIdentity();
        if (!identity) { navigate('/emr/login', { replace: true }); return; }
        if (!organizationId) throw new Error('Choose an organization to continue.');
        const selected = await liveSelectEmrOrganization(organizationId);
        if (!selected.patientRegistryEnabled) throw new Error('The patient registry is not enabled in this test environment.');
        if (!selected.permissions.includes('patient.read')) throw new Error('Your organization role does not permit patient access.');
        if (active) setAccess(selected);
      } catch (cause) { if (active) { setError(cause instanceof Error ? cause.message : 'Patient access is unavailable.'); setLoading(false); } }
    }
    void verify();
    return () => { active = false; };
  }, [organizationId, navigate]);

  useEffect(() => {
    if (!access) return;
    let active = true;
    liveApiRequest<ListResponse>(`/api/v1/emr/organizations/${encodeURIComponent(access.organizationId)}/patients?page=${page}&q=${encodeURIComponent(query)}`)
      .then((result) => { if (active) { setItems(result.data.items); setNextPage(result.data.nextPage); setError(''); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load patients.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [access, page, query]);

  async function register(event: FormEvent) {
    event.preventDefault();
    if (!access || busy) return;
    setBusy(true); setError('');
    try {
      await liveApiRequest(`/api/v1/emr/organizations/${encodeURIComponent(access.organizationId)}/patients`, {
        method: 'POST', body: JSON.stringify(form),
      });
      setForm(emptyForm);
      setPage(1);
      const result = await liveApiRequest<ListResponse>(`/api/v1/emr/organizations/${encodeURIComponent(access.organizationId)}/patients?page=1&q=${encodeURIComponent(query)}`);
      setItems(result.data.items); setNextPage(result.data.nextPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Patient registration failed.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f4faf6] px-5 py-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <Link to={`/emr/workspace/${organizationId ?? ''}`} className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800"><ArrowLeft size={16}/> EMR workspace</Link>
      <div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Sabi OS · EMR</p><h1 className="mt-2 font-display text-3xl font-extrabold text-slate-950">Patient registry</h1><p className="mt-2 text-sm text-slate-600">{access?.organizationName ?? 'Verifying organization access'}</p></div>
      <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>Test-only clinical workflow.</b> Use synthetic patient details only. The current test database has no production backup or retention plan.</div>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {!access ? loading && <p role="status" className="inline-flex items-center gap-2 text-sm text-slate-600"><Loader2 size={17} className="animate-spin"/> Checking EMR access…</p> : <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-xl font-bold text-slate-950">Patients</h2>
          <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(searchInput.trim()); }}><label className="sr-only" htmlFor="emr-patient-search">Search patients</label><input id="emr-patient-search" className="input flex-1" maxLength={50} placeholder="Search name or medical record number" value={searchInput} onChange={(event) => setSearchInput(event.target.value)}/><button className="rounded-lg bg-emerald-900 px-4 py-2 text-white" aria-label="Search"><Search size={17}/></button></form>
          {loading ? <p role="status" className="mt-6 text-sm text-slate-500">Loading patients…</p> : items.length ? <ul className="mt-5 divide-y divide-slate-100">{items.map((patient) => <li key={patient.id} className="flex flex-wrap items-center justify-between gap-2 py-4"><div><p className="font-semibold text-slate-900">{patient.givenName} {patient.familyName}</p><p className="text-xs text-slate-500">{patient.medicalRecordNumber} · Born {patient.dateOfBirth.slice(0, 10)}</p></div><span className="text-xs text-slate-500">{patient.sex}</span></li>)}</ul> : <p className="mt-6 text-sm text-slate-500">No patients found for this organization.</p>}
          <div className="mt-5 flex gap-2"><button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="px-2 py-2 text-sm text-slate-500">Page {page}</span><button className="rounded-lg border px-3 py-2 text-sm disabled:opacity-40" disabled={!nextPage} onClick={() => setPage((value) => value + 1)}>Next</button></div>
        </section>
        {access.permissions.includes('patient.register') && <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><UserRoundPlus size={20} className="text-emerald-800"/><h2 className="font-display text-xl font-bold text-slate-950">Register patient</h2></div><form onSubmit={register} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">Medical record number<input required className="input mt-2" pattern="[A-Za-z0-9][A-Za-z0-9-]{2,31}" maxLength={32} value={form.medicalRecordNumber} onChange={(event) => setForm({ ...form, medicalRecordNumber: event.target.value.toUpperCase() })}/></label>
          <label className="block text-sm font-semibold text-slate-700">Given name<input required className="input mt-2" maxLength={80} value={form.givenName} onChange={(event) => setForm({ ...form, givenName: event.target.value })}/></label>
          <label className="block text-sm font-semibold text-slate-700">Family name<input required className="input mt-2" maxLength={80} value={form.familyName} onChange={(event) => setForm({ ...form, familyName: event.target.value })}/></label>
          <label className="block text-sm font-semibold text-slate-700">Date of birth<input required type="date" className="input mt-2" max={new Date().toISOString().slice(0, 10)} value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })}/></label>
          <label className="block text-sm font-semibold text-slate-700">Sex<select className="input mt-2" value={form.sex} onChange={(event) => setForm({ ...form, sex: event.target.value as Patient['sex'] })}><option value="UNKNOWN">Unknown</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="OTHER">Other</option></select></label>
          <button disabled={busy} className="public-button-primary w-full">{busy ? 'Saving…' : 'Register synthetic patient'}</button>
        </form></section>}
      </div>}
    </div>
  </main>;
}
