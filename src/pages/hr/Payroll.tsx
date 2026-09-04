import { useState } from "react";
import { Wallet, Plus, ArrowRight, Banknote, ReceiptText, HandCoins } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, statusTone, Progress } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Checkbox } from "@/components/ui/form";
import { usePayroll } from "@/store/usePayroll";
import { useHr } from "@/store/useHr";
import { naira, shortDate } from "@/lib/format";
import type { LoanType, ReimbursementType } from "@/data/payroll";

export default function Payroll() {
  const {
    salaryStructures, payslips, contracts, loans, reimbursements,
    setStructure, runBatch, advancePayslip, confirmBatch,
    addContract, requestLoan, decideLoan, payInstallment,
    requestReimbursement, decideReimbursement,
  } = usePayroll();
  const staff = useHr((s) => s.staff);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;

  const batches = [...new Set(payslips.map((p) => p.batch))];
  const totalNetThisMonth = payslips.filter((p) => p.batch === batches[0]).reduce((n, p) => n + p.netPay, 0);

  const [runOpen, setRunOpen] = useState(false);
  const [rf, setRf] = useState({ batch: "", startDate: "", endDate: "", employeeIds: staff.filter((s) => s.status === "Active").map((s) => s.id) });

  const [structFor, setStructFor] = useState<string | null>(null);
  const [sf, setSf] = useState({ basicSalary: 0, housing: 0, transport: 0, pension: 0, tax: 0 });

  const [ctOpen, setCtOpen] = useState(false);
  const [cf, setCf] = useState({ employeeId: staff[0]?.id ?? "", title: "", startDate: "", endDate: "", basicSalary: 0 });

  const [loanOpen, setLoanOpen] = useState(false);
  const [lf, setLf] = useState({ employeeId: staff[0]?.id ?? "", type: "Salary Advance" as LoanType, amount: 0, installments: 1, reason: "" });

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
            <div className="space-y-3">
              <div className="flex justify-end"><Button variant="soft" onClick={() => { setLf({ employeeId: staff[0]?.id ?? "", type: "Salary Advance", amount: 0, installments: 1, reason: "" }); setLoanOpen(true); }}><Plus size={14} /> Request</Button></div>
              <Table columns={["Employee", "Type", "Amount", "Reason", "Progress", "Status", ""]}>
                {loans.map((l, i) => (
                  <Row key={l.id} index={i}>
                    <Cell className="font-semibold">{name(l.employeeId)}</Cell>
                    <Cell><Badge tone="mist">{l.type}</Badge></Cell>
                    <Cell>{naira(l.amount)}</Cell>
                    <Cell className="max-w-[220px] text-mist-500">{l.reason}</Cell>
                    <Cell>
                      {l.status === "Repaying" || l.status === "Settled" ? (
                        <div className="w-28"><Progress value={l.installmentsPaid} target={l.installments} /><span className="text-[11px] text-mist-400">{l.installmentsPaid}/{l.installments}</span></div>
                      ) : "—"}
                    </Cell>
                    <Cell><Badge tone={statusTone(l.status)}>{l.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1.5">
                        {l.status === "Requested" && (
                          <>
                            <button onClick={() => decideLoan(l.id, "Rejected")} className="btn-ghost px-2 py-1 text-xs">Reject</button>
                            <button onClick={() => decideLoan(l.id, "Approved")} className="btn-primary px-2.5 py-1 text-xs">Approve</button>
                          </>
                        )}
                        {l.status === "Repaying" && <button onClick={() => payInstallment(l.id)} className="btn-soft px-2.5 py-1 text-xs"><Banknote size={12} /> Record instalment</button>}
                      </div>
                    </Cell>
                  </Row>
                ))}
                {loans.length === 0 && <Row><Cell className="text-mist-400">No loans or advances.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
              </Table>
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
          <Button disabled={!lf.reason.trim() || lf.amount <= 0} onClick={() => { requestLoan(lf.employeeId, lf.type, lf.amount, lf.installments, lf.reason.trim()); setLoanOpen(false); }}>Request</Button></>}>
        <div className="space-y-4">
          <Field label="Employee"><Select value={lf.employeeId} onChange={(e) => setLf({ ...lf, employeeId: e.target.value })} options={staff.map((s) => ({ value: s.id, label: s.name }))} /></Field>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Type"><Select value={lf.type} onChange={(e) => setLf({ ...lf, type: e.target.value as LoanType })} options={["Salary Advance", "Loan"]} /></Field>
            <Field label="Amount"><Input type="number" value={lf.amount} onChange={(e) => setLf({ ...lf, amount: +e.target.value })} /></Field>
            <Field label="Instalments"><Input type="number" min="1" value={lf.installments} onChange={(e) => setLf({ ...lf, installments: +e.target.value })} /></Field>
          </div>
          <Field label="Reason"><Input value={lf.reason} onChange={(e) => setLf({ ...lf, reason: e.target.value })} /></Field>
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
