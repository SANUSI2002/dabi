import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, Plus, Star, ArrowRight, X, CalendarClock, UserCheck, Users2,
} from "lucide-react";
import { PageHeader, Card, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { useRecruitment } from "@/store/useRecruitment";
import { useOnboarding } from "@/store/useOnboarding";
import { useOrg } from "@/store/useOrg";
import { useHr } from "@/store/useHr";
import { timeAgo, initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CandidateSource } from "@/data/recruitment";

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onChange(n === value ? 0 : n)} className="text-amber-400">
          <Star size={13} fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

export default function Recruitment() {
  const { requisitions, candidates, stagesFor, candidatesFor, addRequisition, addCandidate, moveCandidate, rateCandidate, rejectCandidate, hireCandidate, scheduleInterview } = useRecruitment();
  const { startOnboarding } = useOnboarding();
  const { departments, positionsFor, jobPositionName, departmentName } = useOrg();
  const staff = useHr((s) => s.staff);
  const nav = useNavigate();

  const [reqId, setReqId] = useState(requisitions[0]?.id ?? "");
  const requisition = requisitions.find((r) => r.id === reqId);
  const cols = useMemo(() => stagesFor(reqId), [reqId, stagesFor]);
  const active = candidatesFor(reqId).filter((c) => !c.canceled);
  const rejected = candidatesFor(reqId).filter((c) => c.canceled);

  const [reqOpen, setReqOpen] = useState(false);
  const [rf, setRf] = useState({ title: "", description: "", departmentId: departments[0]?.id ?? "", jobPositionId: "", vacancy: 1, startDate: "" });
  const [candOpen, setCandOpen] = useState(false);
  const [cf, setCf] = useState({ name: "", email: "", phone: "", source: "Application" as CandidateSource, referredBy: "" });
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [ivFor, setIvFor] = useState<string | null>(null);
  const [ivf, setIvf] = useState({ scheduledAt: "", interviewerIds: [] as string[], notes: "" });

  function hire(candidateId: string) {
    const c = candidates.find((x) => x.id === candidateId);
    if (!c || !requisition) return;
    hireCandidate(candidateId);
    startOnboarding({ candidateId, candidateName: c.name, requisitionId: requisition.id, jobPositionId: requisition.jobPositionId, departmentId: requisition.departmentId });
    nav("/hr/onboarding");
  }

  return (
    <div>
      <PageHeader
        title="Recruitment"
        subtitle="Job requisitions, pipeline stages, candidates — through to hire"
        actions={<Button onClick={() => { setRf({ title: "", description: "", departmentId: departments[0]?.id ?? "", jobPositionId: "", vacancy: 1, startDate: "" }); setReqOpen(true); }}><Plus size={15} /> New requisition</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Open requisitions" value={requisitions.filter((r) => !r.closed).length} tone="brand" icon={<Briefcase size={18} />} />
        <StatCard label="Candidates (this req.)" value={active.length} tone="mist" delay={0.05} icon={<Users2 size={18} />} />
        <StatCard label="Hired (this req.)" value={active.filter((c) => c.hired).length} tone="brand" delay={0.1} icon={<UserCheck size={18} />} />
        <StatCard label="Rejected (this req.)" value={rejected.length} tone={rejected.length ? "action" : "mist"} delay={0.15} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={reqId} onChange={(e) => setReqId(e.target.value)} className="w-auto" options={requisitions.map((r) => ({ value: r.id, label: `${r.title} (${r.vacancy} vacancy)` }))} />
        {requisition && <Badge tone="mist">{departmentName(requisition.departmentId)} · {jobPositionName(requisition.jobPositionId)}</Badge>}
        <Button variant="soft" className="ml-auto" onClick={() => { setCf({ name: "", email: "", phone: "", source: "Application", referredBy: "" }); setCandOpen(true); }}><Plus size={14} /> Add candidate</Button>
      </div>

      {!requisition ? (
        <Card>No requisitions yet — open one to start a pipeline.</Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {cols.map((col) => {
            const inCol = active.filter((c) => c.stageId === col.id);
            const nextCol = cols.find((x) => x.sequence === col.sequence + 1);
            return (
              <div key={col.id} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="font-display text-sm font-bold text-mist-900">{col.name}</p>
                  <Badge tone="mist">{inCol.length}</Badge>
                </div>
                <div className="space-y-2.5">
                  {inCol.map((c) => (
                    <div key={c.id} className="card p-3">
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-gradient text-[11px] font-bold text-white">{initials(c.name)}</span>
                          <div>
                            <p className="text-sm font-semibold text-mist-900">{c.name}</p>
                            <p className="text-[11px] text-mist-400">{c.source}{c.referredBy && ` · ${staff.find((s) => s.id === c.referredBy)?.name ?? ""}`}</p>
                          </div>
                        </div>
                        {c.hired && <Badge tone="brand">Hired</Badge>}
                      </div>
                      <Stars value={c.rating} onChange={(n) => rateCandidate(c.id, n)} />
                      <p className="mt-1.5 text-[11px] text-mist-400">Applied {timeAgo(c.appliedAt)}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {col.type === "Interview" && (
                          <button onClick={() => { setIvFor(c.id); setIvf({ scheduledAt: "", interviewerIds: [], notes: "" }); }} className="btn-ghost px-2 py-1 text-[11px]"><CalendarClock size={11} /> Interview</button>
                        )}
                        <button onClick={() => { setRejectFor(c.id); setRejectReason(""); }} className="btn-ghost px-2 py-1 text-[11px] text-action-600"><X size={11} /> Reject</button>
                        {col.type === "Hired" ? (
                          !c.hired && <button onClick={() => hire(c.id)} className="btn-primary px-2 py-1 text-[11px]"><UserCheck size={11} /> Hire &amp; onboard</button>
                        ) : (
                          nextCol && <button onClick={() => moveCandidate(c.id, nextCol.id)} className="btn-soft px-2 py-1 text-[11px]">{nextCol.name} <ArrowRight size={11} /></button>
                        )}
                      </div>
                    </div>
                  ))}
                  {inCol.length === 0 && <div className="card border-2 border-dashed border-mist-200 bg-transparent py-6 text-center text-xs text-mist-400 shadow-none">Empty</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="New job requisition"
        wide
        footer={<><Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
          <Button disabled={!rf.title.trim() || !rf.jobPositionId || !rf.startDate} onClick={() => { addRequisition({ ...rf, startDate: new Date(rf.startDate).toISOString(), managerIds: [] }); setReqOpen(false); }}>Create</Button></>}
      >
        <div className="space-y-4">
          <Field label="Title"><Input value={rf.title} onChange={(e) => setRf({ ...rf, title: e.target.value })} placeholder="e.g. Staff Nurse — Maternity Ward" /></Field>
          <Grid cols={3}>
            <Field label="Department"><Select value={rf.departmentId} onChange={(e) => setRf({ ...rf, departmentId: e.target.value, jobPositionId: "" })} options={departments.map((d) => ({ value: d.id, label: d.name }))} /></Field>
            <Field label="Job position"><Select value={rf.jobPositionId} onChange={(e) => setRf({ ...rf, jobPositionId: e.target.value })} options={[{ value: "", label: "Select…" }, ...positionsFor(rf.departmentId).map((p) => ({ value: p.id, label: p.name }))]} /></Field>
            <Field label="Vacancies"><Input type="number" value={rf.vacancy} onChange={(e) => setRf({ ...rf, vacancy: +e.target.value })} /></Field>
          </Grid>
          <Field label="Start date"><Input type="date" value={rf.startDate} onChange={(e) => setRf({ ...rf, startDate: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={rf.description} onChange={(e) => setRf({ ...rf, description: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={candOpen}
        onClose={() => setCandOpen(false)}
        title="Add candidate"
        footer={<><Button variant="ghost" onClick={() => setCandOpen(false)}>Cancel</Button>
          <Button disabled={!cf.name.trim() || !cf.email.trim()} onClick={() => { if (requisition) addCandidate({ requisitionId: requisition.id, name: cf.name.trim(), email: cf.email.trim(), phone: cf.phone.trim(), source: cf.source, referredBy: cf.referredBy || undefined }); setCandOpen(false); }}>Add</Button></>}
      >
        <div className="space-y-4">
          <Field label="Name"><Input value={cf.name} onChange={(e) => setCf({ ...cf, name: e.target.value })} /></Field>
          <Grid cols={2}>
            <Field label="Email"><Input value={cf.email} onChange={(e) => setCf({ ...cf, email: e.target.value })} /></Field>
            <Field label="Phone"><Input value={cf.phone} onChange={(e) => setCf({ ...cf, phone: e.target.value })} /></Field>
          </Grid>
          <Field label="Source"><Select value={cf.source} onChange={(e) => setCf({ ...cf, source: e.target.value as CandidateSource })} options={["Application", "Referral", "Inside software"]} /></Field>
          {cf.source === "Referral" && (
            <Field label="Referred by"><Select value={cf.referredBy} onChange={(e) => setCf({ ...cf, referredBy: e.target.value })} options={[{ value: "", label: "Select staff…" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} /></Field>
          )}
        </div>
      </Modal>

      <Modal
        open={!!rejectFor}
        onClose={() => setRejectFor(null)}
        title="Reject candidate"
        footer={<><Button variant="ghost" onClick={() => setRejectFor(null)}>Cancel</Button>
          <Button variant="action" disabled={!rejectReason} onClick={() => { if (rejectFor) rejectCandidate(rejectFor, rejectReason); setRejectFor(null); }}>Reject</Button></>}
      >
        <Field label="Reason"><Select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} options={["", "Overqualified", "Underqualified", "Failed practical test", "Salary mismatch", "Did not attend interview", "Position filled internally", "Other"].map((r) => ({ value: r, label: r || "Select a reason…" }))} /></Field>
      </Modal>

      <Modal
        open={!!ivFor}
        onClose={() => setIvFor(null)}
        title="Schedule interview"
        footer={<><Button variant="ghost" onClick={() => setIvFor(null)}>Cancel</Button>
          <Button disabled={!ivf.scheduledAt || ivf.interviewerIds.length === 0} onClick={() => { if (ivFor) scheduleInterview({ candidateId: ivFor, scheduledAt: new Date(ivf.scheduledAt).toISOString(), interviewerIds: ivf.interviewerIds, notes: ivf.notes || undefined }); setIvFor(null); }}>Schedule</Button></>}
      >
        <div className="space-y-4">
          <Field label="Date & time"><Input type="datetime-local" value={ivf.scheduledAt} onChange={(e) => setIvf({ ...ivf, scheduledAt: e.target.value })} /></Field>
          <Field label="Interviewer">
            <Select
              value={ivf.interviewerIds[0] ?? ""}
              onChange={(e) => setIvf({ ...ivf, interviewerIds: e.target.value ? [e.target.value] : [] })}
              options={[{ value: "", label: "Select staff…" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]}
            />
          </Field>
          <Field label="Notes"><Textarea value={ivf.notes} onChange={(e) => setIvf({ ...ivf, notes: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
