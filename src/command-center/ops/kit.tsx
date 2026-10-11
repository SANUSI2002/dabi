// Shared building blocks for the live Command Centre pages: data loading with every state
// (loading / error / empty / restricted), pagination, tabs, money and time formatting in the chosen
// time zone, a reason dialog that handles two-step re-verification, and a timeline.
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Info, Loader2, Lock, RefreshCw, X } from 'lucide-react';
import { liveStepUpMfa, type LiveApiError } from '@/identity/liveIdentity';
import { cn } from '@/lib/cn';
import { CommandButton, CommandInput, Panel } from '../components/ui';
import type { CcMe, TimelineEvent } from './api';

// ---- Context: who is signed in, and the time zone used for display -----------------------------
type CcContextValue = { me: CcMe | null; can: (permission: string) => boolean; canAny: (...permissions: string[]) => boolean; timeZone: string; setTimeZone: (tz: string) => void };
const CcContext = createContext<CcContextValue>({ me: null, can: () => false, canAny: () => false, timeZone: 'Africa/Lagos', setTimeZone: () => {} });
const TZ_KEY = 'sabi.cc.timeZone';
const readTz = () => { try { return localStorage.getItem(TZ_KEY) || 'Africa/Lagos'; } catch { return 'Africa/Lagos'; } };

export function CcProvider({ me, children }: { me: CcMe | null; children: ReactNode }) {
  const [timeZone, setTz] = useState(readTz);
  const setTimeZone = useCallback((tz: string) => { setTz(tz); try { localStorage.setItem(TZ_KEY, tz); } catch { /* per-viewer convenience only */ } }, []);
  const can = useCallback((permission: string) => !!me?.permissions.includes(permission), [me]);
  const canAny = useCallback((...permissions: string[]) => permissions.some((p) => me?.permissions.includes(p)), [me]);
  return <CcContext.Provider value={{ me, can, canAny, timeZone, setTimeZone }}>{children}</CcContext.Provider>;
}
export const useCc = () => useContext(CcContext);
export const TIME_ZONES = ['Africa/Lagos', 'UTC', 'Europe/London', 'America/New_York', 'Asia/Dubai'];

