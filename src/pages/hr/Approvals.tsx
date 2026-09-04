import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck, CheckCircle2, XCircle, Clock, Plus, X, Check, Workflow, Users, ListChecks,
} from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, statusTone, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { useApprovals } from "@/store/useApprovals";
import { useHr } from "@/store/useHr";
import { useIdentity } from "@/store/useIdentity";
import { ACCOUNTS } from "@/data/accounts";
import { timeAgo, initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ApproverType, ApprovalRequest } from "@/data/approvals";

const APPROVER_TYPES: ApproverType[] = ["Line Manager", "HR Administrator", "Specific Person"];

function RequestCard({ req, onDecide }: { req: ApprovalRequest; onDecide: (id: string, decision: "Approved" | "Rejected") => void }) {
  const { types } = useApprovals();
  const byId = useHr((s) => s.byId);
  const user = useIdentity((s) => s.user);
  const type = types.find((t) => t.id === req.approvalTypeId);
  const currentStep = req.status === "Pending" ? req.steps[req.currentStepIndex] : undefined;
  const canDecide = currentStep?.approverId === user.id;

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display font-bold text-mist-900">{req.subjectLabel}</p>
          <p className="text-[11px] text-mist-400">
            {type?.name} · requested by {byId(req.requestedBy)?.name ?? req.requestedBy} · {timeAgo(req.createdAt)}
          </p>
        </div>
        <Badge tone={statusTone(req.status)}>{req.status}</Badge>
      </div>

      <div className="mb-3 flex items-center gap-1">
        {req.steps.map((st, i) => (
          <div key={st.stepId} className="flex flex-1 items-center gap-1">
            <div
              className={cn(
                "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                st.decision === "Approved" ? "bg-brand-gradient text-white"
                  : st.decision === "Rejected" ? "bg-action-500 text-white"
                  : i === req.currentStepIndex && req.status === "Pending" ? "bg-amber-400 text-white"
                  : "bg-mist-100 text-mist-400",
              )}
              title={st.name}
            >
              {st.decision === "Approved" ? <Check size={13} /> : st.decision === "Rejected" ? <X size={13} /> : i + 1}
            </div>
            {i < req.steps.length - 1 && (
              <div className={cn("h-0.5 flex-1", st.decision === "Approved" ? "bg-brand-400" : "bg-mist-100")} />
            )}
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        {req.steps.map((st) => (
          <div key={st.stepId} className="flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2 text-sm">
            <span className="text-mist-600">
              {st.name} <span className="text-mist-400">— {byId(st.approverId)?.name ?? st.approverId}</span>
            </span>
            <span className="flex items-center gap-2">
              {st.comment && <span className="max-w-[220px] truncate text-[11px] italic text-mist-400" title={st.comment}>"{st.comment}"</span>}
              <Badge tone={statusTone(st.decision)}>{st.decision}</Badge>
            </span>
          </div>
        ))}
      </div>

      {canDecide && (
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onDecide(req.id, "Rejected")}><XCircle size={14} /> Reject</Button>
          <Button onClick={() => onDecide(req.id, "Approved")}><CheckCircle2 size={14} /> Approve</Button>
        </div>
      )}
    </Card>
  );
}

export default function Approvals() {
  const { types, workflows, requests, addWorkflow, addApprovalType, decideStep } = useApprovals();
  const byId = useHr((s) => s.byId);
  const user = useIdentity((s) => s.user);

  const pendingForMe = requests.filter((r) => r.status === "Pending" && r.steps[r.currentStepIndex]?.approverId === user.id);
  const pending = requests.filter((r) => r.status === "Pending");
  const approved = requests.filter((r) => r.status === "Approved");
  const rejected = requests.filter((r) => r.status === "Rejected");

  const [statusFilter, setStatusFilter] = useState<"All" | "Pending" | "Approved" | "Rejected">("All");
  const filteredRequests = statusFilter === "All" ? requests : requests.filter((r) => r.status === statusFilter);

  const [decideFor, setDecideFor] = useState<{ id: string; decision: "Approved" | "Rejected" } | null>(null);
  const [comment, setComment] = useState("");

  const [wfOpen, setWfOpen] = useState(false);
  const [wfName, setWfName] = useState("");
  const [wfSteps, setWfSteps] = useState<{ name: string; approverType: ApproverType; approverId?: string }[]>([
    { name: "Line Manager approval", approverType: "Line Manager" },
  ]);

  const [typeOpen, setTypeOpen] = useState(false);
  const [tf, setTf] = useState({ name: "", module: "", description: "", workflowId: workflows[0]?.id ?? "" });

  const lineManagers = ACCOUNTS.filter((a) => a.wfRole === "Line Manager");
  const hrAdmin = ACCOUNTS.find((a) => a.wfRole === "Tenant HR Administrator");

  return (
    <div>
      <PageHeader title="Approval Workflows" subtitle="One configurable engine — loans, disciplinary queries, offer letters and onboarding sign-off all route through it" />

      <Tabs tabs={["Dashboard", "Requests", "Workflow Builder", "Approver Profiles"]}>
        {(t) =>
          t === "Dashboard" ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard label="Pending" value={pending.length} tone="amber" icon={<Clock size={18} />} />
                <StatCard label="Approved" value={approved.length} tone="brand" delay={0.05} icon={<CheckCircle2 size={18} />} />
                <StatCard label="Rejected" value={rejected.length} tone="mist" delay={0.1} icon={<XCircle size={18} />} />
                <StatCard label="Workflows configured" value={workflows.length} tone="mist" delay={0.15} icon={<Workflow size={18} />} />
              </div>

              <Card>
                <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><ShieldCheck size={16} className="text-brand-600" /> Waiting on you</h3>
                {pendingForMe.length === 0 ? (
                  <p className="text-sm text-mist-400">Nothing needs your decision right now.</p>
                ) : (
                  <div className="space-y-3">
                    {pendingForMe.map((r) => <RequestCard key={r.id} req={r} onDecide={(id, decision) => { setDecideFor({ id, decision }); setComment(""); }} />)}
                  </div>
                )}
              </Card>

              <p className="text-xs text-mist-400">
                Full activity trail lives in the <Link to="/audit-log" className="text-brand-600 hover:underline">Audit Log</Link>.
              </p>
            </div>
          ) : t === "Requests" ? (
            <div className="space-y-3">
              <div className="mb-1 flex flex-wrap gap-1.5">
                {(["All", "Pending", "Approved", "Rejected"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                      statusFilter === s ? "bg-brand-gradient text-white shadow-glow" : "bg-mist-100 text-mist-500 hover:bg-mist-200",
                    )}
                  >
                    {s} {s !== "All" && `(${s === "Pending" ? pending.length : s === "Approved" ? approved.length : rejected.length})`}
                  </button>
                ))}
              </div>
              {filteredRequests.length === 0 ? (
                <EmptyState title="No requests" hint="Approval requests submitted from Payroll, Onboarding or Discipline will show up here." />
              ) : (
                filteredRequests.map((r) => <RequestCard key={r.id} req={r} onDecide={(id, decision) => { setDecideFor({ id, decision }); setComment(""); }} />)
              )}
            </div>
          ) : t === "Workflow Builder" ? (
            <div className="space-y-6">
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display font-bold text-mist-900">Approval types</h3>
                  <Button variant="soft" onClick={() => { setTf({ name: "", module: "", description: "", workflowId: workflows[0]?.id ?? "" }); setTypeOpen(true); }}><Plus size={14} /> New approval type</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {types.map((tp) => {
                    const wf = workflows.find((w) => w.id === tp.workflowId);
                    return (
                      <Card key={tp.id}>
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-mist-900">{tp.name}</p>
                          <Badge tone="mist">{tp.module}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-mist-500">{tp.description}</p>
                        <p className="mt-2 text-[11px] font-semibold uppercase text-mist-400">Workflow: {wf?.name ?? "—"}</p>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display font-bold text-mist-900">Workflows</h3>
                  <Button variant="soft" onClick={() => { setWfName(""); setWfSteps([{ name: "Line Manager approval", approverType: "Line Manager" }]); setWfOpen(true); }}><Plus size={14} /> New workflow</Button>
                </div>
                <div className="space-y-3">
                  {workflows.map((w) => (
                    <Card key={w.id}>
                      <p className="mb-2 font-semibold text-mist-900">{w.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {w.steps.map((st, i) => (
                          <span key={st.id} className="flex items-center gap-1.5">
                            <span className="rounded-full bg-mist-100 px-2.5 py-1 text-[11px] font-semibold text-mist-600">
                              {i + 1}. {st.name} <span className="text-mist-400">({st.approverType === "Specific Person" ? byId(st.approverId)?.name ?? "—" : st.approverType})</span>
                            </span>
                            {i < w.steps.length - 1 && <span className="text-mist-300">→</span>}
                          </span>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <Card>
                <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><Users size={16} className="text-brand-600" /> HR Administrator (final sign-off)</h3>
                <p className="text-sm text-mist-600">{hrAdmin?.name} — resolves every "HR Administrator" step across all workflows.</p>
              </Card>
              <Card>
                <h3 className="mb-3 flex items-center gap-2 font-display font-bold text-mist-900"><ListChecks size={16} className="text-brand-600" /> Line managers</h3>
                <div className="space-y-2">
                  {lineManagers.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl bg-mist-50 px-3 py-2.5">
                      <span className="flex items-center gap-2.5 text-sm">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-white">{initials(m.name)}</span>
                        {m.name}
                      </span>
                      <span className="text-xs text-mist-400">manages {(m.reports ?? []).filter((r) => r !== m.id).map((r) => byId(r)?.name).filter(Boolean).join(", ") || "—"}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-mist-400">A "Line Manager" step resolves to the requester's reporting manager, set on their <Link to="/hr/employees" className="text-brand-600 hover:underline">HR profile</Link>. No manager on file falls back to HR.</p>
              </Card>
            </div>
          )
        }
      </Tabs>

      <Modal
        open={!!decideFor}
        onClose={() => setDecideFor(null)}
        title={decideFor?.decision === "Approved" ? "Approve step" : "Reject request"}
        footer={<><Button variant="ghost" onClick={() => setDecideFor(null)}>Cancel</Button>
          <Button
            variant={decideFor?.decision === "Rejected" ? "action" : "primary"}
            onClick={() => {
              if (!decideFor) return;
              decideStep(decideFor.id, decideFor.decision, comment.trim() || undefined);
              setDecideFor(null);
            }}
          >
            {decideFor?.decision === "Approved" ? "Confirm approval" : "Confirm rejection"}
          </Button></>}
      >
        <Field label="Comment (optional)"><Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add context for the next approver or the requester…" /></Field>
      </Modal>

      <Modal
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title="New approval type"
        footer={<><Button variant="ghost" onClick={() => setTypeOpen(false)}>Cancel</Button>
          <Button disabled={!tf.name.trim() || !tf.workflowId} onClick={() => { addApprovalType(tf); setTypeOpen(false); }}>Create</Button></>}
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={tf.name} onChange={(e) => setTf({ ...tf, name: e.target.value })} placeholder="e.g. Leave Request" /></Field>
          <Grid cols={2}>
            <Field label="Module"><Input value={tf.module} onChange={(e) => setTf({ ...tf, module: e.target.value })} placeholder="e.g. Workforce" /></Field>
            <Field label="Workflow"><Select value={tf.workflowId} onChange={(e) => setTf({ ...tf, workflowId: e.target.value })} options={workflows.map((w) => ({ value: w.id, label: w.name }))} /></Field>
          </Grid>
          <Field label="Description"><Textarea value={tf.description} onChange={(e) => setTf({ ...tf, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={wfOpen}
        onClose={() => setWfOpen(false)}
        title="New approval workflow"
        wide
        footer={<><Button variant="ghost" onClick={() => setWfOpen(false)}>Cancel</Button>
          <Button disabled={!wfName.trim() || wfSteps.length === 0} onClick={() => { addWorkflow(wfName.trim(), wfSteps); setWfOpen(false); }}>Create workflow</Button></>}
      >
        <div className="space-y-4">
          <Field label="Workflow name"><Input value={wfName} onChange={(e) => setWfName(e.target.value)} placeholder="e.g. Line Manager → Department Head → HR" /></Field>
          <div className="space-y-2">
            <span className="label">Approval chain, in order</span>
            {wfSteps.map((st, i) => (
              <div key={i} className="flex items-center gap-2 rounded-xl bg-mist-50 p-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-mist-200 text-[11px] font-bold text-mist-600">{i + 1}</span>
                <Input className="flex-1" value={st.name} onChange={(e) => setWfSteps(wfSteps.map((s2, i2) => (i2 === i ? { ...s2, name: e.target.value } : s2)))} placeholder="Step name" />
                <Select
                  className="w-44"
                  value={st.approverType}
                  onChange={(e) => setWfSteps(wfSteps.map((s2, i2) => (i2 === i ? { ...s2, approverType: e.target.value as ApproverType } : s2)))}
                  options={APPROVER_TYPES}
                />
                {st.approverType === "Specific Person" && (
                  <Select
                    className="w-40"
                    value={st.approverId ?? ""}
                    onChange={(e) => setWfSteps(wfSteps.map((s2, i2) => (i2 === i ? { ...s2, approverId: e.target.value } : s2)))}
                    options={[{ value: "", label: "Choose…" }, ...useHr.getState().staff.map((s2) => ({ value: s2.id, label: s2.name }))]}
                  />
                )}
                <button onClick={() => setWfSteps(wfSteps.filter((_, i2) => i2 !== i))} className="btn-ghost px-2 py-1.5 text-xs text-action-500"><X size={13} /></button>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setWfSteps([...wfSteps, { name: "", approverType: "HR Administrator" }])}><Plus size={14} /> Add step</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
