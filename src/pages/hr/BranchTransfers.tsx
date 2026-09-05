import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, ShieldCheck, Clock, CheckCircle2, Users2, ArrowRight } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useBranchTransfers } from "@/store/useBranchTransfers";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { useApprovals } from "@/store/useApprovals";
import { useIdentity } from "@/store/useIdentity";
import { shortDate, initials } from "@/lib/format";

export default function BranchTransfers() {
  const { transfers, propose, applyTransfer, resubmit, setSuccessor, completeHandover } = useBranchTransfers();
  const staff = useHr((s) => s.staff);
  const byId = useHr((s) => s.byId);
  const { profileFor } = useEmployees();
  const { companies } = useOrg();
  const { requestFor } = useApprovals();
  const user = useIdentity((s) => s.user);

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ employeeId: "", toCompanyId: "", effectiveDate: "", reason: "" });
  const [handoverFor, setHandoverFor] = useState<string | null>(null);
  const [hf, setHf] = useState({ successorId: "", notes: "" });

  const active = staff.filter((s) => s.status === "Active");
  const companyName = (id?: string) => companies.find((c) => c.id === id)?.name ?? "—";

  function statusFor(transferId: string) {
    const req = requestFor(transferId);
    if (!req) return { label: "Not submitted", tone: "mist" as const };
    if (req.status === "Pending") return { label: "Awaiting approval", tone: "amber" as const };
    if (req.status === "Rejected") return { label: "Rejected", tone: "action" as const };
    return { label: "Approved", tone: "brand" as const };
  }

  if (companies.length < 2) {
    return (
      <div>
        <PageHeader title="Branch Transfers" subtitle="Move an employee from one branch or facility to another" />
        <EmptyState
          title="Only one branch is set up"
          hint="Add a second facility in Organisation Setup → Company to enable transfers between branches."
          action={<Link to="/hr/org-setup" className="btn-primary"><Building2 size={14} /> Go to Organisation Setup</Link>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Branch Transfers"
        subtitle="Move an employee from one branch to another, with a sign-off gate and a tracked handover"
        actions={<Button onClick={() => { setF({ employeeId: "", toCompanyId: "", effectiveDate: "", reason: "" }); setOpen(true); }}><Plus size={15} /> Propose transfer</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Proposed" value={transfers.filter((t) => t.status === "Proposed").length} tone="amber" icon={<Clock size={18} />} />
        <StatCard label="Effective" value={transfers.filter((t) => t.status === "Effective").length} tone="brand" delay={0.05} icon={<Building2 size={18} />} />
        <StatCard label="Handovers pending" value={transfers.filter((t) => t.successorId && t.handoverStatus !== "Complete").length} tone="amber" delay={0.1} icon={<Users2 size={18} />} />
        <StatCard label="Branches" value={companies.length} tone="mist" delay={0.15} />
      </div>

      <div className="space-y-4">
        {transfers.map((t) => {
          const emp = byId(t.employeeId);
          const st = statusFor(t.id);
          const successor = byId(t.successorId);
          return (
            <Card key={t.id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-xs font-bold text-white">{initials(emp?.name ?? "?")}</span>
                  <div>
                    <p className="font-display font-bold text-mist-900">{emp?.name}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-mist-400">
                      {companyName(t.fromCompanyId)} <ArrowRight size={11} /> <span className="font-semibold text-brand-600">{companyName(t.toCompanyId)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={t.status === "Effective" ? "brand" : "amber"}>{t.status}</Badge>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </div>
              <p className="mb-3 rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600">{t.reason} <span className="ml-2 text-[11px] text-mist-400">Effective {shortDate(t.effectiveDate)}</span></p>

              {t.status === "Proposed" && (
                <div className="flex flex-wrap justify-end gap-2">
                  {st.label === "Rejected" ? (
                    <Button variant="soft" onClick={() => resubmit(t.id, user.id)}>Resubmit for approval</Button>
                  ) : st.label === "Approved" ? (
                    <Button onClick={() => applyTransfer(t.id)}><ShieldCheck size={14} /> Apply transfer</Button>
                  ) : (
                    <p className="text-xs text-mist-400">See <Link to="/hr/approvals" className="text-brand-600 hover:underline">Approval Workflows</Link> for the sign-off queue.</p>
                  )}
                </div>
              )}

              {t.status === "Effective" && (
                <div className="rounded-xl border border-dashed border-mist-200 p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-mist-400"><Users2 size={13} /> Handover at the outgoing branch</p>
                  {t.successorId ? (
                    <div className="space-y-2">
                      <p className="text-sm text-mist-700">
                        <b>{successor?.name}</b> is taking over — <Badge tone={t.handoverStatus === "Complete" ? "brand" : "amber"}>{t.handoverStatus}</Badge>
                      </p>
                      {t.handoverNotes && <p className="text-xs text-mist-500">{t.handoverNotes}</p>}
                      {t.handoverStatus !== "Complete" && (
                        <Button variant="soft" onClick={() => completeHandover(t.id)}><CheckCircle2 size={14} /> Mark handover complete</Button>
                      )}
                    </div>
                  ) : (
                    <Button variant="ghost" onClick={() => { setHf({ successorId: "", notes: "" }); setHandoverFor(t.id); }}><Plus size={14} /> Assign a successor</Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {transfers.length === 0 && <Card className="text-center text-mist-400">No branch transfers recorded yet.</Card>}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Propose branch transfer"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!f.employeeId || !f.toCompanyId || !f.effectiveDate || !f.reason.trim()}
            onClick={() => {
              propose({ employeeId: f.employeeId, toCompanyId: f.toCompanyId, effectiveDate: new Date(f.effectiveDate).toISOString(), reason: f.reason.trim(), requestedBy: user.id });
              setOpen(false);
            }}
          >
            Submit for approval
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Employee"><Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} options={[{ value: "", label: "Choose…" }, ...active.map((s) => ({ value: s.id, label: `${s.name} — currently ${companyName(profileFor(s.id)?.companyId)}` }))]} /></Field>
          <Field label="Destination branch"><Select value={f.toCompanyId} onChange={(e) => setF({ ...f, toCompanyId: e.target.value })} options={[{ value: "", label: "Choose…" }, ...companies.map((c) => ({ value: c.id, label: c.name }))]} /></Field>
          <Field label="Effective date"><Input type="date" value={f.effectiveDate} onChange={(e) => setF({ ...f, effectiveDate: e.target.value })} /></Field>
          <Field label="Reason / justification"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">Routes through the same Line Manager → HR chain as other HR approvals — see <Link to="/hr/approvals" className="text-brand-600 hover:underline">Approval Workflows</Link>.</p>
        </div>
      </Modal>

      <Modal
        open={!!handoverFor}
        onClose={() => setHandoverFor(null)}
        title="Assign a successor"
        footer={<><Button variant="ghost" onClick={() => setHandoverFor(null)}>Cancel</Button>
          <Button disabled={!hf.successorId} onClick={() => { if (handoverFor) setSuccessor(handoverFor, hf.successorId, hf.notes.trim()); setHandoverFor(null); }}>Save</Button></>}
      >
        <div className="space-y-4">
          <Field label="Successor at the outgoing branch"><Select value={hf.successorId} onChange={(e) => setHf({ ...hf, successorId: e.target.value })} options={[{ value: "", label: "Choose…" }, ...active.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
          <Field label="Handover notes"><Textarea value={hf.notes} onChange={(e) => setHf({ ...hf, notes: e.target.value })} placeholder="Open items, ongoing patients/cases, access to transfer…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