// ---- Formatting ---------------------------------------------------------------------------------
export const naira = (minor: number | null | undefined) => minor === null || minor === undefined ? '—' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(minor / 100);
export const human = (code: string | null | undefined) => code ? code.replaceAll('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : '—';
export function useFormat() {
  const { timeZone } = useCc();
  return {
    dateTime: (iso: string | Date | null | undefined) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—',
    date: (iso: string | Date | null | undefined) => iso ? new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '—',
    ago: (iso: string | null | undefined) => {
      if (!iso) return '—';
      const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
      const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
      const steps: [number, Intl.RelativeTimeFormatUnit][] = [[60, 'second'], [3600, 'minute'], [86400, 'hour'], [2592000, 'day'], [31536000, 'month']];
      for (let i = 0; i < steps.length; i += 1) if (Math.abs(seconds) < steps[i][0]) return rtf.format(-Math.round(seconds / (i ? steps[i - 1][0] : 1)), steps[i][1]);
      return rtf.format(-Math.round(seconds / 31536000), 'year');
    },
    timeZone,
  };
}

// ---- Loading ------------------------------------------------------------------------------------
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: LiveApiError | null; loading: boolean }>({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    load().then((data) => { if (active) setState({ data, error: null, loading: false }); })
      .catch((error: LiveApiError) => { if (active) setState((s) => ({ data: s.data, error, loading: false })); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" />{label}</div>;
}
export function ErrorBox({ error, retry }: { error: LiveApiError | Error | null; retry?: () => void }) {
  if (!error) return null;
  const status = (error as LiveApiError).status;
  const text = status === 403 ? 'Your platform role does not allow this. Ask a Sabi super admin if you need it.' : status === 401 ? 'Your session has ended. Sign in again.' : error.message;
  return <div role="alert" className="flex flex-wrap items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={17} className="mt-0.5 shrink-0" /><p className="min-w-0 flex-1">{text}</p>{retry && status !== 403 && <CommandButton variant="secondary" onClick={retry}><RefreshCw size={14} />Retry</CommandButton>}</div>;
}
export function Empty({ title, hint }: { title: string; hint?: string }) {
  return <div className="p-8 text-center"><p className="text-sm font-semibold text-slate-700">{title}</p>{hint && <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">{hint}</p>}</div>;
}
export function Restricted({ what, permission }: { what: string; permission: string }) {
  return <Panel><div className="flex items-start gap-3 p-6"><Lock size={18} className="mt-0.5 shrink-0 text-slate-400" /><div><h2 className="text-sm font-bold text-slate-900">{what} is not part of your role</h2><p className="mt-1 text-sm text-slate-600">This needs the <code className="rounded bg-slate-100 px-1 text-xs">{permission}</code> permission. Access is enforced by the server; ask a Sabi super admin to change your platform role if you need it.</p></div></div></Panel>;
}
/** Renders children only when the caller has one of the permissions; otherwise explains why not. */
export function Gate({ any, what, children }: { any: string[]; what: string; children: ReactNode }) {
  const { canAny, me } = useCc();
  if (!me) return <Loading />;
  return canAny(...any) ? <>{children}</> : <Restricted what={what} permission={any.join(' or ')} />;
}

// ---- Tables, pagination, tabs ------------------------------------------------------------------
export function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  return <nav aria-label="Pages" className="flex items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
    <span>{total.toLocaleString()} result{total === 1 ? '' : 's'} · page {page} of {pages}</span>
    <span className="flex gap-1"><CommandButton variant="secondary" className="h-8 px-2" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><ChevronLeft size={14} /></CommandButton><CommandButton variant="secondary" className="h-8 px-2" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page"><ChevronRight size={14} /></CommandButton></span>
  </nav>;
}
export function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm">{caption && <caption className="sr-only">{caption}</caption>}<thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{head.map((h, i) => <th key={i} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>;
}
export const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cn('px-4 py-2.5 align-top', className)}>{children}</td>;

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <div role="tablist" aria-label={label} className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200" onKeyDown={(e) => {
    const i = tabs.findIndex((t) => t.value === value);
    const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1;
    if (next >= 0) { onChange(tabs[next].value); refs.current[next]?.focus(); }
  }}>{tabs.map((t, i) => <button key={t.value} ref={(el) => { refs.current[i] = el; }} role="tab" aria-selected={t.value === value} tabIndex={t.value === value ? 0 : -1} onClick={() => onChange(t.value)} className={cn('-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition', t.value === value ? 'border-emerald-600 text-emerald-800' : 'border-transparent text-slate-500 hover:text-slate-800')}>{t.label}{t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[11px] text-slate-600">{t.count}</span>}</button>)}</div>;
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-end gap-2 border-b border-slate-100 px-4 py-3">{children}</div>;
}
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn('grid gap-1 text-xs font-semibold text-slate-600', className)}>{label}{children}</label>;
}
export function KeyValues({ items }: { items: [string, ReactNode][] }) {
  return <dl className="grid gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-2 xl:grid-cols-3">{items.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt><dd className="mt-0.5 break-words text-slate-800">{v ?? '—'}</dd></div>)}</dl>;
}
export function Definition({ text }: { text: string }) {
  const id = useId();
  return <span className="group relative inline-flex"><button type="button" aria-describedby={id} className="rounded text-slate-400 hover:text-slate-600 focus:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500" aria-label="How this is calculated"><Info size={12} /></button><span id={id} role="tooltip" className="pointer-events-none absolute left-1/2 top-5 z-30 hidden w-64 -translate-x-1/2 rounded-lg bg-slate-900 p-2.5 text-[11px] font-normal normal-case leading-4 tracking-normal text-white shadow-lg group-focus-within:block group-hover:block">{text}</span></span>;
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const f = useFormat();
  const tone: Record<string, string> = { PAYMENT: 'bg-sky-500', DELIVERY: 'bg-violet-500', PHARMACY: 'bg-emerald-500', REFUND: 'bg-amber-500', STAFF: 'bg-slate-900', ORDER: 'bg-slate-400', BOOKING: 'bg-emerald-500', VIDEO: 'bg-sky-500', NOTE: 'bg-violet-500', ACCESS: 'bg-slate-400' };
  if (!events.length) return <Empty title="No events recorded yet" />;
  return <ol className="relative space-y-3 p-4 before:absolute before:bottom-4 before:left-[21px] before:top-4 before:w-px before:bg-slate-200">{events.map((e, i) => <li key={i} className="relative flex gap-3 pl-0"><span className={cn('relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white', tone[e.kind] ?? 'bg-slate-400')} style={{ marginLeft: 1 }} /><div className="min-w-0"><p className="text-sm text-slate-800">{e.text}</p><p className="text-[11px] text-slate-500">{f.dateTime(e.at)} · {human(e.kind)}</p></div></li>)}</ol>;
}

