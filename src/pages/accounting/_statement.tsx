import { useEffect, useState } from "react";
import { Download, FileText, Mail } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/form";
import { Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate, isoDate } from "@/lib/format";
import { customerStatementPdf, loadStatement, vendorStatementPdf, type PartyStatement } from "@/accounting-live/documents";
import { emailStatementNow } from "@/accounting-live/receivables";
import { describeEmrError } from "@/emr-live/client";

// A live statement of account, read from the subledger on the server: the balance brought forward, every
// posted entry on the customer's receivable (or the supplier's payable) in the period with a running
// balance, the open documents and the ageing — the same figures as the PDF and the ledger.

export function LiveStatement({ kind, partyId, email }: { kind: "customer" | "vendor"; partyId: string; email?: string }) {
  const [from, setFrom] = useState(() => isoDate(new Date(Date.now() - 90 * 864e5)));
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [data, setData] = useState<PartyStatement | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const period = { from, to };

  useEffect(() => {
    let current = true;
    loadStatement(kind, partyId, { from, to }).then((s) => { if (current) { setData(s); setError(""); } }, (cause) => { if (current) { setData(null); setError(describeEmrError(cause)); } });
    return () => { current = false; };
  }, [kind, partyId, from, to]);

  const pdf = (open: boolean) => {
    setBusy(true);
    void (kind === "customer" ? customerStatementPdf(partyId, period, open) : vendorStatementPdf(partyId, period, open)).then((e) => { setNote(e); setBusy(false); });
  };
  const [charges, payments] = kind === "customer" ? ["Charge", "Payment"] : ["Payment", "Bill"];

  return (
    <>
      <div className="no-print mb-4 space-y-2 rounded-lg bg-mist-50 px-3 py-2 text-sm">
        <div className="flex flex-wrap items-end gap-2">
          <Field label="From"><Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} /></Field>
          <Field label="To"><Input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} /></Field>
          <Button variant="soft" disabled={busy} onClick={() => pdf(true)}><FileText size={14} /> Open PDF</Button>
          <Button variant="soft" disabled={busy} onClick={() => pdf(false)}><Download size={14} /> Download</Button>
          {kind === "customer" && email && (
            <Button disabled={busy} onClick={() => { setBusy(true); void emailStatementNow(partyId, period).then((n) => { setNote(n); setBusy(false); }); }}><Mail size={14} /> {busy ? "Sending…" : "Email to customer"}</Button>
          )}
        </div>
        <p className="text-mist-500">{note || (kind === "customer"
          ? email ? `Emailed statements go to ${email} with the PDF attached.` : "Add the customer's email address to email the statement."
          : "From the payable ledger: what the hospital owes this supplier.")}</p>
      </div>
      {error && <p className="mb-3 rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{error}</p>}
      {!data && !error && <p className="text-sm text-mist-400">Loading the statement…</p>}
      {data && (
        <>
          <Section title="Statement of Account">
            <Line label={kind === "customer" ? "Customer" : "Vendor"} value={data.party.name} />
            <Line label="Period" value={`${shortDate(data.from)} – ${shortDate(data.to)}`} />
            <Line label="Opening balance" value={money(data.openingBalance)} />
            <Line label="Closing balance" value={money(data.closingBalance)} />
          </Section>
          {data.aging.length > 0 && data.closingBalance !== 0 && (
            <Section title="Aging summary">
              <div className="grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-6">
                {data.aging.map((a) => (
                  <div key={a.label} className="rounded-lg bg-mist-50 p-2"><div className="text-mist-400">{a.label}</div><div className="font-mono font-semibold">{money(a.amount)}</div></div>
                ))}
              </div>
            </Section>
          )}
          <table className="w-full border-collapse text-sm">
            <thead><tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Date</th><th>Doc</th><th>Detail</th><th className="text-right">{charges}</th><th className="text-right">{payments}</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              <tr className="border-b border-mist-100 font-semibold"><td className="py-1.5">{shortDate(data.from)}</td><td /><td>Opening balance</td><td /><td /><td className="text-right font-mono">{money(data.openingBalance)}</td></tr>
              {data.lines.map((l, i) => (
                <tr key={i} className="border-b border-mist-100">
                  <td className="py-1.5">{shortDate(l.date)}</td><td className="font-mono text-xs">{l.reference}</td><td>{l.description}</td>
                  <td className="text-right font-mono">{l.debit ? money(l.debit) : ""}</td>
                  <td className="text-right font-mono">{l.credit ? money(l.credit) : ""}</td>
                  <td className="text-right font-mono">{money(l.balance)}</td>
                </tr>
              ))}
              <tr className="border-b border-mist-300 font-semibold"><td className="py-1.5">{shortDate(data.to)}</td><td /><td>Closing balance</td><td /><td /><td className="text-right font-mono">{money(data.closingBalance)}</td></tr>
            </tbody>
          </table>
          {data.open.length > 0 && (
            <div className="mt-4">
              <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-mist-500">{kind === "customer" ? "Open invoices" : "Open bills"}</h4>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  {data.open.map((o) => (
                    <tr key={o.id} className="border-b border-mist-100">
                      <td className="py-1.5 font-mono text-xs">{o.number}</td><td>{shortDate(o.date)}</td><td>{o.dueDate ? `due ${shortDate(o.dueDate)}` : ""}{o.overdue && <b className="text-action-600"> · overdue</b>}</td>
                      <td className="text-right font-mono">{o.currency !== "NGN" ? `${o.currency} ${o.balance.toLocaleString()}` : money(o.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
