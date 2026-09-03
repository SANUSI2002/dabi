import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Trash2, FlaskConical, Pill, Save, LogOut, BedDouble, Stethoscope } from "lucide-react";
import { PageHeader, Button, Badge } from "@/components/ui/primitives";
import { Field, Input, Textarea, Select, Checkbox } from "@/components/ui/form";
import { Modal } from "@/components/ui/Modal";
import { useEmr, serviceLine } from "@/store/useEmr";
import { DIAGNOSES, LAB_PANELS, STATIONS } from "@/data/catalog";
import { ageFromDob } from "@/lib/format";
import type { Prescription } from "@/data/types";

const NHMIS_GROUPS: Record<string, string[]> = {
  Malaria: ["Presented with fever", "Tested by RDT", "Tested by microscopy", "Confirmed uncomplicated", "Severe malaria", "Treated with ACT", "Severe — pre-referral treatment given"],
  "TB Screening": ["Screened for TB", "Presumptive TB (score ≥ 1)", "Referred to TB services"],
  "NCD (new suspected)": ["Diabetes Mellitus", "Hypertension", "Asthma", "Sickle Cell Disease", "Depression", "Breast Cancer", "Cervical Cancer"],
  "Child Health (under-5)": ["Diarrhoea case", "Given ORS + zinc", "Pneumonia case", "Given Amoxicillin DT", "Measles case"],
  "Other IDSR": ["GBV case seen", "Snake bite (new)", "Woman with obstetric fistula", "Adverse drug reaction reported", "Patient died during / after consultation"],
};

