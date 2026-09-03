import { useState } from "react";
import { Receipt, Plus, Trash2, Printer } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Select } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PrintDoc, Line, Section } from "@/components/print/PrintFrame";
import { useEmr, serviceLine } from "@/store/useEmr";
import { SERVICE_TYPES, PATIENT_CATEGORIES } from "@/data/catalog";
import { naira, shortDate, dateTime } from "@/lib/format";
import type { Invoice, InvoiceLine } from "@/data/types";

const total = (i: Invoice) => i.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);

export default function Billing() {
  const { invoices, patientById, createInvoice, settleInvoice } = useEmr();
  const [create, setCreate] = useState(false);
  const [settle, setSettle] = useState<Invoice | null>(null);
  const [method, setMethod] = useState<"Cash" | "POS" | "Transfer">("Cash");
  const [print, setPrint] = useState<Invoice | null>(null);

  const [pid, setPid] = useState<string | null>(null);
  const [lines, setLines] = useState<InvoiceLine[]>([serviceLine("CONS")]);

  const collected = invoices.filter((i) => i.status === "Paid").reduce((n, i) => n + total(i), 0);
  const outstanding = invoices.filter((i) => i.status === "Unpaid").reduce((n, i) => n + total(i), 0);
  const waived = invoices.filter((i) => i.status === "Waived").reduce((n, i) => n + total(i), 0);

  const previewPatient = pid ? patientById(pid) : undefined;
  const previewCat = PATIENT_CATEGORIES.find((c) => c.code === previewPatient?.category);
  const previewExempt = !!previewCat?.exempt || previewPatient?.payer === "NHIS";

  return (
    <div>
      <PageHeader
        title="Billing"
        subtitle="Invoices, payments & revenue — tariffs and category exemptions applied automatically"
        actions={<Button onClick={() => { setPid(null); setLines([serviceLine("CONS")]); setCreate(true); }}><Plus size={15} /> New Invoice</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Collected (period)" value={naira(collected)} tone="brand" icon={<Receipt size={18} />} />
        <StatCard label="Outstanding" value={naira(outstanding)} tone="action" delay={0.05} />
        <StatCard label="Waived / NHIS" value={naira(waived)} tone="mist" delay={0.1} />
        <StatCard label="Invoices" value={invoices.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Invoices", "Unpaid", "Revenue by Service"]}>
        {(t) =>
          t === "Revenue by Service" ? (
            <Table columns={["Service", "Category", "Invoices", "Billed", "Collected"]}>
              {SERVICE_TYPES.filter((s) => s.billable).map((s, i) => {
                const rel = invoices.flatMap((inv) => inv.lines.filter((l) => l.code === s.code).map((l) => ({ l, inv })));
                const billed = rel.reduce((n, { l }) => n + l.qty * l.unitPrice, 0);
                const got = rel.filter(({ inv }) => inv.status === "Paid").reduce((n, { l }) => n + l.qty * l.unitPrice, 0);
                return (
                  <Row key={s.code} index={i}>
                    <Cell className="font-semibold">{s.name}</Cell>
                    <Cell>{s.category}</Cell>
                    <Cell>{rel.length}</Cell>
                    <Cell>{naira(billed)}</Cell>
                    <Cell>{naira(got)}</Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Table columns={["Invoice", "Patient", "Payer", "Items", "Amount", "Status", ""]}>
              {invoices
                .filter((i) => (t === "Unpaid" ? i.status === "Unpaid" : true))
                .map((inv, idx) => {
                  const p = patientById(inv.patientId);
                  return (
                    <Row key={inv.id} index={idx}>
                      <Cell className="font-mono text-xs">{inv.number}<span className="block font-sans text-mist-400">{shortDate(inv.createdAt)}</span></Cell>
                      <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                      <Cell><Badge tone={inv.payer === "NHIS" ? "brand" : "mist"}>{inv.payer}</Badge></Cell>
                      <Cell className="max-w-[240px] truncate text-mist-500">{inv.lines.map((l) => l.name).join(", ")}</Cell>
                      <Cell className="font-semibold">{naira(total(inv))}</Cell>
                      <Cell><Badge tone={statusTone(inv.status)}>{inv.status}{inv.method ? ` · ${inv.method}` : ""}</Badge></Cell>
                      <Cell>
                        <div className="flex justify-end gap-1.5">
                          {inv.status === "Unpaid" && (
                            <button onClick={() => { setSettle(inv); setMethod("Cash"); }} className="btn-primary px-2.5 py-1 text-xs">
                              Take Payment
                            </button>
                          )}
                          <button onClick={() => setPrint(inv)} className="btn-ghost px-2 py-1 text-xs"><Printer size={12} /></button>
                        </div>
                      </Cell>
                    </Row>
                  );
                })}
            </Table>
          )
        }
      </Tabs>

      {/* Create invoice */}
      <Modal
        open={create}
        onClose={() => setCreate(false)}
        title="New Invoice"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreate(false)}>Cancel</Button>
            <Button
              disabled={!pid || lines.length === 0}
              onClick={() => {
                if (pid) {
                  const inv = createInvoice(pid, lines);
                  setCreate(false);
                  if (!inv.exempt) setPrint(inv);
                }
              }}
            >
              Generate Invoice
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={pid} onChange={setPid} /></Field>
          {previewPatient && (
            <div className={`rounded-xl px-3 py-2 text-sm ring-1 ${previewExempt ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-mist-50 text-mist-600 ring-mist-200"}`}>
              Payer <b>{previewPatient.payer}</b> · category <b>{previewCat?.name}</b>
              {previewExempt && " — this invoice will be automatically waived"}
            </div>
          )}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="label mb-0">Line items</span>
              <button onClick={() => setLines((l) => [...l, serviceLine("REVIEW")])} className="btn-soft px-2 py-1 text-xs"><Plus size={12} /> Add line</button>
            </div>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_70px_90px_28px] items-center gap-2">
                  <select
                    className="input"
                    value={l.code}
                    onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? serviceLine(e.target.value, y.qty) : y)))}
                  >
                    {SERVICE_TYPES.filter((s) => s.billable).map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                  <input
                    type="number" min={1} className="input text-center" value={l.qty}
                    onChange={(e) => setLines((x) => x.map((y, j) => (j === i ? { ...y, qty: +e.target.value } : y)))}
                  />
                  <span className="text-right text-sm text-mist-600">{naira(l.qty * l.unitPrice)}</span>
                  <button onClick={() => setLines((x) => x.filter((_, j) => j !== i))} className="text-action-500 hover:text-action-700"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-mist-200 pt-2 text-sm font-bold">
              <span>Total</span>
              <span>{naira(lines.reduce((n, l) => n + l.qty * l.unitPrice, 0))}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Settle */}
      <Modal
        open={!!settle}
        onClose={() => setSettle(null)}
        title={`Take Payment — ${settle?.number ?? ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettle(null)}>Cancel</Button>
            <Button onClick={() => { if (settle) settleInvoice(settle.id, method); setSettle(null); }}>
              Confirm {settle ? naira(total(settle)) : ""}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-mist-600">Amount due: <b className="text-mist-900">{settle ? naira(total(settle)) : ""}</b></p>
          <Field label="Payment method"><Select value={method} onChange={(e) => setMethod(e.target.value as never)} options={["Cash", "POS", "Transfer"]} /></Field>
        </div>
      </Modal>

      {/* Invoice / receipt print */}
      {print && (() => {
        const p = patientById(print.patientId);
        return (
          <PrintDoc open onClose={() => setPrint(null)} docTitle={print.status === "Paid" ? "Official Receipt" : "Invoice"}>
            <Section title="Bill to">
              <div className="grid grid-cols-2 gap-x-8">
                <Line label="Patient" value={p ? `${p.firstName} ${p.lastName}` : "—"} />
                <Line label="File no." value={p?.mrn} />
                <Line label="Invoice no." value={print.number} />
                <Line label="Date" value={dateTime(print.createdAt)} />
                <Line label="Payer" value={print.payer} />
                <Line label="Category" value={PATIENT_CATEGORIES.find((c) => c.code === print.category)?.name} />
              </div>
            </Section>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500">
                  <th className="py-2">Service</th><th className="text-center">Qty</th><th className="text-right">Unit</th><th className="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {print.lines.map((l, i) => (
                  <tr key={i} className="border-b border-mist-100">
                    <td className="py-2">{l.name}</td>
                    <td className="text-center">{l.qty}</td>
                    <td className="text-right">{naira(l.unitPrice)}</td>
                    <td className="text-right">{naira(l.qty * l.unitPrice)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-brand-600 font-bold">
                  <td className="py-2" colSpan={3}>Total</td>
                  <td className="text-right">{naira(total(print))}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-sm">
              Status: <b className={print.status === "Paid" ? "text-brand-700" : print.status === "Waived" ? "text-mist-500" : "text-action-600"}>
                {print.status}{print.method ? ` (${print.method})` : ""}
              </b>
              {print.paidAt && ` · ${dateTime(print.paidAt)}`}
            </p>
          </PrintDoc>
        );
      })()}
    </div>
  );
}
