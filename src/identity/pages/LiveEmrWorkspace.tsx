import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Activity, ArrowLeft, Building2, ClipboardList, FlaskConical, Loader2, LogOut, ShieldCheck, Users } from 'lucide-react';
import { liveSelectEmrOrganization, liveSignOut, restoreLiveIdentity, type LiveEmrAccess } from '../liveIdentity';
import InvitationManager from '../components/InvitationManager';

const clinicalAreas = [
  { icon: Users, name: 'Patients', detail: 'Tenant-scoped patient records' },
  { icon: Activity, name: 'Encounters', detail: 'Clinical consultations and care plans' },
  { icon: FlaskConical, name: 'Laboratory', detail: 'Orders and results' },
  { icon: ClipboardList, name: 'Billing', detail: 'Invoices and payments' },
];

export default function LiveEmrWorkspace() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const [access, setAccess] = useState<LiveEmrAccess | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Sabi EMR workspace';
    let active = true;
    async function load() {
      try {
        const identity = await restoreLiveIdentity();
        if (!identity) { navigate('/login', { replace: true }); return; }
        if (!organizationId) throw new Error('Choose an organization to continue.');
        const selected = await liveSelectEmrOrganization(organizationId);
        if (active) { setAccess(selected); setEmail(identity.user.email); }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'EMR access could not be verified.'); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [organizationId, navigate]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><p role="status" className="flex items-center gap-3 text-sm text-slate-600"><Loader2 size={20} className="animate-spin"/> Verifying organization and EMR entitlement…</p></main>;
  if (!access) return <main className="grid min-h-screen place-items-center bg-slate-50 p-6"><div className="w-full max-w-lg rounded-2xl border border-amber-200 bg-white p-8"><h1 className="text-2xl font-bold text-slate-900">EMR access not available</h1><p role="alert" className="mt-3 text-sm leading-6 text-amber-900">{error}</p><p className="mt-3 text-sm text-slate-600">Your hospital must complete document review, receive Sabi approval, and activate the owner account before this workspace opens.</p><Link to="/identity/account" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-emerald-800"><ArrowLeft size={16}/> Back to Sabi ID</Link></div></main>;

  return <div className="min-h-screen bg-[#f4faf6]"><header className="border-b border-emerald-900/10 bg-[#06271c] px-5 py-4 text-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-400/15 text-emerald-200"><Building2 size={22}/></span><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-200">Sabi OS</p><h1 className="font-display text-xl font-extrabold">{access.organizationName} · EMR</h1></div></div><button className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold" onClick={async () => { await liveSignOut(); navigate('/login', { replace: true }); }}><LogOut size={16}/> Sign out</button></div></header><main className="mx-auto max-w-6xl space-y-6 px-5 py-8"><section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-center gap-3"><ShieldCheck className="text-emerald-700" size={23}/><div><h2 className="font-display text-xl font-bold text-slate-950">Verified organization session</h2><p className="mt-1 text-sm text-slate-600">{email} · {access.roles.join(', ')}</p></div></div><p className="mt-4 text-sm leading-6 text-slate-600">Your Sabi ID, active organization membership and EMR entitlement were checked by the backend. Organization data is kept separate from other tenants.</p></section>{!access.clinicalApiConnected && <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><b>Clinical services are not connected to the live backend yet.</b> This secure workspace does not show demo patients or allow clinical entries. We will enable each module after its tenant-scoped API and audit controls pass testing.</section>}<section><h2 className="font-display text-xl font-bold text-slate-950">EMR modules</h2><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{clinicalAreas.map(({ icon: Icon, name, detail }) => <div key={name} className="rounded-2xl border border-slate-200 bg-white p-5"><Icon className="text-emerald-700" size={22}/><h3 className="mt-4 font-bold text-slate-900">{name}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p><p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-amber-700">Backend connection pending</p></div>)}</div></section>{access.permissions.includes('membership.manage') && <InvitationManager organizationId={access.organizationId} title={`${access.organizationName} team invitations`}/>}</main></div>;
}