export default function Consultation() {
  const { queue, patientById, saveEncounter, addLabOrders, advanceQueue, admit, latestVitals, createInvoice } = useEmr();
  const consultQueue = queue.filter((q) => ["Waiting", "In Progress"].includes(q.status));
  const [activeQ, setActiveQ] = useState(consultQueue[0]?.id ?? null);
  const entry = queue.find((q) => q.id === activeQ);
  const patient = patientById(entry?.patientId);
  const vitals = latestVitals(entry?.patientId);

  const [soap, setSoap] = useState({ s: "", o: "", a: "", p: "" });
  const [dx, setDx] = useState<{ code: string; name: string }[]>([]);
  const [dxQ, setDxQ] = useState("");
  const [rx, setRx] = useState<Prescription[]>([]);
  const [labs, setLabs] = useState<string[]>([]);
  const [nhmis, setNhmis] = useState<Record<string, boolean>>({});
  const [route, setRoute] = useState("Exit");
  const [admitOpen, setAdmitOpen] = useState(false);
  const [toast, setToast] = useState("");

  const dxMatches = useMemo(
    () => (dxQ ? DIAGNOSES.filter((d) => `${d.code} ${d.name}`.toLowerCase().includes(dxQ.toLowerCase())).slice(0, 6) : []),
    [dxQ],
  );

  function addRx() {
    setRx((r) => [...r, { id: Math.random().toString(36).slice(2), drug: "", dose: "", frequency: "BD", duration: "3 days", qty: 0, status: "Pending" }]);
  }

  function finalize(exit: boolean) {
    if (!entry || !patient) return;
    saveEncounter({
      patientId: patient.id,
      provider: "Dr. Adaeze Okonjo",
      complaint: soap.s || entry.complaint || "—",
      examination: soap.o,
      assessment: soap.a,
      plan: soap.p,
      diagnoses: dx,
      prescriptions: rx,
      labs,
      station: "Consultation",
    });
    if (labs.length) addLabOrders(patient.id, labs.map((t) => ({ test: t, category: "Consultation order" })));

    const invLines = [
      serviceLine("CONS"),
      ...(labs.length ? [{ ...serviceLine("LAB"), qty: labs.length }] : []),
      ...(rx.length ? [serviceLine("PHARM")] : []),
    ];
    const inv = createInvoice(patient.id, invLines);

    advanceQueue(entry.id, exit ? "Completed" : "Referred", route as never);
    setSoap({ s: "", o: "", a: "", p: "" });
    setDx([]); setRx([]); setLabs([]); setNhmis({});
    setToast(
      inv.exempt
        ? `Encounter finalized · invoice ${inv.number} waived (${patient.payer})`
        : `Encounter finalized · invoice ${inv.number} raised — patient to Billing then ${route}`,
    );
    setTimeout(() => setToast(""), 3200);
  }

  return (
    <div>
      <PageHeader title="Consultation" subtitle="SOAP encounter · ICD-11 diagnosis · orders · NHMIS indicators" />

      <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
        {/* queue rail */}
        <div className="card h-fit p-2">
          <p className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-mist-400">
            Consultation Queue · {consultQueue.length}
          </p>
          {consultQueue.map((q) => {
            const p = patientById(q.patientId);
            return (
              <button
                key={q.id}
                onClick={() => setActiveQ(q.id)}
                className={`mb-1 w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  activeQ === q.id ? "bg-brand-gradient text-white shadow-glow" : "hover:bg-mist-50"
                }`}
              >
                <span className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</span>
                <span className={`block text-[11px] ${activeQ === q.id ? "text-white/80" : "text-mist-400"}`}>
                  {p ? `${ageFromDob(p.dob)} · ${p.sex}` : ""} · {q.status}
                </span>
              </button>
            );
          })}
          {consultQueue.length === 0 && <p className="p-3 text-sm text-mist-400">Queue is clear 🎉</p>}
        </div>

        {/* encounter */}
        {!patient ? (
          <div className="card grid place-items-center py-20 text-mist-400">Select a patient from the queue.</div>
        ) : (
          <div className="space-y-5">
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-bold text-mist-900">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="text-xs text-mist-400">
                    {patient.mrn} · {ageFromDob(patient.dob)} · {patient.sex} ·{" "}
                    <Badge tone="mist">{patient.payer}</Badge>{" "}
                    {patient.allergies && patient.allergies !== "NKA" ? (
                      <Badge tone="action">Allergy: {patient.allergies}</Badge>
                    ) : (
                      <Badge tone="brand">NKA</Badge>
                    )}
                  </p>
                </div>
                <Badge tone="brand">
                  <Stethoscope size={12} /> In consultation
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-mist-100 pt-3">
                {vitals ? (
                  [
                    ["BP", vitals.bp],
                    ["Temp", vitals.temp && `${vitals.temp}°C`],
                    ["Pulse", vitals.pulse],
                    ["Resp", vitals.resp],
                    ["SpO₂", vitals.spo2 && `${vitals.spo2}%`],
                    ["Weight", vitals.weight && `${vitals.weight} kg`],
                  ]
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <span key={k} className="chip bg-mist-100 text-mist-600">
                        <span className="font-normal text-mist-400">{k}</span> {v}
                      </span>
                    ))
                ) : (
                  <span className="text-xs text-mist-400">No vitals recorded — send patient to the Vital station.</span>
                )}
              </div>
            </div>

            <div className="card space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-mist-400">SOAP Notes</p>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="S — History of presenting complaint">
                  <Textarea value={soap.s} onChange={(e) => setSoap({ ...soap, s: e.target.value })} placeholder={entry?.complaint} />
                </Field>
                <Field label="O — Objective / examination findings">
                  <Textarea value={soap.o} onChange={(e) => setSoap({ ...soap, o: e.target.value })} />
                </Field>
                <Field label="A — Assessment / impression">
                  <Textarea value={soap.a} onChange={(e) => setSoap({ ...soap, a: e.target.value })} />
                </Field>
                <Field label="P — Plan">
                  <Textarea value={soap.p} onChange={(e) => setSoap({ ...soap, p: e.target.value })} />
                </Field>
              </div>
            </div>

            {/* Diagnoses */}
            <div className="card">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Diagnosis (ICD-11)</p>
              <div className="relative">
                <Input value={dxQ} onChange={(e) => setDxQ(e.target.value)} placeholder="Search ICD-11 code or name…" />
                {dxMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-xl bg-white p-1 shadow-pop ring-1 ring-mist-200">
                    {dxMatches.map((d) => (
                      <button
                        key={d.code}
                        onClick={() => { setDx((x) => [...x, { code: d.code, name: d.name }]); setDxQ(""); }}
                        className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50"
                      >
                        <span>{d.name}</span>
                        <span className="text-[11px] text-mist-400">
                          {d.code} {d.ncd && "· NCD"} {d.notifiable && "· Notifiable"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {dx.map((d, i) => (
                  <span key={i} className="chip bg-brand-50 text-brand-700 ring-1 ring-brand-200">
                    {d.name}
                    <button onClick={() => setDx((x) => x.filter((_, j) => j !== i))}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
                {dx.length === 0 && <span className="text-sm text-mist-400">No diagnoses added yet.</span>}
              </div>
            </div>

            {/* Prescriptions */}
            <div className="card">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wide text-mist-400">Prescriptions</p>
                <Button variant="soft" onClick={addRx} className="px-2.5 py-1 text-xs">
                  <Pill size={13} /> Add drug
                </Button>
              </div>
              <div className="space-y-2">
                {rx.map((r, i) => (
                  <div key={r.id} className="grid grid-cols-2 gap-2 rounded-xl bg-mist-50 p-2 md:grid-cols-6">
                    <input className="input md:col-span-2" placeholder="Drug" value={r.drug}
                      onChange={(e) => setRx((x) => x.map((y, j) => (j === i ? { ...y, drug: e.target.value } : y)))} />
                    <input className="input" placeholder="Dose" value={r.dose}
                      onChange={(e) => setRx((x) => x.map((y, j) => (j === i ? { ...y, dose: e.target.value } : y)))} />
                    <input className="input" placeholder="Freq" value={r.frequency}
                      onChange={(e) => setRx((x) => x.map((y, j) => (j === i ? { ...y, frequency: e.target.value } : y)))} />
                    <input className="input" placeholder="Duration" value={r.duration}
                      onChange={(e) => setRx((x) => x.map((y, j) => (j === i ? { ...y, duration: e.target.value } : y)))} />
                    <div className="flex gap-1">
                      <input className="input" type="number" placeholder="Qty" value={r.qty || ""}
                        onChange={(e) => setRx((x) => x.map((y, j) => (j === i ? { ...y, qty: +e.target.value } : y)))} />
                      <button onClick={() => setRx((x) => x.filter((_, j) => j !== i))} className="rounded-lg px-2 text-action-500 hover:bg-action-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {rx.length === 0 && <p className="text-sm text-mist-400">No prescriptions yet.</p>}
              </div>
            </div>

            {/* Lab orders */}
            <div className="card">
              <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mist-400">
                <FlaskConical size={13} /> Lab Orders
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(LAB_PANELS).map(([panel, tests]) => (
                  <div key={panel}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase text-mist-400">{panel}</p>
                    <div className="space-y-1">
                      {tests.map((t) => (
                        <label key={t} className="flex items-center gap-2 text-sm text-mist-600">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-mist-300 text-brand-600"
                            checked={labs.includes(t)}
                            onChange={(e) =>
                              setLabs((l) => (e.target.checked ? [...l, t] : l.filter((x) => x !== t)))
                            }
                          />
                          {t}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NHMIS indicators */}
            <div className="card bg-brand-gradient text-white">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-white/80">NHMIS Reporting Indicators</p>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(NHMIS_GROUPS).map(([group, items]) => (
                  <div key={group}>
                    <p className="mb-1.5 text-[11px] font-bold uppercase text-white/70">{group}</p>
                    <div className="space-y-1">
                      {items.map((it) => (
                        <label key={it} className="flex items-center gap-2 text-sm text-white/90">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-white/40 bg-white/20 text-brand-900"
                            checked={!!nhmis[it]}
                            onChange={(e) => setNhmis((n) => ({ ...n, [it]: e.target.checked }))}
                          />
                          {it}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* actions */}
            <div className="card sticky bottom-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-mist-500">Route to:</span>
              <Select value={route} onChange={(e) => setRoute(e.target.value)} options={[...STATIONS]} className="w-auto" />
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" onClick={() => finalize(false)}>
                  <Save size={15} /> Save & Route
                </Button>
                <Button variant="ghost" onClick={() => setAdmitOpen(true)}>
                  <BedDouble size={15} /> Admit
                </Button>
                <Button onClick={() => finalize(true)}>
                  <LogOut size={15} /> Finalize & Exit
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal
        open={admitOpen}
        onClose={() => setAdmitOpen(false)}
        title="Admit Patient"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdmitOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (patient) admit(patient.id, "Female Ward", "Bed 3", dx[0]?.name ?? soap.a ?? "For observation");
                setAdmitOpen(false);
                setToast("Patient admitted to Female Ward · Bed 3");
                setTimeout(() => setToast(""), 2600);
              }}
            >
              Admit Patient
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-mist-600">
          Admitting <b>{patient?.firstName} {patient?.lastName}</b> with working diagnosis{" "}
          <b>{dx[0]?.name ?? "—"}</b>. Bed assignment can be changed from the In-patient module.
        </div>
      </Modal>

      {toast && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-glow"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}