// ---- Reason dialog (with two-step re-verification) ----------------------------------------------
type DialogField = { name: string; label: string; placeholder?: string; type?: 'text' | 'select' | 'number' | 'datetime-local'; options?: { value: string; label: string }[]; required?: boolean; defaultValue?: string; pattern?: string; hint?: string };
export type ActionDialogProps = {
  title: string; description?: ReactNode; confirm: string; tone?: 'primary' | 'danger';
  reasonLabel?: string | null; reasonMin?: number; fields?: DialogField[];
  run: (values: Record<string, string> & { reason: string }) => Promise<unknown>;
  onDone: (result: unknown) => void; onClose: () => void;
};
export function ActionDialog({ title, description, confirm, tone = 'primary', reasonLabel = 'Reason (recorded in the audit trail)', reasonMin = 5, fields = [], run, onDone, onClose }: ActionDialogProps) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ''])));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mfa, setMfa] = useState<'none' | 'needed'>('none');
  const [code, setCode] = useState('');
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    box.current?.querySelector<HTMLElement>('textarea, input, select, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [busy, onClose]);
  const reasonOk = reasonLabel === null || reason.trim().length >= reasonMin;
  const fieldsOk = fields.every((f) => !f.required || values[f.name]?.trim());
  async function submit() {
    setBusy(true); setError('');
    try {
      if (mfa === 'needed') {
        await liveStepUpMfa(code.trim(), code.trim().length > 8);
        setMfa('none'); setCode('');
      }
      onDone(await run({ ...values, reason: reason.trim() }));
    } catch (cause) {
      const e = cause as LiveApiError;
      if (e.code === 'MFA_REQUIRED') { setMfa('needed'); setError('This action needs you to confirm with your authenticator.'); }
      else if (e.code === 'MFA_ENROLLMENT_REQUIRED') setError('Set up an authenticator on your Sabi ID before taking this action.');
      else setError(e.message || 'Something went wrong.');
    } finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div ref={box} role="dialog" aria-modal="true" aria-labelledby={titleId} className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4"><h2 id={titleId} className="font-display text-lg font-bold text-slate-950">{title}</h2><button onClick={onClose} disabled={busy} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div>
      <form className="grid gap-4 px-5 py-4" onSubmit={(e) => { e.preventDefault(); if (reasonOk && fieldsOk && (mfa === 'none' || code.trim())) void submit(); }}>
        {description && <div className="text-sm leading-6 text-slate-600">{description}</div>}
        {fields.map((f) => <Field key={f.name} label={`${f.label}${f.required ? '' : ' (optional)'}`}>
          {f.type === 'select'
            ? <select value={values[f.name]} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800">{f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <CommandInput type={f.type ?? 'text'} value={values[f.name]} placeholder={f.placeholder} pattern={f.pattern} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="font-normal" />}
          {f.hint && <span className="text-[11px] font-normal text-slate-500">{f.hint}</span>}
        </Field>)}
        {reasonLabel !== null && <Field label={reasonLabel}><textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15" placeholder="Be specific: someone may review this later." /><span className="text-[11px] font-normal text-slate-500">{reason.trim().length < reasonMin ? `At least ${reasonMin} characters.` : `${500 - reason.length} characters left.`}</span></Field>}
        {mfa === 'needed' && <Field label="Authenticator code (or a recovery code)"><CommandInput autoComplete="one-time-code" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} className="font-normal tracking-widest" /></Field>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4"><CommandButton type="button" variant="secondary" onClick={onClose} disabled={busy}>Cancel</CommandButton><CommandButton type="submit" variant={tone} disabled={busy || !reasonOk || !fieldsOk || (mfa === 'needed' && !code.trim())}>{busy && <Loader2 size={14} className="animate-spin" />}{mfa === 'needed' ? 'Verify and continue' : confirm}</CommandButton></div>
      </form>
    </div>
  </div>;
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' }) {
  return <p className={cn('flex items-start gap-2 rounded-lg px-3 py-2 text-xs leading-5', tone === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-slate-50 text-slate-600')}><Info size={13} className="mt-0.5 shrink-0" />{children}</p>;
}
