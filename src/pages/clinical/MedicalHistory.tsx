import { useState } from "react";
import { Link } from "react-router-dom";
import { Printer, FileClock } from "lucide-react";
import { PageHeader, Button, Badge } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { ConsolidatedEmrDoc } from "@/components/print/documents";
import { LabProgress } from "@/components/lab/LabProgress";
import { ClinicalStatusBadge } from "@/components/clinical/ClinicalStatusBadge";
import { useEmr } from "@/store/useEmr";
import { useLabConfig } from "@/store/useLabConfig";
import { dateTime, ageFromDob } from "@/lib/format";

function noteStatus(status?: string): "draft" | "saved" | "signed" | "amended" | "cancelled" {
  if (status === "in-progress") return "saved";
  if (status === "amended") return "amended";
  if (status === "cancelled") return "cancelled";
  return "signed";
}

export default function MedicalHistory() {
  const { patients, encounters, labOrders, patientById, amendEncounter } = useEmr();
  const { configFor } = useLabConfig();
  const [pid, setPid] = useState<string | null>(patients[0]?.id ?? null);
  const [amend, setAmend] = useState<string | null>(null);
  const [amendReason, setAmendReason] = useState("");
  const [printDoc, setPrintDoc] = useState(false);
  const p = patientById(pid);
  const encs = encounters.filter((e) => e.patientId === pid);
  const labs = labOrders.filter((l) => l.patientId === pid);
  const meds = encs.flatMap((e) => e.prescriptions.map((r) => ({ ...r, date: e.date })));

  return (
    <div>
      <PageHeader
        title="Medical History"
        subtitle="Consolidated patient record"
        actions={
          <Button variant="ghost" disabled={!p} onClick={() => setPrintDoc(true)}>
            <Printer size={15} /> Print Consolidated EMR
          </Button>
        }
      />

      <div className="card mb-5 flex flex-wrap items-center gap-4">
        <div className="min-w-[280px] flex-1">
          <PatientPicker value={pid} onChange={setPid} />
        </div>
        {p && (
          <div className="flex items-center gap-3 text-sm">
            <div>
              <p className="font-display font-bold text-mist-900">{p.firstName} {p.lastName}</p>
              <p className="text-xs text-mist-400">{p.mrn} · {ageFromDob(p.dob)} · {p.sex}</p>
            </div>
            <Link to={`/patients/${p.id}`} className="btn-soft px-2.5 py-1 text-xs">Open full chart →</Link>
          </div>
        )}
      </div>

      {!p ? (
        <div className="card py-16 text-center text-mist-400">Select a patient to view their history.</div>
      ) : (
        <Tabs tabs={[`Consultation (${encs.length})`, `Medication (${meds.length})`, `Lab (${labs.length})`, "Vitals"]}>
          {(t) =>
            t.startsWith("Consultation") ? (
              <div className="space-y-3">
                {encs.map((e) => (
                  <div key={e.id} className="card">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileClock size={15} className="text-brand-600" />
                        <span className="text-sm font-semibold text-mist-800">{dateTime(e.date)}</span>
                        <span className="text-xs text-mist-400">· {e.provider}</span>
                        <ClinicalStatusBadge kind="note" status={noteStatus(e.status)} />
                      </div>
                      <button onClick={() => { setAmend(e.id); setAmendReason(""); }} className="text-xs font-semibold text-action-600 hover:underline">
                        Amend
                      </button>
                    </div>
                    <p className="text-sm text-mist-700"><b>Complaint:</b> {e.complaint}</p>
                    {e.assessment && <p className="text-sm text-mist-700"><b>Assessment:</b> {e.assessment}</p>}
                    {e.plan && <p className="text-sm text-mist-700"><b>Plan:</b> {e.plan}</p>}
                    {e.amendmentNote && (
                      <p className="mt-1 text-xs text-mist-400">Amended by {e.amendedBy} {e.amendedAt ? dateTime(e.amendedAt) : ""} — {e.amendmentNote}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {e.diagnoses.map((d) => <Badge key={d.code} tone="brand">{d.name}</Badge>)}
                    </div>
                  </div>
                ))}
                {encs.length === 0 && <div className="card py-12 text-center text-mist-400">No encounters recorded.</div>}
              </div>
            ) : t.startsWith("Medication") ? (
              <div className="card p-0">
                {meds.map((m, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-mist-100 px-4 py-3 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-mist-800">{m.drug || "—"}</p>
                      <p className="text-[11px] text-mist-400">{m.dose} · {m.frequency} · {m.duration} · Qty {m.qty}</p>
                    </div>
                    <Badge tone={m.status === "Dispensed" ? "brand" : "amber"}>{m.status}</Badge>
                  </div>
                ))}
                {meds.length === 0 && <div className="py-12 text-center text-mist-400">No medications.</div>}
              </div>
            ) : t.startsWith("Lab") ? (
              <div className="space-y-3">
                {labs.map((l) => (
                  <div key={l.id} className="card">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-mist-800">{l.test}</p>
                      <p className="text-[11px] text-mist-400">Ordered {dateTime(l.orderedAt)}</p>
                    </div>
                    <LabProgress order={l} phases={configFor(l.test).phases} />
                  </div>
                ))}
                {labs.length === 0 && <div className="py-12 text-center text-mist-400">No lab records.</div>}
              </div>
            ) : (
              <div className="card py-12 text-center text-mist-400">
                Vitals are not recorded as structured data in this build — no BP, temperature, pulse, or weight readings are captured against an encounter.
              </div>
            )
          }
        </Tabs>
      )}

      <Modal
        open={!!amend}
        onClose={() => setAmend(null)}
        title="Amend Encounter"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAmend(null)}>Cancel</Button>
            <Button
              variant="action"
              disabled={!amendReason.trim()}
              onClick={() => { if (amend) amendEncounter(amend, {}, amendReason.trim()); setAmend(null); }}
            >
              Save Amendment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Reason for amendment (required)">
            <Textarea value={amendReason} onChange={(event) => setAmendReason(event.target.value)} placeholder="Why is this encounter being amended?" />
          </Field>
          <p className="text-xs text-mist-400">Amendments are recorded in the audit log and never overwrite the original note.</p>
        </div>
      </Modal>

      {p && printDoc && (
        <ConsolidatedEmrDoc patient={p} encounters={encs} labs={labs} open onClose={() => setPrintDoc(false)} />
      )}
    </div>
  );
}
