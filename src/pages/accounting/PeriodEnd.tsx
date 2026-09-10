import { useMemo, useState } from "react";
import { RefreshCw, CalendarSync, Coins, CalendarClock, CheckCircle2 } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Field, Input } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useLedger } from "@/store/accounting/useLedger";
import { useAR, fxOf } from "@/store/accounting/useAR";
import { useAP, fxOfBill } from "@/store/accounting/useAP";

const thisMonth = () => { const d = new Date(); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

export default function PeriodEnd() {
  const { fxRates, recurringJournals, dueRecurringJournals, runRecurringJournals, accountByNumber } = useLedger();
  const { invoices, revenueSchedules, revalueForeignAr, runRecurringInvoices, recognizeRevenue, customerById } = useAR();
  const { bills, revalueForeignAp, runRecurringBills, vendorById } = useAP();

  const foreignCurrencies = useMemo(() => [...new Set([...invoices, ...bills].filter((d) => d.currency !== "NGN").map((d) => d.currency))], [invoices, bills]);
  const [rates, setRates] = useState<Record<string, number>>(() => Object.fromEntries(foreignCurrencies.map((c) => [c, fxRates.find((r) => r.code === c)?.rateToNgn ?? 1])));
  const [asOf, setAsOf] = useState(isoDate(new Date()));
  const [period, setPeriod] = useState(thisMonth());
  const [msg, setMsg] = useState<string | null>(null);

  const openForeignInv = invoices.filter((i) => i.currency !== "NGN" && (i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue"));
  const openForeignBill = bills.filter((b) => b.currency !== "NGN" && (b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue"));
  const dueRecurringInv = invoices.filter((i) => i.isRecurring && i.recurrenceNextDate && new Date(i.recurrenceNextDate).getTime() <= new Date(asOf + "T23:59:59Z").getTime());
  const dueRecurringBill = bills.filter((b) => b.isRecurring && b.recurrenceNextDate && new Date(b.recurrenceNextDate).getTime() <= new Date(asOf + "T23:59:59Z").getTime());
  const dueSchedules = revenueSchedules.flatMap((s) => s.entries.filter((e) => !e.recognized && e.period <= period).map((e) => ({ s, e })));

  function revalue() {
    const iso = new Date(asOf + "T23:59:59Z").toISOString();
    const ar = revalueForeignAr(iso, rates);
    const ap = revalueForeignAp(iso, rates);
    // AR delta>0 is a gain; AP delta>0 is a loss
    setMsg(`Revalued ${ar.adjusted} AR + ${ap.adjusted} AP balances. Net P&L impact ${money(ar.net - ap.net)}.`);
  }
  function recur() {
    const iso = new Date(asOf + "T23:59:59Z").toISOString();
    const i = runRecurringInvoices(iso);
    const b = runRecurringBills(iso);
    const j = runRecurringJournals(iso);
    setMsg(`Generated ${i.created.length} invoice(s), ${b.created.length} bill(s) and posted ${j.posted} recurring journal(s).`);
  }
  const dueJournals = dueRecurringJournals(new Date(asOf + "T23:59:59Z").toISOString());

  return (
    <div>
      <PageHeader title="Period-End Routines" subtitle="Foreign-currency revaluation, recurring documents, and revenue recognition — each posts real journal entries" />

      {msg && <div className="mb-4 flex items-center gap-2 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200"><CheckCircle2 size={16} /> {msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Foreign AR / AP open" value={openForeignInv.length + openForeignBill.length} tone="brand" icon={<Coins size={18} />} />
        <StatCard label="Recurring due" value={dueRecurringInv.length + dueRecurringBill.length + dueRecurringJournals(new Date(asOf + "T23:59:59Z").toISOString()).length} tone="amber" delay={0.05} />
        <StatCard label="Revenue to recognise" value={dueSchedules.length} tone={dueSchedules.length ? "amber" : "mist"} delay={0.1} />
        <StatCard label="Revenue schedules" value={revenueSchedules.length} tone="mist" delay={0.15} />
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="As at date"><Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
          <Field label="Recognition period"><Input value={period} onChange={(e) => setPeriod(e.target.value)} className="w-32" /></Field>
        </div>
      </Card>

      <Tabs tabs={["FX Revaluation", "Recurring", "Revenue Recognition"]}>
        {(t) =>
          t === "FX Revaluation" ? (
            <Card>
              <p className="mb-3 text-sm text-mist-500">Enter today's closing rates. Open foreign balances are marked to market and the difference posts to Foreign Exchange Gain / Loss.</p>
              {foreignCurrencies.length === 0 ? <EmptyState title="No foreign-currency documents" /> : (
                <>
                  <div className="mb-4 flex flex-wrap gap-3">
                    {foreignCurrencies.map((c) => (
                      <Field key={c} label={`${c} → NGN`}><Input type="number" value={rates[c] ?? ""} onChange={(e) => setRates({ ...rates, [c]: +e.target.value })} className="w-32" /></Field>
                    ))}
                  </div>
                  <Table columns={["Document", "Party", "Currency", "Balance (FX)", "Booked @", "Now @", "Revaluation"]}>
                    {[...openForeignInv.map((i) => ({ kind: "AR", ref: i.number, party: customerById(i.customerId)?.name, cur: i.currency, bal: (useAR.getState().invoiceBalance(i)), book: fxOf(i) })),
                      ...openForeignBill.map((b) => ({ kind: "AP", ref: b.number, party: vendorById(b.vendorId)?.name, cur: b.currency, bal: useAP.getState().billBalance(b), book: fxOfBill(b) }))].map((r, idx) => {
                      const now = rates[r.cur] ?? r.book;
                      const delta = r.kind === "AR" ? r.bal * (now - r.book) : -(r.bal * (now - r.book));
                      return (
                        <Row key={idx} index={idx}>
                          <Cell className="font-mono text-xs">{r.ref} <Badge tone="mist">{r.kind}</Badge></Cell>
                          <Cell>{r.party}</Cell>
                          <Cell>{r.cur}</Cell>
                          <Cell className="font-mono">{r.bal.toLocaleString()}</Cell>
                          <Cell className="font-mono">{r.book.toLocaleString()}</Cell>
                          <Cell className="font-mono">{now.toLocaleString()}</Cell>
                          <Cell className={`font-mono font-semibold ${delta >= 0 ? "text-brand-700" : "text-action-600"}`}>{money(delta)}</Cell>
                        </Row>
                      );
                    })}
                  </Table>
                  <div className="mt-3 flex justify-end"><Button onClick={revalue}><RefreshCw size={15} /> Post revaluation</Button></div>
                </>
              )}
            </Card>
          ) : t === "Recurring" ? (
            <Card>
              <p className="mb-3 text-sm text-mist-500">Templates whose next date has arrived. Running this issues a fresh invoice / bill or posts a standing journal and advances the schedule.</p>
              {recurringJournals.length > 0 && (
                <Table columns={["Standing journal", "Lines", "Next date", "Every", "Posted", "Status"]}>
                  {recurringJournals.map((rj, i) => (
                    <Row key={rj.id} index={i}>
                      <Cell className="font-semibold">{rj.memo}</Cell>
                      <Cell className="text-mist-500">{rj.lines.map((l) => `${l.accountNumber}`).join(" / ")}</Cell>
                      <Cell>{shortDate(rj.nextDate)}{dueJournals.some((d) => d.id === rj.id) && <Badge tone="amber"> due</Badge>}</Cell>
                      <Cell>{rj.everyMonths} mo</Cell>
                      <Cell>{rj.postedCount}x</Cell>
                      <Cell><Badge tone={rj.active ? "brand" : "mist"}>{rj.active ? "Active" : "Ended"}</Badge></Cell>
                    </Row>
                  ))}
                </Table>
              )}
              {dueRecurringInv.length + dueRecurringBill.length + dueJournals.length === 0 ? <EmptyState title="Nothing due" hint="Recurring invoices, bills and standing journals appear here on their next date." /> : (
                <>
                  <Table columns={["Type", "Source", "Party", "Next date", "Amount", "Every"]}>
                    {[...dueRecurringInv.map((i) => ({ kind: "Invoice", ref: i.number, party: customerById(i.customerId)?.name, next: i.recurrenceNextDate!, amt: useAR.getState().invoiceBalance({ ...i, amountPaid: 0 }) * fxOf(i), every: i.recurrenceEveryMonths })),
                      ...dueRecurringBill.map((b) => ({ kind: "Bill", ref: b.number, party: vendorById(b.vendorId)?.name, next: b.recurrenceNextDate!, amt: useAP.getState().billBalance({ ...b, amountPaid: 0 }) * fxOfBill(b), every: b.recurrenceEveryMonths }))].map((r, i) => (
                      <Row key={i} index={i}>
                        <Cell><Badge tone="mist">{r.kind}</Badge></Cell>
                        <Cell className="font-mono text-xs">{r.ref}</Cell>
                        <Cell>{r.party}</Cell>
                        <Cell>{shortDate(r.next)}</Cell>
                        <Cell className="font-mono">{money(r.amt)}</Cell>
                        <Cell>{r.every} mo</Cell>
                      </Row>
                    ))}
                  </Table>
                  <div className="mt-3 flex justify-end"><Button onClick={recur}><CalendarSync size={15} /> Generate now</Button></div>
                </>
              )}
            </Card>
          ) : (
            <Card className="p-0">
              {revenueSchedules.length === 0 ? <EmptyState title="No revenue schedules" hint="Create an invoice with a deferral period to spread its revenue." /> : (
                <Table columns={["Invoice", "Customer", "Total", "Period", "Amount", "Status", ""]}>
                  {revenueSchedules.flatMap((s) => s.entries.map((e) => ({ s, e }))).map(({ s, e }, i) => (
                    <Row key={`${s.id}-${e.period}`} index={i}>
                      <Cell className="font-mono text-xs">{invoices.find((x) => x.id === s.invoiceId)?.number ?? "—"}</Cell>
                      <Cell>{customerById(s.customerId)?.name}</Cell>
                      <Cell className="font-mono">{money(s.totalAmount)}</Cell>
                      <Cell className="font-mono">{e.period}</Cell>
                      <Cell className="font-mono">{money(e.amount)}</Cell>
                      <Cell><Badge tone={e.recognized ? "brand" : e.period <= period ? "amber" : "mist"}>{e.recognized ? "Recognised" : e.period <= period ? "Due" : "Scheduled"}</Badge></Cell>
                      <Cell>{!e.recognized && e.period <= period && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { const r = recognizeRevenue(s.id, e.period); if (!r.ok) setMsg(r.error ?? "Failed"); else setMsg(`Recognised ${money(e.amount)} for ${e.period}.`); }}><CalendarClock size={11} /> Recognise</button>}</Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </Card>
          )
        }
      </Tabs>
    </div>
  );
}
