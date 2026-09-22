import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Pill, FlaskConical, ClipboardList, ShieldAlert, FileSignature, Plus, Trash2,
  Users, Stethoscope, TriangleAlert, RotateCcw, Info,
} from "lucide-react";
import { PageHeader, Button, Badge, EmptyState, SectionNote } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Checkbox, Grid } from "@/components/ui/form";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { DrugField } from "@/components/clinical/DrugField";
import { WardRoundBanner } from "@/components/clinical/WardRoundBanner";
import { VitalTrend, type VitalReading } from "@/components/clinical/VitalTrend";
import { PhysicalExaminationCard } from "@/components/clinical/PhysicalExaminationCard";
import { useEmr, prescriptionsForPatient } from "@/store/useEmr";
import { useNursing } from "@/store/useNursing";
import { useClinical } from "@/store/useClinical";
import { useRadiology } from "@/store/useRadiology";
import { useWardRound, buildSummary, type MedicationChangeInput } from "@/store/useWardRound";
import {
  CLINICAL_PROGRESS_OPTIONS, PARTICIPANT_ROLES, PLAN_TASK_TYPES, DISCHARGE_BARRIER_OPTIONS,
  EXAMINATION_SYSTEMS, type MedicationChangeAction, type PhysicalExaminationSystem, type ExaminationSystemKey,
  type ClinicalDevice,
} from "@/data/wardRound";
import type { Prescription } from "@/data/types";
import { dateTime, timeAgo } from "@/lib/format";

const FOCUSED_EXAM_SYSTEMS: ExaminationSystemKey[] = ["general", "cardiovascular", "respiratory", "neurological", "abdominal", "musculoskeletal", "other"];

const ACTIVE_RX_STATUSES: Prescription["status"][] = ["Pending", "Dispensed", "Partially Dispensed"];
const INACTIVE_RX_STATUSES: Prescription["status"][] = ["Held", "Stopped", "Replaced"];

const MEDICATION_ACTIONS: { action: MedicationChangeAction; label: string }[] = [
  { action: "DOSE_INCREASED", label: "Increase dose" },
  { action: "DOSE_DECREASED", label: "Decrease dose" },
  { action: "FREQUENCY_CHANGED", label: "Change frequency" },
  { action: "ROUTE_CHANGED", label: "Change route" },
  { action: "REPLACED", label: "Replace" },
  { action: "HELD", label: "Hold" },
  { action: "STOPPED", label: "Stop" },
];

const DEVICE_KINDS: ClinicalDevice["kind"][] = ["IV cannula", "Central line", "Urinary catheter", "NG tube", "Drain", "Chest tube", "Oxygen device", "Other"];

function emptyExamSystems(): PhysicalExaminationSystem[] {
  return FOCUSED_EXAM_SYSTEMS.map((key) => ({ system: key, status: "Not Examined" as const }));
}

