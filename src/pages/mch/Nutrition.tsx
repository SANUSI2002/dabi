import { useState } from "react";
import { Salad, Plus, CheckCircle2 } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, EmptyState, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";
import type { CmamOutcome } from "@/data/types";

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
  const { cmamScreenings, patientById, addCmamScreening, setCmamOutcome } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", muac: 0, oedema: "None", appetite: "Pass", date: "" });
  const cls = classify(f.muac || 13, f.oedema);
  const program = cls === "SAM" ? "OTP" : cls === "MAM" ? "SFP" : "—";
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
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> New Screening</Button>}
      />
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
              <Table columns={["Patient", "Date", "MUAC", "Oedema", "Classification", "Program", "Source", "Status"]}>
                {cmamScreenings.map((s, i) => (
                  <Row key={s.id} index={i}>
                    <Cell><PatientLink patient={patientById(s.patientId)} /></Cell>
                    <Cell className="text-mist-400">{shortDate(s.date)}</Cell>
                    <Cell>{s.muac} cm</Cell>
                    <Cell>{s.oedema}</Cell>
                    <Cell><Badge tone={s.cls === "SAM" ? "action" : s.cls === "MAM" ? "amber" : "brand"}>{s.cls}</Badge></Cell>
                    <Cell>{s.program}</Cell>
                    <Cell className="text-mist-400">{s.source ?? "Nutrition"}</Cell>
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
                    <Cell><PatientLink patient={patientById(s.patientId)} /></Cell>
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
          <Button disabled={!f.patientId || !f.date} onClick={() => {
            addCmamScreening({ ...f, date: new Date(f.date).toISOString(), cls, program, source: "Nutrition" });
            setOpen(false);
            setF({ patientId: "", muac: 0, oedema: "None", appetite: "Pass", date: "" });
          }}>Save Screening</Button></>}
      >
        <div className="space-y-4">
          <Field label="Patient (child under 5)"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <Grid cols={2}>
            <Field label="Screening date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="MUAC (cm)"><Input type="number" step="0.1" value={f.muac || ""} onChange={(e) => setF({ ...f, muac: +e.target.value })} /></Field>
            <Field label="Oedema (NHMIS col 184)"><Select value={f.oedema} onChange={(e) => setF({ ...f, oedema: e.target.value })} options={["None", "+ (mild)", "++ (moderate)", "+++ (severe)"]} /></Field>
            <Field label="Appetite test"><Select value={f.appetite} onChange={(e) => setF({ ...f, appetite: e.target.value })} options={["Pass", "Fail"]} /></Field>
          </Grid>
          <Checkbox label="Growth monitoring done (NHMIS col 178)" defaultChecked />
          <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${cls === "Normal" ? "bg-brand-50 text-brand-700" : cls === "MAM" ? "bg-amber-50 text-amber-700" : "bg-action-50 text-action-700"}`}>
            Auto-classification: <b>{cls}</b> {cls !== "Normal" ? `→ enrol in ${program}` : "→ discharge with health education"}
          </div>
          <Field label="Notes"><Textarea placeholder="Anything else?" /></Field>
        </div>
      </Modal>

      <Modal
        open={!!outcomeFor}
        onClose={() => setOutcomeFor(null)}
        title="Discharge from CMAM"
        footer={null}
      >
        <div className="space-y-2">
          <p className="mb-2 text-sm text-mist-500">Select the discharge outcome (WHO Sphere indicator):</p>
          {OUTCOMES.map((o) => (
            <button
              key={o}
              onClick={() => { if (outcomeFor) setCmamOutcome(outcomeFor, o); setOutcomeFor(null); }}
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
