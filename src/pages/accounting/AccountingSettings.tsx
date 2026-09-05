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
  const { org, sequences, updateOrg, updateSequence } = useAccountingSettings();
  const { periods, fiscalYears, booksLockedBefore, setPeriodStatus, setBooksLockedBefore, openFiscalYear, fxRates } = useLedger();
  const { rules, addRule, updateRule, removeRule } = useAcctControl();

  const [orgForm, setOrgForm] = useState(org);
  const [lockDate, setLockDate] = useState(booksLockedBefore ? isoDate(booksLockedBefore) : "");
  const [ruleModal, setRuleModal] = useState(false);
  const [rf, setRf] = useState<{ docType: ApprovableDoc; minAmount: number; maxAmount: string; approverRole: ApprovalRule["approverRole"]; level: number }>({ docType: "Bill", minAmount: 0, maxAmount: "", approverRole: "Accountant", level: 1 });

  return (
    <div>
      <PageHeader title="Accounting Settings" subtitle="Organisation, fiscal calendar, period locking, approval rules, numbering and currencies" />

      <Tabs tabs={["Organisation", "Periods & Locking", "Approval Rules", "Numbering", "Currencies"]}>
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
            <Card className="p-0">
              <div className="flex justify-end p-3"><Button variant="soft" onClick={() => setRuleModal(true)}><Plus size={13} /> Add Rule</Button></div>
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
