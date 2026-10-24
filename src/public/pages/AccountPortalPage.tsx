import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Building2, Download, FileText, Loader2, Lock, Wallet } from "lucide-react";
import { apiBaseUrl } from "@/config/runtime";
import { artworkUrl } from "@/lib/routeArtwork";

// A customer's or supplier's own account with a hospital, opened from the link the hospital sent them —
// no Sabi account needed. The statement, invoices (or bills and remittance advice) and how to pay come
// from the hospital's books; documents open as PDF. Nothing is paid or changed from here.

type Line = { date: string; reference: string; description: string; debit: number; credit: number; balance: number };
type Statement = { from: string; to: string; openingBalance: number; closingBalance: number; lines: Line[]; aging: { label: string; amount: number }[] };
type Hospital = { name: string; address: string; phone: string; email: string; paymentInstructions: string };
type View = { kind: "customer" | "vendor"; hospital: Hospital; party: { name: string }; expiresAt: string; statement: Statement } & (
  | { kind: "customer"; invoices: { id: string; number: string; date: string; dueDate?: string; currency: string; status: string; total: number; balance: number }[] }
  | { kind: "vendor"; bills: { id: string; number: string; yourReference?: string; date: string; dueDate?: string; currency: string; status: string; total: number; balance: number }[]; payments: { id: string; number: string; date: string; method: string; amount: number; withheldTax: number; reference?: string }[] }
);

