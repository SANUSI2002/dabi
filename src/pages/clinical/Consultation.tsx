import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trash2, FlaskConical, Pill, FileSignature, Save, BedDouble, ClipboardList } from "lucide-react";
import { PageHeader, Button, Badge, SectionNote } from "@/components/ui/primitives";
import { Field, Input, Textarea, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { useEmr, serviceLine } from "@/store/useEmr";
import { useClinical } from "@/store/useClinical";
import { useWards } from "@/store/useWards";
import { DrugField } from "@/components/clinical/DrugField";
import { DIAGNOSES, LAB_PANELS, STATIONS } from "@/data/catalog";
import { ENCOUNTER_TEMPLATES, templateByKey } from "@/data/encounterTemplates";
import { icd11Concept } from "@/data/clinicalCoding";
import { useHr } from "@/store/useHr";
import { useIdentity } from "@/store/useIdentity";
import { useUnsavedGuard, confirmIfDirty } from "@/lib/useUnsavedGuard";
import { ageFromDob, dateTime } from "@/lib/format";
import type { Prescription } from "@/data/types";

const NHMIS_GROUPS: Record<string, string[]> = {
  Malaria: ["Presented with fever", "Tested by RDT", "Tested by microscopy", "Confirmed uncomplicated", "Severe malaria", "Treated with ACT", "Severe — pre-referral treatment given"],
  "TB Screening": ["Screened for TB", "Presumptive TB (score ≥ 1)", "Referred to TB services"],
  "NCD (new suspected)": ["Diabetes Mellitus", "Hypertension", "Asthma", "Sickle Cell Disease", "Depression", "Breast Cancer", "Cervical Cancer"],
  "Child Health (under-5)": ["Diarrhoea case", "Given ORS + zinc", "Pneumonia case", "Given Amoxicillin DT", "Measles case"],
  "Other IDSR": ["GBV case seen", "Snake bite (new)", "Woman with obstetric fistula", "Adverse drug reaction reported", "Patient died during / after consultation"],
};

type SoapState = { s: string; o: string; a: string; p: string };
const EMPTY_SOAP: SoapState = { s: "", o: "", a: "", p: "" };

export default function Consultation() {
  const emr = useEmr();
  const { queue, patientById, saveEncounter, addLabOrders, advanceQueue, admit, latestVitals, createInvoice } = emr;
  const addCondition = useClinical((state) => state.addCondition);
  const wards = useWards((state) => state.wards);
  const beds = useWards((state) => state.beds);
  const currentUser = useIdentity((state) => state.user.name);
  const clinicians = useHr((state) => state.staff).filter(
    (staff) => staff.status === "Active" && ["Medical Officer", "Nurse"].includes(staff.role),
  );

  const consultQueue = queue.filter((entry) => ["Waiting", "In Progress"].includes(entry.status));
  const [activeQueueId, setActiveQueueId] = useState<string | null>(consultQueue[0]?.id ?? null);
  const entry = queue.find((item) => item.id === activeQueueId);
  const patient = patientById(entry?.patientId);
  const vitals = latestVitals(entry?.patientId);

  const [provider, setProvider] = useState(clinicians[0]?.name ?? currentUser);
  const [visitType, setVisitType] = useState("General consultation");
  const [templateKey, setTemplateKey] = useState("");
  const [startedAt] = useState(() => new Date().toISOString());
  const [soap, setSoap] = useState<SoapState>(EMPTY_SOAP);
  const [diagnoses, setDiagnoses] = useState<{ code: string; name: string; toProblemList: boolean }[]>([]);
  const [diagnosisQuery, setDiagnosisQuery] = useState("");
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [labs, setLabs] = useState<string[]>([]);
  const [nhmis, setNhmis] = useState<Record<string, boolean>>({});
  const [followUp, setFollowUp] = useState("");
  const [instructions, setInstructions] = useState("");
  const [routeStation, setRouteStation] = useState("Exit");
  const [admitOpen, setAdmitOpen] = useState(false);
  const [admitWardId, setAdmitWardId] = useState(wards[0]?.id ?? "");
  const [admitBedId, setAdmitBedId] = useState("");
  const [toast, setToast] = useState("");

  const dirty = useMemo(
    () =>
      Boolean(soap.s || soap.o || soap.a || soap.p || diagnoses.length || prescriptions.length || labs.length || followUp || instructions),
    [soap, diagnoses, prescriptions, labs, followUp, instructions],
  );
  useUnsavedGuard(dirty);

  function resetEncounter() {
    setSoap(EMPTY_SOAP);
    setDiagnoses([]);
    setDiagnosisQuery("");
    setPrescriptions([]);
    setLabs([]);
    setNhmis({});
    setFollowUp("");
    setInstructions("");
    setTemplateKey("");
  }

  function switchPatient(queueId: string) {
    confirmIfDirty(dirty, () => {
      resetEncounter();
      setActiveQueueId(queueId);
    });
  }

  const diagnosisMatches = useMemo(
    () => (diagnosisQuery ? DIAGNOSES.filter((entry) => `${entry.code} ${entry.name}`.toLowerCase().includes(diagnosisQuery.toLowerCase())).slice(0, 6) : []),
    [diagnosisQuery],
  );

  function applyTemplate(key: string) {
    setTemplateKey(key);
    const template = templateByKey(key);
    if (!template) return;
    setVisitType(template.visitType);
    setSoap((current) => ({
      s: current.s || template.soap.s,
      o: current.o || template.soap.o,
      a: current.a || template.soap.a,
      p: current.p || template.soap.p,
    }));
    setLabs((current) => Array.from(new Set([...current, ...template.suggestedLabs.flatMap((panel) => LAB_PANELS[panel] ?? [])])));
  }

  function addPrescription() {
    setPrescriptions((current) => [
      ...current,
      { id: Math.random().toString(36).slice(2), drug: "", dose: "", frequency: "BD", duration: "3 days", qty: 0, status: "Pending" },
    ]);
  }

  const canSign = Boolean(patient && soap.s.trim() && soap.a.trim());
  const occupiedBedLabels = new Set(
    emr.admissions.filter((admission) => admission.status === "Active").map((admission) => `${admission.ward}|${admission.bed}`),
  );
  const admitWard = wards.find((ward) => ward.id === admitWardId);
  const admitBeds = beds.filter(
    (bed) => bed.wardId === admitWardId && bed.active && !occupiedBedLabels.has(`${admitWard?.name}|${bed.label}`),
  );

  function finalize(sign: boolean) {
    if (!entry || !patient) return;
    const encounterId = saveEncounter({
      patientId: patient.id,
      provider,
      complaint: soap.s || entry.complaint || "—",
      examination: soap.o,
      assessment: soap.a,
      plan: soap.p,
      diagnoses: diagnoses.map(({ code, name }) => ({ code, name })),
      prescriptions,
      labs,
      station: "Consultation",
      status: sign ? "signed" : "in-progress",
      visitType,
      followUp: followUp || undefined,
      patientInstructions: instructions || undefined,
      nhmisIndicators: Object.entries(nhmis).filter(([, on]) => on).map(([indicator]) => indicator),
      templateKey: templateKey || undefined,
    });

    diagnoses.forEach((diagnosis) => {
      addCondition({
        patientId: patient.id,
        code: icd11Concept(diagnosis.code, diagnosis.name),
        category: diagnosis.toProblemList ? "problem-list-item" : "encounter-diagnosis",
        verificationStatus: "confirmed",
        encounterId,
      });
    });

    if (labs.length) addLabOrders(patient.id, labs.map((test) => ({ test, category: "Consultation order" })), provider);

    let invoiceMessage = "";
    if (sign) {
      const invoiceLines = [
        serviceLine("CONS"),
        ...(labs.length ? [{ ...serviceLine("LAB"), qty: labs.length }] : []),
        ...(prescriptions.length ? [serviceLine("PHARM")] : []),
      ];
      const invoice = createInvoice(patient.id, invoiceLines);
      invoiceMessage = invoice.exempt
        ? ` · invoice ${invoice.number} waived (${patient.payer})`
        : ` · invoice ${invoice.number} raised — patient to Billing then ${routeStation}`;
      advanceQueue(entry.id, routeStation === "Exit" ? "Completed" : "Referred", routeStation as never);
    } else {
      advanceQueue(entry.id, "In Progress");
    }

    resetEncounter();
    setToast(sign ? `Encounter signed${invoiceMessage}` : "Note saved as unsigned draft — patient stays in progress");
    setTimeout(() => setToast(""), 3600);
  }

  return (
    <div>
      <PageHeader title="Consultation" subtitle="Clinician encounter · structured note · coded diagnosis · orders" />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        <div className="card h-fit p-2">
          <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-mist-400">
            Consultation queue · {consultQueue.length}
          </p>
          {consultQueue.map((queueEntry) => {
            const queuePatient = patientById(queueEntry.patientId);
            return (
              <button
                key={queueEntry.id}
                onClick={() => switchPatient(queueEntry.id)}
                aria-current={activeQueueId === queueEntry.id}
                className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activeQueueId === queueEntry.id ? "bg-brand-gradient text-white shadow-glow" : "hover:bg-mist-50"
                }`}
              >
                <span className="font-semibold">{queuePatient ? `${queuePatient.firstName} ${queuePatient.lastName}` : "—"}</span>
                <span className={`block text-[11px] ${activeQueueId === queueEntry.id ? "text-white/80" : "text-mist-400"}`}>
                  {queuePatient ? `${ageFromDob(queuePatient.dob)} · ${queuePatient.sex}` : ""} · {queueEntry.status}
                </span>
              </button>
            );
          })}
          {consultQueue.length === 0 && <p className="p-3 text-sm text-mist-400">The consultation queue is clear.</p>}
        </div>

        {!patient ? (
          <div className="card grid place-items-center py-20 text-center text-mist-400">
            <div>
              <ClipboardList size={28} className="mx-auto mb-2 opacity-50" />
              Select a patient from the queue to open an encounter.
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {/* encounter header */}
            <div className="card border-l-4 border-l-brand-500">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-mist-900">
                    {patient.firstName} {patient.lastName} {patient.otherName ?? ""}
                  </p>
                  <p className="text-xs text-mist-400">
                    {patient.mrn} · {ageFromDob(patient.dob)} · {patient.sex === "M" ? "Male" : "Female"} ·{" "}
                    <Badge tone="mist">{patient.payer}</Badge>{" "}
                    {patient.allergies && patient.allergies !== "NKA" ? (
                      <Badge tone="action">Allergy: {patient.allergies}</Badge>
                    ) : (
                      <Badge tone="brand">NKA</Badge>
                    )}
                  </p>
                  <p className="mt-1 text-[11px] text-mist-400">
                    Consultation room · started {dateTime(startedAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <ClinicalStatusBadge kind="note" status="draft" title="This note is not yet signed" />
                  <Select
                    value={provider}
                    onChange={(event) => setProvider(event.target.value)}
                    options={clinicians.length ? clinicians.map((clinician) => clinician.name) : [currentUser]}
                    className="h-8 w-auto py-0 text-xs"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-mist-100 pt-3">
                {vitals ? (
                  ([
                    ["BP", vitals.bp],
                    ["Temp", vitals.temp && `${vitals.temp}°C`],
                    ["Pulse", vitals.pulse],
                    ["Resp", vitals.resp],
                    ["SpO₂", vitals.spo2 && `${vitals.spo2}%`],
                    ["Weight", vitals.weight && `${vitals.weight} kg`],
                  ] as const)
                    .filter(([, value]) => value)
                    .map(([key, value]) => (
                      <span key={key} className="chip bg-mist-100 text-mist-600">
                        <span className="font-normal text-mist-400">{key}</span> {value}
                      </span>
                    ))
                ) : (
                  <span className="text-xs text-mist-400">No vitals recorded this visit — send the patient to the Vital station.</span>
                )}
              </div>
            </div>

            {/* visit type + template */}
            <div className="card grid gap-4 sm:grid-cols-2">
              <Field label="Visit type">
                <Input value={visitType} onChange={(event) => setVisitType(event.target.value)} />
              </Field>
              <Field label="Documentation template" hint="Scaffolds the note only. Applies prompts to empty fields.">
                <Select
                  value={templateKey}
                  onChange={(event) => applyTemplate(event.target.value)}
                  options={[{ value: "", label: "None" }, ...ENCOUNTER_TEMPLATES.map((template) => ({ value: template.key, label: `${template.name} (v${template.version})` }))]}
                />
              </Field>
            </div>

            {/* SOAP */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Clinical note</p>
                <p className="text-[11px] text-mist-400">
                  <span className="text-action-600">*</span> History and Assessment are required to sign
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="S — History of presenting complaint *">
                  <Textarea value={soap.s} onChange={(event) => setSoap({ ...soap, s: event.target.value })} placeholder={entry?.complaint} className="min-h-[120px]" />
                </Field>
                <Field label="O — Objective / examination findings">
                  <Textarea value={soap.o} onChange={(event) => setSoap({ ...soap, o: event.target.value })} className="min-h-[120px]" />
                </Field>
                <Field label="A — Assessment / clinical impression *">
                  <Textarea value={soap.a} onChange={(event) => setSoap({ ...soap, a: event.target.value })} className="min-h-[100px]" />
                </Field>
                <Field label="P — Plan">
                  <Textarea value={soap.p} onChange={(event) => setSoap({ ...soap, p: event.target.value })} className="min-h-[100px]" />
                </Field>
              </div>
              {templateByKey(templateKey)?.pertinentNegatives.length ? (
                <div>
                  <p className="label mb-1.5">Pertinent negatives — click to append to the examination</p>
                  <div className="flex flex-wrap gap-1.5">
                    {templateByKey(templateKey)!.pertinentNegatives.map((negative) => (
                      <button
                        key={negative}
                        type="button"
                        onClick={() => setSoap((current) => ({ ...current, o: `${current.o}${current.o ? "\n" : ""}${negative}.` }))}
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-mist-500 ring-1 ring-mist-200 hover:bg-mist-50"
                      >
                        + {negative}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Follow-up">
                  <Input value={followUp} onChange={(event) => setFollowUp(event.target.value)} placeholder="e.g. Review in 3 days" />
                </Field>
                <Field label="Patient instructions">
                  <Input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Advice given to the patient" />
                </Field>
              </div>
            </div>

            {/* diagnoses */}
            <div className="card">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Diagnosis (ICD-11)</p>
              <div className="relative">
                <Input value={diagnosisQuery} onChange={(event) => setDiagnosisQuery(event.target.value)} placeholder="Search ICD-11 code or name…" />
                {diagnosisMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl bg-white p-1 shadow-pop ring-1 ring-mist-200">
                    {diagnosisMatches.map((match) => (
                      <button
                        key={match.code}
                        onClick={() => { setDiagnoses((current) => [...current, { code: match.code, name: match.name, toProblemList: match.ncd }]); setDiagnosisQuery(""); }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50"
                      >
                        <span>{match.name}</span>
                        <span className="font-mono text-[11px] text-mist-400">ICD-11 {match.code}{match.ncd ? " · NCD" : ""}{match.notifiable ? " · Notifiable" : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <ul className="mt-2 space-y-1.5">
                {diagnoses.map((diagnosis, index) => (
                  <li key={index} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mist-50 px-3 py-2 text-sm">
                    <span className="text-mist-700">{diagnosis.name} <span className="font-mono text-[11px] text-mist-400">ICD-11 {diagnosis.code}</span></span>
                    <span className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-mist-500">
                        <input
                          type="checkbox"
                          checked={diagnosis.toProblemList}
                          onChange={(event) => setDiagnoses((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, toProblemList: event.target.checked } : item)))}
                          className="h-3.5 w-3.5 rounded border-mist-300 text-brand-600"
                        />
                        Add to problem list
                      </label>
                      <button onClick={() => setDiagnoses((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="text-action-500 hover:text-action-700">
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                ))}
                {diagnoses.length === 0 && <li><SectionNote>No diagnoses added. Unticked diagnoses are recorded against this encounter only; ticked ones also go on the problem list.</SectionNote></li>}
              </ul>
            </div>

            {/* prescriptions */}
            <div className="card">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Prescriptions</p>
                <Button variant="soft" onClick={addPrescription} className="px-2.5 py-1 text-xs"><Pill size={13} /> Add drug</Button>
              </div>
              <div className="space-y-2">
                {prescriptions.map((prescription, index) => (
                  <div key={prescription.id} className="grid grid-cols-2 gap-2 rounded-xl bg-mist-50 p-2 md:grid-cols-6">
                    <DrugField
                      className="md:col-span-2"
                      value={prescription.drug}
                      onChange={(name) => setPrescriptions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, drug: name } : item)))}
                    />
                    <input className="input" placeholder="Dose" value={prescription.dose} onChange={(event) => setPrescriptions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, dose: event.target.value } : item)))} />
                    <input className="input" placeholder="Frequency" value={prescription.frequency} onChange={(event) => setPrescriptions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, frequency: event.target.value } : item)))} />
                    <input className="input" placeholder="Duration" value={prescription.duration} onChange={(event) => setPrescriptions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, duration: event.target.value } : item)))} />
                    <div className="flex gap-1">
                      <input className="input" type="number" placeholder="Qty" value={prescription.qty || ""} onChange={(event) => setPrescriptions((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, qty: Number(event.target.value) } : item)))} />
                      <button onClick={() => setPrescriptions((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-2 text-action-500 hover:bg-action-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {prescriptions.length === 0 && <SectionNote>No prescriptions. Prescribed medication is dispensed separately in Pharmacy.</SectionNote>}
              </div>
            </div>

            {/* lab orders */}
            <div className="card">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mist-400">
                <FlaskConical size={13} /> Laboratory orders
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(LAB_PANELS).map(([panel, tests]) => (
                  <div key={panel}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase text-mist-400">{panel}</p>
                    <div className="space-y-1">
                      {tests.map((test) => (
                        <label key={test} className="flex items-center gap-2 text-sm text-mist-600">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-mist-300 text-brand-600"
                            checked={labs.includes(test)}
                            onChange={(event) => setLabs((current) => (event.target.checked ? [...current, test] : current.filter((item) => item !== test)))}
                          />
                          {test}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NHMIS */}
            <div className="card">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-mist-400">NHMIS reporting indicators</p>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(NHMIS_GROUPS).map(([group, items]) => (
                  <div key={group}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase text-mist-400">{group}</p>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <label key={item} className="flex items-center gap-2 text-sm text-mist-600">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-mist-300 text-brand-600"
                            checked={Boolean(nhmis[item])}
                            onChange={(event) => setNhmis((current) => ({ ...current, [item]: event.target.checked }))}
                          />
                          {item}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-mist-400">Ticked indicators are saved with the encounter and feed the NHMIS report.</p>
            </div>

            {/* actions */}
            <div className="sticky bottom-3 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-mist-200 bg-white/95 p-3 shadow-pop backdrop-blur">
              <span className="text-sm font-semibold text-mist-500">Route to</span>
              <Select value={routeStation} onChange={(event) => setRouteStation(event.target.value)} options={[...STATIONS]} className="w-auto" />
              <div className="ml-auto flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => finalize(false)} disabled={!dirty}>
                  <Save size={15} /> Save draft
                </Button>
                <Button variant="ghost" onClick={() => setAdmitOpen(true)}>
                  <BedDouble size={15} /> Admit
                </Button>
                <Button onClick={() => finalize(true)} disabled={!canSign} title={canSign ? undefined : "Record history and assessment first"}>
                  <FileSignature size={15} /> Sign &amp; finalise
                </Button>
              </div>
            </div>
            {!canSign && dirty && (
              <p className="text-right text-[11px] text-mist-400">History and Assessment must be completed before the note can be signed.</p>
            )}
          </div>
        )}
      </div>

      <Modal
        open={admitOpen}
        onClose={() => setAdmitOpen(false)}
        title="Admit patient"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdmitOpen(false)}>Cancel</Button>
            <Button
              disabled={!patient || !admitWard || !admitBedId}
              onClick={() => {
                const bed = beds.find((item) => item.id === admitBedId);
                if (patient && admitWard && bed) {
                  admit(patient.id, admitWard.name, bed.label, diagnoses[0]?.name ?? soap.a ?? "For observation");
                  if (entry) advanceQueue(entry.id, "Completed", "Exit" as never);
                  setToast(`Admitted to ${admitWard.name} · ${bed.label}`);
                  setTimeout(() => setToast(""), 2800);
                }
                setAdmitOpen(false);
              }}
            >
              Admit
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-mist-600">
            Admitting <b>{patient?.firstName} {patient?.lastName}</b> with working diagnosis{" "}
            <b>{diagnoses[0]?.name ?? soap.a ?? "—"}</b>.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Ward">
              <Select
                value={admitWardId}
                onChange={(event) => { setAdmitWardId(event.target.value); setAdmitBedId(""); }}
                options={wards.map((ward) => ({ value: ward.id, label: `${ward.name} (${ward.type})` }))}
              />
            </Field>
            <Field label="Bed">
              <Select
                value={admitBedId}
                onChange={(event) => setAdmitBedId(event.target.value)}
                options={admitBeds.length ? admitBeds.map((bed) => ({ value: bed.id, label: `${bed.label}${bed.isVip ? " · VIP" : ""}` })) : [{ value: "", label: "No free beds in this ward" }]}
              />
            </Field>
          </div>
          {admitWard && admitBeds.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Every active bed in {admitWard.name} is occupied. Choose another ward or free a bed from In-patient Care.
            </p>
          )}
        </div>
      </Modal>

      {toast && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          role="status"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}
