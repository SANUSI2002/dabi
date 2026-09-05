import { useMemo, useState } from "react";
import { Plus, Banknote } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAR, docTotal } from "@/store/accounting/useAR";
import { useLedger } from "@/store/accounting/useLedger";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function CustomerReceipts() {
  const { customers, receipts, customerById, openInvoicesOf, invoiceBalance, recordReceipt } = useAR();
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const [create, setCreate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ customerId: "", date: isoDate(new Date()), method: "Bank Transfer" as const, account: 1010, amount: 0, reference: "", notes: "" });
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  const open = f.customerId ? openInvoicesOf(f.customerId) : [];
  const allocTotal = round2(Object.values(alloc).reduce((n, v) => n + (v || 0), 0));
  const unapplied = round2(f.amount - allocTotal);

  function autoAllocate() {
    let left = f.amount;
    const next: Record<string, number> = {};
    for (const inv of open) {
      const b = invoiceBalance(inv);
      const take = Math.max(0, Math.min(left, b));
      if (take > 0) next[inv.id] = round2(take);
      left = round2(left - take);
    }
    setAlloc(next);
  }

  function submit() {
    setErr(null);
    const r = recordReceipt({
      customerId: f.customerId,
      date: new Date(f.date + "T12:00:00Z").toISOString(),
      method: f.method,
      depositAccountNumber: f.account,
      amount: f.amount,
      allocations: Object.entries(alloc).filter(([, v]) => v > 0).map(([invoiceId, amount]) => ({ invoiceId, amount: round2(amount) })),
      reference: f.reference || undefined,
      notes: f.notes || undefined,
    });
    if (!r.ok) return setErr(r.error ?? "Could not record receipt");
    setCreate(false);
    setAlloc({});
    setF({ ...f, amount: 0, reference: "", notes: "" });
  }

  const total = useMemo(() => receipts.reduce((n, r) => n + r.amount, 0), [receipts]);
  const thisMonth = receipts.filter((r) => new Date(r.date).getUTCMonth() === new Date().getUTCMonth()).reduce((n, r) => n + r.amount, 0);

  return (
    <div>
      <PageHeader title="Customer Receipts" subtitle="Money in from customers — posts Dr bank / Cr Accounts Receivable and clears invoices"
        actions={<Button onClick={() => { setErr(null); setAlloc({}); setF({ ...f, customerId: customers[0]?.id ?? "", amount: 0 }); setCreate(true); }}><Plus size={15} /> Record Receipt</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Receipts" value={receipts.length} tone="brand" icon={<Banknote size={18} />} />
        <StatCard label="Collected (all time)" value={money(total)} tone="brand" delay={0.05} />
        <StatCard label="Collected this month" value={money(thisMonth)} tone="mist" delay={0.1} />
      </div>

      {receipts.length === 0 ? <EmptyState title="No receipts yet" /> : (
        <Card className="p-0">
          <Table columns={["Receipt", "Customer", "Date", "Method", "Amount", "Applied", "Deposit"]}>
            {receipts.map((r, i) => (
              <Row key={r.id} index={i}>
                <Cell className="font-mono text-xs">{r.number}</Cell>
                <Cell className="font-semibold">{customerById(r.customerId)?.name}</Cell>
                <Cell>{shortDate(r.date)}</Cell>
                <Cell><Badge tone="mist">{r.method}</Badge></Cell>
                <Cell className="font-mono">{money(r.amount)}</Cell>
                <Cell className="font-mono">{money(r.allocations.reduce((n, a) => n + a.amount, 0))}</Cell>
                <Cell className="text-xs text-mist-500">{r.depositAccountNumber}</Cell>
              </Row>
            ))}
          </Table>
        </Card>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="Record Receipt" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={!f.customerId || f.amount <= 0}>Post receipt</Button></>}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Customer"><Select value={f.customerId} onChange={(e) => { setF({ ...f, customerId: e.target.value }); setAlloc({}); }} options={[{ value: "", label: "Select…" }, ...customers.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Amount received"><Input type="number" value={f.amount || ""} onChange={(e) => setF({ ...f, amount: +e.target.value })} /></Field>
            <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as never })} options={["Cash", "Bank Transfer", "POS", "Cheque", "NHIS Remittance"]} /></Field>
            <Field label="Deposit to"><Select value={String(f.account)} onChange={(e) => setF({ ...f, account: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
            <Field label="Reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
          </div>

          {f.customerId && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label mb-0">Apply to open invoices</span>
                <button type="button" className="btn-soft px-2 py-1 text-xs" onClick={autoAllocate}>Auto-allocate</button>
              </div>
              {open.length === 0 ? <p className="text-sm text-mist-400">No open invoices — the receipt will sit as an unapplied credit.</p> : (
                <Table columns={["Invoice", "Due", "Balance", "Apply"]}>
                  {open.map((inv, i) => (
                    <Row key={inv.id} index={i}>
                      <Cell className="font-mono text-xs">{inv.number}</Cell>
                      <Cell>{shortDate(inv.dueDate)}</Cell>
                      <Cell className="font-mono">{money(invoiceBalance(inv))}</Cell>
                      <Cell>
                        <input type="number" className="input h-8 w-28 text-sm" value={alloc[inv.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [inv.id]: Math.min(+e.target.value, invoiceBalance(inv)) })} />
                      </Cell>
                    </Row>
                  ))}
                </Table>
              )}
              <div className="mt-2 flex justify-end gap-6 text-sm font-semibold">
                <span>Applied {money(allocTotal)}</span>
                <span className={unapplied < -0.01 ? "text-action-600" : "text-mist-500"}>Unapplied {money(unapplied)}</span>
              </div>
            </div>
          )}
          <Field label="Notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
