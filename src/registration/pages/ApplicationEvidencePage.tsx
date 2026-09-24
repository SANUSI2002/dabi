import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FileCheck2, LockKeyhole, ShieldAlert, UploadCloud } from 'lucide-react';
import { liveApplicantEvidence, liveRequestEvidenceAccess, liveUploadApplicantEvidence, type LiveEvidenceList } from '../livePlatform';

const labels: Record<string, string> = {
  OFFICER_LICENCE: 'Operating officer licence', CAC_CERTIFICATE: 'Corporate registration certificate',
  TAX_EVIDENCE: 'Tax evidence', FACILITY_REGISTRATION: 'Facility registration',
  WASTE_MANAGEMENT: 'Waste-management evidence', HMIS_RENDITION: 'HMIS reporting evidence',
  SITE_DIAGRAM: 'Facility site diagram', PREVIOUS_CERTIFICATE: 'Previous facility certificate',
};

export default function ApplicationEvidencePage() {
  const { id = '' } = useParams();
  const [accessToken] = useState(() => window.location.hash.slice(1));
  const validToken = !!id && /^[a-f0-9]{64}$/.test(accessToken);
  const [evidence, setEvidence] = useState<LiveEvidenceList | null>(null);
  const [loading, setLoading] = useState(validToken);
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    // The fragment is not sent to the server. Remove it from browser history
    // immediately and never persist this short-lived applicant capability.
    window.history.replaceState(null, '', window.location.pathname);
    if (!validToken) return;
    let active = true;
    liveApplicantEvidence(id, accessToken).then((response) => {
      if (active) setEvidence(response.data);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load document requirements.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, accessToken, validToken]);

  async function upload(key: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busyKey || !id) return;
    setError(''); setBusyKey(key);
    try {
      const result = await liveUploadApplicantEvidence(id, key, accessToken, file);
      setEvidence((current) => current ? { ...current, items: [result.data, ...current.items] } : current);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed.'); }
    finally { setBusyKey(''); }
  }

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !email.trim()) return;
    setError('');
    try { await liveRequestEvidenceAccess(id, email.trim()); setRequestSent(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not request a new link.'); }
  }

  const keys = evidence?.requiredEvidence ?? [];
  return <main className="min-h-screen bg-[#f4faf6] text-slate-900">
    <header className="border-b border-slate-200 bg-white px-5 py-4"><Link to="/" className="font-display text-xl font-extrabold text-emerald-800">Sabi Health</Link></header>
    <section className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Hospital onboarding</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">Application documents</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Only upload documents requested for your hospital application. Do not upload patient records. Sabi staff will independently check authenticity before any EMR access is considered.</p>
      {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {loading && <p role="status" className="mt-8 text-sm text-slate-600">Checking your secure link…</p>}
      {!loading && !evidence && <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-6">
        <LockKeyhole className="text-emerald-700" size={25}/><h2 className="mt-3 font-display text-lg font-bold">Request a fresh access link</h2>
        <p className="mt-2 text-sm text-slate-600">Links expire after 30 minutes. If this verified application is accepting documents, a new link will be sent to its owner email.</p>
        {requestSent ? <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">If eligible, an access link has been sent. Check your inbox and spam folder.</p> : <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={requestAccess}><input type="email" required autoComplete="email" aria-label="Application owner email" placeholder="Application owner email" className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm" value={email} onChange={(event) => setEmail(event.target.value)}/><button className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800">Email access link</button></form>}
      </div>}
      {evidence && <>
        <div className="mt-7 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><ShieldAlert size={20} className="shrink-0"/><span>Uploads go into private quarantine. “Uploaded” does not mean scanned, verified, approved, or that EMR access has been granted. Documents cannot be previewed while scanning is unavailable.</span></div>
        {keys.length === 0 ? <p className="mt-6 rounded-2xl bg-white p-6 text-sm text-slate-600">These requirements need manual configuration. Do not upload documents until Sabi contacts you.</p> : <div className="mt-6 space-y-3">{keys.map((key) => {
          const versions = evidence.items.filter((item) => item.requirementKey === key);
          const latest = versions[0];
          return <section key={key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display font-bold">{labels[key] ?? key.replaceAll('_', ' ')}</h2><p className="mt-1 text-xs text-slate-500">{latest ? `${versions.length} submission${versions.length === 1 ? '' : 's'} · Latest: ${latest.scanStatus.toLowerCase()} scan, ${latest.reviewStatus.toLowerCase()} review` : 'Not uploaded'}</p></div><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50"><UploadCloud size={17}/>{busyKey === key ? 'Uploading…' : latest ? 'Submit new version' : 'Choose document'}<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={!!busyKey} onChange={(event) => upload(key, event)}/></label></div>{latest && <p className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500"><FileCheck2 size={15}/>{latest.fileName} · {Math.round(latest.sizeBytes / 1024)} KB · {new Date(latest.createdAt).toLocaleString()}</p>}</section>;
        })}</div>}
        <p className="mt-5 text-xs text-slate-500">PDF, JPEG, or PNG only; maximum 10 MB each. New submissions are retained as separate versions.</p>
      </>}
    </section>
  </main>;
}
