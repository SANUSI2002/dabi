import SabiBrand from '@/components/brand/SabiBrand';
// The Command Centre shell: sidebar with collapsible groups (the current page's group always open),
// live counts of waiting work, role locks and the product switcher; header breadcrumb, alerts bell
// and keyboard shortcut for search. Navigation items are never hidden.
import { useEffect, useMemo, useState, type RefObject } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Bell, Building2, Check, ChevronDown, ChevronRight, Lock, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { COMMAND_ITEMS, COMMAND_NAV, navForProduct, type CommandNavGroup } from '../navigation';
import { useProductContext, type ProductContext } from '../useProductContext';
import { alerts, getOverview } from './api';

const PRODUCTS: { value: ProductContext; label: string }[] = [
  { value: 'all', label: 'All Sabi' },
  { value: 'sabi-os', label: 'Sabi OS' },
  { value: 'sabi-health', label: 'Sabi Health' },
];
const COLLAPSED_KEY = 'sabi.cc.collapsedGroups';
const readCollapsed = (): string[] => { try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '[]'); } catch { return []; } };
const has = (permissions: string[] | undefined, any: string[]) => Boolean(permissions && any.some((p) => permissions.includes(p)));

/** Live counts of work waiting (from the overview queues), refreshed every two minutes. */
export function useNavBadges(permissions: string[] | undefined) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const allowed = has(permissions, ['platform.ops.read', 'platform.finance.read']);
  useEffect(() => {
    if (!allowed) return undefined;
    let active = true;
    const load = () => getOverview({ from: new Date(Date.now() - 86_400_000).toISOString(), to: new Date().toISOString() })
      .then((o) => { if (active) setCounts(Object.fromEntries(o.queues.map((q) => [q.key, q.value]))); })
      .catch(() => { /* badges are a convenience; the pages show the real state */ });
    void load();
    const timer = setInterval(load, 120_000);
    return () => { active = false; clearInterval(timer); };
  }, [allowed]);
  return counts;
}

/** Critical and warning alerts, for the header bell. */
export function useAlertCount(permissions: string[] | undefined) {
  const [count, setCount] = useState<number | null>(null);
  const allowed = has(permissions, ['platform.ops.read', 'platform.audit.read', 'platform.jobs.manage']);
  useEffect(() => {
    if (!allowed) return undefined;
    let active = true;
    const load = () => alerts().then((a) => { if (active) setCount(a.items.filter((x) => x.severity !== 'info').length); }).catch(() => {});
    void load();
    const timer = setInterval(load, 120_000);
    return () => { active = false; clearInterval(timer); };
  }, [allowed]);
  return allowed ? count : null;
}

function groupOf(path: string): CommandNavGroup | undefined {
  const match = [...COMMAND_ITEMS].sort((a, b) => b.to.length - a.to.length).find((i) => path === i.to || path.startsWith(`${i.to}/`));
  return match ? COMMAND_NAV.find((g) => g.items.includes(match)) : undefined;
}

