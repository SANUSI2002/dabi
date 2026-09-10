import { useEffect, useState } from "react";
import { Plus, Briefcase, Send, RefreshCw, XCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader, Button, Badge, StatCard, Card, EmptyState, statusTone } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { money, shortDate, timeAgo } from "@/lib/format";
import { useVacancies } from "@/store/useVacancies";
import { useOrg } from "@/store/useOrg";
import { useHr } from "@/store/useHr";
import { useIdentity } from "@/store/useIdentity";
import { useMasterData } from "@/platform/useMasterData";
import { useWorkflow } from "@/platform/workflow/useWorkflow";
import { useTerminology } from "@/platform/useTerminology";
import type { VacancyRequest } from "@/data/vacancies";

export default function Vacancies() {
  const { vacancies, createVacancy, updateVacancy, submitVacancy, cancelVacancy, syncFromWorkflow, markFilled, liveStatus } = useVacancies();
  const { departments, deptById, positionsFor } = useOrg();
  const staff = useHr((s) => s.staff);
  const me = useIdentity((s) => s.user);
  const vacancyTypes = useMasterData((s) => s.items("vacancy-types")).filter((t) => t.active);
  const instanceFor = useWorkflow((s) => s.instanceFor);
  const { label } = useTerminology();

  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<VacancyRequest | null>(null);
  const [f, setF] = useState({ departmentId: departments[0]?.id ?? "", jobPositionId: "", roleTitle: "", headcount: 1, vacancyTypeId: "", reason: "", requirements: "", salaryMin: 0, salaryMax: 0 });
  const [detail, setDetail] = useState<string | null>(null);

  // keep statuses fresh from the workflow
  useEffect(() => {
    vacancies.filter((v) => v.status === "Submitted").forEach((v) => syncFromWorkflow(v.id));
  });

  const open = vacancies.filter((v) => v.status === "Submitted");
  const dv = detail ? vacancies.find((v) => v.id === detail) : null;
  const dvInst = dv ? instanceFor(dv.id) : null;

  function startCreate() {
    setEditing(null);
    setF({ departmentId: departments[0]?.id ?? "", jobPositionId: "", roleTitle: "", headcount: 1, vacancyTypeId: vacancyTypes[0]?.id ?? "", reason: "", requirements: "", salaryMin: 0, salaryMax: 0 });
    setModal(true);
  }
  function startEdit(v: VacancyRequest) {
    setEditing(v);
    setF({ departmentId: v.departmentId, jobPositionId: v.jobPositionId ?? "", roleTitle: v.roleTitle, headcount: v.headcount, vacancyTypeId: v.vacancyTypeId ?? "", reason: v.reason, requirements: v.requirements ?? "", salaryMin: v.salaryMin ?? 0, salaryMax: v.salaryMax ?? 0 });
    setModal(true);
  }
  function save() {
    const payload = { departmentId: f.departmentId, jobPositionId: f.jobPositionId || undefined, roleTitle: f.roleTitle, headcount: f.headcount, vacancyTypeId: f.vacancyTypeId || undefined, reason: f.reason, requirements: f.requirements || undefined, salaryMin: f.salaryMin || undefined, salaryMax: f.salaryMax || undefined };
    if (editing) updateVacancy(editing.id, payload);
    else createVacancy(payload);
    setModal(false);
  }

  return (
    <div>
      <PageHeader title="Vacancy Requests" subtitle={`${label("hod", "plural")} raise a request for their ${label("department").toLowerCase()}; it runs through the vacancy approval workflow.`}
        actions={<Button onClick={startCreate}><Plus size={15} /> Raise Vacancy</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open requests" value={open.length} tone="amber" icon={<Briefcase size={18} />} />
        <StatCard label="Approved" value={vacancies.filter((v) => v.status === "Approved").length} tone="brand" delay={0.05} />
        <StatCard label="Rejected" value={vacancies.filter((v) => v.status === "Rejected").length} tone="action" delay={0.1} />
        <StatCard label="Headcount requested" value={open.reduce((n, v) => n + v.headcount, 0)} tone="mist" delay={0.15} />
      </div>

      {vacancies.length === 0 ? <EmptyState title="No vacancy requests" /> : (
        <Card className="p-0">
          <Table columns={["Role", label("department"), "Raised by", "Heads", "Salary band", "Status", ""]}>
            {vacancies.map((v, i) => {
              const st = liveStatus(v);
              return (
                <Row key={v.id} index={i} onClick={() => setDetail(v.id)}>
                  <Cell className="font-semibold">{v.roleTitle}<span className="block text-xs font-normal text-mist-400">{timeAgo(v.createdAt)}</span></Cell>
                  <Cell>{deptById(v.departmentId)?.name}</Cell>
                  <Cell>{staff.find((s) => s.id === v.raisedBy)?.name}</Cell>
                  <Cell>{v.headcount}</Cell>
                  <Cell className="font-mono text-xs">{v.salaryMin || v.salaryMax ? `${money(v.salaryMin ?? 0)} – ${money(v.salaryMax ?? 0)}` : "—"}</Cell>
                  <Cell><Badge tone={statusTone(st.toLowerCase())}>{st}</Badge></Cell>
                  <Cell>
                    <div className="flex justify-end gap-1">
                      {(v.status === "Draft" || v.status === "Rejected") && v.raisedBy === me.id && <button className="btn-primary px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); const r = submitVacancy(v.id); if (!r.ok) alert(r.error); }}><Send size={11} /> {v.status === "Rejected" ? "Resubmit" : "Submit"}</button>}
                      {st === "Approved" && !v.requisitionId && <Link to="/hr/recruitment" onClick={(e) => e.stopPropagation()} className="btn-soft px-2 py-1 text-xs">To recruitment <ArrowRight size={11} /></Link>}
                    </div>
                  </Cell>
                </Row>
              );
            })}
          </Table>
        </Card>
      )}

      {/* create / edit */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Revise Vacancy Request" : "Raise a Vacancy Request"} wide
        footer={<><Button variant="ghost" onClick={() => setModal(false)}>Cancel</Button><Button disabled={!f.roleTitle || !f.reason} onClick={save}>{editing ? "Save" : "Create draft"}</Button></>}>
        <div className="space-y-3">
          {editing?.status === "Rejected" && <div className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700">Previously rejected: “{editing.rejectionReason}”. Revise and resubmit.</div>}
          <Grid cols={2}>
            <Field label={label("department")}><Select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value, jobPositionId: "" })} options={departments.map((d) => ({ value: d.id, label: d.name }))} /></Field>
            <Field label="Existing position (optional)"><Select value={f.jobPositionId} onChange={(e) => setF({ ...f, jobPositionId: e.target.value, roleTitle: positionsFor(f.departmentId).find((p) => p.id === e.target.value)?.name ?? f.roleTitle })} options={[{ value: "", label: "— new role —" }, ...positionsFor(f.departmentId).map((p) => ({ value: p.id, label: p.name }))]} /></Field>
          </Grid>
          <Grid cols={3}>
            <Field label="Role title"><Input value={f.roleTitle} onChange={(e) => setF({ ...f, roleTitle: e.target.value })} /></Field>
            <Field label="Headcount"><Input type="number" value={f.headcount} onChange={(e) => setF({ ...f, headcount: +e.target.value })} /></Field>
            <Field label="Type"><Select value={f.vacancyTypeId} onChange={(e) => setF({ ...f, vacancyTypeId: e.target.value })} options={[{ value: "", label: "—" }, ...vacancyTypes.map((t) => ({ value: t.id, label: t.label }))]} /></Field>
          </Grid>
          <Grid cols={2}>
            <Field label="Salary min"><Input type="number" value={f.salaryMin || ""} onChange={(e) => setF({ ...f, salaryMin: +e.target.value })} /></Field>
            <Field label="Salary max"><Input type="number" value={f.salaryMax || ""} onChange={(e) => setF({ ...f, salaryMax: +e.target.value })} /></Field>
          </Grid>
          <Field label="Justification"><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
          <Field label="Requirements"><Textarea value={f.requirements} onChange={(e) => setF({ ...f, requirements: e.target.value })} /></Field>
        </div>
      </Modal>

      {/* detail */}
      <Modal open={!!dv} onClose={() => setDetail(null)} title={dv?.roleTitle ?? ""} wide
        footer={dv && <>
          <Button variant="ghost" onClick={() => setDetail(null)}>Close</Button>
          {(dv.status === "Draft" || dv.status === "Rejected") && <Button variant="soft" onClick={() => { setDetail(null); startEdit(dv); }}>Revise</Button>}
          {dv.status !== "Cancelled" && dv.status !== "Filled" && <Button variant="action" onClick={() => { cancelVacancy(dv.id); setDetail(null); }}><XCircle size={14} /> Cancel</Button>}
          {liveStatus(dv) === "Approved" && <Button onClick={() => { markFilled(dv.id); setDetail(null); }}><CheckCircle2 size={14} /> Mark filled</Button>}
        </>}>
        {dv && (
          <div className="space-y-3">
            <div className="grid gap-1 rounded-lg bg-mist-50 p-3 text-sm sm:grid-cols-2">
              <div><span className="text-mist-400">{label("department")}</span> · {deptById(dv.departmentId)?.name}</div>
              <div><span className="text-mist-400">Raised by</span> · {staff.find((s) => s.id === dv.raisedBy)?.name}</div>
              <div><span className="text-mist-400">Headcount</span> · {dv.headcount}</div>
              <div><span className="text-mist-400">Status</span> · <b>{liveStatus(dv)}</b></div>
            </div>
            <p className="text-sm"><b>Justification.</b> {dv.reason}</p>
            {dv.requirements && <p className="text-sm"><b>Requirements.</b> {dv.requirements}</p>}
            {dv.rejectionReason && <div className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700"><b>Rejected:</b> {dv.rejectionReason}</div>}
            {dvInst && (
              <div>
                <h4 className="mb-1 text-xs font-bold uppercase text-mist-400">Approval progress</h4>
                <div className="space-y-1 text-sm">
                  {dvInst.history.filter((h) => h.action !== "auto" || h.comment).map((h) => (
                    <div key={h.id} className="flex items-center gap-2"><span className="text-mist-400">{shortDate(h.at)}</span> {h.nodeLabel} — {h.action}{h.comment ? ` · ${h.comment}` : ""}</div>
                  ))}
                </div>
                {dvInst.status === "Running" && <Button variant="soft" className="mt-2" onClick={() => { useWorkflow.getState().tick(); syncFromWorkflow(dv.id); }}><RefreshCw size={13} /> Run escalations</Button>}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
