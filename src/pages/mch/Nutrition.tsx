import { useState } from "react";
import { Salad, Plus, CheckCircle2 } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, EmptyState, statusTone } from "@/components/ui/primitives";
import { GuidelineBanner } from "@/components/clinical/GuidelineBanner";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";
import type { CmamOutcome } from "@/data/types";
import type { Patient } from "@/data/types";
import { useIsLiveEmr } from "@/emr-live/session";
import { describeEmrError } from "@/emr-live/client";
import { newIdempotencyKey, useLiveNutrition, useLiveNutritionLoad, type LiveScreening } from "@/emr-live/nutrition";

const OUTCOMES: CmamOutcome[] = ["Cured", "Non-response", "Defaulter", "Death", "Transferred"];

function classify(muac: number, oedema: string): "Normal" | "MAM" | "SAM" {
  if (oedema !== "None" || muac < 11.5) return "SAM";
  if (muac < 12.5) return "MAM";
  return "Normal";
}

const SPHERE = [
  { k: "Cured", target: "≥ 75%" },
  { k: "Defaulter", target: "< 15%" },
  { k: "Death", target: "< 10%" },
];

export default function Nutrition() {
  const { cmamScreenings: demoScreenings, patientById, addCmamScreening, setCmamOutcome } = useEmr();
  // A live hospital's CMAM records come from its EMR, which classifies and picks the programme (src/emr-live/nutrition.ts).
  const live = useIsLiveEmr();
  useLiveNutritionLoad(live);
  const liveScreenings = useLiveNutrition((st) => st.screenings);
  const liveError = useLiveNutrition((st) => st.error);
  const cmamScreenings: ((typeof demoScreenings)[number] & Partial<LiveScreening>)[] = live ? liveScreenings : demoScreenings;
  const patientOf = (v: { patientId: string; patient?: Patient }) => (live ? v.patient : patientById(v.patientId));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [saveKey, setSaveKey] = useState(newIdempotencyKey);
  async function run(work: () => Promise<void> | void, after: () => void) {
    setBusy(true); setActionError("");
    try { await work(); after(); }
    catch (cause) { setActionError(describeEmrError(cause)); }
    finally { setBusy(false); }
  }
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", muac: 0, oedema: "None", appetite: "Pass", date: "", growthMonitoringDone: true, notes: "" });
  const cls = classify(f.muac || 13, f.oedema);
  // Shown before saving; a live hospital also sends SAM with a failed appetite test or severe oedema to SC.
  const program = cls === "SAM" ? (live && (f.appetite === "Fail" || f.oedema.startsWith("+++")) ? "SC" : "OTP") : cls === "MAM" ? "SFP" : "—";
  const [outcomeFor, setOutcomeFor] = useState<string | null>(null);

  const caseload = cmamScreenings.filter((s) => s.cls !== "Normal");
  const active = caseload.filter((s) => !s.outcome);
  const discharged = caseload.filter((s) => s.outcome);
  const sphere = (o: CmamOutcome) => (discharged.length ? Math.round((discharged.filter((s) => s.outcome === o).length / discharged.length) * 100) : 0);

  return (
    <div>
      <PageHeader
        title="Nutrition · CMAM"
        subtitle="Acute malnutrition screening & treatment (OTP / SC / SFP)"
        actions={<Button onClick={() => { setSaveKey(newIdempotencyKey()); setActionError(""); setOpen(true); }}><Plus size={15} /> New Screening</Button>}
      />

      <GuidelineBanner guidelineKey="cmam-ng-2016" className="mb-5" />
      {live && (actionError || liveError) && !open && !outcomeFor && <p role="alert" className="mb-4 rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError || liveError}</p>}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Screenings" value={cmamScreenings.length} tone="brand" icon={<Salad size={18} />} />
        <StatCard label="Active caseload" value={active.length} tone="action" delay={0.05} />
        <StatCard label="Cure rate" value={`${sphere("Cured")}%`} tone={sphere("Cured") >= 75 ? "brand" : "amber"} delay={0.1} />
        <StatCard label="Discharged" value={discharged.length} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Screening", "Active Caseload", "Outcomes"]}>
        {(t) =>
          t === "Screening" ? (
            cmamScreenings.length === 0 ? (
              <EmptyState title="No screenings yet" hint='Click "New Screening" to add one.' />
            ) : (
              <Table columns={["Patient", "Date", "MUAC", "Oedema", "Classification", "Program", "Source", "Growth checked", "Notes", "Status"]}>
                {cmamScreenings.map((s, i) => (
                  <Row key={s.id} index={i}>
                    <Cell><PatientLink patient={patientOf(s)} /></Cell>
                    <Cell className="text-mist-400">{shortDate(s.date)}</Cell>
                    <Cell>{s.muac} cm</Cell>
                    <Cell>{s.oedema}</Cell>
                    <Cell><Badge tone={s.cls === "SAM" ? "action" : s.cls === "MAM" ? "amber" : "brand"}>{s.cls}</Badge></Cell>
                    <Cell>{s.program}</Cell>
                    <Cell className="text-mist-400">{s.source ?? "Nutrition"}</Cell>
                    <Cell>{s.growthMonitoringDone === undefined ? "Unknown" : s.growthMonitoringDone ? "Yes" : "No"}</Cell>
                    <Cell className="max-w-[220px] whitespace-normal text-xs text-mist-500">{s.notes || "—"}</Cell>
                    <Cell>{s.outcome ? <Badge tone={s.outcome === "Cured" ? "brand" : "action"}>{s.outcome}</Badge> : s.cls === "Normal" ? "—" : <Badge tone="amber">In caseload</Badge>}</Cell>
                  </Row>
                ))}
              </Table>
            )
          ) : t === "Active Caseload" ? (
            active.length === 0 ? (
              <EmptyState title="No active caseload" hint="Children classified as MAM/SAM are enrolled automatically after screening." />
            ) : (
              <Table columns={["Patient", "Program", "MUAC", "Enrolled", "Days in program", ""]}>
                {active.map((s, i) => (
                  <Row key={s.id} index={i}>
                    <Cell><PatientLink patient={patientOf(s)} /></Cell>
                    <Cell><Badge tone={s.program === "OTP" ? "action" : "amber"}>{s.program}</Badge></Cell>
                    <Cell>{s.muac} cm</Cell>
                    <Cell className="text-mist-400">{shortDate(s.date)}</Cell>
                    <Cell>{Math.max(0, Math.round((Date.now() - +new Date(s.date)) / 864e5))}d</Cell>
                    <Cell>
                      <button onClick={() => setOutcomeFor(s.id)} className="btn-primary px-2.5 py-1 text-xs"><CheckCircle2 size={12} /> Discharge</button>
                    </Cell>
                  </Row>
                ))}
              </Table>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {SPHERE.map((s) => (
                <div key={s.k} className="card">
                  <p className="text-xs font-bold uppercase text-mist-400">{s.k}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-mist-900">{sphere(s.k as CmamOutcome)}%</p>
                  <p className="text-[11px] text-mist-400">WHO Sphere target {s.target} · {discharged.filter((d) => d.outcome === s.k).length}/{discharged.length} discharges</p>
                </div>
              ))}
              {discharged.length === 0 && <p className="text-sm text-mist-400 sm:col-span-3">No discharges recorded yet — rates compute once caseload children are discharged.</p>}
            </div>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New CMAM Screening"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.patientId || !f.date || busy} onClick={() => void run(
            () => (live ? useLiveNutrition.getState().screen(f, saveKey) : addCmamScreening({ ...f, date: new Date(f.date).toISOString(), cls, program, source: "Nutrition" })),
            () => { setOpen(false); setF({ patientId: "", muac: 0, oedema: "None", appetite: "Pass", date: "", growthMonitoringDone: true, notes: "" }); },
          )}>{busy ? "Saving…" : "Save Screening"}</Button></>}
      >
        <div className="space-y-4">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          <Field label="Patient (child under 5)"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <Grid cols={2}>
            <Field label="Screening date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="MUAC (cm)"><Input type="number" step="0.1" value={f.muac || ""} onChange={(e) => setF({ ...f, muac: +e.target.value })} /></Field>
            <Field label="Oedema (NHMIS col 184)"><Select value={f.oedema} onChange={(e) => setF({ ...f, oedema: e.target.value })} options={["None", "+ (mild)", "++ (moderate)", "+++ (severe)"]} /></Field>
            <Field label="Appetite test"><Select value={f.appetite} onChange={(e) => setF({ ...f, appetite: e.target.value })} options={["Pass", "Fail"]} /></Field>
          </Grid>
          <Checkbox label="Growth monitoring done (NHMIS col 178)" checked={f.growthMonitoringDone} onChange={(event) => setF({ ...f, growthMonitoringDone: event.target.checked })} />
          <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${cls === "Normal" ? "bg-brand-50 text-brand-700" : cls === "MAM" ? "bg-amber-50 text-amber-700" : "bg-action-50 text-action-700"}`}>
            Auto-classification: <b>{cls}</b> {cls !== "Normal" ? `→ enrol in ${program}` : "→ discharge with health education"}
          </div>
          <Field label="Notes"><Textarea placeholder="Anything else?" value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!outcomeFor}
        onClose={() => setOutcomeFor(null)}
        title="Discharge from CMAM"
        footer={null}
      >
        <div className="space-y-2">
          {live && actionError && <p role="alert" className="rounded-xl bg-action-50 px-3 py-2 text-sm text-action-700">{actionError}</p>}
          <p className="mb-2 text-sm text-mist-500">Select the discharge outcome (WHO Sphere indicator):</p>
          {OUTCOMES.map((o) => (
            <button
              key={o}
              disabled={busy}
              onClick={() => void run(() => {
                if (!outcomeFor) return;
                if (live) return useLiveNutrition.getState().discharge(liveScreenings.find((x) => x.id === outcomeFor)!, o);
                setCmamOutcome(outcomeFor, o);
              }, () => setOutcomeFor(null))}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition ${o === "Cured" ? "bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100" : "bg-mist-50 text-mist-600 ring-mist-200 hover:bg-mist-100"}`}
            >
              {o}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
