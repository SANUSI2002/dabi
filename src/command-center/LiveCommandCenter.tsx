import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Building2, Check, ChevronDown, Database, Loader2, LogOut, Menu, Search, ShieldCheck, Users, X } from 'lucide-react';
import { liveListPlatformOrganizations, liveSignOut, restoreLiveIdentity, type LiveIdentity, type LivePlatformOrganization } from '@/identity/liveIdentity';
import InvitationManager from '@/identity/components/InvitationManager';
import { COMMAND_ITEMS, navForProduct } from './navigation';
import { useProductContext, type ProductContext } from './useProductContext';
import { CommandPageHeader, MetricCard, Panel, PanelHeader, StatusPill } from './components/ui';
import { cn } from '@/lib/cn';

const PRODUCTS: { value: ProductContext; label: string }[] = [
  { value: 'all', label: 'All Sabi' },
  { value: 'sabi-os', label: 'Sabi OS' },
  { value: 'sabi-health', label: 'Sabi Health' },
];

function LiveSidebar({ email, close }: { email: string; close?: () => void }) {
  const product = useProductContext((state) => state.product);
  const setProduct = useProductContext((state) => state.setProduct);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  return <aside className="flex h-full w-[252px] shrink-0 flex-col border-r border-white/[0.07] bg-[#09130f] text-slate-300">
    <div className="flex h-[68px] items-center gap-3 border-b border-white/[0.07] px-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400 text-slate-950 shadow-[0_0_24px_rgba(52,211,153,.22)]"><ShieldCheck size={19} /></div>
      <div className="leading-tight"><p className="font-display text-sm font-extrabold tracking-tight text-white">SABI</p><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-emerald-400">Command Center</p></div>
      {close && <button onClick={close} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Close navigation"><X size={18} /></button>}
    </div>
    <div className="relative border-b border-white/[0.07] px-3 py-3">
      <button aria-expanded={switcherOpen} onClick={() => setSwitcherOpen((open) => !open)} className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left text-[12px] font-semibold text-slate-200 hover:bg-white/[0.07]">
        <Building2 size={14} className="text-emerald-400" /><span className="flex-1">{PRODUCTS.find((option) => option.value === product)?.label}</span><ChevronDown size={13} className={cn('text-slate-500 transition', switcherOpen && 'rotate-180')} />
      </button>
      {switcherOpen && <div className="absolute inset-x-3 top-[calc(100%-8px)] z-20 overflow-hidden rounded-lg border border-white/10 bg-[#0d1a15] shadow-xl">{PRODUCTS.map((option) => <button key={option.value} onClick={() => { setProduct(option.value); setSwitcherOpen(false); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] font-medium text-slate-300 hover:bg-white/[0.06]"><span className="w-3.5">{option.value === product && <Check size={13} className="text-emerald-400" />}</span>{option.label}</button>)}</div>}
    </div>
    <nav aria-label="Command Center" className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4 [scrollbar-width:thin]">
      {navForProduct(product).map((group) => <div key={group.title || 'overview'}>
        {group.title && <p className="mb-1 px-2.5 text-[9px] font-bold uppercase tracking-[.18em] text-slate-600">{group.title}</p>}
        <div className="space-y-0.5">{group.items.map((item) => <NavLink key={item.to} to={item.to} end={item.to === '/command-center'} onClick={close} className={({ isActive }) => cn('group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12px] font-medium transition', isActive ? 'bg-emerald-400/12 text-emerald-300 ring-1 ring-inset ring-emerald-400/15' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200')}><item.icon size={15} className="shrink-0" /><span className="truncate">{item.label}</span></NavLink>)}</div>
      </div>)}
    </nav>
    <div className="border-t border-white/[0.07] px-4 py-3"><p className="truncate text-xs font-semibold text-slate-200">{email}</p><p className="truncate text-[10px] text-emerald-400">Verified platform session</p></div>
  </aside>;
}

function Registry({ hasAccess, organizations, nextPage, busy, loadMore, compact = false }: { hasAccess: boolean; organizations: LivePlatformOrganization[]; nextPage: number | null; busy: boolean; loadMore: () => void; compact?: boolean }) {
  return <Panel><PanelHeader title="Organization registry" description="Server-owned organizations visible to your role" action={compact && <Link to="/command-center/organizations" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">View all <ArrowRight size={13} /></Link>} />
    {!hasAccess ? <p className="p-5 text-sm text-slate-500">Your platform role does not include onboarding review.</p> : organizations.length ? <div className="divide-y divide-slate-100">{(compact ? organizations.slice(0, 5) : organizations).map((item) => <div key={item.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[2fr_1fr_1fr]"><span className="font-semibold text-slate-900">{item.name}</span><span className="text-slate-500">{item.type.replaceAll('_', ' ')}</span><span><StatusPill status={item.status.replaceAll('_', ' ')} /></span></div>)}</div> : <p className="p-5 text-sm text-slate-500">No organizations have been registered in this test environment.</p>}
    {!compact && nextPage && <button disabled={busy} className="m-4 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-50" onClick={loadMore}>{busy ? 'Loading…' : 'Load more'}</button>}
  </Panel>;
}

function UnavailableSection({ title }: { title: string }) {
  return <><CommandPageHeader eyebrow="Sabi platform operations" title={title} description="The Command Center layout is available, but this section is not yet connected to a server-owned service in the test environment." />
    <Panel><div className="flex items-start gap-3 p-6"><Database size={20} className="mt-0.5 shrink-0 text-amber-600" /><div><h2 className="text-sm font-bold text-slate-900">Live data not connected</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">The earlier Command Center prototype stored this section in the browser. Those records and editing controls are not part of the live service yet. No demo records are shown as real data, and writes remain unavailable until the backend workflow and permissions are implemented.</p><Link to="/command-center" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700">Back to live overview <ArrowRight size={14} /></Link></div></div></Panel>
  </>;
}

export default function LiveCommandCenter() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identity, setIdentity] = useState<LiveIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizations, setOrganizations] = useState<LivePlatformOrganization[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState('');

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

  useEffect(() => { document.title = 'Sabi Command Center'; }, []);

  const searchResults = useMemo(() => search.trim() ? COMMAND_ITEMS.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase())).slice(0, 8) : [], [search]);
  const hasRegistry = !!identity?.platform?.permissions.includes('platform.onboarding.review');
  const hasInvites = !!identity?.platform?.permissions.includes('platform.staff.invite');
  const path = location.pathname.replace(/\/$/, '') || '/command-center';
  const section = [...COMMAND_ITEMS].sort((a, b) => b.to.length - a.to.length).find((item) => path === item.to || path.startsWith(`${item.to}/`));

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

  let content;
  if (path === '/command-center') {
    content = <>
      <CommandPageHeader eyebrow="Executive operations" title="Platform overview" description="Live test-environment operations across Sabi Health and Sabi OS." actions={<Link to="/command-center/organizations" className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white">Open organizations <ArrowRight size={15} /></Link>} />
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MetricCard label="Organizations" value={hasRegistry ? `${organizations.length}${nextPage ? '+' : ''}` : '—'} hint={nextPage ? 'loaded so far' : 'live registry'} icon={<Building2 size={15} />} />
        <MetricCard label="Platform access" value="Verified" hint="MFA-protected session" icon={<ShieldCheck size={15} />} />
        <MetricCard label="Staff invitations" value={hasInvites ? 'Available' : 'Restricted'} hint="role-based access" icon={<Users size={15} />} />
        <MetricCard label="Other modules" value="Pending" hint="backend integration" icon={<Database size={15} />} />
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]"><Registry compact hasAccess={hasRegistry} organizations={organizations} nextPage={nextPage} busy={busy} loadMore={loadMore} /><Panel><PanelHeader title="Live service coverage" description="What this test release can actually use" /><div className="space-y-3 p-4 text-sm"><div className="flex items-center justify-between gap-2"><span>Identity and platform session</span><StatusPill status="Connected" /></div><div className="flex items-center justify-between gap-2"><span>Organization registry</span><StatusPill status={hasRegistry ? 'Connected' : 'Restricted'} /></div><div className="flex items-center justify-between gap-2"><span>Staff invitations</span><StatusPill status={hasInvites ? 'Connected' : 'Restricted'} /></div><div className="flex items-center justify-between gap-2"><span>Commercial and provisioning workflows</span><StatusPill status="Not connected" /></div></div></Panel></div>
      <Panel className="mt-4"><PanelHeader title="Command Center access" description="Invite staff and control who can use this platform" action={<Link to="/command-center/internal-users" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">Manage staff <ArrowRight size={13} /></Link>} /><p className="p-4 text-sm text-slate-600">Signed in as {identity?.user.email}. Platform roles: {identity?.platform?.roles.join(', ')}.</p></Panel>
    </>;
  } else if (path === '/command-center/organizations') {
    content = <><CommandPageHeader eyebrow="Sabi OS · Customers" title="Organizations" description="Registered organizations from the live platform service. No browser fixtures are used." /><Registry hasAccess={hasRegistry} organizations={organizations} nextPage={nextPage} busy={busy} loadMore={loadMore} /></>;
  } else if (path === '/command-center/internal-users') {
    content = <><CommandPageHeader eyebrow="Administration" title="Internal users" description="Invite Command Center staff by email with a server-enforced role." />{hasInvites ? <InvitationManager title="Command Center staff invitations" /> : <Panel><p className="p-5 text-sm text-slate-600">Your platform role does not permit staff invitations.</p></Panel>}</>;
  } else {
    content = <UnavailableSection title={section?.label ?? 'Command Center'} />;
  }

  if (loading) return <div role="status" className="flex min-h-screen items-center justify-center gap-2 bg-[#f4f7f5] text-sm text-slate-600"><Loader2 className="animate-spin" size={18} /> Checking platform access…</div>;
  if (!identity || !identity.platform) return <main className="min-h-screen bg-[#f4f7f5] p-6"><div className="mx-auto mt-16 max-w-lg rounded-xl border border-slate-200 bg-white p-6"><ShieldCheck className="text-emerald-700" size={22} /><h1 className="mt-3 font-display text-xl font-bold">{!identity ? 'Sign in required' : !identity.platformAssigned ? 'Platform access not assigned' : 'Authenticator verification required'}</h1><p className="mt-2 text-sm text-slate-600">{!identity ? 'Use a Sabi ID with an assigned platform role.' : !identity.platformAssigned ? 'A Sabi platform administrator must invite or assign your staff identity.' : 'Set up or verify your authenticator to open live Command Center data.'}</p><Link className="mt-5 inline-flex rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white" to={!identity || !identity.platformAssigned ? '/command-center/login' : '/identity/mfa?next=command-center'}>Continue</Link></div></main>;

  return <div className="flex min-h-screen bg-[#f4f7f5] text-slate-900">
    <div className="hidden lg:block"><LiveSidebar email={identity.user.email} /></div>
    <AnimatePresence>{mobile && <><motion.button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setMobile(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /><motion.div className="fixed inset-y-0 left-0 z-50 lg:hidden" initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}><LiveSidebar email={identity.user.email} close={() => setMobile(false)} /></motion.div></>}</AnimatePresence>
    <div className="min-w-0 flex-1"><header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl lg:px-6">
      <button onClick={() => setMobile(true)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Open navigation"><Menu size={18} /></button>
      <div className="relative flex h-9 min-w-0 max-w-xl flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"><Search size={15} className="shrink-0" /><input aria-label="Search Command Center sections" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Command Center sections…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />{search && <button onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}
        {search && <div className="absolute left-0 right-0 top-11 z-40 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">{searchResults.length ? searchResults.map((item) => <button key={item.to} onClick={() => { navigate(item.to); setSearch(''); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50"><item.icon size={15} className="text-emerald-700" />{item.label}</button>) : <p className="px-3 py-2 text-xs text-slate-500">No matching sections</p>}</div>}
      </div>
      <span className="ml-auto hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200 sm:inline">Live test session</span>
      <button onClick={async () => { await liveSignOut(); navigate('/command-center/login', { replace: true }); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Sign out of Command Center"><LogOut size={17} /></button>
    </header>
    <main className="min-h-[calc(100vh-68px)]"><div className="mx-auto max-w-[1560px] px-4 py-5 lg:px-7 lg:py-6"><motion.div key={location.pathname} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>{content}{error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}</motion.div></div></main></div>
  </div>;
}
