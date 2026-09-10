import { useState } from "react";
import { Plus, Lock, Unlock, Trash2 } from "lucide-react";
import { PageHeader, Button, Badge, Card, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { money, shortDate, isoDate } from "@/lib/format";
import { useAccountingSettings } from "@/store/accounting/useAccountingSettings";
import { useLedger } from "@/store/accounting/useLedger";
import { useAcctControl } from "@/store/accounting/useAcctControl";
import type { ApprovableDoc, ApprovalRule } from "@/data/accounting/control";
import type { FinanceRole } from "@/data/accounts";

const DOC_TYPES: ApprovableDoc[] = ["Purchase Requisition", "Purchase Order", "Bill", "Vendor Payment", "Expense Claim", "Journal Entry"];
const ROLES: Exclude<FinanceRole, "None" | "Auditor">[] = ["Approver", "Accountant", "Finance Controller"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function AccountingSettings() {
  const { org, sequences, updateOrg, updateSequence, paymentTerms, addPaymentTerm, updatePaymentTerm, reminderRules, addReminderRule, updateReminderRule, removeReminderRule } = useAccountingSettings();
  const { periods, fiscalYears, booksLockedBefore, setPeriodStatus, setBooksLockedBefore, openFiscalYear, fxRates } = useLedger();
  const { rules, addRule, updateRule, removeRule, rulesFor } = useAcctControl();
  const [testDoc, setTestDoc] = useState<ApprovableDoc>("Bill");
  const [testAmt, setTestAmt] = useState(500000);

  const [orgForm, setOrgForm] = useState(org);
  const [lockDate, setLockDate] = useState(booksLockedBefore ? isoDate(booksLockedBefore) : "");
  const [ruleModal, setRuleModal] = useState(false);
  const [rf, setRf] = useState<{ docType: ApprovableDoc; minAmount: number; maxAmount: string; approverRole: ApprovalRule["approverRole"]; level: number }>({ docType: "Bill", minAmount: 0, maxAmount: "", approverRole: "Accountant", level: 1 });
  const [termModal, setTermModal] = useState(false);
  const [tf, setTf] = useState({ name: "", netDays: 30, eom: false, discountPercent: "", discountDays: "" });
  const [dunModal, setDunModal] = useState(false);
  const [df, setDf] = useState({ level: 4, daysOverdue: 45, tone: "Escalation", subject: "", body: "" });

  return (
    <div>
      <PageHeader title="Accounting Settings" subtitle="Organisation, fiscal calendar, period locking, approval rules, numbering and currencies" />

      <Tabs tabs={["Organisation", "Periods & Locking", "Approval Rules", "Payment Terms", "Dunning", "Numbering", "Currencies"]}>
        {(t) => {
          if (t === "Organisation") return (
            <Card>
              <Grid cols={2}>
                <Field label="Legal name"><Input value={orgForm.legalName} onChange={(e) => setOrgForm({ ...orgForm, legalName: e.target.value })} /></Field>
                <Field label="Trading name"><Input value={orgForm.tradingName} onChange={(e) => setOrgForm({ ...orgForm, tradingName: e.target.value })} /></Field>
                <Field label="Tax ID (TIN)"><Input value={orgForm.tin} onChange={(e) => setOrgForm({ ...orgForm, tin: e.target.value })} /></Field>
                <Field label="RC number"><Input value={orgForm.rcNumber} onChange={(e) => setOrgForm({ ...orgForm, rcNumber: e.target.value })} /></Field>
                <Field label="Reporting currency"><Select value={orgForm.reportingCurrency} onChange={(e) => setOrgForm({ ...orgForm, reportingCurrency: e.target.value })} options={fxRates.map((r) => ({ value: r.code, label: `${r.code} — ${r.name}` }))} /></Field>
                <Field label="Fiscal year starts"><Select value={String(orgForm.fiscalYearStartMonth)} onChange={(e) => setOrgForm({ ...orgForm, fiscalYearStartMonth: +e.target.value })} options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} /></Field>
              </Grid>
              <Field label="Registered address"><Textarea value={orgForm.address} onChange={(e) => setOrgForm({ ...orgForm, address: e.target.value })} /></Field>
              <div className="mt-3 flex justify-end"><Button onClick={() => updateOrg(orgForm)}>Save</Button></div>
            </Card>
          );

          if (t === "Periods & Locking") return (
            <div className="space-y-4">
              <Card>
                <h3 className="mb-2 text-sm font-bold text-mist-700">Books-closed-before date</h3>
                <p className="mb-3 text-sm text-mist-500">Posting or reversing to any date before this is blocked across the whole ledger.</p>
                <div className="flex items-end gap-2">
                  <Field label="Lock date"><Input type="date" value={lockDate} onChange={(e) => setLockDate(e.target.value)} /></Field>
                  <Button onClick={() => setBooksLockedBefore(lockDate ? new Date(lockDate + "T00:00:00Z").toISOString() : null)}><Lock size={14} /> Apply</Button>
                  {booksLockedBefore && <Button variant="ghost" onClick={() => { setBooksLockedBefore(null); setLockDate(""); }}><Unlock size={14} /> Remove</Button>}
                </div>
                <p className="mt-2 text-xs text-mist-400">Currently: {booksLockedBefore ? shortDate(booksLockedBefore) : "no lock"}</p>
              </Card>
              <Card>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-mist-700">Accounting periods</h3>
                  <Button variant="soft" onClick={() => openFiscalYear(Math.max(...fiscalYears.map((f) => f.year)) + 1)}><Plus size={13} /> Open next year</Button>
                </div>
                <Table columns={["Period", "Start", "End", "Status", ""]}>
                  {periods.map((p, i) => (
                    <Row key={p.id} index={i}>
                      <Cell className="font-semibold">{p.label}</Cell>
                      <Cell>{shortDate(p.startDate)}</Cell>
                      <Cell>{shortDate(p.endDate)}</Cell>
                      <Cell><Badge tone={p.status === "Open" ? "brand" : p.status === "Locked" ? "action" : "mist"}>{p.status}</Badge></Cell>
                      <Cell>
                        <div className="flex justify-end gap-1">
                          {p.status !== "Open" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setPeriodStatus(p.id, "Open")}>Open</button>}
                          {p.status === "Open" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setPeriodStatus(p.id, "Closed")}>Close</button>}
                          {p.status !== "Locked" && <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setPeriodStatus(p.id, "Locked")}>Lock</button>}
                        </div>
                      </Cell>
                    </Row>
                  ))}
                </Table>
              </Card>
            </div>
          );

          if (t === "Approval Rules") return (
            <div className="space-y-4">
              <Card>
                <h3 className="mb-2 text-sm font-bold text-mist-700">Test the workflow</h3>
                <div className="flex flex-wrap items-end gap-3">
                  <Field label="Document"><Select value={testDoc} onChange={(e) => setTestDoc(e.target.value as ApprovableDoc)} options={DOC_TYPES} /></Field>
                  <Field label="Amount"><Input type="number" value={testAmt} onChange={(e) => setTestAmt(+e.target.value)} className="w-40" /></Field>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {rulesFor(testDoc, testAmt).length === 0 ? <Badge tone="mist">No approval required — posts straight through</Badge> :
                    rulesFor(testDoc, testAmt).map((r, i, arr) => (
                      <span key={r.id} className="flex items-center gap-2">
                        <span className="rounded-lg bg-brand-50 px-2.5 py-1 font-semibold text-brand-700 ring-1 ring-brand-200">L{r.level} · {r.approverRole}</span>
                        {i < arr.length - 1 && <span className="text-mist-300">→</span>}
                      </span>
                    ))}
                </div>
              </Card>
              <Card className="p-0">
              <div className="flex justify-end p-3"><Button variant="soft" onClick={() => setRuleModal(true)}><Plus size={13} /> Add Step</Button></div>
              <Table columns={["Document", "From", "To", "Approver role", "Level", ""]}>
                {rules.sort((a, b) => a.docType.localeCompare(b.docType) || a.level - b.level).map((r, i) => (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{r.docType}</Cell>
                    <Cell className="font-mono">{money(r.minAmount)}</Cell>
                    <Cell className="font-mono">{r.maxAmount === null ? "no limit" : money(r.maxAmount)}</Cell>
                    <Cell><Badge tone="mist">{r.approverRole}</Badge></Cell>
                    <Cell>{r.level}</Cell>
                    <Cell>
                      <div className="flex justify-end gap-1">
                        <button onClick={() => updateRule(r.id, { active: !r.active })}><Badge tone={r.active ? "brand" : "mist"}>{r.active ? "On" : "Off"}</Badge></button>
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => removeRule(r.id)}><Trash2 size={12} /></button>
                      </div>
                    </Cell>
                  </Row>
                ))}
              </Table>
              </Card>
            </div>
          );

          if (t === "Payment Terms") return (
            <Card className="p-0">
              <div className="flex justify-end p-3"><Button variant="soft" onClick={() => setTermModal(true)}><Plus size={13} /> Add Term</Button></div>
              <Table columns={["Name", "Net days", "EOM", "Early-pay discount", "Active"]}>
                {paymentTerms.map((term, i) => (
                  <Row key={term.id} index={i}>
                    <Cell className="font-semibold">{term.name}</Cell>
                    <Cell className="font-mono">{term.netDays}</Cell>
                    <Cell>{term.eom ? "Yes" : "—"}</Cell>
                    <Cell>{term.discountPercent ? `${term.discountPercent}% within ${term.discountDays} days` : "—"}</Cell>
                    <Cell><button onClick={() => updatePaymentTerm(term.id, { active: !term.active })}><Badge tone={term.active ? "brand" : "mist"}>{term.active ? "On" : "Off"}</Badge></button></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          );

          if (t === "Dunning") return (
            <Card className="p-0">
              <div className="flex items-center justify-between p-3">
                <p className="text-sm text-mist-500">Overdue-invoice reminder ladder. Placeholders: {"{number} {amount} {dueDate} {daysOverdue}"}.</p>
                <Button variant="soft" onClick={() => setDunModal(true)}><Plus size={13} /> Add Step</Button>
              </div>
              <Table columns={["Level", "Days overdue", "Tone", "Subject", "Active", ""]}>
                {reminderRules.map((r, i) => (
                  <Row key={r.id} index={i}>
                    <Cell className="font-mono">{r.level}</Cell>
                    <Cell><input type="number" className="input h-8 w-20 text-sm" value={r.daysOverdue} onChange={(e) => updateReminderRule(r.id, { daysOverdue: +e.target.value })} /></Cell>
                    <Cell><input className="input h-8 w-28 text-sm" value={r.tone} onChange={(e) => updateReminderRule(r.id, { tone: e.target.value })} /></Cell>
                    <Cell className="max-w-[280px] truncate text-mist-500">{r.subject}</Cell>
                    <Cell><button onClick={() => updateReminderRule(r.id, { active: !r.active })}><Badge tone={r.active ? "brand" : "mist"}>{r.active ? "On" : "Off"}</Badge></button></Cell>
                    <Cell><button className="btn-ghost px-2 py-1 text-xs" onClick={() => removeReminderRule(r.id)}><Trash2 size={12} /></button></Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          );

          if (t === "Numbering") return (
            <Card className="p-0">
              <Table columns={["Document", "Prefix", "Padding", "Next", "Example"]}>
                {sequences.map((s, i) => (
                  <Row key={s.key} index={i}>
                    <Cell className="font-semibold">{s.label}</Cell>
                    <Cell><input className="input h-8 w-20 text-sm" value={s.prefix} onChange={(e) => updateSequence(s.key, { prefix: e.target.value })} /></Cell>
                    <Cell><input type="number" className="input h-8 w-16 text-sm" value={s.padding} onChange={(e) => updateSequence(s.key, { padding: +e.target.value })} /></Cell>
                    <Cell><input type="number" className="input h-8 w-24 text-sm" value={s.next} onChange={(e) => updateSequence(s.key, { next: +e.target.value })} /></Cell>
                    <Cell className="font-mono text-xs">{s.example}</Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          );

          return (
            <Card className="p-0">
              <Table columns={["Code", "Currency", "Symbol", "Rate → NGN"]}>
                {fxRates.map((r, i) => (
                  <Row key={r.code} index={i}>
                    <Cell className="font-mono font-semibold">{r.code}</Cell>
                    <Cell>{r.name}</Cell>
                    <Cell>{r.symbol}</Cell>
                    <Cell className="font-mono">{r.rateToNgn.toLocaleString()}</Cell>
                  </Row>
                ))}
              </Table>
            </Card>
          );
        }}
      </Tabs>

      <Modal open={termModal} onClose={() => setTermModal(false)} title="Add Payment Term"
        footer={<><Button variant="ghost" onClick={() => setTermModal(false)}>Cancel</Button><Button disabled={!tf.name} onClick={() => { addPaymentTerm({ name: tf.name, netDays: tf.netDays, eom: tf.eom, discountPercent: tf.discountPercent ? +tf.discountPercent : undefined, discountDays: tf.discountDays ? +tf.discountDays : undefined }); setTermModal(false); setTf({ name: "", netDays: 30, eom: false, discountPercent: "", discountDays: "" }); }}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Name"><Input value={tf.name} onChange={(e) => setTf({ ...tf, name: e.target.value })} placeholder="e.g. Net 90" /></Field>
          <Grid cols={2}>
            <Field label="Net days"><Input type="number" value={tf.netDays} onChange={(e) => setTf({ ...tf, netDays: +e.target.value })} /></Field>
            <Field label="End of month"><Select value={tf.eom ? "yes" : "no"} onChange={(e) => setTf({ ...tf, eom: e.target.value === "yes" })} options={[{ value: "no", label: "No" }, { value: "yes", label: "Yes" }]} /></Field>
            <Field label="Early-pay discount %"><Input type="number" value={tf.discountPercent} onChange={(e) => setTf({ ...tf, discountPercent: e.target.value })} placeholder="optional" /></Field>
            <Field label="…if paid within (days)"><Input type="number" value={tf.discountDays} onChange={(e) => setTf({ ...tf, discountDays: e.target.value })} placeholder="optional" /></Field>
          </Grid>
        </div>
      </Modal>

      <Modal open={dunModal} onClose={() => setDunModal(false)} title="Add Dunning Step"
        footer={<><Button variant="ghost" onClick={() => setDunModal(false)}>Cancel</Button><Button disabled={!df.subject} onClick={() => { addReminderRule({ level: df.level, daysOverdue: df.daysOverdue, tone: df.tone, subject: df.subject, body: df.body }); setDunModal(false); }}>Add</Button></>}>
        <div className="space-y-3">
          <Grid cols={3}>
            <Field label="Level"><Input type="number" value={df.level} onChange={(e) => setDf({ ...df, level: +e.target.value })} /></Field>
            <Field label="Days overdue"><Input type="number" value={df.daysOverdue} onChange={(e) => setDf({ ...df, daysOverdue: +e.target.value })} /></Field>
            <Field label="Tone"><Input value={df.tone} onChange={(e) => setDf({ ...df, tone: e.target.value })} /></Field>
          </Grid>
          <Field label="Subject"><Input value={df.subject} onChange={(e) => setDf({ ...df, subject: e.target.value })} /></Field>
          <Field label="Body"><Textarea value={df.body} onChange={(e) => setDf({ ...df, body: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={ruleModal} onClose={() => setRuleModal(false)} title="Add Approval Rule"
        footer={<><Button variant="ghost" onClick={() => setRuleModal(false)}>Cancel</Button><Button onClick={() => { addRule({ docType: rf.docType, minAmount: rf.minAmount, maxAmount: rf.maxAmount === "" ? null : Number(rf.maxAmount), approverRole: rf.approverRole, level: rf.level }); setRuleModal(false); }}>Add</Button></>}>
        <div className="space-y-3">
          <Field label="Document type"><Select value={rf.docType} onChange={(e) => setRf({ ...rf, docType: e.target.value as ApprovableDoc })} options={DOC_TYPES} /></Field>
          <Grid cols={2}>
            <Field label="From amount"><Input type="number" value={rf.minAmount || ""} onChange={(e) => setRf({ ...rf, minAmount: +e.target.value })} /></Field>
            <Field label="To amount (blank = no limit)"><Input type="number" value={rf.maxAmount} onChange={(e) => setRf({ ...rf, maxAmount: e.target.value })} /></Field>
            <Field label="Approver role"><Select value={rf.approverRole} onChange={(e) => setRf({ ...rf, approverRole: e.target.value as never })} options={ROLES} /></Field>
            <Field label="Level"><Input type="number" value={rf.level} onChange={(e) => setRf({ ...rf, level: +e.target.value })} /></Field>
          </Grid>
        </div>
      </Modal>
    </div>
  );
}