export function Sidebar({ email, name, roles, permissions, badges, close }: { email: string; name?: string | null; roles?: string[]; permissions?: string[]; badges: Record<string, number>; close?: () => void }) {
  const product = useProductContext((state) => state.product);
  const setProduct = useProductContext((state) => state.setProduct);
  const location = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<string[]>(readCollapsed);
  const current = groupOf(location.pathname.replace(/\/$/, '') || '/command-center');
  const toggle = (title: string) => setCollapsed((c) => {
    const next = c.includes(title) ? c.filter((t) => t !== title) : [...c, title];
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next)); } catch { /* per-viewer convenience */ }
    return next;
  });
  return <aside className="flex h-full w-[264px] shrink-0 flex-col border-r border-white/[0.06] bg-[#08110d] text-slate-300">
    <div className="flex h-[64px] items-center gap-3 border-b border-white/[0.06] px-4">
      <SabiBrand symbol size={34} inverse/>
      <div className="leading-tight"><p className="font-display text-sm font-extrabold tracking-tight text-white">SABI</p><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-400">Command Center</p></div>
      {close && <button onClick={close} className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 lg:hidden" aria-label="Close navigation"><X size={18} /></button>}
    </div>
    <div className="relative border-b border-white/[0.06] px-3 py-3">
      <button aria-expanded={switcherOpen} aria-label="Product context" onClick={() => setSwitcherOpen((open) => !open)} className="flex w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left text-[12px] font-semibold text-slate-200 hover:bg-white/[0.07]">
        <Building2 size={14} className="text-emerald-400" /><span className="flex-1">{PRODUCTS.find((option) => option.value === product)?.label}</span><ChevronDown size={13} className={cn('text-slate-500 transition', switcherOpen && 'rotate-180')} />
      </button>
      {switcherOpen && <div className="absolute inset-x-3 top-[calc(100%-8px)] z-20 overflow-hidden rounded-lg border border-white/10 bg-[#0d1a15] shadow-xl">{PRODUCTS.map((option) => <button key={option.value} onClick={() => { setProduct(option.value); setSwitcherOpen(false); }} className="flex w-full items-center gap-2 px-2.5 py-2 text-left text-[12px] font-medium text-slate-300 hover:bg-white/[0.06]"><span className="w-3.5">{option.value === product && <Check size={13} className="text-emerald-400" />}</span>{option.label}</button>)}</div>}
    </div>
    <nav aria-label="Command Center" className="flex-1 space-y-1 overflow-y-auto px-2.5 py-3 [scrollbar-width:thin]">
      {navForProduct(product).map((group) => {
        const open = !group.title || group === current || !collapsed.includes(group.title);
        const waiting = group.items.reduce((n, i) => n + (i.badge ?? []).reduce((m, k) => m + (badges[k] ?? 0), 0), 0);
        return <div key={group.title || 'overview'} className={cn(group.title && 'pt-2')}>
          {group.title && <button type="button" aria-expanded={open} onClick={() => toggle(group.title)} className="flex w-full items-center gap-1 rounded px-2.5 py-1 text-left text-[9.5px] font-bold uppercase tracking-[.16em] text-slate-500 hover:text-slate-300">
            {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />}<span className="flex-1 truncate">{group.title}</span>{!open && waiting > 0 && <span className="rounded-full bg-amber-400/15 px-1.5 text-[10px] tracking-normal text-amber-300">{waiting}</span>}
          </button>}
          {open && <div className="mt-0.5 space-y-0.5">{group.items.map((item) => {
            const locked = permissions && item.live && !item.live.some((code) => permissions.includes(code));
            const count = (item.badge ?? []).reduce((n, k) => n + (badges[k] ?? 0), 0);
            return <NavLink key={`${group.title}-${item.to}`} to={item.to} end={item.to === '/command-center'} onClick={close}
              className={({ isActive }) => cn('group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium transition', isActive ? 'bg-emerald-400/[0.12] text-emerald-200 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-emerald-400' : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100', locked && 'opacity-60')}>
              <item.icon size={15} className="shrink-0" /><span className="truncate">{item.label}</span>
              {count > 0 && !locked && <span className="ml-auto rounded-full bg-amber-400/15 px-1.5 text-[10.5px] font-bold text-amber-300" aria-label={`${count} waiting`}>{count}</span>}
              {locked && <Lock size={11} className="ml-auto shrink-0 text-slate-600" aria-label="Not included in your role" />}
            </NavLink>;
          })}</div>}
        </div>;
      })}
    </nav>
    <div className="border-t border-white/[0.06] px-4 py-3">
      <p className="truncate text-xs font-semibold text-slate-100">{name || email}</p>
      <p className="truncate text-[10px] text-slate-500">{name ? email : ''}</p>
      <p className="mt-0.5 truncate text-[10px] text-emerald-400">{roles?.length ? roles.map((r) => r.replace('SABI_', '').replaceAll('_', ' ').toLowerCase()).join(' · ') : 'Verified platform session'}</p>
    </div>
  </aside>;
}

export function Breadcrumb() {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/command-center';
  const crumbs = useMemo(() => {
    const item = [...COMMAND_ITEMS].sort((a, b) => b.to.length - a.to.length).find((i) => path === i.to || path.startsWith(`${i.to}/`));
    const group = item ? COMMAND_NAV.find((g) => g.items.includes(item)) : undefined;
    return { group: group?.title || null, item, detail: item && path !== item.to };
  }, [path]);
  if (!crumbs.item) return null;
  return <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-xs text-slate-500 md:flex">
    {crumbs.group && <><span className="truncate">{crumbs.group}</span><ChevronRight size={12} className="shrink-0 text-slate-300" /></>}
    {crumbs.detail ? <><Link to={crumbs.item.to} className="truncate font-semibold text-slate-700 hover:text-emerald-700">{crumbs.item.label}</Link><ChevronRight size={12} className="shrink-0 text-slate-300" /><span aria-current="page" className="truncate">Record</span></> : <span aria-current="page" className="truncate font-semibold text-slate-800">{crumbs.item.label}</span>}
  </nav>;
}

export function AlertBell({ count }: { count: number | null }) {
  if (count === null) return null;
  return <Link to="/command-center/alerts" className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={count ? `${count} alerts need attention` : 'Alerts: nothing needs attention'}>
    <Bell size={17} />{count > 0 && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{count > 9 ? '9+' : count}</span>}
  </Link>;
}

/** "/" or Ctrl/Cmd+K focuses the search box (not while typing in another field). */
export function useSearchShortcut(input: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [input]);
}

export function SkipLink() {
  return <a href="#cc-main" className="sr-only z-[70] rounded-lg bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow focus:not-sr-only focus:fixed focus:left-3 focus:top-3">Skip to content</a>;
}
