import { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Printer, ListPlus, Receipt, CalendarPlus, Plus, FileText, ClipboardList,
} from "lucide-react";
import { Button, Badge, EmptyState, SectionNote, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Lines } from "@/components/ui/Chart";
import { PatientBanner } from "@/components/clinical/PatientBanner";
import { ClinicalTimeline, type TimelineItem } from "@/components/clinical/ClinicalTimeline";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { CodedValue } from "@/components/clinical/CodedValue";
import { Provenance } from "@/components/clinical/Provenance";
import { ConsolidatedEmrDoc, PatientCardDoc, PatientSummaryDoc } from "@/components/print/documents";
import { useEmr, serviceLine } from "@/store/useEmr";
import { useClinical, isActivityOverdue } from "@/store/useClinical";
import { DIAGNOSES, LAB_TESTS } from "@/data/catalog";
import {
  ALLERGEN_SNOMED, LAB_LOINC, VITAL_LOINC, icd11Concept, localConcept, type VitalKey,
} from "@/data/clinicalCoding";
import {
  ALLERGY_CATEGORIES, ALLERGY_CRITICALITY, REACTION_SEVERITIES, COMMON_MANIFESTATIONS,
  CONDITION_CLINICAL_STATUS, CONDITION_VERIFICATION_STATUS,
} from "@/data/clinical";
import { shortDate, dateTime, naira } from "@/lib/format";

const VITAL_LABELS: Record<VitalKey, string> = {
  bp: "Systolic BP", temp: "Temperature", pulse: "Pulse", resp: "Respiration",
  spo2: "SpO₂", weight: "Weight", height: "Height", muac: "MUAC", glucose: "Glucose",
};
const VITAL_REF: Partial<Record<VitalKey, { from: number; to: number }>> = {
  temp: { from: 36.1, to: 37.8 }, pulse: { from: 60, to: 100 }, resp: { from: 12, to: 20 },
  spo2: { from: 95, to: 100 }, glucose: { from: 3.9, to: 7.8 },
};

