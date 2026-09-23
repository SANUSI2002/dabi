import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Loader2, PackagePlus, Plus } from 'lucide-react';
import { CommandPageHeader, Panel, PanelHeader, StatusPill } from './components/ui';
import { liveCreatePackage, liveCreatePackageVersion, livePlatformPackages, livePublishPackageVersion, type LivePackage } from '@/registration/livePlatform';

const MODULES = ['emr', 'workforce', 'accounting', 'pharmacy'];
const initial = { code: '', name: '', description: '', monthly: '', annual: '', branchLimit: 1, storageLimitGb: 10, supportLevel: 'STANDARD', moduleKeys: ['emr'] as string[] };
const minor = (value: string) => Math.round(Number(value) * 100);
const format = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value / 100);

export default function LivePackagesPage() {
  const [items, setItems] = useState<LivePackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(initial);
  const [versionFor, setVersionFor] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  async function refresh() {
    const result = await livePlatformPackages();
    setItems(result.data.items);
  }
  useEffect(() => { let active = true; livePlatformPackages().then((result) => { if (active) setItems(result.data.items); }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Package catalog unavailable.'); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, []);
  function toggleModule(key: string) { setForm((current) => ({ ...current, moduleKeys: current.moduleKeys.includes(key) ? current.moduleKeys.filter((item) => item !== key) : [...current.moduleKeys, key] })); }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      if (form.moduleKeys.length === 0) throw new Error('Select at least one product module.');
      if (!Number.isSafeInteger(minor(form.monthly)) || !Number.isSafeInteger(minor(form.annual))) throw new Error('Enter valid prices.');
      const version = { monthlyPriceMinor: minor(form.monthly), annualPriceMinor: minor(form.annual), currency: 'NGN' as const, moduleKeys: form.moduleKeys };
      if (versionFor) await liveCreatePackageVersion(versionFor, version);
      else await liveCreatePackage({ code: form.code.trim().toUpperCase(), name: form.name.trim(), description: form.description.trim(), recommended: false, branchLimit: form.branchLimit, storageLimitGb: form.storageLimitGb, supportLevel: form.supportLevel, version });
      await refresh(); setForm(initial); setVersionFor(null); setMessage('Draft saved. Publish it explicitly before applicants can select it.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save package draft.'); }
    finally { setBusy(false); }
  }
  async function publish(packageId: string, versionId: string) {
    setBusy(true); setError(''); setMessage('');
    try { await livePublishPackageVersion(packageId, versionId); await refresh(); setMessage('Package version published. The public catalog now uses this immutable price version.'); setConfirming(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not publish package.'); }
    finally { setBusy(false); }
  }
  function newVersion(item: LivePackage) {
    const current = item.versions.find((version) => version.version === item.publishedVersion) ?? item.versions[0];
    setVersionFor(item.id); setForm({ ...initial, code: item.code, name: item.name, description: item.description, branchLimit: item.branchLimit, storageLimitGb: item.storageLimitGb, supportLevel: item.supportLevel, monthly: current ? String(current.monthlyPriceMinor / 100) : '', annual: current ? String(current.annualPriceMinor / 100) : '', moduleKeys: current?.moduleKeys ?? ['emr'] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return <><CommandPageHeader eyebrow="Sabi OS · Commercial" title="Packages" description="Create price drafts and explicitly publish immutable versions. Applicant plan selection reads only published packages." />
    {error && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p>}
    <Panel><PanelHeader title={versionFor ? `New price version · ${form.name}` : 'Create package'} description={versionFor ? 'The published version remains unchanged until this draft is published.' : 'A new package starts as an unpublished draft.'} />
      <form onSubmit={save} className="grid gap-4 p-5 sm:grid-cols-2">
        {!versionFor && <><label className="text-xs font-semibold text-slate-600">Code<input required pattern="[A-Za-z][A-Za-z0-9-]{2,31}" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="SABI-CORE" /></label><label className="text-xs font-semibold text-slate-600">Name<input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Description<textarea required minLength={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label></>}
        <label className="text-xs font-semibold text-slate-600">Monthly price (NGN)<input required type="number" min="0" max="20000000" step="0.01" value={form.monthly} onChange={(e) => setForm({ ...form, monthly: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label>
        <label className="text-xs font-semibold text-slate-600">Annual price (NGN)<input required type="number" min="0" max="20000000" step="0.01" value={form.annual} onChange={(e) => setForm({ ...form, annual: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label>
        {!versionFor && <><label className="text-xs font-semibold text-slate-600">Branch limit<input required type="number" min="1" value={form.branchLimit} onChange={(e) => setForm({ ...form, branchLimit: Number(e.target.value) })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Storage (GB)<input required type="number" min="1" value={form.storageLimitGb} onChange={(e) => setForm({ ...form, storageLimitGb: Number(e.target.value) })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm" /></label><label className="text-xs font-semibold text-slate-600">Support level<select value={form.supportLevel} onChange={(e) => setForm({ ...form, supportLevel: e.target.value })} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5 text-sm"><option value="STANDARD">Standard</option><option value="PRIORITY">Priority</option><option value="DEDICATED">Dedicated</option></select></label></>}
        <fieldset className="sm:col-span-2"><legend className="text-xs font-semibold text-slate-600">Included products</legend><div className="mt-2 flex flex-wrap gap-3">{MODULES.map((key) => <label key={key} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold capitalize"><input type="checkbox" checked={form.moduleKeys.includes(key)} onChange={() => toggleModule(key)} />{key}</label>)}</div></fieldset>
        <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={busy} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? <Loader2 className="animate-spin" size={15} /> : <PackagePlus size={15} />}{versionFor ? 'Save new price draft' : 'Create package draft'}</button>{versionFor && <button type="button" onClick={() => { setVersionFor(null); setForm(initial); }} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Cancel</button>}</div>
      </form>
    </Panel>
    <div className="mt-5 space-y-4">{loading ? <p role="status" className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} />Loading packages…</p> : items.length === 0 ? <Panel><p className="p-5 text-sm text-slate-500">No server-owned packages yet. Create a draft above, then publish it.</p></Panel> : items.map((item) => <Panel key={item.id}><PanelHeader title={`${item.name} · ${item.code}`} description={item.description} action={<button disabled={busy || item.versions.some((version) => version.status === 'DRAFT')} onClick={() => newVersion(item)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold disabled:opacity-50"><Plus size={13} />New price version</button>} /><div className="divide-y divide-slate-100">{item.versions.map((version) => <div key={version.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"><div><p className="font-semibold text-slate-900">Version {version.version} · {format(version.monthlyPriceMinor, version.currency)}/month · {format(version.annualPriceMinor, version.currency)}/year</p><p className="mt-1 text-xs text-slate-500">{version.moduleKeys.join(', ')}</p></div><div className="flex items-center gap-2"><StatusPill status={version.status} />{version.status === 'DRAFT' && (confirming === version.id ? <><button disabled={busy} onClick={() => publish(item.id, version.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"><CheckCircle2 size={13} />Confirm publish</button><button onClick={() => setConfirming(null)} className="text-xs font-semibold text-slate-500">Cancel</button></> : <button onClick={() => setConfirming(version.id)} className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700">Publish</button>)}</div></div>)}</div></Panel>)}</div>
  </>;
}
