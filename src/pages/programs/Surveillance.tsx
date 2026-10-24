import { useState } from "react";
import { Radar, Plus, AlertTriangle } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Select, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { NOTIFIABLE } from "@/data/catalog";
import { dateTime } from "@/lib/format";
import type { Patient, SurveillanceCase } from "@/data/types";
import { useIsLiveEmr } from "@/emr-live/session";
import { describeEmrError } from "@/emr-live/client";
import { newIdempotencyKey, useLiveSurveillance, useLiveSurveillanceLoad, type LiveCase } from "@/emr-live/surveillance";

export default function Surveillance() {
  const { surveillanceCases: demoCases, patientById, addSurveillanceCase } = useEmr();
  // A live hospital's line list comes from its EMR (see src/emr-live/surveillance.ts).
  const live = useIsLiveEmr();
  useLiveSurveillanceLoad(live);
  const liveCases = useLiveSurveillance((st) => st.cases);
  const liveError = useLiveSurveillance((st) => st.error);
  const surveillanceCases: (SurveillanceCase & Partial<LiveCase>)[] = live ? liveCases : demoCases;
  const patientOf = (c: { patientId: string; patient?: Patient }) => (live ? c.patient : patientById(c.patientId));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notifyKey, setNotifyKey] = useState(newIdempotencyKey);
  const [classifyFor, setClassifyFor] = useState<{ c: LiveCase; status: "Confirmed" | "Discarded" } | null>(null);
  const [classifyNote, setClassifyNote] = useState("");
  async function run(work: () => Promise<void> | void, after: () => void) {
    setBusy(true); setActionError("");
    try { await work(); after(); }
    catch (cause) { setActionError(describeEmrError(cause)); }
    finally { setBusy(false); }
  }
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", disease: NOTIFIABLE[0].name, onset: "", notes: "" });
  const immediate = NOTIFIABLE.filter((d) => d.class === "IDSR Immediate");

  return (
    <div>
      <PageHeader
        title="Disease Surveillance (IDSR)"
        subtitle="Notifiable disease reporting & alerts"
        actions={<Button variant="action" onClick={() => { setNotifyKey(newIdempotencyKey()); setActionError(""); setOpen(true); }}><Plus size={15} /> Notify Case</Button>}
      />
      {live && (actionError || liveError) && !open && !classifyFor && <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError || liveError}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cases This Week" value={surveillanceCases.length} tone="brand" icon={<Radar size={18} />} />
        <StatCard label="Immediate-notify" value={surveillanceCases.filter((c) => c.immediate ?? immediate.some((d) => d.name === c.disease)).length} tone="action" delay={0.05} icon={<AlertTriangle size={18} />} />
        <StatCard label="Confirmed" value={surveillanceCases.filter((c) => c.status === "Confirmed").length} tone="mist" delay={0.1} />
        <StatCard label="Diseases Tracked" value={NOTIFIABLE.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Line List", "Notifiable Diseases"]}>
        {(t) =>
          t === "Line List" ? (
            <Table columns={["Patient", "Disease", "Onset", "Reported", "Status"]} caption="Notifiable disease line list">
              {surveillanceCases.length === 0 && <Row><Cell className="text-mist-400">No cases notified this week.</Cell></Row>}
              {surveillanceCases.map((c, i) => {
                const p = patientOf(c);
                return (
                  <Row key={c.id} index={i}>
                    <Cell className="font-semibold">
                      <PatientLink patient={p} sub={c.notes} />
                    </Cell>
                    <Cell>{c.disease}</Cell>
                    <Cell>{c.onset}</Cell>
                    <Cell className="text-mist-400">{dateTime(c.reportedAt)}</Cell>
                    <Cell>
                      <Badge tone={c.status === "Confirmed" ? "action" : "amber"}>{c.status}</Badge>
                      {live && c.status === "Suspected" && (
                        <span className="ml-2 inline-flex gap-1">
                          <button className="btn-primary px-2 py-0.5 text-[11px]" onClick={() => { setClassifyFor({ c: c as LiveCase, status: "Confirmed" }); setClassifyNote(""); setActionError(""); }}>Confirm</button>
                          <button className="btn-ghost px-2 py-0.5 text-[11px]" onClick={() => { setClassifyFor({ c: c as LiveCase, status: "Discarded" }); setClassifyNote(""); setActionError(""); }}>Discard</button>
                        </span>
                      )}
                      {c.classifiedBy && <span className="block text-[11px] text-mist-400">by {c.classifiedBy}{c.classificationNote ? ` · ${c.classificationNote}` : ""}</span>}
                    </Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <Table columns={["Code", "Disease", "Class", "Priority", "Reporting Window"]}>
              {NOTIFIABLE.map((d, i) => (
                <Row key={d.code} index={i}>
                  <Cell className="font-mono text-xs">{d.code}</Cell>
                  <Cell className="font-medium">{d.name}</Cell>
                  <Cell>{d.class}</Cell>
                  <Cell><Badge tone={d.priority === "Critical" ? "action" : d.priority === "High" ? "amber" : "mist"}>{d.priority}</Badge></Cell>
                  <Cell>{d.window}</Cell>
                </Row>
              ))}
            </Table>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Notify Disease Case"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="action" disabled={!f.patientId || busy} onClick={() => void run(
            () => (live ? useLiveSurveillance.getState().notify(f, notifyKey) : addSurveillanceCase({ ...f, notes: f.notes.trim() || undefined })),
            () => { setOpen(false); setF({ patientId: "", disease: NOTIFIABLE[0].name, onset: "", notes: "" }); },
          )}>{busy ? "Submitting…" : "Submit Notification"}</Button></>}
      >
        <div className="space-y-4">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <Field label="Disease"><Select value={f.disease} onChange={(e) => setF({ ...f, disease: e.target.value })} options={NOTIFIABLE.map((d) => d.name)} /></Field>
          <Field label="Date of onset"><input type="date" className="input" value={f.onset} onChange={(e) => setF({ ...f, onset: e.target.value })} /></Field>
          {immediate.some((d) => d.name === f.disease) && (
            <div className="rounded-xl bg-action-50 px-3 py-2 text-sm font-semibold text-action-700 ring-1 ring-action-200">
              ⚠ Immediate notification — DSNO and LGA will be alerted within 24 hours.
            </div>
          )}
          <Field label="Case notes"><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Clinical presentation, contacts, travel history…" /></Field>
        </div>
      </Modal>

      <Modal
        open={!!classifyFor}
        onClose={() => setClassifyFor(null)}
        title={classifyFor?.status === "Confirmed" ? "Confirm case" : "Discard case"}
        footer={<><Button variant="ghost" onClick={() => setClassifyFor(null)}>Cancel</Button>
          <Button variant={classifyFor?.status === "Confirmed" ? "action" : "primary"} disabled={busy || (classifyFor?.status === "Discarded" && classifyNote.trim().length < 3)}
            onClick={() => void run(() => useLiveSurveillance.getState().classify(classifyFor!.c, classifyFor!.status, classifyNote), () => setClassifyFor(null))}>
            {busy ? "Saving…" : classifyFor?.status === "Confirmed" ? "Confirm case" : "Discard case"}
          </Button></>}
      >
        <div className="space-y-4">
          {actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          {classifyFor && <p className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600"><b>{classifyFor.c.disease}</b> · reported {dateTime(classifyFor.c.reportedAt)}{classifyFor.c.reportedBy ? ` by ${classifyFor.c.reportedBy}` : ""}</p>}
          <Field label={classifyFor?.status === "Confirmed" ? "How it was confirmed (optional)" : "Why it is discarded"}>
            <Textarea value={classifyNote} onChange={(e) => setClassifyNote(e.target.value)} placeholder={classifyFor?.status === "Confirmed" ? "e.g. PCR positive at reference lab" : "e.g. RDT and blood film negative"} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
