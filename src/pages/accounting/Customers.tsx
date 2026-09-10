import { useMemo, useState } from "react";
import { Plus, Users, Printer, Ban } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PrintDoc, Section, Line } from "@/components/print/PrintFrame";
import { money, shortDate } from "@/lib/format";
import { useAR, docTotal } from "@/store/accounting/useAR";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";
import { ExportButton, ImportButton } from "./_csv";
import type { CustomerType, Customer } from "@/data/accounting/receivables";

const TYPES: CustomerType[] = ["Patient", "NHIS", "HMO", "Corporate", "Walk-in"];
const blank = { name: "", type: "Corporate" as CustomerType, email: "", phone: "", address: "", city: "", paymentTermId: "pt-net30", creditLimit: 0, openingBalance: 0 };

export default function Customers() {
  const { customers, invoices, receipts, addCustomer, updateCustomer, customerBalance, invoicesOf, invoiceBalance, agingFor, markStatementSent, lastStatementSent, importCustomers } = useAR();
  const paymentTerms = useAccountingSettings((s) => s.paymentTerms);
  const termById = useAccountingSettings((s) => s.termById);
  const termName = (id?: string) => termById(id)?.name ?? "Net 30";
  const [create, setCreate] = useState(false);
  const [detail, setDetail] = useState<Customer | null>(null);
  const [statement, setStatement] = useState<Customer | null>(null);
  const [f, setF] = useState(blank);

  const asOf = new Date().toISOString();
  const aging = useMemo(() => agingFor(asOf), [agingFor, asOf]);
  const totalAR = aging.reduce((n, a) => n + a.total, 0);
  const overdue = aging.reduce((n, a) => n + a.d1_30 + a.d31_60 + a.d61_90 + a.d90plus, 0);

  function submit() {
    if (!f.name.trim()) return;
    addCustomer({ name: f.name.trim(), type: f.type, email: f.email || undefined, phone: f.phone || undefined, address: f.address || undefined, city: f.city || undefined, paymentTermId: f.paymentTermId, paymentTermsDays: termById(f.paymentTermId)?.netDays ?? 30, creditLimit: f.creditLimit, openingBalance: f.openingBalance });
    setCreate(false);
    setF(blank);
  }

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Payers, HMOs and corporate schemes — receivables and statements"
        actions={<>
          <ExportButton filename="customers" headers={["name", "type", "email", "phone", "city", "balance"]} rows={customers.map((c) => [c.name, c.type, c.email, c.phone, c.city, customerBalance(c.id)])} />
          <ImportButton title="Import Customers" onImport={importCustomers} sample={"name,type,email,city,credit_limit,opening_balance\nLagoon Hospital HMO,HMO,claims@lagoon.example,Lagos,10000000,0\nAcme Corp Staff,Corporate,hr@acme.example,Abuja,5000000,250000"} />
          <Button onClick={() => { setF(blank); setCreate(true); }}><Plus size={15} /> New Customer</Button>
        </>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Customers" value={customers.length} tone="brand" icon={<Users size={18} />} />
        <StatCard label="Total receivable" value={money(totalAR)} tone="brand" delay={0.05} />
        <StatCard label="Overdue" value={money(overdue)} tone="action" delay={0.1} />
        <StatCard label="Open invoices" value={invoices.filter((i) => i.status === "Open" || i.status === "Partially Paid" || i.status === "Overdue").length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Customers", "Aging"]}>
        {(t) =>
          t === "Aging" ? (
            <Card className="p-0">
              <Table columns={["Customer", "Current", "1–30", "31–60", "61–90", "90+", "Total"]}>
                {aging.filter((a) => a.total > 0).map((a, i) => (
                  <Row key={a.customer.id} index={i} onClick={() => setStatement(a.customer)}>
                    <Cell className="font-semibold">{a.customer.name}</Cell>
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
              <Table columns={["Customer", "Type", "Terms", "Credit limit", "Balance", "Status", ""]}>
                {customers.map((c, i) => {
                  const bal = customerBalance(c.id);
                  return (
                    <Row key={c.id} index={i} onClick={() => setDetail(c)}>
                      <Cell className="font-semibold">{c.name}<span className="block text-xs font-normal text-mist-400">{c.email ?? c.phone ?? "—"}</span></Cell>
                      <Cell><Badge tone="mist">{c.type}</Badge></Cell>
                      <Cell>{termName(c.paymentTermId)}</Cell>
                      <Cell className="font-mono">{c.creditLimit ? money(c.creditLimit) : "—"}</Cell>
                      <Cell className="font-mono font-semibold">{money(bal)}</Cell>
                      <Cell>{c.creditHold ? <Badge tone="action">On hold</Badge> : bal > c.creditLimit && c.creditLimit > 0 ? <Badge tone="amber">Over limit</Badge> : <Badge tone="brand">OK</Badge>}</Cell>
                      <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); setStatement(c); }}><Printer size={12} /></button></Cell>
                    </Row>
                  );
                })}
              </Table>
            </Card>
          )
        }
      </Tabs>

      {/* create */}
      <Modal open={create} onClose={() => setCreate(false)} title="New Customer" footer={<><Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button><Button onClick={submit} disabled={!f.name.trim()}>Create</Button></>}>
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
            <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as CustomerType })} options={TYPES} /></Field>
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
            <Field label="Payment term"><Select value={f.paymentTermId} onChange={(e) => setF({ ...f, paymentTermId: e.target.value })} options={paymentTerms.filter((pt) => pt.active).map((pt) => ({ value: pt.id, label: pt.name }))} /></Field>
            <Field label="Credit limit"><Input type="number" value={f.creditLimit || ""} onChange={(e) => setF({ ...f, creditLimit: +e.target.value })} /></Field>
            <Field label="Opening balance"><Input type="number" value={f.openingBalance || ""} onChange={(e) => setF({ ...f, openingBalance: +e.target.value })} /></Field>
          </Grid>
          <Field label="Address"><Textarea value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
          <p className="text-xs text-mist-400">AR control account is set automatically from the type ({f.type === "NHIS" ? "1110" : f.type === "HMO" ? "1120" : "1100"}).</p>
        </div>
      </Modal>

      {/* detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.name ?? ""} wide
        footer={detail && <><Button variant="ghost" onClick={() => setDetail(null)}>Close</Button><Button variant={detail.creditHold ? "primary" : "action"} onClick={() => updateCustomer(detail.id, { creditHold: !detail.creditHold })}><Ban size={14} /> {detail.creditHold ? "Release hold" : "Put on credit hold"}</Button></>}>
        {detail && (
          <div className="space-y-4">
            <div className="grid gap-2 rounded-xl bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">Type</span> · {detail.type}</div>
              <div><span className="text-mist-400">AR account</span> · {detail.arAccountNumber}</div>
              <div><span className="text-mist-400">Terms</span> · {termName(detail.paymentTermId)}</div>
              <div><span className="text-mist-400">Balance</span> · <b>{money(customerBalance(detail.id))}</b></div>
            </div>
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Invoices</h4>
              <Table columns={["Invoice", "Date", "Due", "Total", "Balance", "Status"]}>
                {invoicesOf(detail.id).map((inv, i) => (
                  <Row key={inv.id} index={i}>
                    <Cell className="font-mono text-xs">{inv.number}</Cell>
                    <Cell>{shortDate(inv.date)}</Cell>
                    <Cell>{shortDate(inv.dueDate)}</Cell>
                    <Cell className="font-mono">{money(docTotal(inv.lines))}</Cell>
                    <Cell className="font-mono">{money(invoiceBalance(inv))}</Cell>
                    <Cell><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            </div>
          </div>
        )}
      </Modal>

      {/* statement print */}
      {statement && (() => {
        const invs = invoicesOf(statement.id).filter((i) => i.status !== "Draft" && i.status !== "Void");
        const rcpts = receipts.filter((r) => r.customerId === statement.id);
        const rows = [
          ...invs.map((i) => ({ date: i.date, doc: i.number, desc: "Invoice", debit: docTotal(i.lines), credit: 0 })),
          ...rcpts.map((r) => ({ date: r.date, doc: r.number, desc: `Receipt (${r.method})`, debit: 0, credit: r.amount })),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        let run = statement.openingBalance;
        const ageRow = aging.find((a) => a.customer.id === statement.id);
        const lastSent = lastStatementSent(statement.id);
        return (
          <PrintDoc open onClose={() => setStatement(null)} docTitle="Customer Statement">
            <div className="no-print mb-4 flex items-center justify-between rounded-lg bg-mist-50 px-3 py-2 text-sm">
              <span className="text-mist-500">{statement.email ? `Deliver to ${statement.email}` : "No email on file"}{lastSent && ` · last sent ${shortDate(lastSent)}`}</span>
              <Button variant="soft" disabled={!statement.email} onClick={() => { const r = markStatementSent(statement.id); if (r.ok) alert(`Statement sent to ${r.to}`); }}>Send statement</Button>
            </div>
            <Section title="Statement of Account">
              <Line label="Customer" value={statement.name} />
              <Line label="As at" value={shortDate(new Date())} />
              <Line label="Opening balance" value={money(statement.openingBalance)} />
              <Line label="Closing balance" value={money(customerBalance(statement.id))} />
            </Section>
            {ageRow && ageRow.total > 0 && (
              <Section title="Aging summary">
                <div className="grid grid-cols-5 gap-2 text-center text-xs">
                  {([["Current", ageRow.current], ["1–30", ageRow.d1_30], ["31–60", ageRow.d31_60], ["61–90", ageRow.d61_90], ["90+", ageRow.d90plus]] as const).map(([lbl, v]) => (
                    <div key={lbl} className="rounded-lg bg-mist-50 p-2"><div className="text-mist-400">{lbl}</div><div className="font-mono font-semibold">{money(v)}</div></div>
                  ))}
                </div>
              </Section>
            )}
            <table className="w-full border-collapse text-sm">
              <thead><tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500"><th className="py-2">Date</th><th>Doc</th><th>Detail</th><th className="text-right">Charge</th><th className="text-right">Payment</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {rows.map((r, i) => { run += r.debit - r.credit; return (
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
