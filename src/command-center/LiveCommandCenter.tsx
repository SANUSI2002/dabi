import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import { liveListPlatformOrganizations, liveSignOut, restoreLiveIdentity, type LiveIdentity, type LivePlatformOrganization } from '@/identity/liveIdentity';

export default function LiveCommandCenter() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<LivePlatformOrganization[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    restoreLiveIdentity().then(async (current) => {
      if (!active) return;
      setIdentity(current);
      if (current?.platform?.permissions.includes('platform.onboarding.review')) {
        try {
          const result = await liveListPlatformOrganizations();
          if (active) { setOrganizations(result.data.items); setNextPage(result.data.nextPage); }
        } catch (cause) {
          if (active) setError(cause instanceof Error ? cause.message : 'Organization service unavailable.');
        }
      }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Identity service unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function loadMore() {
    if (!nextPage || busy) return;
    setBusy(true); setError('');
    try {
      const result = await liveListPlatformOrganizations(nextPage);
      setOrganizations((current) => [...current, ...result.data.items]);
      setNextPage(result.data.nextPage);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load more organizations.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900"><div className="mx-auto max-w-6xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-extrabold uppercase tracking-[.2em] text-emerald-700">Sabi platform operations</p><h1 className="mt-2 font-display text-3xl font-extrabold">Command Center</h1><p className="mt-2 text-sm text-slate-500">Live test data from Sabi Identity. No browser fixtures are used here.</p></div><button className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold" onClick={async () => { await liveSignOut(); navigate('/command-center/login', { replace: true }); }}><LogOut size={15}/> Sign out</button></div>
    {loading ? <div role="status" className="mt-10 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={18}/> Checking platform access…</div> : !identity ? <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6"><h2 className="font-bold">Sign in required</h2><p className="mt-2 text-sm text-slate-600">Use a Sabi ID with an assigned platform role to open Command Center.</p><Link className="mt-4 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white" to="/command-center/login">Sign in</Link></div> : !identity.platformAssigned ? <div className="mt-8 rounded-2xl border border-amber-200 bg-white p-6"><h2 className="font-bold">Platform access not assigned</h2><p className="mt-2 text-sm text-slate-600">Patient and organization sign-up do not grant Command Center permissions. A Sabi platform administrator must assign your staff identity.</p><Link className="mt-4 inline-block text-sm font-bold text-emerald-700" to="/identity/account">View your Sabi ID</Link></div> : !identity.platform ? <div className="mt-8 rounded-2xl border border-amber-200 bg-white p-6"><h2 className="font-bold">Authenticator verification required</h2><p className="mt-2 text-sm text-slate-600">Your platform assignment is recognized. Set up or verify your authenticator to open live Command Center data.</p><Link className="mt-4 inline-block rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white" to="/identity/mfa?next=command-center">Continue to authenticator</Link></div> : <>
      <div className="mt-8 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-5 md:col-span-2"><div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700" size={18}/><h2 className="font-bold">Verified platform session</h2></div><p className="mt-2 text-sm text-slate-600">{identity.user.email} · {identity.platform.roles.join(', ')}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Organizations</p><p className="mt-2 text-3xl font-extrabold">{organizations.length}{nextPage ? '+' : ''}</p><p className="text-xs text-slate-500">Server-owned records visible to your role</p></div></div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center gap-2 border-b border-slate-100 p-5"><Building2 className="text-emerald-700" size={18}/><h2 className="font-bold">Organization registry</h2></div>{identity.platform.permissions.includes('platform.onboarding.review') ? organizations.length ? <div className="divide-y divide-slate-100">{organizations.map((item) => <div key={item.id} className="grid gap-2 px-5 py-4 text-sm sm:grid-cols-[2fr_1fr_1fr]"><span className="font-semibold">{item.name}</span><span className="text-slate-500">{item.type.replaceAll('_', ' ')}</span><span className="text-slate-500">{item.status.replaceAll('_', ' ')}</span></div>)}</div> : <p className="p-6 text-sm text-slate-500">No organizations have been registered in this test environment.</p> : <p className="p-6 text-sm text-slate-500">Your platform role does not include onboarding review.</p>}{nextPage && <button disabled={busy} className="m-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold disabled:opacity-50" onClick={loadMore}>{busy ? 'Loading…' : 'Load more'}</button>}</section>
      <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Package editing, approval decisions and tenant provisioning are not connected to the live API yet. Those controls remain unavailable in this test release.</p>
    </>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
  </div></main>;
}
