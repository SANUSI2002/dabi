import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { emrRequest } from './client';
import { useLiveEmr } from './session';
import { restoreLiveIdentity } from '@/identity/liveIdentity';
import { ActionDialog, type ActionDialogProps } from '@/command-center/ops/kit';
import type { SubscriptionInvoice } from '@/command-center/ops/RuntimePages';

const amount = (n: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(n / 100);
const date = (s: string) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(s));
type List = { items: SubscriptionInvoice[]; page: number; pages: number; total: number };
export default function SubscriptionPage() {
  const [data, setData] = useState<List | null>(null), [page, setPage] = useState(1), [error, setError] = useState(''), [busy, setBusy] = useState(false), [ready, setReady] = useState(false), [dialog, setDialog] = useState<ActionDialogProps | null>(null);
  const access = useLiveEmr((s) => s.access);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!(await restoreLiveIdentity())) throw new Error('Sign in to your hospital account to view subscription billing.');
        if (!useLiveEmr.getState().access) await useLiveEmr.getState().restore();
        if (!useLiveEmr.getState().access) throw new Error('Choose your hospital before opening its subscription.');
        if (active) setReady(true);
      } catch (e) { if (active) setError(e instanceof Error ? e.message : 'Hospital access could not be verified.'); }
    })(); return () => { active = false; };
  }, []);
  const load = async () => { setBusy(true); setError(''); try { setData((await emrRequest<{ data: List }>(`/runtime/subscription?page=${page}&limit=12`)).data); } catch (e) { setError(e instanceof Error ? e.message : 'Invoices could not be loaded.'); } finally { setBusy(false); } };
  useEffect(() => { if (ready) void load(); }, [ready, page]);
  const pay = (i: SubscriptionInvoice) => setDialog({ title: `Pay ${i.reference}`, confirm: 'Continue to secure checkout', reasonLabel: null, description: `${amount(i.amountMinor)} for ${i.packageName}. You will continue to Paystack. Your invoice is marked paid only after the backend independently verifies payment.`, run: async () => { const result = await emrRequest<{ data: { url: string } }>(`/runtime/subscription/${i.id}/pay`, { method: 'POST', body: {} }); const u = new URL(result.data.url); if (u.protocol !== 'https:' || u.hostname !== 'checkout.paystack.com' || u.username || u.password) throw new Error('The provider returned an invalid checkout address.'); return u.toString(); }, onClose: () => setDialog(null), onDone: (url) => { setDialog(null); window.location.assign(String(url)); } });
  const check = async (i: SubscriptionInvoice) => { setBusy(true); setError(''); try { await emrRequest(`/runtime/subscription/${i.id}/check`, { method: 'POST', body: {} }); await load(); } catch (e) { setError(e instanceof Error ? e.message : 'Payment could not be verified.'); } finally { setBusy(false); } };
  return <main className="min-h-screen bg-mist-50 px-4 py-8 text-slate-900 sm:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-700">Sabi OS · {access?.organizationName || 'Hospital account'}</p><h1 className="mt-2 font-display text-3xl font-bold">Your subscription</h1><p className="mt-2 text-sm text-slate-600">Invoices, secure payments and verified receipts for your hospital.</p></div>
        <Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold" to={access ? '/' : '/choose-organization'}>{access ? 'Back to workspace' : 'Choose hospital'}</Link>
      </div>
      {error && <div role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">{error}{ready && <button className="ml-3 underline" onClick={() => void load()} disabled={busy}>Retry</button>}{!ready && <Link className="ml-3 underline" to="/login">Sign in</Link>}</div>}
      {busy && <p role="status" className="mb-4 text-sm text-slate-600">Loading subscription…</p>}
      {ready && data && (data.items.length ? <div className="grid gap-4 md:grid-cols-2">
        {data.items.map((i) => <article key={i.id} className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">{i.reference}</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{i.status}</span></div>
          <p className="mt-5 text-2xl font-bold">{amount(i.amountMinor)}</p><p className="mt-1 text-sm text-slate-600">{i.packageName} · {i.cycle}</p>
          <dl className="mt-5 space-y-2 text-xs">
            <div className="flex justify-between gap-2"><dt>Period (end exclusive)</dt><dd>{date(i.periodStart)} – {date(i.periodEnd)}</dd></div>
            <div className="flex justify-between"><dt>Due</dt><dd>{date(i.dueAt)}</dd></div>
            {i.paidAt && <div className="flex justify-between"><dt>Confirmed paid</dt><dd>{date(i.paidAt)}</dd></div>}
          </dl>
          {i.voidReason && <p className="mt-4 text-sm text-slate-600">{i.voidReason}</p>}
          {i.payment?.errorCode && <p className="mt-4 text-sm text-amber-800">Payment needs checking. No second charge will be started automatically.</p>}
          <div className="mt-5 flex flex-wrap gap-2">
            {i.status === 'OPEN' && access?.permissions.includes('membership.manage') && <button className="min-h-11 rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !!(i.payment && !['CREATED', 'READY'].includes(i.payment.status))} onClick={() => pay(i)}>Pay securely</button>}
            {i.payment && <button className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold disabled:opacity-50" disabled={busy} onClick={() => void check(i)}>Check payment</button>}
          </div>
        </article>)}
      </div> : <section className="rounded-2xl border border-slate-200 bg-white p-8"><h2 className="font-semibold">No subscription invoices yet</h2><p className="mt-2 text-sm text-slate-600">Sabi operations will issue invoices based on your accepted package. Nothing is charged here automatically.</p></section>)}
      {data && data.pages > 1 && <nav className="mt-6 flex justify-between" aria-label="Invoice pages"><button className="min-h-11 px-4 disabled:opacity-50" disabled={busy || page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="py-3 text-sm">{page} / {data.pages}</span><button className="min-h-11 px-4 disabled:opacity-50" disabled={busy || page >= data.pages} onClick={() => setPage((p) => p + 1)}>Next</button></nav>}
    </div>
    {dialog && <ActionDialog {...dialog} />}
  </main>;
}
