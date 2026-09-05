import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Plus, ShieldCheck, Clock, CheckCircle2, Users2, ArrowRight } from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { usePromotions } from "@/store/usePromotions";
import { useHr } from "@/store/useHr";
import { useEmployees } from "@/store/useEmployees";
import { useOrg } from "@/store/useOrg";
import { useApprovals } from "@/store/useApprovals";
import { useIdentity } from "@/store/useIdentity";
import { shortDate, initials } from "@/lib/format";

export default function Promotions() {
  const { promotions, propose, applyPromotion, resubmit, setSuccessor, completeHandover } = usePromotions();
  const staff = useHr((s) => s.staff);
  const byId = useHr((s) => s.byId);
  const { profileFor } = useEmployees();
  const { departments, positionsFor, rolesFor, jobPositionName, jobRoleName } = useOrg();
  const { requestFor } = useApprovals();
  const user = useIdentity((s) => s.user);

  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ employeeId: "", departmentId: "", toJobPositionId: "", toJobRoleId: "", toCadre: "", effectiveDate: "", reason: "" });

  const [handoverFor, setHandoverFor] = useState<string | null>(null);
  const [hf, setHf] = useState({ successorId: "", notes: "" });

  const active = staff.filter((s) => s.status === "Active");
  const effective = promotions.filter((p) => p.status === "Effective");
  const proposed = promotions.filter((p) => p.status === "Proposed");

  function statusFor(promotionId: string) {
    const req = requestFor(promotionId);
    if (!req) return { label: "Not submitted", tone: "mist" as const };
    if (req.status === "Pending") return { label: "Awaiting approval", tone: "amber" as const };
    if (req.status === "Rejected") return { label: "Rejected", tone: "action" as const };
    return { label: "Approved", tone: "brand" as const };
  }

  return (
    <div>
      <PageHeader
        title="Promotions"
        subtitle="Role changes with a sign-off gate and a tracked handover of the outgoing responsibilities"
        actions={<Button onClick={() => { setF({ employeeId: "", departmentId: "", toJobPositionId: "", toJobRoleId: "", toCadre: "", effectiveDate: "", reason: "" }); setOpen(true); }}><Plus size={15} /> Propose promotion</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Proposed" value={proposed.length} tone="amber" icon={<Clock size={18} />} />
        <StatCard label="Effective" value={effective.length} tone="brand" delay={0.05} icon={<TrendingUp size={18} />} />
        <StatCard label="Handovers pending" value={promotions.filter((p) => p.successorId && p.handoverStatus !== "Complete").length} tone="amber" delay={0.1} icon={<Users2 size={18} />} />
        <StatCard label="Total" value={promotions.length} tone="mist" delay={0.15} />
      </div>

      <div className="space-y-4">
        {promotions.map((p) => {
          const emp = byId(p.employeeId);
          const st = statusFor(p.id);
          const successor = byId(p.successorId);
          return (
            <Card key={p.id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-gradient text-xs font-bold text-white">{initials(emp?.name ?? "?")}</span>
                  <div>
                    <p className="font-display font-bold text-mist-900">{emp?.name}</p>
                    <p className="flex items-center gap-1.5 text-[11px] text-mist-400">
                      {p.fromJobPositionId ? jobPositionName(p.fromJobPositionId) : p.fromCadre || emp?.role}
                      <ArrowRight size={11} />
                      <span className="font-semibold text-brand-600">{p.toJobPositionId ? jobPositionName(p.toJobPositionId) : p.toCadre}</span>
                      {p.toJobRoleId && ` · ${jobRoleName(p.toJobRoleId)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={p.status === "Effective" ? "brand" : "amber"}>{p.status}</Badge>
                  <Badge tone={st.tone}>{st.label}</Badge>
                </div>
              </div>
              <p className="mb-3 rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600">{p.reason} <span className="ml-2 text-[11px] text-mist-400">Effective {shortDate(p.effectiveDate)}</span></p>

              {p.status === "Proposed" && (
                <div className="flex flex-wrap justify-end gap-2">
                  {st.label === "Rejected" ? (
                    <Button variant="soft" onClick={() => resubmit(p.id, user.id)}>Resubmit for approval</Button>
                  ) : st.label === "Approved" ? (
                    <Button onClick={() => applyPromotion(p.id)}><ShieldCheck size={14} /> Apply promotion</Button>
                  ) : (
                    <p className="text-xs text-mist-400">See <Link to="/hr/approvals" className="text-brand-600 hover:underline">Approval Workflows</Link> for the sign-off queue.</p>
                  )}
                </div>
              )}

              {p.status === "Effective" && (
                <div className="rounded-xl border border-dashed border-mist-200 p-3">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-mist-400"><Users2 size={13} /> Handover of the outgoing role</p>
                  {p.successorId ? (
                    <div className="space-y-2">
                      <p className="text-sm text-mist-700">
                        <b>{successor?.name}</b> is taking over — <Badge tone={p.handoverStatus === "Complete" ? "brand" : "amber"}>{p.handoverStatus}</Badge>
                      </p>
                      {p.handoverNotes && <p className="text-xs text-mist-500">{p.handoverNotes}</p>}
                      {p.handoverStatus !== "Complete" && (
                        <Button variant="soft" onClick={() => completeHandover(p.id)}><CheckCircle2 size={14} /> Mark handover complete</Button>
                      )}
                    </div>
                  ) : (
                    <Button variant="ghost" onClick={() => { setHf({ successorId: "", notes: "" }); setHandoverFor(p.id); }}><Plus size={14} /> Assign a successor</Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {promotions.length === 0 && <Card className="text-center text-mist-400">No promotions recorded yet.</Card>}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Propose promotion"
        wide
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!f.employeeId || !f.effectiveDate || !f.reason.trim() || (!f.toJobPositionId && !f.toCadre.trim())}
            onClick={() => {
              propose({ employeeId: f.employeeId, toJobPositionId: f.toJobPositionId || undefined, toJobRoleId: f.toJobRoleId || undefined, toCadre: f.toCadre.trim() || undefined, effectiveDate: new Date(f.effectiveDate).toISOString(), reason: f.reason.trim(), requestedBy: user.id });
              setOpen(false);
            }}
          >
            Submit for approval
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Employee"><Select value={f.employeeId} onChange={(e) => setF({ ...f, employeeId: e.target.value })} options={[{ value: "", label: "Choose…" }, ...active.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
          <Grid cols={2}>
            <Field label="Department (for the new position)"><Select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value, toJobPositionId: "" })} options={[{ value: "", label: "—" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} /></Field>
            <Field label="New job position"><Select value={f.toJobPositionId} onChange={(e) => setF({ ...f, toJobPositionId: e.target.value })} options={[{ value: "", label: "—" }, ...positionsFor(f.departmentId).map((p) => ({ value: p.id, label: p.name }))]} /></Field>
          </Grid>
          <Grid cols={2}>
            <Field label="New job role (optional)"><Select value={f.toJobRoleId} onChange={(e) => setF({ ...f, toJobRoleId: e.target.value })} options={[{ value: "", label: "—" }, ...rolesFor(f.toJobPositionId).map((r) => ({ value: r.id, label: r.name }))]} /></Field>
            <Field label="New cadre / grade" hint="Use this if there's no matching job position, e.g. a grade-level bump"><Input value={f.toCadre} onChange={(e) => setF({ ...f, toCadre: e.target.value })} placeholder="e.g. Grade Level 10" /></Field>
          </Grid>
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
          <Field label="Successor"><Select value={hf.successorId} onChange={(e) => setHf({ ...hf, successorId: e.target.value })} options={[{ value: "", label: "Choose…" }, ...active.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
          <Field label="Handover notes"><Textarea value={hf.notes} onChange={(e) => setHf({ ...hf, notes: e.target.value })} placeholder="Open items, access to transfer, ongoing work…" /></Field>
        </div>
      </Modal>
    </div>
  );
}
