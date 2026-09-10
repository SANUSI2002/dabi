import { useMemo, useState } from "react";
import { Plus, Banknote } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { Tabs } from "@/components/ui/Tabs";
import { PrintDoc, Section, Line, SignRow } from "@/components/print/PrintFrame";
import { useAP } from "@/store/accounting/useAP";
import { useLedger } from "@/store/accounting/useLedger";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default function VendorPayments() {
  const { vendors, vendorPayments, vendorById, openBillsOf, billBalance, payVendor, whtCertificates } = useAP();
  const org = useAccountingSettings((s) => s.org);
  const [cert, setCert] = useState<ReturnType<typeof whtCertificates>[number] | null>(null);
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const [create, setCreate] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ vendorId: "", date: isoDate(new Date()), method: "Bank Transfer" as const, account: 1010, reference: "" });
  const [alloc, setAlloc] = useState<Record<string, number>>({});

  const open = f.vendorId ? openBillsOf(f.vendorId) : [];
  const allocTotal = round2(Object.values(alloc).reduce((n, v) => n + (v || 0), 0));

  function autoAllocate() {
    const next: Record<string, number> = {};
    for (const b of [...open].sort((a, z) => new Date(a.dueDate).getTime() - new Date(z.dueDate).getTime())) next[b.id] = round2(billBalance(b));
    setAlloc(next);
  }
  function submit() {
    setErr(null);
    const allocs = Object.entries(alloc).filter(([, v]) => v > 0).map(([billId, amount]) => ({ billId, amount: round2(amount) }));
    const r = payVendor({ vendorId: f.vendorId, date: new Date(f.date + "T12:00:00Z").toISOString(), method: f.method, fromAccountNumber: f.account, amount: allocTotal, allocations: allocs, reference: f.reference || undefined });
    if (!r.ok) return setErr(r.error ?? "Could not pay");
    setCreate(false);
    setAlloc({});
  }

  const total = useMemo(() => vendorPayments.reduce((n, p) => n + p.amount, 0), [vendorPayments]);

  return (
    <div>
      <PageHeader title="Vendor Payments" subtitle="Money out to vendors — posts Dr Accounts Payable / Cr bank and clears bills"
        actions={<Button onClick={() => { setErr(null); setAlloc({}); setF({ ...f, vendorId: vendors[0]?.id ?? "" }); setCreate(true); }}><Plus size={15} /> Pay Vendor</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Payments" value={vendorPayments.length} tone="brand" icon={<Banknote size={18} />} />
        <StatCard label="Paid (all time)" value={money(total)} tone="action" delay={0.05} />
        <StatCard label="Paid this month" value={money(vendorPayments.filter((p) => new Date(p.date).getUTCMonth() === new Date().getUTCMonth()).reduce((n, p) => n + p.amount, 0))} tone="mist" delay={0.1} />
      </div>

      <Tabs tabs={["Payments", `WHT Certificates (${whtCertificates().length})`]}>
        {(t) => t.startsWith("WHT") ? (
          whtCertificates().length === 0 ? <EmptyState title="No withholding tax deducted yet" hint="Certificates appear here when a vendor payment withholds tax." /> : (
            <Card className="p-0">
              <Table columns={["Certificate", "Vendor", "Date", "Gross", "Rate", "Withheld", ""]}>
                {whtCertificates().map((c, i) => (
                  <Row key={c.payment.id} index={i}>
                    <Cell className="font-mono text-xs">{c.certNumber}</Cell>
                    <Cell className="font-semibold">{c.vendor?.name}</Cell>
                    <Cell>{shortDate(c.payment.date)}</Cell>
                    <Cell className="font-mono">{money(c.grossPaid)}</Cell>
                    <Cell className="font-mono">{c.rate}%</Cell>
                    <Cell className="font-mono font-semibold">{money(c.withheld)}</Cell>
                    <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={() => setCert(c)}>Certificate</button></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )
        ) : vendorPayments.length === 0 ? <EmptyState title="No vendor payments yet" /> : (
          <Card className="p-0">
            <Table columns={["Payment", "Vendor", "Date", "Method", "Amount", "WHT", "Bills"]}>
              {vendorPayments.map((p, i) => (
                <Row key={p.id} index={i}>
                  <Cell className="font-mono text-xs">{p.number}</Cell>
                  <Cell className="font-semibold">{vendorById(p.vendorId)?.name}</Cell>
                  <Cell>{shortDate(p.date)}</Cell>
                  <Cell><Badge tone="mist">{p.method}</Badge></Cell>
                  <Cell className="font-mono">{money(p.amount)}</Cell>
                  <Cell className="font-mono">{p.withheldTax ? money(p.withheldTax) : "—"}</Cell>
                  <Cell className="text-xs text-mist-500">{p.allocations.length}</Cell>
                </Row>
              ))}
            </Table>
          </Card>
        )}
      </Tabs>

      {cert && (
        <PrintDoc open onClose={() => setCert(null)} docTitle="Withholding Tax Credit Note">
          <Section title="Withholding Tax Credit Note">
            <Line label="Certificate no." value={cert.certNumber} />
            <Line label="Date" value={shortDate(cert.payment.date)} />
            <Line label="Deducting organisation" value={org.legalName} />
            <Line label="Our TIN" value={org.tin} />
          </Section>
          <Section title="Beneficiary (payee)">
            <Line label="Name" value={cert.vendor?.name} />
            <Line label="TIN" value={cert.vendor?.taxId ?? "—"} />
          </Section>
          <table className="w-full border-collapse text-sm">
            <tbody>
              <tr className="border-y border-mist-300"><td className="py-2">Gross amount paid / payable</td><td className="py-2 text-right font-mono">{money(cert.grossPaid)}</td></tr>
              <tr className="border-b border-mist-100"><td className="py-2">WHT rate</td><td className="py-2 text-right font-mono">{cert.rate}%</td></tr>
              <tr className="border-b-2 border-brand-600 font-bold"><td className="py-2">Tax withheld and remitted to FIRS</td><td className="py-2 text-right font-mono">{money(cert.withheld)}</td></tr>
              <tr><td className="py-2">Net amount paid to beneficiary</td><td className="py-2 text-right font-mono">{money(cert.payment.amount)}</td></tr>
            </tbody>
          </table>
          <p className="mt-4 text-xs text-mist-500">This credit note evidences tax withheld at source under the Companies Income Tax Act. The beneficiary may use it to claim a credit against their own tax liability.</p>
          <SignRow roles={["Prepared by", "Authorised signatory"]} />
        </PrintDoc>
      )}

      <Modal open={create} onClose={() => setCreate(false)} title="Pay Vendor" wide
        footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={!f.vendorId || allocTotal <= 0}>Post payment {allocTotal > 0 ? money(allocTotal) : ""}</Button></>}>
        <div className="space-y-4">
          {err && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700 ring-1 ring-action-200">{err}</p>}
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Vendor"><Select value={f.vendorId} onChange={(e) => { setF({ ...f, vendorId: e.target.value }); setAlloc({}); }} options={[{ value: "", label: "Select…" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]} /></Field>
            <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Method"><Select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as never })} options={["Bank Transfer", "Cheque", "Cash"]} /></Field>
            <Field label="Pay from"><Select value={String(f.account)} onChange={(e) => setF({ ...f, account: +e.target.value })} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
          </div>
          {f.vendorId && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="label mb-0">Open bills</span>
                <button type="button" className="btn-soft px-2 py-1 text-xs" onClick={autoAllocate}>Pay all</button>
              </div>
              {open.length === 0 ? <p className="text-sm text-mist-400">No open bills for this vendor.</p> : (
                <Table columns={["Bill", "Due", "Balance", "Pay"]}>
                  {open.map((b, i) => (
                    <Row key={b.id} index={i}>
                      <Cell className="font-mono text-xs">{b.number}</Cell>
                      <Cell>{shortDate(b.dueDate)}</Cell>
                      <Cell className="font-mono">{money(billBalance(b))}</Cell>
                      <Cell><input type="number" className="input h-8 w-28 text-sm" value={alloc[b.id] ?? ""} onChange={(e) => setAlloc({ ...alloc, [b.id]: Math.min(+e.target.value, billBalance(b)) })} /></Cell>
                    </Row>
                  ))}
                </Table>
              )}
              <div className="mt-2 text-right text-sm font-semibold">Total payment {money(allocTotal)}</div>
            </div>
          )}
          <Field label="Reference"><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