// negatives in brackets, as on the hospital's own screens: "(₦30,000.00)"
const naira = (n: number, currency = "NGN") => {
  const text = `${currency === "NGN" ? "₦" : `${currency} `}${Math.abs(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < -0.005 ? `(${text})` : text;
};
const day = (d?: string) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const tone = (s: string) => (s === "Overdue" ? "bg-red-50 text-red-700" : s === "Paid" ? "bg-emerald-50 text-emerald-700" : s === "Void" ? "bg-slate-100 text-slate-500" : "bg-amber-50 text-amber-800");

export default function AccountPortalPage() {
  const { token = "" } = useParams();
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");
  const base = `${apiBaseUrl}/api/v1/accounting/portal/${encodeURIComponent(token)}`;

  useEffect(() => {
    let current = true;
    fetch(base, { cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" })
      .then(async (r) => { const body = await r.json().catch(() => ({})); if (!r.ok) throw new Error(body.error?.message || "This link could not be opened."); return body.data as View; })
      .then((v) => { if (current) setView(v); }, (e: Error) => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [base]);

  if (error) return <Shell><div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"><Lock className="mx-auto mb-3 text-slate-400" size={28} /><h1 className="font-display text-xl font-bold text-slate-900">This link can't be opened</h1><p className="mt-2 text-sm leading-6 text-slate-600">{error}</p></div></Shell>;
  if (!view) return <Shell><div className="flex items-center justify-center gap-2 py-24 text-slate-500"><Loader2 className="animate-spin" size={18} /> Opening your account…</div></Shell>;

  const s = view.statement;
  const owes = view.kind === "customer" ? "Amount due" : "Amount owed to you";
  const doc = (href: string, label: string) => <a className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-50" href={href} target="_blank" rel="noreferrer noopener"><FileText size={13} /> {label}</a>;
  return (
    <Shell>
      <header className="relative mb-6 overflow-hidden rounded-2xl bg-emerald-900 p-6 text-white shadow-lg sm:p-8">
        <img src={artworkUrl("accounting-customers")} alt="" aria-hidden="true" width={1536} height={1024} className="pointer-events-none absolute inset-y-0 right-0 h-full w-full select-none object-cover object-[70%_40%] opacity-40 sm:w-[65%] sm:opacity-70" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-emerald-950 via-emerald-900/90 to-emerald-900/20" />
        <div className="relative">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100"><Building2 size={14} /> {view.hospital.name}</p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{view.party.name}</h1>
        <p className="mt-1 text-sm text-emerald-100">Your account {view.kind === "customer" ? "with" : "as a supplier to"} {view.hospital.name}, as at {day(s.to)}</p>
        <div className="mt-5 flex flex-wrap items-end gap-6">
          <div><p className="text-xs uppercase tracking-wide text-emerald-200">{owes}</p><p className="font-display text-3xl font-bold">{naira(s.closingBalance)}</p></div>
          <a className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold ring-1 ring-white/30 hover:bg-white/25" href={`${base}/statement.pdf?download=1`} rel="noreferrer noopener"><Download size={15} /> Statement (PDF)</a>
        </div>
        </div>
      </header>

      {view.kind === "customer" && view.hospital.paymentInstructions && (
        <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="flex items-center gap-2 text-sm font-bold text-emerald-900"><Wallet size={16} /> How to pay</h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-6 text-emerald-950">{view.hospital.paymentInstructions}</p>
          <p className="mt-2 text-xs text-emerald-800">Please quote the invoice number with your payment. Payments are not taken on this page.</p>
        </section>
      )}

      {s.aging.length > 0 && s.closingBalance !== 0 && (
        <section className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {s.aging.map((a) => <div key={a.label} className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-[11px] uppercase tracking-wide text-slate-400">{a.label}</p><p className="font-mono text-sm font-semibold text-slate-800">{naira(a.amount)}</p></div>)}
        </section>
      )}

      {view.kind === "customer" ? (
        <Panel title="Invoices">
          <Table head={["Invoice", "Date", "Due", "Total", "Balance", "Status", ""]} empty="No invoices in the past two years.">
            {view.invoices.map((i) => <tr key={i.id} className="border-t border-slate-100"><Td mono>{i.number}</Td><Td>{day(i.date)}</Td><Td>{day(i.dueDate)}</Td><Td mono>{naira(i.total, i.currency)}</Td><Td mono>{naira(i.balance, i.currency)}</Td><Td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(i.status)}`}>{i.status}</span></Td><Td>{doc(`${base}/invoices/${i.id}.pdf`, "PDF")}</Td></tr>)}
          </Table>
        </Panel>
      ) : (
        <>
          <Panel title="Bills">
            <Table head={["Our ref.", "Your invoice", "Date", "Due", "Total", "Balance", "Status"]} empty="No bills in the past two years.">
              {view.bills.map((b) => <tr key={b.id} className="border-t border-slate-100"><Td mono>{b.number}</Td><Td>{b.yourReference ?? "—"}</Td><Td>{day(b.date)}</Td><Td>{day(b.dueDate)}</Td><Td mono>{naira(b.total, b.currency)}</Td><Td mono>{naira(b.balance, b.currency)}</Td><Td><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone(b.status)}`}>{b.status}</span></Td></tr>)}
            </Table>
          </Panel>
          <Panel title="Payments to you">
            <Table head={["Payment", "Date", "Method", "Reference", "Amount", "Tax withheld", ""]} empty="No payments in the past two years.">
              {view.payments.map((p) => <tr key={p.id} className="border-t border-slate-100"><Td mono>{p.number}</Td><Td>{day(p.date)}</Td><Td>{p.method}</Td><Td>{p.reference ?? "—"}</Td><Td mono>{naira(p.amount)}</Td><Td mono>{p.withheldTax ? naira(p.withheldTax) : "—"}</Td><Td>{doc(`${base}/payments/${p.id}/remittance.pdf`, "Remittance")}</Td></tr>)}
            </Table>
          </Panel>
        </>
      )}

      <Panel title={`Statement · ${day(s.from)} – ${day(s.to)}`}>
        <Table head={["Date", "Reference", "Details", view.kind === "customer" ? "Charges" : "Payments", view.kind === "customer" ? "Payments" : "Bills", "Balance"]} empty="">
          <tr className="border-t border-slate-100 font-semibold"><Td>{day(s.from)}</Td><Td /><Td>Opening balance</Td><Td /><Td /><Td mono>{naira(s.openingBalance)}</Td></tr>
          {s.lines.map((l, i) => <tr key={i} className="border-t border-slate-100"><Td>{day(l.date)}</Td><Td mono>{l.reference}</Td><Td>{l.description}</Td><Td mono>{l.debit ? naira(l.debit) : ""}</Td><Td mono>{l.credit ? naira(l.credit) : ""}</Td><Td mono>{naira(l.balance)}</Td></tr>)}
          <tr className="border-t border-slate-200 font-semibold"><Td>{day(s.to)}</Td><Td /><Td>Closing balance</Td><Td /><Td /><Td mono>{naira(s.closingBalance)}</Td></tr>
        </Table>
      </Panel>

      <footer className="mt-8 space-y-1 text-center text-xs leading-5 text-slate-500">
        <p>{[view.hospital.address, view.hospital.phone, view.hospital.email].filter(Boolean).join(" · ")}</p>
        <p>Questions about your account? Contact {view.hospital.email ? <a className="font-semibold text-emerald-800 underline" href={`mailto:${view.hospital.email}`}>{view.hospital.email}</a> : view.hospital.name}. This link works until {day(view.expiresAt)}; keep it private.</p>
      </footer>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8 sm:py-10"><div className="mx-auto max-w-5xl">{children}<p className="mt-6 text-center text-[11px] text-slate-400">Secured by Sabi Health</p></div></main>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><h2 className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-700">{title}</h2><div className="overflow-x-auto">{children}</div></section>;
}
function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty: string }) {
  const rows = Array.isArray(children) ? children.flat().filter(Boolean) : children ? [children] : [];
  return (
    <table className="w-full min-w-[640px] text-left text-sm">
      <thead><tr className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">{head.map((h, i) => <th key={i} className="px-4 py-2 font-semibold">{h}</th>)}</tr></thead>
      <tbody>{rows.length ? children : empty ? <tr><td colSpan={head.length} className="px-4 py-8 text-center text-slate-400">{empty}</td></tr> : null}</tbody>
    </table>
  );
}
function Td({ children, mono }: { children?: React.ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-2.5 text-slate-700 ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}