export default function WardRound() {
  const { admissionId, roundId: routeRoundId } = useParams();
  const navigate = useNavigate();
  const emr = useEmr();
  const nursing = useNursing();
  const clinical = useClinical();
  const radiology = useRadiology();
  const wr = useWardRound();

  const admission = emr.admissions.find((a) => a.id === admissionId);
  const patient = emr.patientById(admission?.patientId);

  const [roundId, setRoundId] = useState<string | null>(routeRoundId ?? null);
  const startedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!admission || !patient) return;
    if (routeRoundId) {
      // opened from history — show that specific (already signed) round, never mint a new one
      setRoundId(routeRoundId);
      return;
    }
    if (startedForRef.current === admission.id) return;
    startedForRef.current = admission.id;
    const draft = wr.roundsFor(admission.id).find((r) => r.status === "draft");
    setRoundId(draft ? draft.id : wr.startRound(admission, patient));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admission?.id, patient?.id, routeRoundId]);

  const round = roundId ? wr.roundById(roundId) : undefined;
  const readOnly = round ? round.status !== "draft" : false;

  const [examSystems, setExamSystems] = useState<PhysicalExaminationSystem[]>(emptyExamSystems());
  useEffect(() => {
    if (!round) return;
    const existing = wr.examinationFor(round.examinationId);
    setExamSystems(existing ? existing.systems : emptyExamSystems());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round?.id, round?.examinationId]);

  const [medAction, setMedAction] = useState<{ target: Prescription; action: MedicationChangeAction } | null>(null);
  const [medForm, setMedForm] = useState({ newDose: "", newFrequency: "", newRoute: "", reason: "", clinicalNote: "", monitoringRequired: "" });
  const [medError, setMedError] = useState("");

  const [addMedOpen, setAddMedOpen] = useState(false);
  const [addMedForm, setAddMedForm] = useState({
    drug: "", dose: "", frequency: "BD", duration: "5 days", qty: 0, route: "Oral", indication: "",
    specialInstructions: "", monitoringInstructions: "", prn: false, prnIndication: "", priority: "Routine" as Prescription["priority"],
  });

  const [participantForm, setParticipantForm] = useState({ role: PARTICIPANT_ROLES[0], name: "" });
  const [deviceForm, setDeviceForm] = useState({ kind: DEVICE_KINDS[0], label: "" });
  const [taskForm, setTaskForm] = useState({ type: PLAN_TASK_TYPES[0], description: "", assignedTo: "", priority: "Routine" as const, dueAt: "" });
  const [problemForm, setProblemForm] = useState({ problem: "", status: "Improving", update: "", plan: "" });
  const [amendmentNote, setAmendmentNote] = useState("");
  const [signError, setSignError] = useState("");
  const [trendOpen, setTrendOpen] = useState(false);

  if (!admission || !patient) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          variant="error"
          title="Admission not found"
          hint="This ward round link does not match an active admission."
          action={<Link to="/inpatient" className="btn-primary">Back to in-patient care</Link>}
        />
      </div>
    );
  }

  if (!round) {
    return <div className="pt-10 text-center text-mist-400">Preparing ward round workspace…</div>;
  }

  const previousRound = wr.roundsFor(admission.id).find((r) => r.id !== round.id && r.status !== "draft");
  const observations = nursing.observationsFor(admission.id);
  const latestObs = observations[0];
  const activeProblems = clinical.conditionsFor(patient.id).filter((c) => c.category === "problem-list-item" && c.clinicalStatus === "active");
  const labs = emr.labOrders.filter((l) => l.patientId === patient.id && +new Date(l.orderedAt) >= +new Date(admission.admittedAt));
  const imaging = radiology.studiesFor(patient.id).filter((s) => +new Date(s.requestedAt) >= +new Date(admission.admittedAt));
  const allMeds = prescriptionsForPatient(emr.encounters, patient.id);
  const activeMeds = allMeds.filter((m) => ACTIVE_RX_STATUSES.includes(m.status));
  const inactiveMeds = allMeds.filter((m) => INACTIVE_RX_STATUSES.includes(m.status)).slice(0, 8);
  const medicationHistory = wr.medicationChangesFor(patient.id);

  const vitalReadings: VitalReading[] = observations.map((o) => ({
    at: o.recordedAt, by: o.recordedBy, bp: o.bp, temp: o.temp, pulse: o.pulse, resp: o.resp, spo2: o.spo2, painScore: o.painScore,
  }));

  const lastAdministered = (prescriptionId: string) =>
    nursing.administrations
      .filter((a) => a.prescriptionId === prescriptionId && a.status === "given")
      .sort((l, r) => +new Date(r.administeredAt ?? 0) - +new Date(l.administeredAt ?? 0))[0]?.administeredAt;

  const openMedAction = (target: Prescription, action: MedicationChangeAction) => {
    setMedError("");
    setMedForm({ newDose: target.dose, newFrequency: target.frequency, newRoute: target.route ?? "Oral", reason: "", clinicalNote: "", monitoringRequired: "" });
    setMedAction({ target, action });
  };

  const submitMedAction = () => {
    if (!medAction) return;
    const input: MedicationChangeInput = {
      patientId: patient.id,
      wardRoundId: round.id,
      encounterId: round.encounterId,
      target: medAction.target,
      action: medAction.action,
      newDose: ["DOSE_INCREASED", "DOSE_DECREASED"].includes(medAction.action) ? medForm.newDose : undefined,
      newFrequency: medAction.action === "FREQUENCY_CHANGED" ? medForm.newFrequency : undefined,
      newRoute: medAction.action === "ROUTE_CHANGED" ? medForm.newRoute : undefined,
      reason: medForm.reason.trim(),
      clinicalNote: medForm.clinicalNote.trim() || undefined,
      monitoringRequired: medForm.monitoringRequired.trim() || undefined,
    };
    const result = wr.changeMedication(input);
    if (!result.ok) { setMedError(result.error); return; }
    setMedAction(null);
  };

  const submitAddMedication = () => {
    if (!addMedForm.drug.trim() || !addMedForm.dose.trim()) return;
    wr.addMedication({
      patientId: patient.id,
      wardRoundId: round.id,
      encounterId: round.encounterId,
      drug: addMedForm.drug.trim(),
      dose: addMedForm.dose.trim(),
      frequency: addMedForm.frequency,
      duration: addMedForm.duration,
      qty: addMedForm.qty || 1,
      route: addMedForm.route,
      indication: addMedForm.indication.trim() || undefined,
      specialInstructions: addMedForm.specialInstructions.trim() || undefined,
      monitoringInstructions: addMedForm.monitoringInstructions.trim() || undefined,
      prn: addMedForm.prn,
      prnIndication: addMedForm.prn ? addMedForm.prnIndication.trim() || undefined : undefined,
      priority: addMedForm.priority,
    });
    setAddMedOpen(false);
    setAddMedForm({ drug: "", dose: "", frequency: "BD", duration: "5 days", qty: 0, route: "Oral", indication: "", specialInstructions: "", monitoringInstructions: "", prn: false, prnIndication: "", priority: "Routine" });
  };

  const safetyAlerts = addMedForm.drug.trim() ? wr.screenNewMedication(patient.id, addMedForm.drug.trim()) : [];

  const handleSign = () => {
    if (examSystems.some((s) => s.status !== "Not Examined")) {
      wr.recordExamination({ patientId: patient.id, encounterId: round.encounterId, wardRoundId: round.id, systems: examSystems });
    }
    const result = wr.sign(round.id);
    if (!result.ok) { setSignError(result.error); return; }
    setSignError("");
  };

  const summaryPreview = buildSummary(round);

  return (
    <div>
      <PageHeader
        title="Ward Round"
        subtitle={round.status === "draft" ? "In progress — not yet signed" : `${round.status === "signed" ? "Signed" : "Amended"} by ${round.signedBy} · ${round.signedAt ? dateTime(round.signedAt) : ""}`}
        actions={
          <div className="flex items-center gap-2">
            <ClinicalStatusBadge kind="note" status={round.status} />
            <Button variant="ghost" onClick={() => navigate("/inpatient")}><ArrowLeft size={15} /> Back to in-patient</Button>
          </div>
        }
      />

      <WardRoundBanner patient={patient} admission={admission} />

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl bg-mist-50 px-4 py-2.5 text-xs text-mist-500 ring-1 ring-mist-200">
        <Stethoscope size={13} />
        {round.roundDate} · {round.roundTime} · <span className="font-semibold text-mist-700">{round.clinicianName}</span> ({round.clinicianRole}
        {round.department ? ` · ${round.department}` : ""})
        <span className="ml-auto flex flex-wrap items-center gap-1">
          {round.participants.map((p) => (
            <Badge key={p.id} tone="mist">{p.name} · {p.role}</Badge>
          ))}
        </span>
      </div>

      {readOnly && (
        <SectionNote tone={round.status === "amended" ? "unavailable" : "empty"}>
          This ward round is {round.status} and is read-only. Use “Add amendment” in the Summary tab to append a correction — the original entry is preserved.
        </SectionNote>
      )}

      <Tabs
        tabs={["Overview", "Vitals & monitoring", "Investigations", "Medications", "Examination & safety", "Plan & discharge", "Summary & sign"]}
        label="Ward round sections"
      >
        {(tab) =>
          tab === "Overview" ? (
            <div className="space-y-4">
              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">MDT participants</p>
                <div className="flex flex-wrap gap-1.5">
                  {round.participants.map((p) => (
                    <span key={p.id} className="chip bg-mist-100 text-mist-600">
                      {p.name} · {p.role}
                      {!readOnly && (
                        <button className="ml-1 text-mist-400 hover:text-action-600" onClick={() => wr.removeParticipant(round.id, p.id)}>
                          <Trash2 size={11} />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
                {!readOnly && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Field label="Role"><Select value={participantForm.role} onChange={(e) => setParticipantForm({ ...participantForm, role: e.target.value as never })} options={[...PARTICIPANT_ROLES]} className="w-44" /></Field>
                    <Field label="Name"><Input value={participantForm.name} onChange={(e) => setParticipantForm({ ...participantForm, name: e.target.value })} className="w-56" /></Field>
                    <Button
                      variant="soft"
                      onClick={() => { if (participantForm.name.trim()) { wr.addParticipant(round.id, participantForm.role, participantForm.name.trim()); setParticipantForm({ role: PARTICIPANT_ROLES[0], name: "" }); } }}
                    >
                      <Plus size={14} /> Add
                    </Button>
                  </div>
                )}
              </div>

              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Clinical overview</p>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <p><span className="text-mist-400">Reason for admission</span> {admission.reason ?? "—"}</p>
                  <p><span className="text-mist-400">Admitting diagnosis</span> {admission.diagnosis}</p>
                </div>
                {previousRound && (
                  <div className="mt-3 rounded-xl bg-mist-50 p-3 text-sm">
                    <p className="text-[11px] font-bold uppercase text-mist-400">Previous round — {previousRound.roundDate} ({previousRound.clinicianName})</p>
                    <p className="text-mist-600">{previousRound.progressNote || "No progress note recorded."}</p>
                  </div>
                )}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Clinical progress since last review">
                    <Select
                      disabled={readOnly}
                      value={round.clinicalProgress}
                      onChange={(e) => wr.updateDraft(round.id, { clinicalProgress: e.target.value as never })}
                      options={[{ value: "", label: "Select…" }, ...CLINICAL_PROGRESS_OPTIONS]}
                    />
                  </Field>
                </div>
                <Field label="Clinical development / progress note *" hint="Becomes part of the permanent record.">
                  <Textarea disabled={readOnly} value={round.progressNote} onChange={(e) => wr.updateDraft(round.id, { progressNote: e.target.value })} className="min-h-[100px]" />
                </Field>
              </div>

              <div className="card">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400">
                  <Users size={13} /> Active problem list (chart)
                </p>
                {activeProblems.length === 0 ? (
                  <SectionNote>No active problems recorded on the chart.</SectionNote>
                ) : (
                  <ul className="space-y-1 text-sm text-mist-600">
                    {activeProblems.map((p) => <li key={p.id}>{p.code.display}</li>)}
                  </ul>
                )}
              </div>
            </div>
          ) : tab === "Vitals & monitoring" ? (
            <div className="space-y-4">
              <div className="card">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Most recent vital signs</p>
                  <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => setTrendOpen(true)}>View vital trend</Button>
                </div>
                {!latestObs ? (
                  <SectionNote tone="unavailable">No nursing observations recorded for this admission yet.</SectionNote>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {([
                        ["BP", latestObs.bp],
                        ["Pulse", latestObs.pulse && `${latestObs.pulse} bpm`],
                        ["Resp", latestObs.resp && `${latestObs.resp} /min`],
                        ["Temp", latestObs.temp && `${latestObs.temp}°C`],
                        ["SpO₂", latestObs.spo2 && `${latestObs.spo2}%`],
                        ["Pain", latestObs.painScore !== undefined && `${latestObs.painScore}/10`],
                        ["O₂ device", latestObs.o2Device],
                        ["AVPU / GCS", latestObs.avpu ?? (latestObs.gcs ? `GCS ${latestObs.gcs}` : undefined)],
                      ] as const)
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k} className="rounded-xl bg-mist-50 p-2.5">
                            <p className="text-[11px] font-bold uppercase text-mist-400">{k}</p>
                            <p className="font-display text-lg font-bold text-mist-900">{v}</p>
                          </div>
                        ))}
                    </div>
                    <p className="mt-2 text-[11px] text-mist-400">
                      Recorded by {latestObs.recordedBy} · {dateTime(latestObs.recordedAt)} · <span className="font-semibold">{timeAgo(latestObs.recordedAt)}</span>
                    </p>
                  </>
                )}
              </div>

              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Fluid balance (latest)</p>
                {!latestObs?.intakeMl && !latestObs?.outputMl ? (
                  <SectionNote>No intake/output recorded.</SectionNote>
                ) : (
                  <p className="text-sm text-mist-600">Intake {latestObs.intakeMl ?? "—"} mL · Output {latestObs.outputMl ?? "—"} mL</p>
                )}
              </div>

              <div className="card">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Active devices / lines</p>
                </div>
                <div className="space-y-1.5">
                  {round.devices.length === 0 && <SectionNote>No devices recorded for this round.</SectionNote>}
                  {round.devices.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-lg bg-mist-50 px-3 py-2 text-sm">
                      <span>{d.kind}{d.label ? ` — ${d.label}` : ""}{d.insertedAt ? ` · inserted ${dateTime(d.insertedAt)}` : ""}</span>
                      {!readOnly && <button onClick={() => wr.removeDevice(round.id, d.id)} className="text-action-500 hover:text-action-700"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <div className="mt-3 flex flex-wrap items-end gap-2">
                    <Field label="Device"><Select value={deviceForm.kind} onChange={(e) => setDeviceForm({ ...deviceForm, kind: e.target.value as never })} options={[...DEVICE_KINDS]} className="w-48" /></Field>
                    <Field label="Label (optional)"><Input value={deviceForm.label} onChange={(e) => setDeviceForm({ ...deviceForm, label: e.target.value })} className="w-48" /></Field>
                    <Button variant="soft" onClick={() => { wr.addDevice(round.id, { kind: deviceForm.kind, label: deviceForm.label.trim() || undefined, insertedAt: new Date().toISOString() }); setDeviceForm({ kind: DEVICE_KINDS[0], label: "" }); }}>
                      <Plus size={14} /> Add device
                    </Button>
                  </div>
                )}
              </div>

              <VitalTrend open={trendOpen} onClose={() => setTrendOpen(false)} readings={vitalReadings} />
            </div>
          ) : tab === "Investigations" ? (
            <div className="space-y-4">
              <div className="card p-0">
                <p className="border-b border-mist-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-mist-400">
                  <FlaskConical size={13} className="mr-1 inline" /> Laboratory — since admission
                </p>
                <Table columns={["Test", "Ordered", "Status", "Result", "Flag"]}>
                  {labs.length === 0 && <EmptyRow colSpan={5}>No laboratory orders since admission.</EmptyRow>}
                  {labs.map((l) => (
                    <Row key={l.id}>
                      <Cell className="font-medium">{l.test}</Cell>
                      <Cell className="text-mist-400">{dateTime(l.orderedAt)}</Cell>
                      <Cell><ClinicalStatusBadge kind="result" status={l.status} /></Cell>
                      <Cell>{l.result ?? "—"}</Cell>
                      <Cell>{l.flag && l.flag !== "Normal" ? <Badge tone={l.flag === "Critical" ? "action" : "amber"}>{l.flag}</Badge> : "—"}</Cell>
                    </Row>
                  ))}
                </Table>
              </div>
              <div className="card p-0">
                <p className="border-b border-mist-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-mist-400">Imaging — since admission</p>
                <Table columns={["Study", "Body site", "Requested", "Status"]}>
                  {imaging.length === 0 && <EmptyRow colSpan={4}>No imaging requests since admission.</EmptyRow>}
                  {imaging.map((s) => (
                    <Row key={s.id}>
                      <Cell className="font-medium">{s.modality}</Cell>
                      <Cell>{s.bodySite}</Cell>
                      <Cell className="text-mist-400">{dateTime(s.requestedAt)}</Cell>
                      <Cell><ClinicalStatusBadge kind="imaging" status={s.status} /></Cell>
                    </Row>
                  ))}
                </Table>
              </div>
              <SectionNote>Results shown here are for clinical review only — the system highlights abnormal flags but does not interpret or diagnose.</SectionNote>
            </div>
          ) : tab === "Medications" ? (
            <div className="space-y-4">
              <div className="card p-0">
                <div className="flex items-center justify-between border-b border-mist-100 px-4 py-2.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><Pill size={13} /> Current medications</p>
                  {!readOnly && <Button variant="soft" className="px-2.5 py-1 text-xs" onClick={() => setAddMedOpen(true)}><Plus size={13} /> Add medication</Button>}
                </div>
                <Table columns={["Medication", "Dose / route", "Frequency", "Started", "Last given", "Prescribed by", "Status", readOnly ? "" : "Actions"]}>
                  {activeMeds.length === 0 && <EmptyRow colSpan={8}>No active medications recorded for this patient.</EmptyRow>}
                  {activeMeds.map((m) => {
                    const lastGiven = lastAdministered(m.id);
                    return (
                      <Row key={m.id}>
                        <Cell className="font-medium">{m.drug}{m.indication ? <span className="block text-[11px] text-mist-400">{m.indication}</span> : null}</Cell>
                        <Cell>{m.dose} · {m.route ?? "Oral"}</Cell>
                        <Cell>{m.frequency}</Cell>
                        <Cell className="text-mist-400">{m.startedAt ? dateTime(m.startedAt) : "—"}</Cell>
                        <Cell className="text-mist-400">{lastGiven ? timeAgo(lastGiven) : "—"}</Cell>
                        <Cell className="text-mist-500">{m.prescribedBy ?? "—"}</Cell>
                        <Cell><ClinicalStatusBadge kind="dispense" status={m.status} /></Cell>
                        {!readOnly && (
                          <Cell>
                            <div className="flex flex-wrap justify-end gap-1">
                              {MEDICATION_ACTIONS.map((a) => (
                                <button key={a.action} className="btn-ghost px-2 py-1 text-[11px]" onClick={() => openMedAction(m, a.action)}>
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </Cell>
                        )}
                      </Row>
                    );
                  })}
                </Table>
              </div>

              {inactiveMeds.length > 0 && (
                <div className="card p-0">
                  <p className="border-b border-mist-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-mist-400">Recently held / stopped</p>
                  <Table columns={["Medication", "Dose / route", "Status", ""]}>
                    {inactiveMeds.map((m) => (
                      <Row key={m.id}>
                        <Cell className="font-medium">{m.drug}</Cell>
                        <Cell>{m.dose} · {m.route ?? "Oral"}</Cell>
                        <Cell><ClinicalStatusBadge kind="dispense" status={m.status} /></Cell>
                        <Cell>{!readOnly && <button className="btn-ghost px-2 py-1 text-[11px]" onClick={() => openMedAction(m, "RESTARTED")}><RotateCcw size={11} className="mr-1 inline" />Restart</button>}</Cell>
                      </Row>
                    ))}
                  </Table>
                </div>
              )}

              <div className="card p-0">
                <p className="border-b border-mist-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-mist-400">Medication change history</p>
                <Table columns={["When", "Medication", "Action", "Change", "Reason", "By"]}>
                  {medicationHistory.length === 0 && <EmptyRow colSpan={6}>No medication changes recorded yet.</EmptyRow>}
                  {medicationHistory.map((c) => (
                    <Row key={c.id}>
                      <Cell className="text-mist-400">{dateTime(c.createdAt)}</Cell>
                      <Cell className="font-medium">{c.drug}</Cell>
                      <Cell>{c.action.replace(/_/g, " ").toLowerCase()}</Cell>
                      <Cell>
                        {c.previousDose || c.newDose ? `${c.previousDose ?? "—"} → ${c.newDose ?? "—"}` : ""}
                        {c.previousFrequency || c.newFrequency ? ` · ${c.previousFrequency ?? "—"} → ${c.newFrequency ?? "—"}` : ""}
                      </Cell>
                      <Cell className="text-mist-500">{c.reason}</Cell>
                      <Cell className="text-mist-500">{c.clinicianName}</Cell>
                    </Row>
                  ))}
                </Table>
              </div>

              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Medication safety review</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {([
                    ["medicationReconciliationReviewed", "Medication reconciliation reviewed"],
                    ["drugAllergiesReviewed", "Drug allergies reviewed"],
                    ["antibioticsReviewed", "Antibiotics reviewed"],
                    ["anticoagulationReviewed", "Anticoagulation reviewed"],
                    ["highRiskMedicinesReviewed", "High-risk medicines reviewed"],
                    ["prnMedicinesReviewed", "PRN medicines reviewed"],
                    ["ivMedicationReviewed", "IV medication reviewed"],
                    ["monitoringRequired", "Monitoring required"],
                    ["changesCommunicated", "Changes communicated to the team"],
                  ] as const).map(([key, label]) => (
                    <Checkbox
                      key={key}
                      label={label}
                      disabled={readOnly}
                      checked={round.safetyChecklist[key]}
                      onChange={(e) => wr.setSafetyChecklist(round.id, { [key]: e.target.checked })}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : tab === "Examination & safety" ? (
            <div className="space-y-4">
              <div className="card space-y-3">
                <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Focused physical examination</p>
                <p className="flex items-center gap-1.5 text-[11px] text-mist-400"><Info size={12} /> Full structured examination lives on the Consultation note — this is a focused, bedside review.</p>
                <div className="space-y-2">
                  {examSystems.map((entry) => (
                    <PhysicalExaminationCard
                      key={entry.system}
                      label={EXAMINATION_SYSTEMS.find((s) => s.key === entry.system)?.label ?? entry.system}
                      entry={entry}
                      readOnly={readOnly}
                      onChange={(next) => setExamSystems((current) => current.map((e) => (e.system === next.system ? next : e)))}
                    />
                  ))}
                </div>
              </div>

              <div className="card">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><ShieldAlert size={13} /> Clinical safety check</p>
                <SectionNote>Falls risk, VTE prophylaxis and pressure-injury status are tracked on the nursing flowsheet; use the notes below for anything requiring escalation this round.</SectionNote>
                <Field label="Escalation / ceiling of care plan" hint="Follows this hospital's escalation policy.">
                  <Textarea disabled={readOnly} value={round.escalationPlan ?? ""} onChange={(e) => wr.updateDraft(round.id, { escalationPlan: e.target.value })} />
                </Field>
              </div>
            </div>
          ) : tab === "Plan & discharge" ? (
            <div className="space-y-4">
              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Assessment — problems for this round</p>
                <div className="space-y-2">
                  {round.problems.length === 0 && <SectionNote>No problems added for this round yet.</SectionNote>}
                  {round.problems.map((p) => (
                    <div key={p.id} className="rounded-xl bg-mist-50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-mist-800">{p.problem} <span className="font-normal text-mist-400">— {p.status}</span></p>
                        {!readOnly && <button onClick={() => wr.removeProblem(round.id, p.id)} className="text-action-500 hover:text-action-700"><Trash2 size={13} /></button>}
                      </div>
                      {p.update && <p className="text-mist-600">{p.update}</p>}
                      {p.plan && <p className="text-mist-500"><span className="font-semibold">Plan:</span> {p.plan}</p>}
                    </div>
                  ))}
                </div>
                {!readOnly && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <Field label="Problem"><Input value={problemForm.problem} onChange={(e) => setProblemForm({ ...problemForm, problem: e.target.value })} /></Field>
                    <Field label="Status"><Input value={problemForm.status} onChange={(e) => setProblemForm({ ...problemForm, status: e.target.value })} placeholder="Improving / Uncontrolled" /></Field>
                    <Field label="Clinical update"><Textarea value={problemForm.update} onChange={(e) => setProblemForm({ ...problemForm, update: e.target.value })} /></Field>
                    <Field label="Plan"><Textarea value={problemForm.plan} onChange={(e) => setProblemForm({ ...problemForm, plan: e.target.value })} /></Field>
                    <div className="sm:col-span-2">
                      <Button
                        variant="soft"
                        onClick={() => { if (problemForm.problem.trim()) { wr.addProblem(round.id, problemForm); setProblemForm({ problem: "", status: "Improving", update: "", plan: "" }); } }}
                      >
                        <Plus size={14} /> Add problem
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-mist-400"><ClipboardList size={13} /> Plan / tasks</p>
                <Table columns={["Type", "Description", "Assigned to", "Priority", "Status", ""]}>
                  {round.tasks.length === 0 && <EmptyRow colSpan={6}>No plan items added yet.</EmptyRow>}
                  {round.tasks.map((t) => (
                    <Row key={t.id}>
                      <Cell>{t.type}</Cell>
                      <Cell>{t.description}</Cell>
                      <Cell className="text-mist-500">{t.assignedTo ?? "—"}</Cell>
                      <Cell><Badge tone={t.priority === "STAT" ? "action" : t.priority === "Urgent" ? "amber" : "mist"}>{t.priority}</Badge></Cell>
                      <Cell><ClinicalStatusBadge kind="task" status={t.status} /></Cell>
                      <Cell>
                        {!readOnly && (
                          <Select
                            value={t.status}
                            onChange={(e) => wr.setTaskStatus(round.id, t.id, e.target.value as never)}
                            options={["Pending", "In Progress", "Completed", "Cancelled"]}
                            className="h-8 w-auto py-0 text-xs"
                          />
                        )}
                      </Cell>
                    </Row>
                  ))}
                </Table>
                {!readOnly && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Type"><Select value={taskForm.type} onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value as never })} options={[...PLAN_TASK_TYPES]} /></Field>
                    <Field label="Description"><Input value={taskForm.description} onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })} /></Field>
                    <Field label="Assigned to"><Input value={taskForm.assignedTo} onChange={(e) => setTaskForm({ ...taskForm, assignedTo: e.target.value })} /></Field>
                    <Field label="Priority"><Select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as never })} options={["Routine", "Urgent", "STAT"]} /></Field>
                    <div className="lg:col-span-4">
                      <Button
                        variant="soft"
                        onClick={() => { if (taskForm.description.trim()) { wr.addTask(round.id, { ...taskForm, status: "Pending" }); setTaskForm({ type: PLAN_TASK_TYPES[0], description: "", assignedTo: "", priority: "Routine", dueAt: "" }); } }}
                      >
                        <Plus size={14} /> Add plan item
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Discharge readiness</p>
                <Grid cols={2}>
                  <Field label="Medically fit for discharge?">
                    <Select
                      disabled={readOnly}
                      value={round.dischargeReadiness.fit === null ? "" : round.dischargeReadiness.fit ? "yes" : "no"}
                      onChange={(e) => wr.setDischargeReadiness(round.id, { fit: e.target.value === "" ? null : e.target.value === "yes" })}
                      options={[{ value: "", label: "Not yet assessed" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                    />
                  </Field>
                  <Field label="Expected discharge date">
                    <Input disabled={readOnly} type="date" value={round.dischargeReadiness.expectedDate ?? ""} onChange={(e) => wr.setDischargeReadiness(round.id, { expectedDate: e.target.value })} />
                  </Field>
                </Grid>
                <Field label="Outstanding barriers">
                  <div className="flex flex-wrap gap-1.5">
                    {DISCHARGE_BARRIER_OPTIONS.map((barrier) => {
                      const on = round.dischargeReadiness.barriers.includes(barrier);
                      return (
                        <button
                          key={barrier}
                          disabled={readOnly}
                          onClick={() => wr.setDischargeReadiness(round.id, { barriers: on ? round.dischargeReadiness.barriers.filter((b) => b !== barrier) : [...round.dischargeReadiness.barriers, barrier] })}
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${on ? "bg-amber-50 text-amber-700 ring-amber-200" : "bg-white text-mist-500 ring-mist-200"}`}
                        >
                          {barrier}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label="Follow-up required"><Textarea disabled={readOnly} value={round.dischargeReadiness.followUp ?? ""} onChange={(e) => wr.setDischargeReadiness(round.id, { followUp: e.target.value })} /></Field>
              </div>

              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Patient / family communication</p>
                <Grid cols={2}>
                  <Field label="Patient updated"><Select disabled={readOnly} value={round.communication.patientUpdated === null ? "" : round.communication.patientUpdated ? "yes" : "no"} onChange={(e) => wr.setCommunication(round.id, { patientUpdated: e.target.value === "" ? null : e.target.value === "yes" })} options={[{ value: "", label: "—" }, { value: "yes", label: "Yes" }, { value: "no", label: "No" }]} /></Field>
                  <Field label="Caregiver updated"><Select disabled={readOnly} value={round.communication.caregiverUpdated ?? ""} onChange={(e) => wr.setCommunication(round.id, { caregiverUpdated: (e.target.value || null) as never })} options={[{ value: "", label: "—" }, "Yes", "No", "Not applicable"]} /></Field>
                </Grid>
                <Field label="Notes"><Textarea disabled={readOnly} value={round.communication.notes ?? ""} onChange={(e) => wr.setCommunication(round.id, { notes: e.target.value })} /></Field>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="card">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Ward round summary (preview)</p>
                <pre className="whitespace-pre-wrap rounded-xl bg-mist-50 p-4 text-sm text-mist-700">{round.summary || summaryPreview || "Nothing recorded yet."}</pre>
              </div>

              {round.status === "draft" ? (
                <div className="card">
                  {signError && (
                    <p className="mb-3 flex items-center gap-1.5 rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700"><TriangleAlert size={14} /> {signError}</p>
                  )}
                  <Button onClick={handleSign}><FileSignature size={15} /> Sign &amp; complete ward round</Button>
                </div>
              ) : (
                <div className="card space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Amendments</p>
                  {round.amendments.length === 0 && <SectionNote>No amendments recorded.</SectionNote>}
                  {round.amendments.map((a) => (
                    <div key={a.id} className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                      <p>{a.note}</p>
                      <p className="mt-1 text-[11px] text-amber-600">{a.by} · {dateTime(a.at)}</p>
                    </div>
                  ))}
                  <Field label="Add amendment"><Textarea value={amendmentNote} onChange={(e) => setAmendmentNote(e.target.value)} placeholder="Correction or addition to the signed record…" /></Field>
                  <Button
                    variant="soft"
                    disabled={!amendmentNote.trim()}
                    onClick={() => { const result = wr.addAmendment(round.id, amendmentNote.trim()); if (result.ok) setAmendmentNote(""); }}
                  >
                    Add amendment
                  </Button>
                </div>
              )}
            </div>
          )
        }
      </Tabs>

      {/* Medication change modal */}
      <Modal
        open={Boolean(medAction)}
        onClose={() => setMedAction(null)}
        title={medAction ? `${MEDICATION_ACTIONS.find((a) => a.action === medAction.action)?.label ?? "Modify"} — ${medAction.target.drug}` : ""}
        wide
        footer={<><Button variant="ghost" onClick={() => setMedAction(null)}>Cancel</Button><Button onClick={submitMedAction} disabled={!medForm.reason.trim()}>Confirm</Button></>}
      >
        {medAction && (
          <div className="space-y-3">
            <p className="text-sm text-mist-600">Current: {medAction.target.dose} · {medAction.target.frequency} · {medAction.target.route ?? "Oral"}</p>
            {medError && <p className="rounded-lg bg-action-50 px-3 py-2 text-sm text-action-700">{medError}</p>}
            {["DOSE_INCREASED", "DOSE_DECREASED"].includes(medAction.action) && (
              <Field label="New dose"><Input value={medForm.newDose} onChange={(e) => setMedForm({ ...medForm, newDose: e.target.value })} /></Field>
            )}
            {medAction.action === "FREQUENCY_CHANGED" && (
              <Field label="New frequency"><Input value={medForm.newFrequency} onChange={(e) => setMedForm({ ...medForm, newFrequency: e.target.value })} /></Field>
            )}
            {medAction.action === "ROUTE_CHANGED" && (
              <Field label="New route"><Input value={medForm.newRoute} onChange={(e) => setMedForm({ ...medForm, newRoute: e.target.value })} /></Field>
            )}
            <Field label="Reason *" hint="Required — preserved with the change record."><Textarea value={medForm.reason} onChange={(e) => setMedForm({ ...medForm, reason: e.target.value })} /></Field>
            <Field label="Clinical note (optional)"><Textarea value={medForm.clinicalNote} onChange={(e) => setMedForm({ ...medForm, clinicalNote: e.target.value })} /></Field>
            <Field label="Monitoring required (optional)"><Input value={medForm.monitoringRequired} onChange={(e) => setMedForm({ ...medForm, monitoringRequired: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      {/* Add medication modal */}
      <Modal
        open={addMedOpen}
        onClose={() => setAddMedOpen(false)}
        title="Add medication"
        wide
        footer={<><Button variant="ghost" onClick={() => setAddMedOpen(false)}>Cancel</Button><Button onClick={submitAddMedication} disabled={!addMedForm.drug.trim() || !addMedForm.dose.trim()}>Add medication</Button></>}
      >
        <div className="space-y-3">
          {safetyAlerts.length > 0 && (
            <div className="space-y-1.5">
              {safetyAlerts.map((alert, index) => (
                <p key={index} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm ${alert.severity === "high" ? "bg-action-50 text-action-700" : "bg-amber-50 text-amber-700"}`}>
                  <TriangleAlert size={14} /> {alert.message}
                </p>
              ))}
              <p className="text-[11px] text-mist-400">Warnings are informational only — the prescribing decision remains with the authorised clinician.</p>
            </div>
          )}
          <Grid cols={2}>
            <Field label="Drug"><DrugField value={addMedForm.drug} onChange={(v) => setAddMedForm({ ...addMedForm, drug: v })} /></Field>
            <Field label="Dose"><Input value={addMedForm.dose} onChange={(e) => setAddMedForm({ ...addMedForm, dose: e.target.value })} placeholder="e.g. 500mg" /></Field>
            <Field label="Route"><Input value={addMedForm.route} onChange={(e) => setAddMedForm({ ...addMedForm, route: e.target.value })} /></Field>
            <Field label="Frequency"><Input value={addMedForm.frequency} onChange={(e) => setAddMedForm({ ...addMedForm, frequency: e.target.value })} /></Field>
            <Field label="Duration"><Input value={addMedForm.duration} onChange={(e) => setAddMedForm({ ...addMedForm, duration: e.target.value })} /></Field>
            <Field label="Quantity"><Input type="number" value={addMedForm.qty || ""} onChange={(e) => setAddMedForm({ ...addMedForm, qty: Number(e.target.value) })} /></Field>
            <Field label="Priority"><Select value={addMedForm.priority} onChange={(e) => setAddMedForm({ ...addMedForm, priority: e.target.value as never })} options={["Routine", "Urgent", "STAT"]} /></Field>
            <Field label="Indication"><Input value={addMedForm.indication} onChange={(e) => setAddMedForm({ ...addMedForm, indication: e.target.value })} /></Field>
          </Grid>
          <Checkbox label="PRN (as required)" checked={addMedForm.prn} onChange={(e) => setAddMedForm({ ...addMedForm, prn: e.target.checked })} />
          {addMedForm.prn && <Field label="PRN indication / max frequency"><Input value={addMedForm.prnIndication} onChange={(e) => setAddMedForm({ ...addMedForm, prnIndication: e.target.value })} /></Field>}
          <Field label="Special instructions"><Textarea value={addMedForm.specialInstructions} onChange={(e) => setAddMedForm({ ...addMedForm, specialInstructions: e.target.value })} /></Field>
          <Field label="Monitoring instructions"><Textarea value={addMedForm.monitoringInstructions} onChange={(e) => setAddMedForm({ ...addMedForm, monitoringInstructions: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}
