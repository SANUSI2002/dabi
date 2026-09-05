import { useMemo, useState } from "react";
import { Plus, Truck, Printer } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PrintDoc, Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate } from "@/lib/format";
import { useAP, purchaseTotal } from "@/store/accounting/useAP";
import type { Vendor } from "@/data/accounting/payables";

const CATS: Vendor["category"][] = ["Pharmaceuticals", "Medical Supplies", "Equipment", "Utilities", "Services", "Facilities", "Other"];
const blank = { name: "", category: "Services" as Vendor["category"], email: "", phone: "", address: "", taxId: "", paymentTermsDays: 30, openingBalance: 0 };

export default function Vendors() {
  const { vendors, bills, vendorPayments, addVendor, updateVendor, vendorBalance, billsOf, billBalance, apAgingFor } = useAP();
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<Vendor | null>(null);
  const [statement, setStatement] = useState<Vendor | null>(null);
  const [f, setF] = useState(blank);

  const asOf = new Date().toISOString();
  const aging = useMemo(() => apAgingFor(asOf), [apAgingFor, asOf]);
  const totalAP = aging.reduce((n, a) => n + a.total, 0);
  const overdue = aging.reduce((n, a) => n + a.d1_30 + a.d31_60 + a.d61_90 + a.d90plus, 0);

  function submit() {
    if (!f.name.trim()) return;
    addVendor({ name: f.name.trim(), category: f.category, email: f.email || undefined, phone: f.phone || undefined, address: f.address || undefined, taxId: f.taxId || undefined, paymentTermsDays: f.paymentTermsDays, openingBalance: f.openingBalance });
    setCreate(false);
    setF(blank);
  }

  return (
    <div>
      <PageHeader title="Vendors" subtitle="Suppliers and service providers — payables and statements"
        actions={<Button onClick={() => { setF(blank); setCreate(true); }}><Plus size={15} /> New Vendor</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Vendors" value={vendors.length} tone="brand" icon={<Truck size={18} />} />
        <StatCard label="Total payable" value={money(totalAP)} tone="action" delay={0.05} />
        <StatCard label="Overdue" value={money(overdue)} tone="action" delay={0.1} />
        <StatCard label="Open bills" value={bills.filter((b) => b.status === "Awaiting Payment" || b.status === "Partially Paid" || b.status === "Overdue").length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Vendors", "Aging"]}>
        {(t) =>
          t === "Aging" ? (
            <Card className="p-0">
              <Table columns={["Vendor", "Current", "1–30", "31–60", "61–90", "90+", "Total"]}>
                {aging.filter((a) => a.total > 0).map((a, i) => (
                  <Row key={a.vendor.id} index={i} onClick={() => setStatement(a.vendor)}>
                    <Cell className="font-semibold">{a.vendor.name}</Cell>
                    <Cell className="font-mono">{money(a.current)}</Cell>
                    <Cell className="font-mono">{money(a.d1_30)}</Cell>
                    <Cell className="font-mono">{money(a.d31_60)}</Cell>
                    <Cell className="font-mono">{money(a.d61_90)}</Cell>
                    <Cell className="font-mono text-action-600">{money(a.d90plus)}</Cell>
                    <Cell className="font-mono font-bold">{money(a.total)}</Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          ) : (
            <Card className="p-0">
              <Table columns={["Vendor", "Category", "Terms", "Balance", ""]}>
                {vendors.map((v, i) => (
                  <Row key={v.id} index={i} onClick={() => setDetail(v)}>
                    <Cell className="font-semibold">{v.name}<span className="block text-xs font-normal text-mist-400">{v.email ?? v.phone ?? "—"}</span></Cell>
                    <Cell><Badge tone="mist">{v.category}</Badge></Cell>
                    <Cell>Net {v.paymentTermsDays}</Cell>
                    <Cell className="font-mono font-semibold">{money(vendorBalance(v.id))}</Cell>
                    <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); setStatement(v); }}><Printer size={12} /></button></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )
        }
      </Tabs>

      <Modal open={create} onClose={() => setCreate(false)} title="New Vendor" footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={!f.name.trim()}>Create</Button></>}>
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Category"><Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as never })} options={CATS} /></Field>
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Tax ID (TIN)"><Input value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} /></Field>
            <Field label="Payment terms (days)"><Input type="number" value={f.paymentTermsDays} onChange={(e) => setF({ ...f, paymentTermsDays: +e.target.value })} /></Field>
            <Field label="Opening balance"><Input type="number" value={f.openingBalance || ""} onChange={(e) => setF({ ...f, openingBalance: +e.target.value })} /></Field>
          </Grid>
          <Field label="Address"><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} wide
        footer={detail && <><Button variant="ghost" onClick={() => setDetail(null)}>Close</Button><Button variant={detail.active ? "action" : "primary"} onClick={() => updateVendor(detail.id, { active: !detail.active })}>{detail.active ? "Deactivate" : "Reactivate"}</Button></>}>
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">Category</span> · {detail.category}</div>
              <div><span className="text-mist-400">Terms</span> · Net {detail.paymentTermsDays}</div>
              <div><span className="text-mist-400">TIN</span> · {detail.taxId ?? "—"}</div>
              <div><span className="text-mist-400">Balance</span> · <b>{money(vendorBalance(detail.id))}</b></div>
            </div>
            <Table columns={["Bill", "Date", "Due", "Total", "Balance", "Status"]}>
              {billsOf(detail.id).map((b, i) => (
                <Row key={b.id} index={i}>
                  <Cell className="font-mono text-xs">{b.number}</Cell>
                  <Cell>{shortDate(b.date)}</Cell>
                  <Cell>{shortDate(b.dueDate)}</Cell>
                  <Cell className="font-mono">{money(purchaseTotal(b.lines))}</Cell>
                  <Cell className="font-mono">{money(billBalance(b))}</Cell>
                  <Cell><Badge tone={statusTone(b.status)}>{b.status}</Badge></Cell>
                </Row>
              ))}
            </Table>
          </div>
        )}
      </Modal>

      {statement && (() => {
        const bs = billsOf(statement.id).filter((b) => b.status !== "Draft" && b.status !== "Pending Approval" && b.status !== "Void");
        const ps = vendorPayments.filter((p) => p.vendorId === statement.id);
        const rows = [
          ...bs.map((b) => ({ date: b.date, doc: b.number, desc: "Bill", debit: 0, credit: purchaseTotal(b.lines) })),
          ...ps.map((p) => ({ date: p.date, doc: p.number, desc: `Payment (${p.method})`, debit: p.amount, credit: 0 })),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let run = statement.openingBalance;
        return (
          <PrintDoc open onClose={() => setStatement(null)} docTitle="Vendor Statement">
            <Section title="Statement of Account">
              <Line label="Vendor" value={statement.name} />
              <Line label="As at" value={shortDate(new Date())} />
              <Line label="Closing balance" value={money(vendorBalance(statement.id))} />
            </Section>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Date</th><th>Doc</th><th>Detail</th><th className="text-right">Payment</th><th className="text-right">Bill</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {rows.map((r, i) => { run += r.credit - r.debit; return (
                  <tr key={i} className="border-b border-mist-100">
                    <td className="py-1.5">{shortDate(r.date)}</td><td className="font-mono text-xs">{r.doc}</td><td>{r.desc}</td>
                    <td className="text-right font-mono">{r.debit ? money(r.debit) : ""}</td>
                    <td className="text-right font-mono">{r.credit ? money(r.credit) : ""}</td>
                    <td className="text-right font-mono">{money(run)}</td>
                  </tr>
                ); })}
              </tbody>
            </table>
          </PrintDoc>
        );
      })()}
    </div>
  );
}
