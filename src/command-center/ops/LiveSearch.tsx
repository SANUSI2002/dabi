// Live data results for the Command Centre search box: patients (masked), orders, pharmacies,
// doctors, organisations and cases — only the groups the signed-in role may see.
import { useEffect, useState } from 'react';
import { Briefcase, Building2, FileText, Loader2, Pill, Stethoscope, User } from 'lucide-react';
import { search, type SearchGroup } from './api';
import { useCc } from './kit';
import { R } from './routes';

const ICON = { patient: User, order: FileText, pharmacy: Pill, doctor: Stethoscope, organization: Building2, case: Briefcase } as const;
const HREF: Record<SearchGroup['type'], (id: string) => string> = {
  patient: (id) => `${R.patients}/${id}`, order: (id) => `${R.orders}/${id}`, pharmacy: (id) => `${R.pharmacies}/${id}`,
  doctor: () => R.doctors, organization: () => '/command-center/organizations', case: (id) => `${R.cases}/${id}`,
};

export function useLiveSearch(q: string) {
  const { canAny } = useCc();
  const allowed = canAny('platform.ops.read', 'platform.patients.read', 'platform.finance.read', 'platform.support.manage');
  const [state, setState] = useState<{ groups: SearchGroup[]; loading: boolean; error: string }>({ groups: [], loading: false, error: '' });
  useEffect(() => {
    const term = q.trim();
    if (!allowed || term.length < 2) { setState({ groups: [], loading: false, error: '' }); return; }
    let active = true;
    setState((s) => ({ ...s, loading: true, error: '' }));
    const timer = setTimeout(() => {
      search(term).then((r) => { if (active) setState({ groups: r.groups, loading: false, error: '' }); })
        .catch((e: Error) => { if (active) setState({ groups: [], loading: false, error: e.message }); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [q, allowed]);
  return { ...state, allowed };
}

export function LiveSearchResults({ q, onPick }: { q: string; onPick: (href: string) => void }) {
  const { groups, loading, error, allowed } = useLiveSearch(q);
  if (!allowed || q.trim().length < 2) return null;
  return <div className="border-t border-slate-100 pt-1">
    {loading && <p className="flex items-center gap-2 px-3 py-2 text-xs text-slate-500"><Loader2 size={12} className="animate-spin" />Searching records…</p>}
    {error && <p className="px-3 py-2 text-xs text-red-600">{error}</p>}
    {!loading && !error && !groups.length && <p className="px-3 py-2 text-xs text-slate-500">No matching records</p>}
    {groups.map((g) => {
      const Icon = ICON[g.type];
      return <div key={g.type} role="group" aria-label={g.label}><p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{g.label}</p>
        {g.items.map((item) => <button key={item.id} onClick={() => onPick(HREF[g.type](item.id))} className="flex w-full items-start gap-2 rounded-lg px-3 py-1.5 text-left text-sm hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"><Icon size={14} className="mt-0.5 shrink-0 text-emerald-700" /><span className="min-w-0"><span className="block truncate font-medium text-slate-800">{item.title}</span><span className="block truncate text-[11px] text-slate-500">{item.subtitle}</span></span></button>)}
      </div>;
    })}
  </div>;
}
