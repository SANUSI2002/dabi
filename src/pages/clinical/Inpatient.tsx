import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BedDouble, Plus, Crown, Pencil, PowerOff, Power, ArrowLeftRight, ClipboardList, Activity, Pill, ShieldAlert } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, SectionNote } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Checkbox, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { useEmr } from "@/store/useEmr";
import { useWards } from "@/store/useWards";
import { useNursing } from "@/store/useNursing";
import { useHr } from "@/store/useHr";
import { useIdentity } from "@/store/useIdentity";
import { useMasterData } from "@/platform/useMasterData";
import { INPATIENT_SERVICES, DISCHARGE_OUTCOMES, type Admission } from "@/data/types";
import { MOBILITY_OPTIONS, RISK_LEVELS } from "@/data/nursing";
import { dateTime, shortDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/cn";

const lengthOfStayDays = (admission: Admission) =>
  Math.max(0, Math.round((Date.now() - new Date(admission.admittedAt).getTime()) / 86400000));

export default function Inpatient() {
  const emr = useEmr();
  const { admissions, patientById, encounters, admit, dischargeWithSummary, transferBed, setDischargeReady } = emr;
  const { wards, beds, addWard, updateWard, addBed, setBedVip, setBedActive } = useWards();
  const nursing = useNursing();
  const clinicians = useHr((state) => state.staff).filter((staff) => staff.status === "Active" && staff.role === "Medical Officer");
  const currentUser = useIdentity((state) => state.user.name);
  const masterData = useMasterData((state) => state.data);
  const wardTypeOptions = useMemo(() => {
    const items = (masterData["ward-types"] ?? []).filter((item) => item.active).map((item) => item.label);
    return items.length ? items : ["General Ward", "Maternity Ward"];
  }, [masterData]);

  const active = admissions.filter((admission) => admission.status === "Active");
  const activeBeds = beds.filter((bed) => bed.active);
  const bedOccupied = (wardName: string, label: string) => active.some((admission) => admission.ward === wardName && admission.bed === label);

  const firstFreeBed = (wardName: string) => {
    const ward = wards.find((entry) => entry.name === wardName);
    return ward ? beds.find((bed) => bed.wardId === ward.id && bed.active && !bedOccupied(ward.name, bed.label))?.label ?? "" : "";
  };
  const [admitOpen, setAdmitOpen] = useState(false);
  const defaultAdmitWard = wards[1]?.name ?? wards[0]?.name ?? "";
  const [admitForm, setAdmitForm] = useState({ patientId: "", ward: defaultAdmitWard, bed: firstFreeBed(defaultAdmitWard), diagnosis: "", service: INPATIENT_SERVICES[0] as string, clinician: clinicians[0]?.name ?? currentUser, reason: "", isolation: "", expectedDischarge: "" });

  function openAdmit() {
    setAdmitForm({ patientId: "", ward: defaultAdmitWard, bed: firstFreeBed(defaultAdmitWard), diagnosis: "", service: INPATIENT_SERVICES[0], clinician: clinicians[0]?.name ?? currentUser, reason: "", isolation: "", expectedDischarge: "" });
    setAdmitOpen(true);
  }
  const [detailId, setDetailId] = useState<string | null>(null);
  const [dischargeId, setDischargeId] = useState<string | null>(null);
  const [dischargeForm, setDischargeForm] = useState({ outcome: DISCHARGE_OUTCOMES[0] as string, summary: "", destination: "" });
  const [transferFor, setTransferFor] = useState<string | null>(null);
  const [transferForm, setTransferForm] = useState({ ward: "", bed: "", reason: "" });

  const [censusWard, setCensusWard] = useState("All");
  const [censusService, setCensusService] = useState("All");
  const [censusReady, setCensusReady] = useState<"all" | "ready" | "not-ready">("all");

  const [flowsheetId, setFlowsheetId] = useState<string | null>(active[0]?.id ?? null);
  const [obsForm, setObsForm] = useState({ temp: "", pulse: "", resp: "", bp: "", spo2: "", painScore: "", intakeMl: "", outputMl: "", mobility: "", fallsRisk: "", pressureRisk: "", note: "" });
  const [marId, setMarId] = useState<string | null>(active[0]?.id ?? null);
  const [doseAction, setDoseAction] = useState<{ admission: Admission; slot: { slotKey: string; prescriptionId: string; drug: string; dose: string; route: string; scheduledFor: string }; status: "held" | "refused" | "omitted" } | null>(null);
  const [doseReason, setDoseReason] = useState("");

  const [wardModal, setWardModal] = useState<{ id: string; name: string; type: string } | null>(null);
  const [bedForWard, setBedForWard] = useState<string | null>(null);
  const [newBedLabel, setNewBedLabel] = useState("");
  const [manageBed, setManageBed] = useState<string | null>(null);
  const managedBed = beds.find((bed) => bed.id === manageBed);

  const census = active.filter((admission) =>
    (censusWard === "All" || admission.ward === censusWard) &&
    (censusService === "All" || admission.service === censusService) &&
    (censusReady === "all" || (censusReady === "ready" ? admission.dischargeReady : !admission.dischargeReady)),
  );

  const detail = admissions.find((admission) => admission.id === detailId);
  const prescriptionsFor = (patientId: string) =>
    encounters.filter((encounter) => encounter.patientId === patientId).flatMap((encounter) => encounter.prescriptions);

  const flowsheetAdmission = active.find((admission) => admission.id === flowsheetId);
  const marAdmission = active.find((admission) => admission.id === marId);
  const marSlots = marAdmission ? nursing.marFor(marAdmission, prescriptionsFor(marAdmission.patientId)) : [];
  const dueDoses = active.flatMap((admission) =>
    nursing.marFor(admission, prescriptionsFor(admission.patientId)).filter((slot) => slot.status === "due"),
  );
  const noRecentObs = active.filter((admission) => {
    const latest = nursing.observationsFor(admission.id)[0];
    return !latest || Date.now() - new Date(latest.recordedAt).getTime() > 6 * 3600000;
  });

  function submitObservation() {
    if (!flowsheetAdmission) return;
    const parseNumber = (value: string) => (value.trim() === "" ? undefined : Number(value));
    nursing.addObservation({
      admissionId: flowsheetAdmission.id,
      patientId: flowsheetAdmission.patientId,
      temp: parseNumber(obsForm.temp),
      pulse: parseNumber(obsForm.pulse),
      resp: parseNumber(obsForm.resp),
      bp: obsForm.bp.trim() || undefined,
      spo2: parseNumber(obsForm.spo2),
      painScore: parseNumber(obsForm.painScore),
      intakeMl: parseNumber(obsForm.intakeMl),
      outputMl: parseNumber(obsForm.outputMl),
      mobility: obsForm.mobility || undefined,
      fallsRisk: (obsForm.fallsRisk || undefined) as never,
      pressureRisk: (obsForm.pressureRisk || undefined) as never,
      note: obsForm.note.trim() || undefined,
    });
    setObsForm({ temp: "", pulse: "", resp: "", bp: "", spo2: "", painScore: "", intakeMl: "", outputMl: "", mobility: "", fallsRisk: "", pressureRisk: "", note: "" });
  }

  return (
    <div>
      <PageHeader
        title="In-patient care"
        subtitle={`${active.length} on the ward · ${activeBeds.length - active.length} beds free`}
        actions={<Button onClick={openAdmit}><Plus size={15} /> Admit patient</Button>}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="On the ward" value={active.length} tone="brand" icon={<BedDouble size={18} />} />
        <StatCard label="Beds free" value={activeBeds.length - active.length} tone="mist" delay={0.05} />
        <StatCard label="Ready for discharge" value={active.filter((admission) => admission.dischargeReady).length} tone="amber" delay={0.1} />
        <StatCard label="Doses due now" value={dueDoses.length} tone={dueDoses.length ? "action" : "mist"} delay={0.15} icon={<Pill size={18} />} />
      </div>

      <Tabs tabs={["Ward census", "Nursing flowsheet", "Medication administration", "Handover", "Bed board", "Discharges"]} label="In-patient work">
        {(tab) =>
          tab === "Ward census" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={censusWard} onChange={(event) => setCensusWard(event.target.value)} options={["All", ...wards.map((ward) => ward.name)]} className="h-9 w-auto py-0 text-sm" />
                <Select value={censusService} onChange={(event) => setCensusService(event.target.value)} options={["All", ...INPATIENT_SERVICES]} className="h-9 w-auto py-0 text-sm" />
                <Select value={censusReady} onChange={(event) => setCensusReady(event.target.value as never)} options={[{ value: "all", label: "Any discharge status" }, { value: "ready", label: "Ready for discharge" }, { value: "not-ready", label: "Not ready" }]} className="h-9 w-auto py-0 text-sm" />
              </div>
              <Table columns={["Patient", "Ward / bed", "Service", "Attending", "Admitting diagnosis", "LOS", "Discharge", ""]} caption="Ward census">
                {census.length === 0 && <EmptyRow colSpan={8}>{active.length === 0 ? "No patients are currently admitted." : "No admissions match these filters."}</EmptyRow>}
                {census.map((admission, index) => {
                  const patient = patientById(admission.patientId);
                  return (
                    <Row key={admission.id} index={index} onClick={() => setDetailId(admission.id)}>
                      <Cell className="font-semibold">
                        {patient ? `${patient.firstName} ${patient.lastName}` : "—"}
                        {admission.isolation && <Badge tone="action">{admission.isolation}</Badge>}
                      </Cell>
                      <Cell>{admission.ward} · {admission.bed}</Cell>
                      <Cell className="text-mist-500">{admission.service ?? "—"}</Cell>
                      <Cell className="text-mist-500">{admission.admittingClinician ?? "—"}</Cell>
                      <Cell>{admission.diagnosis}</Cell>
                      <Cell>{lengthOfStayDays(admission)} d</Cell>
                      <Cell>{admission.dischargeReady ? <Badge tone="amber">Ready</Badge> : <span className="text-mist-300">—</span>}</Cell>
                      <Cell><span className="text-xs text-brand-600">Open</span></Cell>
                    </Row>
                  );
                })}
              </Table>
            </div>
          ) : tab === "Nursing flowsheet" ? (
            <div className="space-y-4">
              <Select value={flowsheetId ?? ""} onChange={(event) => setFlowsheetId(event.target.value || null)} options={[{ value: "", label: "Select an admitted patient…" }, ...active.map((admission) => ({ value: admission.id, label: `${patientById(admission.patientId)?.firstName} ${patientById(admission.patientId)?.lastName} · ${admission.ward} ${admission.bed}` }))]} className="max-w-md" />
              {!flowsheetAdmission ? (
                <SectionNote>Select an admitted patient to record and review nursing observations.</SectionNote>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
                  <div className="card space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Record observations</p>
                    <Grid cols={2}>
                      <Field label="Temp °C"><Input value={obsForm.temp} onChange={(event) => setObsForm({ ...obsForm, temp: event.target.value })} /></Field>
                      <Field label="Pulse"><Input value={obsForm.pulse} onChange={(event) => setObsForm({ ...obsForm, pulse: event.target.value })} /></Field>
                      <Field label="Resp"><Input value={obsForm.resp} onChange={(event) => setObsForm({ ...obsForm, resp: event.target.value })} /></Field>
                      <Field label="BP"><Input value={obsForm.bp} onChange={(event) => setObsForm({ ...obsForm, bp: event.target.value })} placeholder="120/80" /></Field>
                      <Field label="SpO₂ %"><Input value={obsForm.spo2} onChange={(event) => setObsForm({ ...obsForm, spo2: event.target.value })} /></Field>
                      <Field label="Pain (0-10)"><Input value={obsForm.painScore} onChange={(event) => setObsForm({ ...obsForm, painScore: event.target.value })} /></Field>
                      <Field label="Intake mL"><Input value={obsForm.intakeMl} onChange={(event) => setObsForm({ ...obsForm, intakeMl: event.target.value })} /></Field>
                      <Field label="Output mL"><Input value={obsForm.outputMl} onChange={(event) => setObsForm({ ...obsForm, outputMl: event.target.value })} /></Field>
                    </Grid>
                    <Field label="Mobility"><Select value={obsForm.mobility} onChange={(event) => setObsForm({ ...obsForm, mobility: event.target.value })} options={["", ...MOBILITY_OPTIONS]} /></Field>
                    <Grid cols={2}>
                      <Field label="Falls risk"><Select value={obsForm.fallsRisk} onChange={(event) => setObsForm({ ...obsForm, fallsRisk: event.target.value })} options={["", ...RISK_LEVELS.map(String)]} /></Field>
                      <Field label="Pressure-injury risk"><Select value={obsForm.pressureRisk} onChange={(event) => setObsForm({ ...obsForm, pressureRisk: event.target.value })} options={["", ...RISK_LEVELS.map(String)]} /></Field>
                    </Grid>
                    <Field label="Nursing note"><Textarea value={obsForm.note} onChange={(event) => setObsForm({ ...obsForm, note: event.target.value })} className="min-h-[60px]" /></Field>
                    <Button className="w-full" onClick={submitObservation}>Save observations</Button>
                  </div>
                  <div className="card p-0">
                    <p className="border-b border-mist-100 px-4 py-2.5 text-sm font-bold text-mist-700">Flowsheet — most recent first</p>
                    <Table columns={["Recorded", "Temp", "Pulse", "Resp", "BP", "SpO₂", "Pain", "In/Out", "Risks", "By"]}>
                      {nursing.observationsFor(flowsheetAdmission.id).length === 0 && <EmptyRow colSpan={10}>No observations recorded this admission.</EmptyRow>}
                      {nursing.observationsFor(flowsheetAdmission.id).map((observation, index) => (
                        <Row key={observation.id} index={index}>
                          <Cell className="text-mist-400">{dateTime(observation.recordedAt)}</Cell>
                          <Cell>{observation.temp ?? "—"}</Cell>
                          <Cell>{observation.pulse ?? "—"}</Cell>
                          <Cell>{observation.resp ?? "—"}</Cell>
                          <Cell>{observation.bp ?? "—"}</Cell>
                          <Cell>{observation.spo2 ? `${observation.spo2}%` : "—"}</Cell>
                          <Cell>{observation.painScore ?? "—"}</Cell>
                          <Cell>{observation.intakeMl ?? "—"} / {observation.outputMl ?? "—"}</Cell>
                          <Cell>
                            {observation.fallsRisk && <Badge tone={observation.fallsRisk === "High" ? "action" : "mist"}>Falls {observation.fallsRisk}</Badge>}
                            {observation.pressureRisk && <Badge tone={observation.pressureRisk === "High" ? "action" : "mist"}>Skin {observation.pressureRisk}</Badge>}
                          </Cell>
                          <Cell className="text-mist-500">{observation.recordedBy}</Cell>
                        </Row>
                      ))}
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : tab === "Medication administration" ? (
            <div className="space-y-4">
              <Select value={marId ?? ""} onChange={(event) => setMarId(event.target.value || null)} options={[{ value: "", label: "Select an admitted patient…" }, ...active.map((admission) => ({ value: admission.id, label: `${patientById(admission.patientId)?.firstName} ${patientById(admission.patientId)?.lastName} · ${admission.ward} ${admission.bed}` }))]} className="max-w-md" />
              {!marAdmission ? (
                <SectionNote>Select an admitted patient to view their medication administration record.</SectionNote>
              ) : marSlots.length === 0 ? (
                <SectionNote tone="unavailable">No dispensed regular medications for this admission — the MAR is generated from dispensed prescriptions and their frequency. PRN medicines and anything not yet dispensed do not appear here.</SectionNote>
              ) : (
                <Table columns={["Scheduled", "Medication", "Dose / route", "Status", "Given by", ""]} caption="Medication administration record">
                  {marSlots.map((slot) => (
                    <Row key={slot.slotKey}>
                      <Cell className={slot.status === "due" ? "font-semibold text-action-600" : "text-mist-400"}>
                        {dateTime(slot.scheduledFor)}
                        {slot.slotKey.endsWith(":prn") && <span className="ml-1 text-[11px]">PRN</span>}
                      </Cell>
                      <Cell className="font-medium">{slot.drug}</Cell>
                      <Cell className="text-mist-500">{slot.dose} · {slot.route}</Cell>
                      <Cell><ClinicalStatusBadge kind="admin" status={slot.status} />{slot.reason && <p className="text-[11px] text-mist-400">{slot.reason}</p>}</Cell>
                      <Cell className="text-mist-500">{slot.administeredBy ?? "—"}{slot.administeredAt ? <span className="block text-[11px] text-mist-400">{timeAgo(slot.administeredAt)}</span> : null}</Cell>
                      <Cell>
                        {["scheduled", "due"].includes(slot.status) && (
                          <div className="flex justify-end gap-1">
                            <button className="btn-primary px-2 py-1 text-xs" onClick={() => nursing.recordDose(marAdmission, slot, "given")}>Give</button>
                            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setDoseReason(""); setDoseAction({ admission: marAdmission, slot, status: "held" }); }}>Hold</button>
                            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setDoseReason(""); setDoseAction({ admission: marAdmission, slot, status: "refused" }); }}>Refused</button>
                            <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { setDoseReason(""); setDoseAction({ admission: marAdmission, slot, status: "omitted" }); }}>Omit</button>
                          </div>
                        )}
                      </Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </div>
          ) : tab === "Handover" ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="card">
                <p className="mb-2 flex items-center gap-1.5 font-display font-bold text-mist-900"><ClipboardList size={15} /> Outstanding tasks</p>
                {dueDoses.length === 0 && noRecentObs.length === 0 ? (
                  <SectionNote>Nothing outstanding.</SectionNote>
                ) : (
                  <ul className="space-y-1.5 text-sm text-mist-600">
                    {dueDoses.slice(0, 8).map((slot) => (
                      <li key={slot.slotKey}>Dose due — {slot.drug} {slot.dose} ({dateTime(slot.scheduledFor)})</li>
                    ))}
                    {noRecentObs.map((admission) => (
                      <li key={admission.id} className="text-amber-700">Observations overdue — {patientById(admission.patientId)?.firstName} {patientById(admission.patientId)?.lastName} ({admission.ward} {admission.bed})</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card">
                <p className="mb-2 flex items-center gap-1.5 font-display font-bold text-mist-900"><Activity size={15} /> Recent events</p>
                <ul className="space-y-1.5 text-sm text-mist-600">
                  {[...active]
                    .flatMap((admission) => [
                      { at: admission.admittedAt, text: `Admitted — ${patientById(admission.patientId)?.firstName} ${patientById(admission.patientId)?.lastName} to ${admission.ward}` },
                      ...(admission.bedHistory ?? []).slice(1).map((move) => ({ at: move.from, text: `Bed move — ${move.ward} ${move.bed}${move.reason ? ` (${move.reason})` : ""}` })),
                    ])
                    .sort((left, right) => +new Date(right.at) - +new Date(left.at))
                    .slice(0, 8)
                    .map((event, index) => (
                      <li key={index}>{event.text} <span className="text-[11px] text-mist-400">· {timeAgo(event.at)}</span></li>
                    ))}
                  {active.length === 0 && <li className="text-mist-400">No admissions.</li>}
                </ul>
              </div>
              <div className="card">
                <p className="mb-2 flex items-center gap-1.5 font-display font-bold text-mist-900"><ShieldAlert size={15} /> Risks &amp; discharge</p>
                <ul className="space-y-1.5 text-sm text-mist-600">
                  {active.filter((admission) => admission.dischargeReady).map((admission) => (
                    <li key={admission.id} className="text-amber-700">Ready for discharge — {patientById(admission.patientId)?.firstName} {patientById(admission.patientId)?.lastName}</li>
                  ))}
                  {active.filter((admission) => admission.isolation).map((admission) => (
                    <li key={admission.id} className="text-action-700">{admission.isolation} — {patientById(admission.patientId)?.firstName} {patientById(admission.patientId)?.lastName} ({admission.ward} {admission.bed})</li>
                  ))}
                  {active.every((admission) => !admission.dischargeReady && !admission.isolation) && <li className="text-mist-400">No flagged risks.</li>}
                </ul>
              </div>
            </div>
          ) : tab === "Bed board" ? (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button variant="soft" onClick={() => setWardModal({ id: "", name: "", type: wardTypeOptions[0] })}><Plus size={14} /> Add ward</Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {wards.map((ward) => {
                  const wardBeds = beds.filter((bed) => bed.wardId === ward.id);
                  return (
                    <div key={ward.id} className="card">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-display font-bold text-mist-900">{ward.name}</h3>
                        <div className="flex items-center gap-1.5">
                          <Badge tone="mist">{ward.type}</Badge>
                          <button onClick={() => setWardModal({ id: ward.id, name: ward.name, type: ward.type })} className="btn-ghost px-2 py-1 text-xs"><Pencil size={12} /></button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {wardBeds.map((bed) => {
                          const occupant = active.find((admission) => admission.ward === ward.name && admission.bed === bed.label);
                          return (
                            <button
                              key={bed.id}
                              onClick={() => (occupant ? setDetailId(occupant.id) : setManageBed(bed.id))}
                              className={cn(
                                "relative rounded-xl p-2 text-center text-[11px] font-semibold ring-1 transition hover:opacity-80",
                                !bed.active ? "bg-mist-100 text-mist-400 ring-mist-200 line-through"
                                  : occupant?.isolation ? "bg-action-100 text-action-800 ring-action-300"
                                  : occupant ? "bg-action-50 text-action-700 ring-action-200"
                                  : "bg-brand-50 text-brand-700 ring-brand-200",
                              )}
                            >
                              {bed.isVip && <Crown size={11} className="absolute right-1 top-1 text-amber-500" aria-hidden />}
                              {bed.label}
                              <span className="block font-normal">
                                {!bed.active ? "Retired" : occupant ? (occupant.isolation ? "Isolation" : "Occupied") : "Available"}
                              </span>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => { setBedForWard(ward.id); setNewBedLabel(`Bed ${wardBeds.length + 1}`); }}
                          className="grid place-items-center rounded-xl border border-dashed border-mist-300 p-2 text-mist-400 hover:border-brand-400 hover:text-brand-600"
                          aria-label={`Add a bed to ${ward.name}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <Table columns={["Patient", "Ward", "Admitted", "Discharged", "LOS", "Outcome", "Destination"]} caption="Discharge history">
              {admissions.filter((admission) => admission.status === "Discharged").length === 0 && <EmptyRow colSpan={7}>No discharges recorded.</EmptyRow>}
              {admissions.filter((admission) => admission.status === "Discharged").map((admission, index) => {
                const patient = patientById(admission.patientId);
                return (
                  <Row key={admission.id} index={index}>
                    <Cell className="font-semibold">{patient ? `${patient.firstName} ${patient.lastName}` : "—"}</Cell>
                    <Cell>{admission.ward}</Cell>
                    <Cell className="text-mist-400">{shortDate(admission.admittedAt)}</Cell>
                    <Cell className="text-mist-400">{admission.dischargedAt ? shortDate(admission.dischargedAt) : "—"}</Cell>
                    <Cell>{lengthOfStayDays({ ...admission, admittedAt: admission.admittedAt })} d</Cell>
                    <Cell><Badge tone={admission.outcome === "Died" ? "action" : "brand"}>{admission.outcome}</Badge></Cell>
                    <Cell className="text-mist-500">{admission.dischargeDestination ?? "—"}</Cell>
                  </Row>
                );
              })}
            </Table>
          )
        }
      </Tabs>

      {/* Admit */}
      <Modal
        open={admitOpen}
        onClose={() => setAdmitOpen(false)}
        title="Admit patient"
        wide
        footer={<><Button variant="ghost" onClick={() => setAdmitOpen(false)}>Cancel</Button>
          <Button
            disabled={!admitForm.patientId || !admitForm.diagnosis.trim() || !admitForm.bed}
            onClick={() => {
              admit(admitForm.patientId, admitForm.ward, admitForm.bed, admitForm.diagnosis.trim(), {
                admittingClinician: admitForm.clinician,
                service: admitForm.service,
                reason: admitForm.reason.trim() || undefined,
                isolation: admitForm.isolation.trim() || undefined,
                expectedDischarge: admitForm.expectedDischarge || undefined,
              });
              setAdmitOpen(false);
            }}
          >
            Admit patient
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient"><PatientPicker value={admitForm.patientId} onChange={(id) => setAdmitForm({ ...admitForm, patientId: id })} /></Field>
          <Grid cols={2}>
            <Field label="Ward">
              <Select
                value={admitForm.ward}
                onChange={(event) => {
                  const ward = wards.find((entry) => entry.name === event.target.value);
                  const firstFree = ward && beds.find((bed) => bed.wardId === ward.id && bed.active && !bedOccupied(ward.name, bed.label));
                  setAdmitForm({ ...admitForm, ward: event.target.value, bed: firstFree?.label ?? "" });
                }}
                options={wards.map((ward) => ward.name)}
              />
            </Field>
            <Field label="Bed">
              <Select
                value={admitForm.bed}
                onChange={(event) => setAdmitForm({ ...admitForm, bed: event.target.value })}
                options={(() => {
                  const ward = wards.find((entry) => entry.name === admitForm.ward);
                  const free = ward ? beds.filter((bed) => bed.wardId === ward.id && bed.active && !bedOccupied(ward.name, bed.label)) : [];
                  return free.length ? free.map((bed) => ({ value: bed.label, label: bed.isVip ? `${bed.label} · VIP` : bed.label })) : [{ value: "", label: "No free beds in this ward" }];
                })()}
              />
            </Field>
            <Field label="Service"><Select value={admitForm.service} onChange={(event) => setAdmitForm({ ...admitForm, service: event.target.value })} options={[...INPATIENT_SERVICES]} /></Field>
            <Field label="Admitting clinician"><Select value={admitForm.clinician} onChange={(event) => setAdmitForm({ ...admitForm, clinician: event.target.value })} options={clinicians.length ? clinicians.map((clinician) => clinician.name) : [currentUser]} /></Field>
            <Field label="Isolation / precautions"><Input value={admitForm.isolation} onChange={(event) => setAdmitForm({ ...admitForm, isolation: event.target.value })} placeholder="e.g. Contact isolation" /></Field>
            <Field label="Expected discharge"><Input type="date" value={admitForm.expectedDischarge} onChange={(event) => setAdmitForm({ ...admitForm, expectedDischarge: event.target.value })} /></Field>
          </Grid>
          <Field label="Admitting diagnosis"><Input value={admitForm.diagnosis} onChange={(event) => setAdmitForm({ ...admitForm, diagnosis: event.target.value })} /></Field>
          <Field label="Reason for admission"><Textarea value={admitForm.reason} onChange={(event) => setAdmitForm({ ...admitForm, reason: event.target.value })} placeholder="Clinical details supporting admission…" /></Field>
        </div>
      </Modal>

      {/* Admission detail */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? `${patientById(detail.patientId)?.firstName} ${patientById(detail.patientId)?.lastName} — ${detail.ward} ${detail.bed}` : ""}
        wide
        footer={detail && detail.status === "Active" ? (
          <>
            <Button variant="ghost" onClick={() => setDetailId(null)}>Close</Button>
            <Button variant="soft" onClick={() => { setTransferForm({ ward: detail.ward, bed: "", reason: "" }); setTransferFor(detail.id); }}><ArrowLeftRight size={14} /> Transfer bed</Button>
            <Button variant="ghost" onClick={() => setDischargeReady(detail.id, !detail.dischargeReady)}>{detail.dischargeReady ? "Unmark discharge-ready" : "Mark discharge-ready"}</Button>
            <Button variant="action" onClick={() => { setDischargeForm({ outcome: DISCHARGE_OUTCOMES[0], summary: "", destination: "" }); setDischargeId(detail.id); }}>Discharge</Button>
          </>
        ) : <Button onClick={() => setDetailId(null)}>Close</Button>}
      >
        {detail && (
          <div className="space-y-3 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <p><span className="text-mist-400">Admitted</span> {dateTime(detail.admittedAt)} ({lengthOfStayDays(detail)} d)</p>
              <p><span className="text-mist-400">Attending</span> {detail.admittingClinician ?? "—"}</p>
              <p><span className="text-mist-400">Service</span> {detail.service ?? "—"}</p>
              <p><span className="text-mist-400">Expected discharge</span> {detail.expectedDischarge ? shortDate(detail.expectedDischarge) : "—"}</p>
              <p className="sm:col-span-2"><span className="text-mist-400">Diagnosis</span> {detail.diagnosis}</p>
              {detail.reason && <p className="sm:col-span-2"><span className="text-mist-400">Reason</span> {detail.reason}</p>}
              {detail.isolation && <p className="sm:col-span-2"><Badge tone="action">{detail.isolation}</Badge></p>}
            </div>
            {detail.bedHistory && detail.bedHistory.length > 1 && (
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase text-mist-400">Bed history</p>
                <ol className="space-y-0.5 text-xs text-mist-500">
                  {detail.bedHistory.map((move, index) => (
                    <li key={index}>{move.ward} · {move.bed} — from {dateTime(move.from)}{move.reason ? ` (${move.reason})` : ""}</li>
                  ))}
                </ol>
              </div>
            )}
            <p className="text-xs"><Link to={`/patients/${detail.patientId}`} className="text-brand-600 underline">Open full patient chart</Link></p>
          </div>
        )}
      </Modal>

      {/* Discharge with summary */}
      <Modal
        open={Boolean(dischargeId)}
        onClose={() => setDischargeId(null)}
        title="Discharge patient"
        footer={<><Button variant="ghost" onClick={() => setDischargeId(null)}>Cancel</Button>
          <Button
            variant="action"
            disabled={!dischargeForm.summary.trim()}
            onClick={() => {
              if (dischargeId) dischargeWithSummary(dischargeId, { outcome: dischargeForm.outcome, summary: dischargeForm.summary.trim(), destination: dischargeForm.destination.trim() || undefined });
              setDischargeId(null);
              setDetailId(null);
            }}
          >
            Confirm discharge
          </Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Outcome"><Select value={dischargeForm.outcome} onChange={(event) => setDischargeForm({ ...dischargeForm, outcome: event.target.value })} options={[...DISCHARGE_OUTCOMES]} /></Field>
            <Field label="Discharged to"><Input value={dischargeForm.destination} onChange={(event) => setDischargeForm({ ...dischargeForm, destination: event.target.value })} placeholder="Home / referral facility" /></Field>
          </Grid>
          <Field label="Discharge summary *" hint="Diagnosis, treatment given, condition at discharge, medications, follow-up.">
            <Textarea value={dischargeForm.summary} onChange={(event) => setDischargeForm({ ...dischargeForm, summary: event.target.value })} className="min-h-[140px]" />
          </Field>
        </div>
      </Modal>

      {/* Transfer bed */}
      <Modal
        open={Boolean(transferFor)}
        onClose={() => setTransferFor(null)}
        title="Transfer patient to another bed"
        footer={<><Button variant="ghost" onClick={() => setTransferFor(null)}>Cancel</Button>
          <Button
            disabled={!transferForm.bed}
            onClick={() => { if (transferFor) transferBed(transferFor, transferForm.ward, transferForm.bed, transferForm.reason.trim() || "Ward routine"); setTransferFor(null); }}
          >
            Move patient
          </Button></>}
      >
        <div className="space-y-4">
          <Grid cols={2}>
            <Field label="Ward"><Select value={transferForm.ward} onChange={(event) => setTransferForm({ ...transferForm, ward: event.target.value, bed: "" })} options={wards.map((ward) => ward.name)} /></Field>
            <Field label="Bed">
              <Select
                value={transferForm.bed}
                onChange={(event) => setTransferForm({ ...transferForm, bed: event.target.value })}
                options={(() => {
                  const ward = wards.find((entry) => entry.name === transferForm.ward);
                  const free = ward ? beds.filter((bed) => bed.wardId === ward.id && bed.active && !bedOccupied(ward.name, bed.label)) : [];
                  return free.length ? free.map((bed) => bed.label) : [{ value: "", label: "No free beds" }];
                })()}
              />
            </Field>
          </Grid>
          <Field label="Reason"><Input value={transferForm.reason} onChange={(event) => setTransferForm({ ...transferForm, reason: event.target.value })} placeholder="e.g. Step-down, isolation, bed management" /></Field>
        </div>
      </Modal>

      {/* Dose action reason */}
      <Modal
        open={Boolean(doseAction)}
        onClose={() => setDoseAction(null)}
        title={doseAction ? `Record dose as ${doseAction.status}` : ""}
        footer={<><Button variant="ghost" onClick={() => setDoseAction(null)}>Cancel</Button>
          <Button
            disabled={!doseReason.trim()}
            onClick={() => {
              if (doseAction) nursing.recordDose(doseAction.admission, doseAction.slot, doseAction.status, doseReason.trim());
              setDoseAction(null);
            }}
          >
            Record
          </Button></>}
      >
        {doseAction && (
          <div className="space-y-3">
            <p className="text-sm text-mist-600">{doseAction.slot.drug} {doseAction.slot.dose} · scheduled {dateTime(doseAction.slot.scheduledFor)}</p>
            <Field label="Reason *"><Textarea value={doseReason} onChange={(event) => setDoseReason(event.target.value)} placeholder="Why the dose was not given as scheduled" /></Field>
          </div>
        )}
      </Modal>

      {/* Ward + bed management (unchanged) */}
      <Modal
        open={Boolean(wardModal)}
        onClose={() => setWardModal(null)}
        title={wardModal?.id ? "Edit ward" : "Add ward"}
        footer={<><Button variant="ghost" onClick={() => setWardModal(null)}>Cancel</Button>
          <Button
            disabled={!wardModal?.name.trim()}
            onClick={() => {
              if (!wardModal) return;
              if (wardModal.id) updateWard(wardModal.id, { name: wardModal.name.trim(), type: wardModal.type });
              else addWard(wardModal.name.trim(), wardModal.type);
              setWardModal(null);
            }}
          >
            {wardModal?.id ? "Save changes" : "Add ward"}
          </Button></>}
      >
        <div className="space-y-4">
          <Field label="Ward name"><Input value={wardModal?.name ?? ""} onChange={(event) => setWardModal((state) => (state ? { ...state, name: event.target.value } : state))} /></Field>
          <Field label="Type"><Select value={wardModal?.type ?? wardTypeOptions[0]} onChange={(event) => setWardModal((state) => (state ? { ...state, type: event.target.value } : state))} options={wardTypeOptions} /></Field>
        </div>
      </Modal>

      <Modal
        open={Boolean(bedForWard)}
        onClose={() => setBedForWard(null)}
        title="Add bed"
        footer={<><Button variant="ghost" onClick={() => setBedForWard(null)}>Cancel</Button>
          <Button disabled={!newBedLabel.trim()} onClick={() => { if (bedForWard) addBed(bedForWard, newBedLabel.trim()); setBedForWard(null); }}>Add bed</Button></>}
      >
        <Field label="Bed label"><Input value={newBedLabel} onChange={(event) => setNewBedLabel(event.target.value)} /></Field>
      </Modal>

      <Modal
        open={Boolean(manageBed)}
        onClose={() => setManageBed(null)}
        title={`Manage — ${managedBed?.label ?? ""}`}
        footer={<Button onClick={() => setManageBed(null)}>Done</Button>}
      >
        {managedBed && (
          <div className="space-y-4">
            <Checkbox label="VIP bed" checked={managedBed.isVip} onChange={(event) => setBedVip(managedBed.id, event.target.checked)} />
            {(() => {
              const ward = wards.find((entry) => entry.id === managedBed.wardId);
              const occupied = ward ? bedOccupied(ward.name, managedBed.label) : false;
              return managedBed.active ? (
                <Button variant="action" disabled={occupied} onClick={() => setBedActive(managedBed.id, false)}>
                  <PowerOff size={14} /> {occupied ? "Cannot retire — currently occupied" : "Retire this bed"}
                </Button>
              ) : (
                <Button onClick={() => setBedActive(managedBed.id, true)}><Power size={14} /> Reactivate this bed</Button>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
}