export default function PatientChart() {
  const { id } = useParams();
  const nav = useNavigate();
  const emr = useEmr();
  const clinical = useClinical();
  const patient = emr.patientById(id);
  const [doc, setDoc] = useState<"emr" | "card" | "summary" | null>(null);
  const [problemOpen, setProblemOpen] = useState(false);
  const [allergyOpen, setAllergyOpen] = useState(false);

  if (!patient) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          variant="error"
          title="Patient not found"
          hint="This file number does not match a patient in the registry."
          action={<Link to="/registration" className="btn-primary">Back to patient registry</Link>}
        />
      </div>
    );
  }

  const encounters = emr.encounters.filter((entry) => entry.patientId === patient.id);
  const labs = emr.labOrders.filter((entry) => entry.patientId === patient.id);
  const meds = encounters
    .flatMap((encounter) => encounter.prescriptions.map((prescription) => ({ ...prescription, date: encounter.date, encounterId: encounter.id })))
    .sort((left, right) => +new Date(right.date) - +new Date(left.date));
  const invoices = emr.invoices.filter((entry) => entry.patientId === patient.id);
  const appointments = emr.appointments.filter((entry) => entry.patientId === patient.id);
  const admissions = emr.admissions.filter((entry) => entry.patientId === patient.id);
  const transfers = emr.transfers.filter((entry) => entry.patientId === patient.id);
  const referrals = emr.referrals.filter((entry) => entry.patientId === patient.id);
  const immunizations = emr.immunizations.filter((entry) => entry.patientId === patient.id);
  const vitals = [...(emr.vitals[patient.id] ?? [])].sort((left, right) => +new Date(left.takenAt) - +new Date(right.takenAt));
  const conditions = clinical.conditionsFor(patient.id);
  const allergies = clinical.allergiesFor(patient);
  const carePlans = clinical.carePlansFor(patient.id);

  const activeProblems = conditions.filter((condition) => condition.clinicalStatus === "active" || condition.clinicalStatus === "recurrence" || condition.clinicalStatus === "relapse");
  const pastProblems = conditions.filter((condition) => !activeProblems.includes(condition));
  const balance = invoices
    .filter((invoice) => invoice.status === "Unpaid")
    .reduce((total, invoice) => total + invoice.lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0), 0);

  const timeline: TimelineItem[] = [
    ...encounters.map((encounter) => ({ id: `enc-${encounter.id}`, timestamp: encounter.date, category: "Encounters", title: `${encounter.complaint}`, detail: `${encounter.station} · ${encounter.provider}`, author: encounter.provider })),
    ...conditions.map((condition) => ({ id: `cond-${condition.id}`, timestamp: condition.recordedDate, category: "Diagnoses", title: condition.code.display, detail: `${condition.category === "encounter-diagnosis" ? "Encounter diagnosis" : "Problem list"} · ${condition.clinicalStatus} · ${condition.verificationStatus}`, author: condition.recordedBy })),
    ...allergies.filter((allergy) => !allergy.id.startsWith("alg-legacy")).map((allergy) => ({ id: `alg-${allergy.id}`, timestamp: allergy.recordedDate, category: "Allergies", title: `Allergy — ${allergy.substance.display}`, detail: `${allergy.criticality} criticality · ${allergy.verificationStatus}`, author: allergy.recordedBy })),
    ...labs.map((lab) => ({ id: `lab-${lab.id}`, timestamp: lab.orderedAt, category: "Laboratory", title: `${lab.test}`, detail: lab.result ? `Result: ${lab.result}${lab.flag ? ` (${lab.flag})` : ""}` : `Status: ${lab.status}`, author: lab.verifiedBy ?? lab.orderedBy })),
    ...meds.map((med) => ({ id: `med-${med.id}`, timestamp: med.date, category: "Medications", title: `${med.drug} ${med.dose}`, detail: `${med.frequency} for ${med.duration} · ${med.status}` })),
    ...immunizations.map((imm) => ({ id: `imm-${imm.id}`, timestamp: imm.givenAt, category: "Immunizations", title: imm.vaccineName, detail: `Batch ${imm.batchNo}${imm.aefi ? ` · AEFI (${imm.aefi.severity})` : ""}`, author: imm.givenBy })),
    ...appointments.map((appointment) => ({ id: `appt-${appointment.id}`, timestamp: appointment.date, category: "Appointments", title: `${appointment.type} appointment`, detail: `${appointment.provider} · ${appointment.time} · ${appointment.status}` })),
    ...referrals.map((referral) => ({ id: `ref-${referral.id}`, timestamp: referral.date, category: "Referrals", title: `${referral.type} referral — ${referral.diagnosis}`, detail: `${referral.facility} · ${referral.status}`, author: referral.referredBy })),
    ...admissions.map((admission) => ({ id: `adm-${admission.id}`, timestamp: admission.admittedAt, category: "Admissions", title: `Admitted — ${admission.diagnosis}`, detail: `${admission.ward} · ${admission.bed} · ${admission.status}` })),
    ...transfers.map((transfer) => ({ id: `xfer-${transfer.id}`, timestamp: transfer.date, category: "Admissions", title: `${transfer.direction === "Out" ? "Transfer out to" : "Transfer in from"} ${transfer.facility}`, detail: `${transfer.reason} · ${transfer.status}` })),
    ...invoices.map((invoice) => ({ id: `inv-${invoice.id}`, timestamp: invoice.createdAt, category: "Billing", title: `${invoice.number}`, detail: `${invoice.lines.map((line) => line.name).join(", ")} · ${invoice.status}` })),
    ...carePlans.map((plan) => ({ id: `plan-${plan.id}`, timestamp: plan.createdDate, category: "Care plans", title: plan.title, detail: `${plan.status} · ${plan.goals.length} goal(s)`, author: plan.createdBy })),
  ];

  const tabs = [
    "Overview",
    `Problems (${activeProblems.length})`,
    `Allergies (${allergies.length})`,
    `Medications (${meds.length})`,
    `Results & trends (${labs.length})`,
    `Care plans (${carePlans.length})`,
    "Documents",
    `Encounters (${encounters.length})`,
    "Vitals",
    `Billing (${invoices.length})`,
    "Admissions",
  ];

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-mist-500 hover:text-mist-800">
        <ArrowLeft size={15} /> Back
      </button>

      <PatientBanner
        patient={patient}
        actions={
          <>
            <Button variant="soft" onClick={() => { emr.addToQueue(patient.id, "Vital", "Normal"); nav("/queue"); }}>
              <ListPlus size={14} /> Add to queue
            </Button>
            <Button variant="ghost" onClick={() => nav("/appointments")}><CalendarPlus size={14} /> Appointment</Button>
            <Button variant="ghost" onClick={() => { emr.createInvoice(patient.id, [serviceLine("CONS")]); nav("/billing"); }}>
              <Receipt size={14} /> Invoice
            </Button>
            <Button variant="ghost" onClick={() => setDoc("summary")}><FileText size={14} /> Patient summary</Button>
            <Button onClick={() => setDoc("emr")}><Printer size={14} /> Consolidated record</Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Active problems" value={activeProblems.length} tone={activeProblems.length ? "amber" : "mist"} icon={<ClipboardList size={18} />} />
        <StatCard label="Encounters" value={encounters.length} tone="mist" delay={0.05} />
        <StatCard label="Results" value={labs.length} tone="mist" delay={0.1} />
        <StatCard label="Outstanding" value={naira(balance)} tone={balance > 0 ? "action" : "mist"} delay={0.15} />
      </div>

      <Tabs tabs={tabs} label="Patient chart sections">
        {(tab) => {
          if (tab === "Overview") {
            return (
              <div className="grid gap-5 lg:grid-cols-[1fr_minmax(280px,340px)]">
                <div className="card">
                  <h3 className="mb-3 font-display font-bold text-mist-900">Longitudinal timeline</h3>
                  <ClinicalTimeline items={timeline} />
                </div>
                <div className="space-y-4">
                  <div className="card">
                    <h3 className="mb-2 text-sm font-bold text-mist-700">Active problems</h3>
                    {activeProblems.length === 0 ? (
                      <SectionNote>No active problems have been recorded.</SectionNote>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {activeProblems.map((condition) => (
                          <li key={condition.id} className="flex items-center justify-between gap-2">
                            <span className="text-mist-700">{condition.code.display}</span>
                            <ClinicalStatusBadge kind="result" status={condition.verificationStatus === "confirmed" ? "final" : "preliminary"} title={`verification: ${condition.verificationStatus}`} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="card">
                    <h3 className="mb-2 text-sm font-bold text-mist-700">Allergies</h3>
                    {allergies.length === 0 ? (
                      <SectionNote>No known allergies have been recorded.</SectionNote>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {allergies.map((allergy) => (
                          <li key={allergy.id} className="flex items-center justify-between gap-2">
                            <span className="text-mist-700">{allergy.substance.display}</span>
                            <Badge tone={allergy.criticality === "high" ? "action" : "amber"}>{allergy.criticality}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="card">
                    <h3 className="mb-2 text-sm font-bold text-mist-700">Care plans</h3>
                    {carePlans.length === 0 ? (
                      <SectionNote>No care plans are open.</SectionNote>
                    ) : (
                      <ul className="space-y-1.5 text-sm">
                        {carePlans.map((plan) => (
                          <li key={plan.id} className="flex items-center justify-between gap-2">
                            <span className="text-mist-700">{plan.title}</span>
                            <ClinicalStatusBadge kind="request" status={plan.status} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          }

          if (tab.startsWith("Problems")) {
            return (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="soft" onClick={() => setProblemOpen(true)}><Plus size={14} /> Add problem</Button>
                </div>
                <ProblemList title="Active" list={activeProblems} onStatus={clinical.setConditionClinicalStatus} onVerify={clinical.setConditionVerification} emptyText="No active problems have been recorded." />
                {pastProblems.length > 0 && (
                  <ProblemList title="Resolved / historical" list={pastProblems} onStatus={clinical.setConditionClinicalStatus} onVerify={clinical.setConditionVerification} emptyText="" muted />
                )}
              </div>
            );
          }

          if (tab.startsWith("Allergies")) {
            return (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button variant="soft" onClick={() => setAllergyOpen(true)}><Plus size={14} /> Record allergy</Button>
                </div>
                {allergies.length === 0 ? (
                  <EmptyState variant="empty" title="No known allergies recorded" hint="If the patient has no known allergies, record that explicitly at the next encounter." />
                ) : (
                  <div className="space-y-3">
                    {allergies.map((allergy) => (
                      <div key={allergy.id} className="card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-display font-bold text-mist-900">{allergy.substance.display}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge tone="mist">{allergy.type}</Badge>
                              <Badge tone="mist">{allergy.category}</Badge>
                              <Badge tone={allergy.criticality === "high" ? "action" : "amber"}>{allergy.criticality} criticality</Badge>
                              <ClinicalStatusBadge kind="result" status={allergy.verificationStatus === "confirmed" ? "final" : "preliminary"} title={`verification: ${allergy.verificationStatus}`} />
                            </div>
                          </div>
                          {!allergy.id.startsWith("alg-legacy") && allergy.verificationStatus !== "confirmed" && (
                            <Button variant="ghost" className="px-2.5 py-1 text-xs" onClick={() => clinical.setAllergyVerification(allergy.id, "confirmed")}>
                              Mark confirmed
                            </Button>
                          )}
                        </div>
                        {allergy.reactions.length > 0 && (
                          <ul className="mt-3 space-y-1 border-t border-mist-100 pt-3 text-sm text-mist-600">
                            {allergy.reactions.map((reaction, index) => (
                              <li key={index}>
                                <span className="font-medium text-mist-800">{reaction.severity}</span> — {reaction.manifestation.join(", ")}
                                {reaction.description ? ` · ${reaction.description}` : ""}
                              </li>
                            ))}
                          </ul>
                        )}
                        <Provenance
                          className="mt-3"
                          info={{ author: allergy.recordedBy, recordedAt: allergy.recordedDate, source: allergy.source }}
                        />
                        {allergy.id.startsWith("alg-legacy") && (
                          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                            Imported from the free-text field on registration. Review and re-record with a substance code and reaction details.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          if (tab.startsWith("Medications")) {
            const grouped = {
              current: meds.filter((med) => med.status === "Dispensed" && daysBetween(med.date) <= 30),
              past: meds.filter((med) => !(med.status === "Dispensed" && daysBetween(med.date) <= 30)),
            };
            return (
              <div className="space-y-4">
                <MedGroup title="Current (dispensed within 30 days)" list={grouped.current} emptyText="No current medications." />
                <MedGroup title="Earlier / not dispensed" list={grouped.past} emptyText="No earlier medications recorded." muted />
                <p className="text-xs text-mist-400">
                  Prescribed, dispensed and administered are tracked separately. This view shows what was prescribed at
                  encounters and its dispensing status; inpatient administration is on the ward chart.
                </p>
              </div>
            );
          }

          if (tab.startsWith("Results & trends")) {
            const numericVitals = (Object.keys(VITAL_LOINC) as VitalKey[]).filter((key) =>
              vitals.some((entry) => key === "bp" ? entry.bp : typeof entry[key] === "number"),
            );
            return (
              <div className="space-y-5">
                <div className="card">
                  <h3 className="mb-3 font-display font-bold text-mist-900">Laboratory results</h3>
                  <Table columns={["Test", "Ordered", "Result", "Verification", "Communication"]} caption={`Laboratory results for ${patient.firstName} ${patient.lastName}`}>
                    {labs.length === 0 && <EmptyRow colSpan={5}>No laboratory results have been recorded.</EmptyRow>}
                    {labs.map((lab, index) => {
                      const loinc = LAB_LOINC[lab.test];
                      const catalogTest = LAB_TESTS.find((entry) => entry.name === lab.test);
                      return (
                        <Row key={lab.id} index={index}>
                          <Cell>
                            <CodedValue
                              concept={loinc ? { system: "loinc", code: loinc.code, display: lab.test } : localConcept(lab.test)}
                            />
                            {catalogTest?.ref && <p className="text-[11px] text-mist-400">Reference: {catalogTest.ref} {catalogTest.unit}</p>}
                          </Cell>
                          <Cell className="text-mist-500">{dateTime(lab.orderedAt)}</Cell>
                          <Cell>
                            {lab.result ? (
                              <span className={lab.flag && lab.flag !== "Normal" ? "font-semibold text-action-700" : "font-medium text-mist-800"}>
                                {lab.result}{lab.flag && lab.flag !== "Normal" ? ` · ${lab.flag}` : ""}
                              </span>
                            ) : (
                              <span className="text-mist-400">Awaiting result</span>
                            )}
                          </Cell>
                          <Cell>
                            <ClinicalStatusBadge kind="result" status={lab.status} />
                            {lab.verifiedBy && <p className="mt-1 text-[11px] text-mist-400">by {lab.verifiedBy}</p>}
                          </Cell>
                          <Cell>
                            <ClinicalStatusBadge kind="comm" status={lab.status === "Resulted" ? "viewed" : "new"} />
                          </Cell>
                        </Row>
                      );
                    })}
                  </Table>
                </div>

                <div className="card">
                  <h3 className="mb-1 font-display font-bold text-mist-900">Vital sign trends</h3>
                  {vitals.length < 2 ? (
                    <SectionNote>At least two sets of vitals are needed to show a trend. {vitals.length === 0 ? "None recorded yet." : "One set recorded."}</SectionNote>
                  ) : (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {numericVitals.map((key) => {
                        const series = vitals
                          .map((entry) => {
                            const raw = key === "bp" ? Number(entry.bp?.split("/")[0]) : (entry[key] as number | undefined);
                            return raw && !Number.isNaN(raw) ? { label: shortDate(entry.takenAt), value: raw } : null;
                          })
                          .filter((point): point is { label: string; value: number } => point !== null);
                        if (series.length < 2) return null;
                        return (
                          <div key={key}>
                            <p className="mb-1 text-xs font-bold text-mist-600">
                              {VITAL_LABELS[key]}{" "}
                              <span className="font-mono text-[10px] text-mist-400">LOINC {VITAL_LOINC[key].code} · {VITAL_LOINC[key].unit}</span>
                            </p>
                            <Lines data={series} x="label" series={[{ key: "value", label: VITAL_LABELS[key] }]} height={150} yAllowDecimals referenceBand={VITAL_REF[key]} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-3 text-[11px] text-mist-400">Shaded band = typical adult reference range where shown. Not a clinical assessment.</p>
                </div>
              </div>
            );
          }

          if (tab.startsWith("Care plans")) {
            return (
              <div className="space-y-4">
                {carePlans.length === 0 ? (
                  <EmptyState variant="empty" title="No care plans" hint="Open a care plan from a consultation to track goals and follow-up activities over time." />
                ) : (
                  carePlans.map((plan) => (
                    <div key={plan.id} className="card">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-display font-bold text-mist-900">{plan.title}</p>
                          <p className="text-xs text-mist-400">{plan.category} · started {shortDate(plan.period.start)}{plan.reviewDate ? ` · review ${shortDate(plan.reviewDate)}` : ""}</p>
                        </div>
                        <ClinicalStatusBadge kind="request" status={plan.status} />
                      </div>
                      {plan.description && <p className="mt-2 text-sm text-mist-600">{plan.description}</p>}

                      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-mist-400">Goals</p>
                      <ul className="mt-1.5 space-y-1.5 text-sm">
                        {plan.goals.map((goal) => (
                          <li key={goal.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-2">
                            <span className="text-mist-700">{goal.description}{goal.target ? ` (target ${goal.target})` : ""}</span>
                            <Badge tone={goal.status === "achieved" ? "brand" : goal.status === "not-achieved" ? "action" : "mist"}>{goal.status}</Badge>
                          </li>
                        ))}
                      </ul>

                      <p className="mt-4 text-xs font-bold uppercase tracking-wide text-mist-400">Activities</p>
                      <ul className="mt-1.5 space-y-1.5 text-sm">
                        {plan.activities.map((activity) => {
                          const overdue = isActivityOverdue(activity);
                          return (
                            <li key={activity.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-2">
                              <span className="text-mist-700">
                                {activity.description}
                                {activity.owner ? <span className="text-mist-400"> · {activity.owner}</span> : null}
                                {activity.dueDate ? <span className="text-mist-400"> · due {shortDate(activity.dueDate)}</span> : null}
                              </span>
                              <span className="flex items-center gap-1.5">
                                {overdue && <Badge tone="action">Overdue</Badge>}
                                <Select
                                  value={activity.status}
                                  onChange={(event) => clinical.setActivityStatus(plan.id, activity.id, event.target.value as never)}
                                  options={["not-started", "scheduled", "in-progress", "on-hold", "completed", "cancelled"]}
                                  className="h-8 w-auto py-0 text-xs"
                                />
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                      <Provenance className="mt-3" info={{ author: plan.createdBy, recordedAt: plan.createdDate, source: "Care plan" }} />
                    </div>
                  ))
                )}
              </div>
            );
          }

          if (tab === "Documents") {
            return (
              <div className="space-y-4">
                <Table columns={["Document", "Type", "Author", "Date", "Status"]} caption="Clinical documents">
                  {encounters.length === 0 && <EmptyRow colSpan={5}>No clinical documents have been recorded.</EmptyRow>}
                  {encounters.map((encounter, index) => (
                    <Row key={encounter.id} index={index}>
                      <Cell className="font-medium text-mist-900">Consultation note — {encounter.complaint}</Cell>
                      <Cell><Badge tone="mist">Encounter note</Badge></Cell>
                      <Cell>{encounter.provider}</Cell>
                      <Cell className="text-mist-500">{shortDate(encounter.date)}</Cell>
                      <Cell><ClinicalStatusBadge kind="note" status="signed" /></Cell>
                    </Row>
                  ))}
                </Table>
                <EmptyState
                  variant="unavailable"
                  compact
                  title="Imaging reports unavailable"
                  hint="No radiology / imaging integration is configured for this facility. Imaging studies and reports are not available in this record."
                />
              </div>
            );
          }

          if (tab.startsWith("Encounters")) {
            return (
              <Table columns={["Date", "Provider", "Complaint", "Diagnoses", "Plan", "Note"]} caption="Encounter history">
                {encounters.length === 0 && <EmptyRow colSpan={6}>No encounters have been recorded.</EmptyRow>}
                {encounters.map((encounter, index) => (
                  <Row key={encounter.id} index={index}>
                    <Cell>{shortDate(encounter.date)}</Cell>
                    <Cell className="font-semibold">{encounter.provider}</Cell>
                    <Cell>{encounter.complaint}</Cell>
                    <Cell>{encounter.diagnoses.map((diagnosis) => `${diagnosis.name} (${diagnosis.code})`).join(", ") || "—"}</Cell>
                    <Cell className="text-mist-500">{encounter.plan ?? "—"}</Cell>
                    <Cell><ClinicalStatusBadge kind="note" status="signed" /></Cell>
                  </Row>
                ))}
              </Table>
            );
          }

          if (tab === "Vitals") {
            return (
              <Table columns={["Taken", "BP", "Temp", "Pulse", "Resp", "SpO₂", "Weight", "Recorded by"]} caption="Recorded vital signs">
                {vitals.length === 0 && <EmptyRow colSpan={8}>No vital signs have been recorded.</EmptyRow>}
                {[...vitals].reverse().map((entry, index) => (
                  <Row key={index} index={index}>
                    <Cell>{dateTime(entry.takenAt)}</Cell>
                    <Cell>{entry.bp ?? "—"}</Cell>
                    <Cell>{entry.temp ? `${entry.temp}°C` : "—"}</Cell>
                    <Cell>{entry.pulse ?? "—"}</Cell>
                    <Cell>{entry.resp ?? "—"}</Cell>
                    <Cell>{entry.spo2 ? `${entry.spo2}%` : "—"}</Cell>
                    <Cell>{entry.weight ? `${entry.weight} kg` : "—"}</Cell>
                    <Cell className="text-mist-500">{entry.takenBy}</Cell>
                  </Row>
                ))}
              </Table>
            );
          }

          if (tab.startsWith("Billing")) {
            return (
              <Table columns={["Invoice", "Date", "Items", "Amount", "Status"]} caption="Billing history">
                {invoices.length === 0 && <EmptyRow colSpan={5}>No invoices have been raised.</EmptyRow>}
                {invoices.map((invoice, index) => (
                  <Row key={invoice.id} index={index}>
                    <Cell className="font-mono text-xs">{invoice.number}</Cell>
                    <Cell>{shortDate(invoice.createdAt)}</Cell>
                    <Cell className="text-mist-500">{invoice.lines.map((line) => line.name).join(", ")}</Cell>
                    <Cell className="font-semibold">{naira(invoice.lines.reduce((total, line) => total + line.qty * line.unitPrice, 0))}</Cell>
                    <Cell><Badge tone={invoice.status === "Paid" ? "brand" : invoice.status === "Waived" ? "mist" : "action"}>{invoice.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            );
          }

          return (
            <Table columns={["Ward", "Bed", "Diagnosis", "Admitted", "Status", "Outcome"]} caption="Admissions">
              {admissions.length === 0 && <EmptyRow colSpan={6}>No admissions have been recorded.</EmptyRow>}
              {admissions.map((admission, index) => (
                <Row key={admission.id} index={index}>
                  <Cell className="font-semibold">{admission.ward}</Cell>
                  <Cell>{admission.bed}</Cell>
                  <Cell>{admission.diagnosis}</Cell>
                  <Cell>{dateTime(admission.admittedAt)}</Cell>
                  <Cell><Badge tone={admission.status === "Active" ? "brand" : "mist"}>{admission.status}</Badge></Cell>
                  <Cell>{admission.outcome ?? "—"}</Cell>
                </Row>
              ))}
            </Table>
          );
        }}
      </Tabs>

      <AddProblemModal open={problemOpen} onClose={() => setProblemOpen(false)} patientId={patient.id} />
      <AddAllergyModal open={allergyOpen} onClose={() => setAllergyOpen(false)} patientId={patient.id} />

      {doc === "emr" && <ConsolidatedEmrDoc patient={patient} encounters={encounters} labs={labs} open onClose={() => setDoc(null)} />}
      {doc === "card" && <PatientCardDoc patient={patient} open onClose={() => setDoc(null)} />}
      {doc === "summary" && (
        <PatientSummaryDoc
          patient={patient}
          conditions={conditions}
          allergies={allergies}
          encounters={encounters}
          labs={labs}
          carePlans={carePlans}
          open
          onClose={() => setDoc(null)}
        />
      )}
    </div>
  );
}

function daysBetween(iso: string) {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
}

type ConditionRow = ReturnType<typeof useClinical.getState>["conditions"][number];

function ProblemList({
  title,
  list,
  onStatus,
  onVerify,
  emptyText,
  muted,
}: {
  title: string;
  list: ConditionRow[];
  onStatus: (id: string, status: never) => void;
  onVerify: (id: string, status: never) => void;
  emptyText: string;
  muted?: boolean;
}) {
  return (
    <div className="card">
      <h3 className={`mb-3 font-display font-bold ${muted ? "text-mist-500" : "text-mist-900"}`}>{title}</h3>
      {list.length === 0 ? (
        <SectionNote>{emptyText}</SectionNote>
      ) : (
        <ul className="space-y-3">
          {list.map((condition) => (
            <li key={condition.id} className="rounded-xl bg-mist-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CodedValue concept={condition.code} />
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <Badge tone="mist">{condition.category === "encounter-diagnosis" ? "Encounter diagnosis" : "Problem list"}</Badge>
                    {condition.onsetDate && <span className="text-mist-400">Onset {shortDate(condition.onsetDate)}</span>}
                    {condition.abatementDate && <span className="text-mist-400">Resolved {shortDate(condition.abatementDate)}</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Select
                    value={condition.clinicalStatus}
                    onChange={(event) => onStatus(condition.id, event.target.value as never)}
                    options={CONDITION_CLINICAL_STATUS as unknown as string[]}
                    className="h-8 w-auto py-0 text-xs"
                  />
                  <Select
                    value={condition.verificationStatus}
                    onChange={(event) => onVerify(condition.id, event.target.value as never)}
                    options={CONDITION_VERIFICATION_STATUS as unknown as string[]}
                    className="h-8 w-auto py-0 text-xs"
                  />
                </div>
              </div>
              {condition.note && <p className="mt-2 text-sm text-mist-600">{condition.note}</p>}
              <Provenance className="mt-2" info={{ author: condition.recordedBy, recordedAt: condition.recordedDate, source: condition.encounterId ? "Consultation encounter" : "Problem list" }} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MedGroup({
  title,
  list,
  emptyText,
  muted,
}: {
  title: string;
  list: { id: string; drug: string; dose: string; frequency: string; duration: string; qty: number; status: string; date: string }[];
  emptyText: string;
  muted?: boolean;
}) {
  return (
    <div className="card p-0">
      <p className={`border-b border-mist-100 px-4 py-2.5 text-sm font-bold ${muted ? "text-mist-500" : "text-mist-700"}`}>{title}</p>
      {list.length === 0 ? (
        <p className="px-4 py-4 text-sm text-mist-400">{emptyText}</p>
      ) : (
        <Table columns={["Medication", "Dose", "Frequency", "Duration", "Prescribed", "Dispensing"]}>
          {list.map((med, index) => (
            <Row key={med.id} index={index}>
              <Cell className="font-medium text-mist-900">{med.drug}</Cell>
              <Cell>{med.dose}</Cell>
              <Cell>{med.frequency}</Cell>
              <Cell>{med.duration}</Cell>
              <Cell className="text-mist-500">{shortDate(med.date)}</Cell>
              <Cell><ClinicalStatusBadge kind="dispense" status={med.status} /></Cell>
            </Row>
          ))}
        </Table>
      )}
    </div>
  );
}

function AddProblemModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: string }) {
  const addCondition = useClinical((state) => state.addCondition);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ code: string; name: string } | null>(null);
  const [verification, setVerification] = useState("provisional");
  const [onset, setOnset] = useState("");
  const [note, setNote] = useState("");

  const matches = useMemo(
    () => (query ? DIAGNOSES.filter((entry) => `${entry.code} ${entry.name}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8) : []),
    [query],
  );

  function reset() {
    setQuery(""); setSelected(null); setVerification("provisional"); setOnset(""); setNote("");
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Add problem"
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              addCondition({
                patientId,
                code: icd11Concept(selected.code, selected.name),
                category: "problem-list-item",
                verificationStatus: verification as never,
                onsetDate: onset ? new Date(onset).toISOString() : undefined,
                note: note.trim() || undefined,
              });
              reset();
              onClose();
            }}
          >
            Add to problem list
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Diagnosis (ICD-11)" hint="Search the facility ICD-11 subset. Free-text problems are not supported here so the list stays coded.">
          <Input value={selected ? `${selected.name} · ${selected.code}` : query} onChange={(event) => { setSelected(null); setQuery(event.target.value); }} placeholder="e.g. hypertension" />
        </Field>
        {matches.length > 0 && !selected && (
          <div className="max-h-52 overflow-y-auto rounded-xl ring-1 ring-mist-200">
            {matches.map((match) => (
              <button
                key={match.code}
                type="button"
                onClick={() => { setSelected({ code: match.code, name: match.name }); setQuery(""); }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50"
              >
                <span>{match.name}</span>
                <span className="font-mono text-[11px] text-mist-400">ICD-11 {match.code}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Verification status">
            <Select value={verification} onChange={(event) => setVerification(event.target.value)} options={CONDITION_VERIFICATION_STATUS as unknown as string[]} />
          </Field>
          <Field label="Onset date (optional)">
            <Input type="date" value={onset} onChange={(event) => setOnset(event.target.value)} />
          </Field>
        </div>
        <Field label="Clinical note (optional)">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function AddAllergyModal({ open, onClose, patientId }: { open: boolean; onClose: () => void; patientId: string }) {
  const addAllergy = useClinical((state) => state.addAllergy);
  const [substance, setSubstance] = useState("");
  const [category, setCategory] = useState<string>("medication");
  const [criticality, setCriticality] = useState<string>("high");
  const [severity, setSeverity] = useState<string>("moderate");
  const [manifestations, setManifestations] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  function reset() {
    setSubstance(""); setCategory("medication"); setCriticality("high"); setSeverity("moderate");
    setManifestations([]); setDescription("");
  }

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="Record allergy / intolerance"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => { reset(); onClose(); }}>Cancel</Button>
          <Button
            disabled={!substance.trim()}
            onClick={() => {
              const known = ALLERGEN_SNOMED[substance.trim()];
              addAllergy({
                patientId,
                substance: known ? { system: "snomed", code: known.code, display: substance.trim() } : localConcept(substance.trim()),
                category: category as never,
                criticality: criticality as never,
                verificationStatus: "confirmed",
                reactions: manifestations.length ? [{ manifestation: manifestations, severity: severity as never, description: description.trim() || undefined }] : [],
                source: "Recorded at consultation",
              });
              reset();
              onClose();
            }}
          >
            Save allergy
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Substance" hint="Common allergens are matched to a SNOMED CT substance code; anything else is stored as a local label.">
          <Input list="allergen-list" value={substance} onChange={(event) => setSubstance(event.target.value)} placeholder="e.g. Penicillin" />
          <datalist id="allergen-list">
            {Object.keys(ALLERGEN_SNOMED).map((name) => <option key={name} value={name} />)}
          </datalist>
        </Field>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Category"><Select value={category} onChange={(event) => setCategory(event.target.value)} options={ALLERGY_CATEGORIES as unknown as string[]} /></Field>
          <Field label="Criticality"><Select value={criticality} onChange={(event) => setCriticality(event.target.value)} options={ALLERGY_CRITICALITY as unknown as string[]} /></Field>
          <Field label="Reaction severity"><Select value={severity} onChange={(event) => setSeverity(event.target.value)} options={REACTION_SEVERITIES as unknown as string[]} /></Field>
        </div>
        <div>
          <p className="label mb-1.5">Reaction manifestations</p>
          <div className="flex flex-wrap gap-1.5">
            {COMMON_MANIFESTATIONS.map((manifestation) => {
              const on = manifestations.includes(manifestation);
              return (
                <button
                  key={manifestation}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setManifestations((current) => (on ? current.filter((entry) => entry !== manifestation) : [...current, manifestation]))}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition ${on ? "bg-brand-gradient text-white ring-transparent" : "bg-white text-mist-500 ring-mist-200 hover:bg-mist-50"}`}
                >
                  {manifestation}
                </button>
              );
            })}
          </div>
        </div>
        <Field label="Description (optional)">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Circumstances, timing, treatment given…" />
        </Field>
      </div>
    </Modal>
  );
}
