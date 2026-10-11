// Live platform overview: headline metrics for a period (each with its definition and a drill-down),
// work waiting on someone now, paid orders per local day, and when the numbers were read.
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { CommandButton, CommandSelect, Panel, PanelHeader } from '../components/ui';
import { getOverview, type Metric, type Overview, type QueueItem } from './api';
import { Definition, ErrorBox, Field, Loading, naira, TIME_ZONES, useCc, useFormat, useLoad } from './kit';
import { drillTo } from './routes';

/** The UTC instant of local midnight on `date` (YYYY-MM-DD) in `timeZone`. */
export function zonedMidnight(date: string, timeZone: string) {
  const [y, m, d] = date.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return new Date(guess - (asLocal - guess));
}

const PRESETS = [
  { value: '1', label: 'Last 24 hours' }, { value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: 'custom', label: 'Custom dates' },
];

export function usePeriod() {
  const { timeZone } = useCc();
  const [preset, setPreset] = useState('7');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [anchor, setAnchor] = useState(() => Date.now());
  const range = useMemo(() => {
    if (preset === 'custom' && from && to && from <= to) {
      const end = zonedMidnight(to, timeZone); end.setUTCDate(end.getUTCDate() + 1);
      return { from: zonedMidnight(from, timeZone).toISOString(), to: end.toISOString(), tz: timeZone };
    }
    const days = Number(preset === 'custom' ? 7 : preset);
    return { from: new Date(anchor - days * 86_400_000).toISOString(), to: new Date(anchor).toISOString(), tz: timeZone };
  }, [preset, from, to, timeZone, anchor]);
  return { preset, setPreset, from, setFrom, to, setTo, range, refresh: () => setAnchor(Date.now()) };
}

export function PeriodControls({ period, generatedAt, loading }: { period: ReturnType<typeof usePeriod>; generatedAt?: string; loading?: boolean }) {
  const { timeZone, setTimeZone } = useCc();
  const f = useFormat();
  return <div className="flex flex-wrap items-end gap-2">
    <Field label="Period"><CommandSelect value={period.preset} onChange={(e) => period.setPreset(e.target.value)}>{PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</CommandSelect></Field>
    {period.preset === 'custom' && <><Field label="From"><input type="date" value={period.from} max={period.to || undefined} onChange={(e) => period.setFrom(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" /></Field><Field label="To (inclusive)"><input type="date" value={period.to} min={period.from || undefined} onChange={(e) => period.setTo(e.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-sm" /></Field></>}
    <Field label="Time zone"><CommandSelect value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>{TIME_ZONES.map((tz) => <option key={tz}>{tz}</option>)}</CommandSelect></Field>
    <CommandButton variant="secondary" onClick={period.refresh} disabled={loading} aria-label="Refresh numbers"><RefreshCw size={14} className={cn(loading && 'animate-spin')} />Refresh</CommandButton>
    {generatedAt && <p className="flex items-center gap-1 pb-2 text-[11px] text-slate-500"><Clock size={12} />Live · read {f.ago(generatedAt)} ({f.dateTime(generatedAt)})</p>}
  </div>;
}

function value(m: Metric) {
  if (m.value === null) return '—';
  return m.unit === 'kobo' ? naira(m.value) : m.unit === 'percent' ? `${m.value}%` : m.value.toLocaleString();
}

function MetricTile({ m }: { m: Metric }) {
  const href = drillTo(m.drill);
  const body = <><div className="flex items-start justify-between gap-2"><p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.1em] text-slate-500">{m.label}<Definition text={m.definition} /></p></div><p className="mt-1 font-display text-xl font-bold tracking-tight text-slate-950 [font-variant-numeric:tabular-nums]">{value(m)}</p>{href && <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">See records <ArrowRight size={11} /></p>}</>;
  return <div className="min-w-0 border-l-2 border-emerald-400 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,.04)] ring-1 ring-slate-200">{href ? <Link to={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">{body}</Link> : body}</div>;
}

const SEVERITY: Record<QueueItem['severity'], string> = { ok: 'bg-slate-300', info: 'bg-sky-500', attention: 'bg-amber-500', warning: 'bg-orange-500', critical: 'bg-red-600' };

function Queues({ items }: { items: QueueItem[] }) {
  return <Panel><PanelHeader title="Waiting on someone now" description="Live counts, not limited to the period above" />
    <ul className="divide-y divide-slate-100">{items.map((q) => {
      const href = drillTo(q.drill);
      const row = <><span className={cn('h-2 w-2 shrink-0 rounded-full', SEVERITY[q.severity])} aria-hidden /><span className="min-w-0 flex-1 text-sm text-slate-700">{q.label} <Definition text={q.definition} /></span><span className={cn('font-display text-base font-bold [font-variant-numeric:tabular-nums]', q.value ? 'text-slate-950' : 'text-slate-400')}>{q.value}</span>{href && <ArrowRight size={13} className="text-slate-400" />}</>;
      return <li key={q.key}>{href ? <Link to={href} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50">{row}<span className="sr-only">{q.severity === 'ok' ? 'nothing waiting' : q.severity}</span></Link> : <div className="flex items-center gap-3 px-4 py-2.5">{row}</div>}</li>;
    })}</ul>
  </Panel>;
}

function DailyChart({ daily }: { daily: Overview['daily'] }) {
  const max = Math.max(1, ...daily.map((d) => d.paidValueMinor));
  return <Panel><PanelHeader title="Paid orders per day" description="Value of paid orders by local day in the selected time zone" />
    {daily.length ? <><div className="flex h-44 items-end gap-1 px-4 pb-2 pt-4" aria-hidden>{daily.map((d) => <div key={d.day} className="group relative flex h-full flex-1 flex-col justify-end"><div className="rounded-t bg-emerald-500/85 transition group-hover:bg-emerald-600" style={{ height: `${Math.max(2, (d.paidValueMinor / max) * 100)}%` }} /><span className="pointer-events-none absolute -top-1 left-1/2 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-white group-hover:block">{d.day}: {naira(d.paidValueMinor)} · {d.paid}/{d.orders} paid</span></div>)}</div>
      <div className="flex justify-between px-4 pb-3 text-[10px] text-slate-400" aria-hidden><span>{daily[0].day}</span><span>{daily.at(-1)?.day}</span></div>
      <table className="sr-only"><caption>Paid orders per day</caption><thead><tr><th>Day</th><th>Orders</th><th>Paid</th><th>Paid value</th></tr></thead><tbody>{daily.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.orders}</td><td>{d.paid}</td><td>{naira(d.paidValueMinor)}</td></tr>)}</tbody></table></>
      : <p className="p-6 text-sm text-slate-500">No orders in this period.</p>}
  </Panel>;
}

export default function OverviewPanels() {
  const { canAny } = useCc();
  const period = usePeriod();
  const allowed = canAny('platform.ops.read', 'platform.finance.read');
  const { data, error, loading, reload } = useLoad(() => (allowed ? getOverview(period.range) : Promise.resolve(null)), [allowed, period.range.from, period.range.to, period.range.tz]);
  if (!allowed) return null;
  return <section aria-label="Live platform metrics" className="mb-4 space-y-4">
    <PeriodControls period={period} generatedAt={data?.generatedAt} loading={loading} />
    <ErrorBox error={error} retry={reload} />
    {!data && loading ? <Panel><Loading label="Reading live metrics…" /></Panel> : data && <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">{data.metrics.map((m) => <MetricTile key={m.key} m={m} />)}</div>
      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]"><DailyChart daily={data.daily} /><Queues items={data.queues} /></div>
    </>}
  </section>;
}
