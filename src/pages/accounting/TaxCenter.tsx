import { useState } from "react";
import { Plus, Percent, FileCheck2, Banknote, Send } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, Card, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useTax } from "@/store/accounting/useTax";
import { useLedger } from "@/store/accounting/useLedger";
import type { TaxKind, ReturnType } from "@/data/accounting/tax";

const RETURN_TYPES: ReturnType[] = ["VAT", "WHT", "PAYE"];

export default function TaxCenter() {
  const { rates, returns, addRate, updateRate, prepareReturn, efileReturn, payReturn } = useTax();
  const cashAccts = useLedger((s) => s.accounts).filter((a) => a.subtype === "cash" || a.subtype === "bank");
  const [rateModal, setRateModal] = useState(false);
  const [prep, setPrep] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [payAcct, setPayAcct] = useState(1010);
  const [rf, setRf] = useState({ name: "", kind: "VAT" as TaxKind, rate: 0, accountNumber: 2200 });
  const [pf, setPf] = useState<{ type: ReturnType; start: string; end: string }>(() => ({ type: "VAT", start: isoDate(new Date(Date.now() - 30 * 864e5)), end: isoDate(new Date()) }));
  const [msg, setMsg] = useState<string | null>(null);

  const netDue = returns.filter((r) => r.status !== "Paid").reduce((n, r) => n + Math.max(0, r.netPayable), 0);

  return (
    <div>
      <PageHeader title="Tax" subtitle="Rates, and VAT / WHT / PAYE returns computed from the ledger, e-filed and remitted"
        actions={<>
          <Button variant="soft" onClick={() => setRateModal(true)}><Plus size={15} /> Tax Rate</Button>
          <Button onClick={() => setPrep(true)}><FileCheck2 size={15} /> Prepare Return</Button>
        </>} />

      {msg && <div className="mb-4 rounded-xl bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 ring-1 ring-brand-200">{msg}</div>}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Active tax rates" value={rates.filter((r) => r.isActive).length} tone="brand" icon={<Percent size={18} />} />
        <StatCard label="Returns filed" value={returns.filter((r) => r.status !== "Open").length} tone="brand" delay={0.05} />
        <StatCard label="Net tax due" value={money(netDue)} tone="action" delay={0.1} />
      </div>

      <Tabs tabs={["Returns", "Tax Rates"]}>
        {(t) =>
          t === "Tax Rates" ? (
            <Card className="p-0">
              <Table columns={["Name", "Kind", "Rate", "Posts to", "Active"]}>
                {rates.map((r, i) => (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{r.name}<span className="block text-xs font-normal text-mist-400">{r.description}</span></Cell>
                    <Cell><Badge tone="mist">{r.kind}</Badge></Cell>
                    <Cell className="font-mono">{r.rate}%</Cell>
                    <Cell className="font-mono text-xs">{r.accountNumber}</Cell>
                    <Cell><button onClick={() => updateRate(r.id, { isActive: !r.isActive })}><Badge tone={r.isActive ? "brand" : "mist"}>{r.isActive ? "Active" : "Off"}</Badge></button></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          ) : returns.length === 0 ? (
            <EmptyState title="No returns yet" hint="Prepare a VAT, WHT or PAYE return — each reads the movement on its liability account." />
          ) : (
            <Card className="p-0">
              <Table columns={["Reference", "Type", "Authority", "Period", "Output", "Input", "Net payable", "Status", ""]}>
                {returns.map((r, i) => (
                  <Row key={r.id} index={i}>
                    <Cell className="font-mono text-xs">{r.reference}{r.submissionRef && <span className="block text-[10px] text-mist-400">{r.submissionRef}</span>}</Cell>
                    <Cell><Badge tone="mist">{r.returnType}</Badge></Cell>
                    <Cell>{r.authority}</Cell>
                    <Cell>{shortDate(r.periodStart)} – {shortDate(r.periodEnd)}</Cell>
                    <Cell className="font-mono">{money(r.outputTax)}</Cell>
                    <Cell className="font-mono">{r.inputTax ? money(r.inputTax) : "—"}</Cell>
                    <Cell className="font-mono font-semibold">{money(r.netPayable)}</Cell>
                    <Cell><Badge tone={statusTone(r.status === "Paid" ? "paid" : r.status === "Filed" ? "approved" : "submitted")}>{r.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1">
                        {r.status === "Open" && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { const res = efileReturn(r.id); if (res.ok) setMsg(`Filed with ${r.authority}. Acknowledgement: ${res.ref}`); }}><Send size={11} /> E-file</button>}
                        {r.status === "Filed" && r.netPayable > 0 && <button className="btn-primary px-2 py-1 text-xs" onClick={() => { setPayAcct(1010); setPayId(r.id); }}><Banknote size={11} /> Pay</button>}
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          )
        }
      </Tabs>

      <Modal open={rateModal} onClose={() => setRateModal(false)} title="New Tax Rate"
        footer={<><Button variant="ghost" onClick={() => setRateModal(false)}>Cancel</Button><Button onClick={() => { addRate({ name: rf.name, kind: rf.kind, rate: rf.rate, accountNumber: rf.accountNumber, isCompound: false }); setRateModal(false); }} disabled={!rf.name}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Name"><Input value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} placeholder="e.g. VAT 7.5%" /></Field>
          <Field label="Kind"><Select value={rf.kind} onChange={(e) => setRf({ ...rf, kind: e.target.value as TaxKind })} options={["VAT", "WHT", "Exempt", "Zero-rated"]} /></Field>
          <Field label="Rate %"><Input type="number" value={rf.rate || ""} onChange={(e) => setRf({ ...rf, rate: +e.target.value })} /></Field>
          <Field label="Liability account"><Input type="number" value={rf.accountNumber} onChange={(e) => setRf({ ...rf, accountNumber: +e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={prep} onClose={() => setPrep(false)} title="Prepare Tax Return"
        footer={<><Button variant="ghost" onClick={() => setPrep(false)}>Cancel</Button><Button onClick={() => { prepareReturn(pf.type, new Date(pf.start + "T00:00:00Z").toISOString(), new Date(pf.end + "T23:59:59Z").toISOString()); setPrep(false); }}>Prepare</Button></>}>
        <div className="space-y-3">
          <Field label="Return type"><Select value={pf.type} onChange={(e) => setPf({ ...pf, type: e.target.value as ReturnType })} options={RETURN_TYPES} /></Field>
          <p className="text-sm text-mist-600">{pf.type === "VAT" ? "Output VAT (credits to VAT Payable) minus recoverable input VAT (debits)." : pf.type === "WHT" ? "Withholding tax deducted from vendor payments, accrued on WHT Payable." : "PAYE deducted from payroll, accrued on PAYE Payable."}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="From"><Input type="date" value={pf.start} onChange={(e) => setPf({ ...pf, start: e.target.value })} /></Field>
            <Field label="To"><Input type="date" value={pf.end} onChange={(e) => setPf({ ...pf, end: e.target.value })} /></Field>
          </div>
        </div>
      </Modal>

      <Modal open={!!payId} onClose={() => setPayId(null)} title="Remit Tax"
        footer={<><Button variant="ghost" onClick={() => setPayId(null)}>Cancel</Button><Button onClick={() => { if (payId) payReturn(payId, payAcct); setPayId(null); }}>Remit</Button></>}>
        <Field label="Pay from"><Select value={String(payAcct)} onChange={(e) => setPayAcct(+e.target.value)} options={cashAccts.map((a) => ({ value: String(a.number), label: `${a.number} — ${a.name}` }))} /></Field>
      </Modal>
    </div>
  );
}
