import { useState } from "react";
import { Scissors, Plus, ShieldCheck, ClipboardCheck } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid, Checkbox } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { Provenance } from "@/components/clinical/Provenance";
import { useProcedures } from "@/store/useProcedures";
import { useEmr } from "@/store/useEmr";
import { useHr } from "@/store/useHr";
import type { ProcedureRecord } from "@/data/procedures";
import { dateTime, shortDate } from "@/lib/format";

const PROCEDURE_NAMES = [
  "Incision and drainage", "Wound debridement", "Suturing / laceration repair", "IUCD insertion",
  "IUCD removal", "Implant insertion", "Implant removal", "Male circumcision", "Foreign body removal",
  "Excision of skin lesion", "Nasogastric tube insertion", "Urinary catheterisation",
];

export default function Procedures() {
  const { procedures, requestProcedure, scheduleProcedure, recordConsent, setChecklistItem, beginPreProcedure, performProcedure, moveToRecovery, setFollowUp, signNote, amendNote, cancelProcedure } = useProcedures();
  const { patientById } = useEmr();
  const clinicians = useHr((state) => state.staff).filter((staff) => staff.status === "Active" && staff.role === "Medical Officer");
  const nurses = useHr((state) => state.staff).filter((staff) => staff.status === "Active" && staff.role === "Nurse");

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ patientId: "", name: PROCEDURE_NAMES[0], indication: "", bodySite: "", laterality: "N/A" as ProcedureRecord["laterality"], priority: "Routine" as ProcedureRecord["priority"] });
  const [detailId, setDetailId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ date: "", performer: clinicians[0]?.name ?? "", assistants: [] as string[] });
  const [consentBy, setConsentBy] = useState("");
  const [performForm, setPerformForm] = useState({ anaesthesia: "", device: "", complications: "", outcome: "", findings: "", specimenSentToLab: false });
  const [recoveryNotes, setRecoveryNotes] = useState("");
  const [followUpPlan, setFollowUpPlan] = useState("");
  const [amendmentNote, setAmendmentNote] = useState("");
  const [cancelReason, setCancelReason] = useState<string | null>(null);

  const detail = procedures.find((procedure) => procedure.id === detailId) ?? null;
  const scheduled = procedures.filter((procedure) => ["Requested", "Scheduled", "Consented", "Pre-procedure"].includes(procedure.status));
  const inRecovery = procedures.filter((procedure) => ["Performed", "Recovery", "Follow-up"].includes(procedure.status));

  function openDetail(procedure: ProcedureRecord) {
    setScheduleForm({ date: procedure.scheduledFor?.slice(0, 10) ?? "", performer: procedure.performer ?? clinicians[0]?.name ?? "", assistants: procedure.assistants ?? [] });
    setConsentBy(procedure.consentObtainedBy ?? "");
    setPerformForm({ anaesthesia: procedure.anaesthesia ?? "", device: procedure.device ?? "", complications: procedure.complications ?? "", outcome: procedure.outcome ?? "", findings: procedure.findings ?? "", specimenSentToLab: procedure.specimenSentToLab ?? false });
    setRecoveryNotes(procedure.recoveryNotes ?? "");
    setFollowUpPlan(procedure.followUpPlan ?? "");
    setAmendmentNote("");
    setDetailId(procedure.id);
  }

  const renderTable = (list: ProcedureRecord[], caption: string) => (
    <Table columns={["Patient", "Procedure", "Site", "Priority", "Requested", "Status", ""]} caption={caption}>
      {list.length === 0 && <EmptyRow colSpan={7}>Nothing here.</EmptyRow>}
      {list.map((procedure, index) => {
        const patient = patientById(procedure.patientId);
        return (
          <Row key={procedure.id} index={index} onClick={() => openDetail(procedure)}>
            <Cell><PatientLink patient={patient} /></Cell>
            <Cell className="font-medium">{procedure.name}</Cell>
            <Cell className="text-mist-500">{procedure.bodySite ?? "—"}{procedure.laterality && procedure.laterality !== "N/A" ? ` (${procedure.laterality})` : ""}</Cell>
            <Cell><Badge tone={procedure.priority === "Routine" ? "mist" : "action"}>{procedure.priority}</Badge></Cell>
            <Cell className="text-mist-400">{shortDate(procedure.requestedAt)}</Cell>
            <Cell><ClinicalStatusBadge kind="procedure" status={procedure.status} /></Cell>
            <Cell><span className="text-xs text-brand-600">Open</span></Cell>
          </Row>
        );
      })}
    </Table>
  );

  return (
    <div>
      <PageHeader
        title="Procedures"
        subtitle="Minor / outpatient procedures performed at this facility — request through to signed note"
        actions={<Button onClick={() => { setRequestForm({ patientId: "", name: PROCEDURE_NAMES[0], indication: "", bodySite: "", laterality: "N/A", priority: "Routine" }); setRequestOpen(true); }}><Plus size={15} /> Request procedure</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Awaiting / scheduled" value={scheduled.length} tone="amber" icon={<Scissors size={18} />} />
        <StatCard label="Recovery / follow-up" value={inRecovery.length} tone="brand" delay={0.05} />
        <StatCard label="Unsigned notes" value={procedures.filter((procedure) => procedure.status === "Performed" && !procedure.noteSigned).length} tone="action" delay={0.1} />
        <StatCard label="All procedures" value={procedures.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Procedure schedule", "Recovery & follow-up", "All procedures"]} label="Procedures">
        {(tab) =>
          tab === "Procedure schedule" ? renderTable(scheduled, "Requested, scheduled, consented and pre-procedure cases")
          : tab === "Recovery & follow-up" ? renderTable(inRecovery, "Performed, recovery and follow-up cases")
          : renderTable(procedures, "All procedures")
        }
      </Tabs>

      {/* Request */}
      <Modal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        title="Request procedure"
        wide
        footer={<><Button variant="ghost" onClick={() => setRequestOpen(false)}>Cancel</Button>
          <Button disabled={!requestForm.patientId || !requestForm.indication.trim()} onClick={() => { requestProcedure(requestForm); setRequestOpen(false); }}>Request</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={requestForm.patientId} onChange={(id) => setRequestForm({ ...requestForm, patientId: id })} /></Field>
          <Grid cols={2}>
            <Field label="Procedure"><Input list="procedure-names" value={requestForm.name} onChange={(event) => setRequestForm({ ...requestForm, name: event.target.value })} />
              <datalist id="procedure-names">{PROCEDURE_NAMES.map((name) => <option key={name} value={name} />)}</datalist>
            </Field>
            <Field label="Priority"><Select value={requestForm.priority} onChange={(event) => setRequestForm({ ...requestForm, priority: event.target.value as never })} options={["Routine", "Urgent", "Emergency"]} /></Field>
            <Field label="Body site"><Input value={requestForm.bodySite} onChange={(event) => setRequestForm({ ...requestForm, bodySite: event.target.value })} /></Field>
            <Field label="Laterality"><Select value={requestForm.laterality} onChange={(event) => setRequestForm({ ...requestForm, laterality: event.target.value as never })} options={["N/A", "Left", "Right", "Bilateral"]} /></Field>
          </Grid>
          <Field label="Indication"><Textarea value={requestForm.indication} onChange={(event) => setRequestForm({ ...requestForm, indication: event.target.value })} /></Field>
        </div>
      </Modal>

      {/* Detail / lifecycle */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? `${detail.name} — ${patientById(detail.patientId)?.firstName} ${patientById(detail.patientId)?.lastName}` : ""}
        wide
        footer={<Button variant="ghost" onClick={() => setDetailId(null)}>Close</Button>}
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ClinicalStatusBadge kind="procedure" status={detail.status} />
              <Badge tone={detail.priority === "Routine" ? "mist" : "action"}>{detail.priority}</Badge>
              {detail.laterality && detail.laterality !== "N/A" && <Badge tone="mist">{detail.laterality}</Badge>}
            </div>
            <p className="text-sm text-mist-600"><b>Indication:</b> {detail.indication}</p>
            <Provenance info={{ author: detail.requestedBy, recordedAt: detail.requestedAt, source: "Procedure request" }} />

            {detail.status === "Requested" && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Schedule</p>
                <Grid cols={2}>
                  <Field label="Date"><Input type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm({ ...scheduleForm, date: event.target.value })} /></Field>
                  <Field label="Performer"><Select value={scheduleForm.performer} onChange={(event) => setScheduleForm({ ...scheduleForm, performer: event.target.value })} options={clinicians.length ? clinicians.map((clinician) => clinician.name) : ["—"]} /></Field>
                </Grid>
                <div className="mt-2">
                  <p className="label mb-1">Assistants</p>
                  <div className="flex flex-wrap gap-1.5">
                    {nurses.map((nurse) => {
                      const on = scheduleForm.assistants.includes(nurse.name);
                      return (
                        <button key={nurse.id} type="button" aria-pressed={on} onClick={() => setScheduleForm({ ...scheduleForm, assistants: on ? scheduleForm.assistants.filter((name) => name !== nurse.name) : [...scheduleForm.assistants, nurse.name] })} className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${on ? "bg-brand-gradient text-white ring-transparent" : "bg-white text-mist-500 ring-mist-200"}`}>
                          {nurse.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <Button className="mt-3" disabled={!scheduleForm.date} onClick={() => scheduleProcedure(detail.id, new Date(scheduleForm.date).toISOString(), scheduleForm.performer, scheduleForm.assistants)}>Schedule</Button>
              </div>
            )}

            {detail.status === "Scheduled" && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Consent</p>
                <Field label="Consent obtained by"><Select value={consentBy} onChange={(event) => setConsentBy(event.target.value)} options={["", ...clinicians.map((clinician) => clinician.name), ...nurses.map((nurse) => nurse.name)]} /></Field>
                <Button className="mt-3" disabled={!consentBy} onClick={() => recordConsent(detail.id, consentBy)}><ShieldCheck size={14} /> Record consent</Button>
              </div>
            )}

            {(detail.status === "Consented" || detail.status === "Pre-procedure") && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase text-mist-400"><ClipboardCheck size={13} /> Safety checklist</p>
                {(["Sign In", "Time Out", "Sign Out"] as const).map((phase) => (
                  <div key={phase} className="mb-3">
                    <p className="mb-1 text-[11px] font-bold uppercase text-mist-400">{phase}</p>
                    <div className="space-y-1">
                      {detail.checklist.filter((item) => item.phase === phase).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 text-sm ring-1 ring-mist-200">
                          <Checkbox label={item.label} checked={item.completed} onChange={(event) => setChecklistItem(detail.id, item.id, event.target.checked)} />
                          {!item.completed && (
                            <input
                              className="input h-7 w-40 text-xs"
                              placeholder="Exception reason"
                              value={item.exceptionReason ?? ""}
                              onChange={(event) => setChecklistItem(detail.id, item.id, false, event.target.value)}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {detail.status === "Consented" && <Button onClick={() => beginPreProcedure(detail.id)}>Move to pre-procedure</Button>}
              </div>
            )}

            {detail.status === "Pre-procedure" && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Perform procedure</p>
                <Grid cols={2}>
                  <Field label="Anaesthesia"><Input value={performForm.anaesthesia} onChange={(event) => setPerformForm({ ...performForm, anaesthesia: event.target.value })} /></Field>
                  <Field label="Device / equipment"><Input value={performForm.device} onChange={(event) => setPerformForm({ ...performForm, device: event.target.value })} /></Field>
                </Grid>
                <Field label="Findings"><Textarea value={performForm.findings} onChange={(event) => setPerformForm({ ...performForm, findings: event.target.value })} /></Field>
                <Field label="Complications"><Input value={performForm.complications} onChange={(event) => setPerformForm({ ...performForm, complications: event.target.value })} placeholder="None" /></Field>
                <Field label="Outcome *"><Textarea value={performForm.outcome} onChange={(event) => setPerformForm({ ...performForm, outcome: event.target.value })} /></Field>
                <Checkbox label="Specimen sent to laboratory" checked={performForm.specimenSentToLab} onChange={(event) => setPerformForm({ ...performForm, specimenSentToLab: event.target.checked })} />
                <Button className="mt-3" disabled={!performForm.outcome.trim()} onClick={() => performProcedure(detail.id, performForm)}>Mark performed</Button>
              </div>
            )}

            {detail.status === "Performed" && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Recovery</p>
                <Field label="Recovery notes"><Textarea value={recoveryNotes} onChange={(event) => setRecoveryNotes(event.target.value)} /></Field>
                <Button className="mt-2" disabled={!recoveryNotes.trim()} onClick={() => moveToRecovery(detail.id, recoveryNotes)}>Move to recovery</Button>
              </div>
            )}

            {detail.status === "Recovery" && (
              <div className="rounded-xl bg-mist-50 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Follow-up plan</p>
                <Field label="Plan"><Textarea value={followUpPlan} onChange={(event) => setFollowUpPlan(event.target.value)} /></Field>
                <Button className="mt-2" disabled={!followUpPlan.trim()} onClick={() => setFollowUp(detail.id, followUpPlan)}>Set follow-up</Button>
              </div>
            )}

            {(detail.status === "Performed" || detail.status === "Recovery" || detail.status === "Follow-up") && (
              <div className="rounded-xl border border-mist-200 p-4">
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Procedure note</p>
                <div className="space-y-1 text-sm text-mist-600">
                  <p><b>Outcome:</b> {detail.outcome ?? "—"}</p>
                  <p><b>Findings:</b> {detail.findings ?? "—"}</p>
                  <p><b>Complications:</b> {detail.complications ?? "—"}</p>
                  {detail.recoveryNotes && <p><b>Recovery:</b> {detail.recoveryNotes}</p>}
                  {detail.followUpPlan && <p><b>Follow-up:</b> {detail.followUpPlan}</p>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <ClinicalStatusBadge kind="note" status={detail.noteSigned ? "signed" : "saved"} />
                  {detail.noteSignedBy && <span className="text-[11px] text-mist-400">{detail.noteSignedBy} · {dateTime(detail.noteSignedAt!)}</span>}
                  {!detail.noteSigned && <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => signNote(detail.id)}>Sign note</Button>}
                </div>
                {detail.amendments && detail.amendments.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-mist-100 pt-2 text-[11px] text-mist-500">
                    {detail.amendments.map((amendment, index) => (
                      <p key={index}>Amended by {amendment.by} · {dateTime(amendment.at)} — {amendment.note}</p>
                    ))}
                  </div>
                )}
                {detail.noteSigned && (
                  <div className="mt-2 flex gap-2">
                    <Input className="h-8 text-xs" placeholder="Amendment note" value={amendmentNote} onChange={(event) => setAmendmentNote(event.target.value)} />
                    <Button variant="ghost" className="px-2.5 py-1 text-xs" disabled={!amendmentNote.trim()} onClick={() => { amendNote(detail.id, amendmentNote.trim()); setAmendmentNote(""); }}>Add amendment</Button>
                  </div>
                )}
              </div>
            )}

            {!["Performed", "Recovery", "Follow-up", "Cancelled"].includes(detail.status) && (
              cancelReason !== null ? (
                <div className="rounded-xl border border-action-200 bg-action-50/50 p-3">
                  <Field label="Reason for cancelling"><Input value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></Field>
                  <div className="mt-2 flex gap-2">
                    <Button variant="action" disabled={!cancelReason.trim()} onClick={() => { cancelProcedure(detail.id, cancelReason.trim()); setCancelReason(null); setDetailId(null); }}>Confirm cancel</Button>
                    <Button variant="ghost" onClick={() => setCancelReason(null)}>Back</Button>
                  </div>
                </div>
              ) : (
                <button className="text-xs text-action-600 underline" onClick={() => setCancelReason("")}>Cancel this procedure</button>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
