import { useMemo, useState } from "react";
import { Wallet, Plus, ArrowRight, Banknote, ReceiptText, HandCoins, AlertTriangle, Send, RefreshCcw, Settings2 } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, statusTone, Progress, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { usePayroll } from "@/store/usePayroll";
import { useHr } from "@/store/useHr";
import { useMasterData } from "@/platform/useMasterData";
import { naira, shortDate } from "@/lib/format";
import type { LoanType, ReimbursementType, RepaymentMethod } from "@/data/payroll";

const money = (n: number) => "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });

export default function Payroll() {
  const {
    salaryStructures, payslips, contracts, loans, reimbursements,
    setStructure, runBatch, advancePayslip, confirmBatch,
    addContract, requestLoan, decideLoan, recordPayment, checkOverdue,
    sendEscalationLetter, paymentsFor, lettersFor, requiresEscalation, maxLoanFor,
    loanEligibilityTiers, addEligibilityTier,
    requestReimbursement, decideReimbursement,
  } = usePayroll();
  const staff = useHr((s) => s.staff);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const masterData = useMasterData((s) => s.data);
  const loanTypes = useMemo(() => (masterData["loan-types"] ?? []).filter((i) => i.active), [masterData]);
  const loanTypeOptions = loanTypes.length ? loanTypes.map((t) => t.label) : ["Staff Advance", "Personal Loan"];

  const batches = [...new Set(payslips.map((p) => p.batch))];
  const totalNetThisMonth = payslips.filter((p) => p.batch === batches[0]).reduce((n, p) => n + p.netPay, 0);

  const [runOpen, setRunOpen] = useState(false);
  const [rf, setRf] = useState({ batch: "", startDate: "", endDate: "", employeeIds: staff.filter((s) => s.status === "Active").map((s) => s.id) });

  const [structFor, setStructFor] = useState<string | null>(null);
  const [sf, setSf] = useState({ basicSalary: 0, housing: 0, transport: 0, pension: 0, tax: 0 });

  const [ctOpen, setCtOpen] = useState(false);
  const [cf, setCf] = useState({ employeeId: staff[0]?.id ?? "", title: "", startDate: "", endDate: "", basicSalary: 0 });

  const [loanOpen, setLoanOpen] = useState(false);
  const [lf, setLf] = useState({ employeeId: staff[0]?.id ?? "", type: "Staff Advance" as LoanType, amount: 0, installments: 1, reason: "", repaymentMethod: "Manual" as RepaymentMethod });

  const [payFor, setPayFor] = useState<string | null>(null);
  const [pf, setPf] = useState({ amount: 0, date: new Date().toISOString().slice(0, 10) });

  const [tierOpen, setTierOpen] = useState(false);
  const [tf2, setTf2] = useState({ minMonthlySalary: 0, maxMonthlySalary: "" as number | "", maxLoanAmount: 0 });

  const [rbOpen, setRbOpen] = useState(false);
  const [rbf, setRbf] = useState({ employeeId: staff[0]?.id ?? "", type: "Expense Claim" as ReimbursementType, title: "", amount: 0 });

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Salary structure, payslip runs, contracts, loans & reimbursements"
        actions={<Button onClick={() => { setRf({ batch: "", startDate: "", endDate: "", employeeIds: staff.filter((s) => s.status === "Active").map((s) => s.id) }); setRunOpen(true); }}><Plus size={15} /> Run payroll</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Net pay (latest batch)" value={naira(totalNetThisMonth)} tone="brand" icon={<Wallet size={18} />} />
        <StatCard label="Payslips" value={payslips.length} tone="mist" delay={0.05} />
        <StatCard label="Loans active" value={loans.filter((l) => l.status === "Repaying").length} tone="amber" delay={0.1} icon={<HandCoins size={18} />} />
        <StatCard label="Reimbursements pending" value={reimbursements.filter((r) => r.status === "Requested").length} tone={reimbursements.some((r) => r.status === "Requested") ? "amber" : "mist"} delay={0.15} icon={<ReceiptText size={18} />} />
      </div>

      <Tabs tabs={["Payslips", "Salary Structure", "Contracts", "Loans & Advances", "Reimbursements"]}>
        {(t) =>
          t === "Payslips" ? (
            <div className="space-y-4">
              {batches.map((batch) => {
                const list = payslips.filter((p) => p.batch === batch);
                const reviewCount = list.filter((p) => p.status === "Review Ongoing").length;
                return (
                  <Card key={batch}>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="font-display font-bold text-mist-900">{batch}</p>
                      <div className="flex items-center gap-2">
                        <Badge tone="mist">{list.length} payslips</Badge>
                        {reviewCount > 0 && <Button variant="soft" onClick={() => confirmBatch(batch)}>Confirm {reviewCount} in review</Button>}
                      </div>
                    </div>
                    <Table columns={["Employee", "Period", "Gross", "Deductions", "Net Pay", "Status", ""]}>
                      {list.map((p, i) => (
                        <Row key={p.id} index={i}>
                          <Cell className="font-semibold">{name(p.employeeId)}</Cell>
                          <Cell className="text-mist-400">{shortDate(p.startDate)} – {shortDate(p.endDate)}</Cell>
                          <Cell>{naira(p.grossPay)}</Cell>
                          <Cell className="text-action-600">{naira(p.totalDeductions)}</Cell>
                          <Cell className="font-semibold">{naira(p.netPay)}</Cell>
                          <Cell><Badge tone={statusTone(p.status)}>{p.status}</Badge></Cell>
                          <Cell>
                            {p.status !== "Paid" && (
                              <button onClick={() => advancePayslip(p.id)} className="btn-ghost px-2 py-1 text-xs">
                                {p.status === "Draft" ? "Send for review" : p.status === "Review Ongoing" ? "Confirm" : "Mark paid"} <ArrowRight size={11} />
                              </button>
                            )}
                          </Cell>
                        </Row>
                      ))}
                    </Table>
                  </Card>
                );
              })}
              {batches.length === 0 && <Card className="text-sm text-mist-400">No payroll batches yet.</Card>}
            </div>
          ) : t === "Salary Structure" ? (
            <Table columns={["Employee", "Basic", "Allowances", "Deductions", "Gross", "Net", ""]}>
              {staff.map((s, i) => {
                const st = salaryStructures.find((x) => x.employeeId === s.id);
                const allowTotal = st?.allowances.reduce((n, a) => n + a.amount, 0) ?? 0;
                const dedTotal = st?.deductions.reduce((n, d) => n + d.amount, 0) ?? 0;
                const gross = (st?.basicSalary ?? 0) + allowTotal;
                return (
                  <Row key={s.id} index={i}>
                    <Cell className="font-semibold">{s.name}</Cell>
                    <Cell>{naira(st?.basicSalary ?? 0)}</Cell>
                    <Cell className="text-brand-600">+{naira(allowTotal)}</Cell>
                    <Cell className="text-action-600">-{naira(dedTotal)}</Cell>
                    <Cell>{naira(gross)}</Cell>
                    <Cell className="font-semibold">{naira(gross - dedTotal)}</Cell>
                    <Cell>
                      <button
                        onClick={() => {
                          setStructFor(s.id);
                          setSf({
                            basicSalary: st?.basicSalary ?? 0,
                            housing: st?.allowances.find((a) => a.name === "Housing")?.amount ?? 0,
                            transport: st?.allowances.find((a) => a.name === "Transport")?.amount ?? 0,
                            pension: st?.deductions.find((d) => d.name.startsWith("Pension"))?.amount ?? 0,
                            tax: st?.deductions.find((d) => d.name === "PAYE Tax")?.amount ?? 0,
                          });
                        }}
                        className="btn-ghost px-2 py-1 text-xs"
                      >Edit</button>
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          ) : t === "Contracts" ? (
            <div className="space-y-3">
              <div className="flex justify-end"><Button variant="soft" onClick={() => { setCf({ employeeId: staff[0]?.id ?? "", title: "", startDate: "", endDate: "", basicSalary: 0 }); setCtOpen(true); }}><Plus size={14} /> Add contract</Button></div>
              <Table columns={["Employee", "Contract", "Start", "End", "Basic salary", "Status"]}>
                {contracts.map((c, i) => (
                  <Row key={c.id} index={i}>
                    <Cell className="font-semibold">{name(c.employeeId)}</Cell>
                    <Cell>{c.title}</Cell>
                    <Cell className="text-mist-400">{shortDate(c.startDate)}</Cell>
                    <Cell className="text-mist-400">{c.endDate ? shortDate(c.endDate) : "—"}</Cell>
                    <Cell>{naira(c.basicSalary)}</Cell>
                    <Cell><Badge tone={statusTone(c.status)}>{c.status}</Badge></Cell>
                  </Row>
                ))}
                {contracts.length === 0 && <Row><Cell className="text-mist-400">No contracts recorded.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
              </Table>
            </div>
          ) : t === "Loans & Advances" ? (
            <div className="space-y-4">
              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display font-bold text-mist-900"><Settings2 size={15} className="text-brand-600" /> Loan eligibility tiers</h3>
                  <Button variant="ghost" onClick={() => { setTf2({ minMonthlySalary: 0, maxMonthlySalary: "", maxLoanAmount: 0 }); setTierOpen(true); }}><Plus size={13} /> Add tier</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {loanEligibilityTiers.map((tier) => (
                    <span key={tier.id} className="rounded-full bg-mist-100 px-3 py-1.5 text-xs font-semibold text-mist-600">
                      {money(tier.minMonthlySalary)}–{tier.maxMonthlySalary ? money(tier.maxMonthlySalary) : "∞"} /mo → max {money(tier.maxLoanAmount)}
                    </span>
                  ))}
                </div>
              </Card>

              <div className="flex justify-end"><Button variant="soft" onClick={() => { setLf({ employeeId: staff[0]?.id ?? "", type: loanTypeOptions[0], amount: 0, installments: 1, reason: "", repaymentMethod: "Manual" }); setLoanOpen(true); }}><Plus size={14} /> Request</Button></div>

              {loans.length === 0 && <EmptyState title="No loans or advances" hint="Requests raised for employees will show up here." />}
              {loans.map((l) => {
                const escalates = requiresEscalation(l);
                const letters = lettersFor(l.id);
                const payments = paymentsFor(l.id);
                return (
                  <Card key={l.id}>
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-display font-bold text-mist-900">{name(l.employeeId)} <span className="ml-1 text-xs font-normal text-mist-400">{l.type}</span></p>
                        <p className="text-xs text-mist-500">{l.reason}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {escalates && <Badge tone="action"><AlertTriangle size={11} /> Above annual salary</Badge>}
                        <Badge tone="mist">{l.repaymentMethod}</Badge>
                        <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                      </div>
                    </div>

                    <div className="mb-2 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div><p className="text-[10px] font-bold uppercase text-mist-400">Amount</p><p className="font-semibold text-mist-800">{money(l.amount)}</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-mist-400">Instalment</p><p className="font-semibold text-mist-800">{money(l.installmentAmount)}</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-mist-400">Paid so far</p><p className="font-semibold text-brand-600">{money(l.totalPaid)}</p></div>
                      <div><p className="text-[10px] font-bold uppercase text-mist-400">Periods</p><p className="font-semibold text-mist-800">{l.installmentsPaid}/{l.installments}</p></div>
                    </div>

                    {(l.status === "Repaying" || l.status === "Overdue") && (
                      <div className="mb-2">
                        <div className="mb-1 flex items-center justify-between text-[11px] text-mist-400">
                          <span>This period: {money(l.currentPeriodPaid)} of {money(l.currentPeriodDue)}</span>
                          {l.currentPeriodPaid > 0 && l.currentPeriodPaid < l.currentPeriodDue && <Badge tone="amber">Partial payment</Badge>}
                        </div>
                        <Progress value={l.currentPeriodPaid} target={l.currentPeriodDue} tone={l.status === "Overdue" ? "action" : "brand"} />
                      </div>
                    )}

                    {letters.length > 0 && (
                      <div className="mb-2 space-y-1.5">
                        {letters.map((letter) => (
                          <div key={letter.id} className="flex items-center justify-between rounded-xl bg-action-50 px-3 py-2 text-xs text-action-700">
                            <span>Level {letter.level} escalation letter — {money(letter.amountOwed)} owed · issued {shortDate(letter.issuedDate)}{letter.sent && ` · sent ${shortDate(letter.sentAt!)}`}</span>
                            {!letter.sent && <button onClick={() => sendEscalationLetter(letter.id)} className="btn-action px-2 py-1 text-[11px]"><Send size={11} /> Send</button>}
                          </div>
                        ))}
                      </div>
                    )}

                    {payments.length > 0 && (
                      <p className="mb-2 text-[11px] text-mist-400">{payments.length} payment{payments.length > 1 ? "s" : ""} recorded — last {money(payments[0].amount)} on {shortDate(payments[0].date)}</p>
                    )}

                    <div className="flex flex-wrap justify-end gap-1.5">
                      {l.status === "Requested" && (
                        <>
                          <button onClick={() => decideLoan(l.id, "Rejected")} className="btn-ghost px-2 py-1 text-xs">Reject</button>
                          <button onClick={() => decideLoan(l.id, "Approved")} className="btn-primary px-2.5 py-1 text-xs">Approve</button>
                        </>
                      )}
                      {(l.status === "Repaying" || l.status === "Overdue") && l.repaymentMethod === "Manual" && (
                        <>
                          <button onClick={() => checkOverdue(l.id)} className="btn-ghost px-2.5 py-1 text-xs"><RefreshCcw size={12} /> Check overdue</button>
                          <button onClick={() => { setPf({ amount: l.currentPeriodDue - l.currentPeriodPaid, date: new Date().toISOString().slice(0, 10) }); setPayFor(l.id); }} className="btn-soft px-2.5 py-1 text-xs"><Banknote size={12} /> Record payment</button>
                        </>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-end"><Button variant="soft" onClick={() => { setRbf({ employeeId: staff[0]?.id ?? "", type: "Expense Claim", title: "", amount: 0 }); setRbOpen(true); }}><Plus size={14} /> Request</Button></div>
              <Table columns={["Employee", "Type", "Title", "Amount", "Requested", "Status", ""]}>
                {reimbursements.map((r, i) => (
                  <Row key={r.id} index={i}>
                    <Cell className="font-semibold">{name(r.employeeId)}</Cell>
                    <Cell><Badge tone="mist">{r.type}</Badge></Cell>
                    <Cell>{r.title}</Cell>
                    <Cell>{naira(r.amount)}</Cell>
                    <Cell className="text-mist-400">{shortDate(r.requestedDate)}</Cell>
                    <Cell><Badge tone={statusTone(r.status)}>{r.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1.5">
                        {r.status === "Requested" && (
                          <>
                            <button onClick={() => decideReimbursement(r.id, "Rejected")} className="btn-ghost px-2 py-1 text-xs">Reject</button>
                            <button onClick={() => decideReimbursement(r.id, "Approved")} className="btn-primary px-2.5 py-1 text-xs">Approve</button>
                          </>
                        )}
                        {r.status === "Approved" && <button onClick={() => decideReimbursement(r.id, "Paid")} className="btn-soft px-2.5 py-1 text-xs">Mark paid</button>}
                      </div>
                    </Cell>
                  </Row>
                ))}
                {reimbursements.length === 0 && <Row><Cell className="text-mist-400">No reimbursement requests.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
              </Table>
            </div>
          )
        }
      </Tabs>

      <Modal open={runOpen} onClose={() => setRunOpen(false)} title="Run payroll batch" wide
        footer={<><Button variant="ghost" onClick={() => setRunOpen(false)}>Cancel</Button>
          <Button disabled={!rf.batch.trim() || !rf.startDate || !rf.endDate || rf.employeeIds.length === 0} onClick={() => { runBatch(rf.batch.trim(), new Date(rf.startDate).toISOString(), new Date(rf.endDate).toISOString(), rf.employeeIds); setRunOpen(false); }}>Generate draft payslips</Button></>}>
        <div className="space-y-4">
          <Field label="Batch name"><Input value={rf.batch} onChange={(e) => setRf({ ...rf, batch: e.target.value })} placeholder="e.g. September 2026" /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Period start"><Input type="date" value={rf.startDate} onChange={(e) => setRf({ ...rf, startDate: e.target.value })} /></Field>
            <Field label="Period end"><Input type="date" value={rf.endDate} onChange={(e) => setRf({ ...rf, endDate: e.target.value })} /></Field>
          </div>
          <div>
            <p className="label mb-1.5">Employees</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {staff.map((s) => (
                <Checkbox key={s.id} label={s.name} checked={rf.employeeIds.includes(s.id)} onChange={(e) => setRf({ ...rf, employeeIds: e.target.checked ? [...rf.employeeIds, s.id] : rf.employeeIds.filter((x) => x !== s.id) })} />
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!structFor} onClose={() => setStructFor(null)} title="Edit salary structure" wide
        footer={<><Button variant="ghost" onClick={() => setStructFor(null)}>Cancel</Button>
          <Button onClick={() => {
            if (!structFor) return;
            setStructure(structFor, sf.basicSalary,
              [{ name: "Housing", amount: sf.housing }, { name: "Transport", amount: sf.transport }],
              [{ name: "Pension (8%)", amount: sf.pension }, { name: "PAYE Tax", amount: sf.tax }]);
            setStructFor(null);
          }}>Save</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Basic salary"><Input type="number" value={sf.basicSalary} onChange={(e) => setSf({ ...sf, basicSalary: +e.target.value })} /></Field>
          <Field label="Housing allowance"><Input type="number" value={sf.housing} onChange={(e) => setSf({ ...sf, housing: +e.target.value })} /></Field>
          <Field label="Transport allowance"><Input type="number" value={sf.transport} onChange={(e) => setSf({ ...sf, transport: +e.target.value })} /></Field>
          <Field label="Pension deduction"><Input type="number" value={sf.pension} onChange={(e) => setSf({ ...sf, pension: +e.target.value })} /></Field>
          <Field label="PAYE tax deduction"><Input type="number" value={sf.tax} onChange={(e) => setSf({ ...sf, tax: +e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={ctOpen} onClose={() => setCtOpen(false)} title="Add contract" wide
        footer={<><Button variant="ghost" onClick={() => setCtOpen(false)}>Cancel</Button>
          <Button disabled={!cf.title.trim() || !cf.startDate} onClick={() => { addContract({ ...cf, startDate: new Date(cf.startDate).toISOString(), endDate: cf.endDate ? new Date(cf.endDate).toISOString() : undefined }); setCtOpen(false); }}>Add</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Employee"><Select value={cf.employeeId} onChange={(e) => setCf({ ...cf, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Contract title"><Input value={cf.title} onChange={(e) => setCf({ ...cf, title: e.target.value })} /></Field>
          <Field label="Start date"><Input type="date" value={cf.startDate} onChange={(e) => setCf({ ...cf, startDate: e.target.value })} /></Field>
          <Field label="End date (optional)"><Input type="date" value={cf.endDate} onChange={(e) => setCf({ ...cf, endDate: e.target.value })} /></Field>
          <Field label="Basic salary"><Input type="number" value={cf.basicSalary} onChange={(e) => setCf({ ...cf, basicSalary: +e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={loanOpen} onClose={() => setLoanOpen(false)} title="Request loan / advance"
        footer={<><Button variant="ghost" onClick={() => setLoanOpen(false)}>Cancel</Button>
          <Button disabled={!lf.reason.trim() || lf.amount <= 0} onClick={() => { requestLoan(lf.employeeId, lf.type, lf.amount, lf.installments, lf.reason.trim(), lf.repaymentMethod); setLoanOpen(false); }}>Request</Button></>}>
        <div className="space-y-4">
          <Field label="Employee"><Select value={lf.employeeId} onChange={(e) => setLf({ ...lf, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Type"><Select
              value={lf.type}
              onChange={(e) => {
                const it = loanTypes.find((t) => t.label === e.target.value);
                const auto = it?.meta?.autoDebit === true;
                setLf({ ...lf, type: e.target.value, repaymentMethod: auto ? "Salary Auto-Debit" : lf.repaymentMethod });
              }}
              options={loanTypeOptions}
            /></Field>
            <Field label="Amount"><Input type="number" value={lf.amount} onChange={(e) => setLf({ ...lf, amount: +e.target.value })} /></Field>
            <Field label="Instalments"><Input type="number" min="1" value={lf.installments} onChange={(e) => setLf({ ...lf, installments: +e.target.value })} /></Field>
          </div>
          <Field label="Repayment method"><Select value={lf.repaymentMethod} onChange={(e) => setLf({ ...lf, repaymentMethod: e.target.value as RepaymentMethod })} options={["Manual", "Salary Auto-Debit"]} /></Field>
          <Field label="Reason"><Input value={lf.reason} onChange={(e) => setLf({ ...lf, reason: e.target.value })} /></Field>
          {(() => {
            const cap = maxLoanFor(lf.employeeId);
            const annualSalary = (salaryStructures.find((s) => s.employeeId === lf.employeeId)?.basicSalary ?? 0) * 12;
            return (
              <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
                {cap !== null && <>Eligible up to <b className="text-mist-700">{money(cap)}</b> based on their salary tier. </>}
                {lf.amount > annualSalary && annualSalary > 0 && (
                  <span className="block mt-1 font-semibold text-action-600">This exceeds their annual salary ({money(annualSalary)}) — overdue periods will auto-generate escalation letters.</span>
                )}
              </p>
            );
          })()}
        </div>
      </Modal>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} title="Record payment"
        footer={<><Button variant="ghost" onClick={() => setPayFor(null)}>Cancel</Button>
          <Button disabled={pf.amount <= 0 || !pf.date} onClick={() => { if (payFor) recordPayment(payFor, pf.amount, new Date(pf.date).toISOString()); setPayFor(null); }}>Record payment</Button></>}>
        <div className="space-y-4">
          <Field label="Amount paid"><Input type="number" value={pf.amount} onChange={(e) => setPf({ ...pf, amount: +e.target.value })} /></Field>
          <Field label="Date"><Input type="date" value={pf.date} onChange={(e) => setPf({ ...pf, date: e.target.value })} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Paying less than the period's amount due records as a partial payment — the shortfall carries forward if the period closes before it's made up.</p>
        </div>
      </Modal>

      <Modal open={tierOpen} onClose={() => setTierOpen(false)} title="Add eligibility tier"
        footer={<><Button variant="ghost" onClick={() => setTierOpen(false)}>Cancel</Button>
          <Button disabled={tf2.maxLoanAmount <= 0} onClick={() => { addEligibilityTier({ minMonthlySalary: tf2.minMonthlySalary, maxMonthlySalary: tf2.maxMonthlySalary === "" ? null : tf2.maxMonthlySalary, maxLoanAmount: tf2.maxLoanAmount }); setTierOpen(false); }}>Add tier</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Min monthly salary"><Input type="number" value={tf2.minMonthlySalary} onChange={(e) => setTf2({ ...tf2, minMonthlySalary: +e.target.value })} /></Field>
            <Field label="Max monthly salary (blank = no cap)"><Input type="number" value={tf2.maxMonthlySalary} onChange={(e) => setTf2({ ...tf2, maxMonthlySalary: e.target.value === "" ? "" : +e.target.value })} /></Field>
          </div>
          <Field label="Max loan amount for this tier"><Input type="number" value={tf2.maxLoanAmount} onChange={(e) => setTf2({ ...tf2, maxLoanAmount: +e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={rbOpen} onClose={() => setRbOpen(false)} title="Request reimbursement"
        footer={<><Button variant="ghost" onClick={() => setRbOpen(false)}>Cancel</Button>
          <Button disabled={!rbf.title.trim() || rbf.amount <= 0} onClick={() => { requestReimbursement(rbf.employeeId, rbf.type, rbf.title.trim(), rbf.amount); setRbOpen(false); }}>Request</Button></>}>
        <div className="space-y-4">
          <Field label="Employee"><Select value={rbf.employeeId} onChange={(e) => setRbf({ ...rbf, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <Field label="Type"><Select value={rbf.type} onChange={(e) => setRbf({ ...rbf, type: e.target.value as ReimbursementType })} options={["Expense Claim", "Leave Encashment"]} /></Field>
          <Field label="Title"><Input value={rbf.title} onChange={(e) => setRbf({ ...rbf, title: e.target.value })} /></Field>
          <Field label="Amount"><Input type="number" value={rbf.amount} onChange={(e) => setRbf({ ...rbf, amount: +e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
