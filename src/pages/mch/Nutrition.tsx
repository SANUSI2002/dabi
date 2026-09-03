import { useState } from "react";
import { Salad, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { shortDate } from "@/lib/format";

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
  const { cmamScreenings, patientById, addCmamScreening } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", muac: 0, oedema: "None", appetite: "Pass", date: "" });
  const cls = classify(f.muac || 13, f.oedema);
  const program = cls === "SAM" ? "OTP" : cls === "MAM" ? "SFP" : "—";

  return (
    <div>
      <PageHeader
        title="Nutrition · CMAM"
        subtitle="Acute malnutrition screening & treatment (OTP / SC / SFP)"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> New Screening</Button>}
      />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Screenings" value={cmamScreenings.length} tone="brand" icon={<Salad size={18} />} />
        <StatCard label="Active OTP" value={cmamScreenings.filter((s) => s.program === "OTP").length} tone="action" delay={0.05} />
        <StatCard label="Active SFP" value={cmamScreenings.filter((s) => s.program === "SFP").length} tone="amber" delay={0.1} />
        <StatCard label="Normal" value={cmamScreenings.filter((s) => s.cls === "Normal").length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Screening", "Active Caseload", "Outcomes"]}>
        {(t) =>
          t === "Screening" ? (
            cmamScreenings.length === 0 ? (
              <EmptyState title="No screenings yet" hint='Click "New Screening" to add one.' />
            ) : (
              <div className="card p-0">
                <table className="w-full">
                  <thead className="border-b border-mist-200 bg-mist-50/60"><tr>{["Patient", "Date", "MUAC", "Oedema", "Classification", "Program"].map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
                  <tbody className="divide-y divide-mist-100">
                    {cmamScreenings.map((s) => {
                      const p = patientById(s.patientId);
                      return (
                        <tr key={s.id}>
                          <td className="td font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</td>
                          <td className="td">{shortDate(s.date)}</td>
                          <td className="td">{s.muac} cm</td>
                          <td className="td">{s.oedema}</td>
                          <td className="td"><Badge tone={s.cls === "SAM" ? "action" : s.cls === "MAM" ? "amber" : "brand"}>{s.cls}</Badge></td>
                          <td className="td">{s.program}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : t === "Active Caseload" ? (
            cmamScreenings.filter((s) => s.cls !== "Normal").length === 0 ? (
              <EmptyState title="No active caseload" hint="Children classified as MAM/SAM are enrolled automatically after screening." />
            ) : (
              <div className="card p-0">
                <table className="w-full">
                  <thead className="border-b border-mist-200 bg-mist-50/60"><tr>{["Patient", "Program", "MUAC", "Enrolled"].map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
                  <tbody className="divide-y divide-mist-100">
                    {cmamScreenings.filter((s) => s.cls !== "Normal").map((s) => {
                      const p = patientById(s.patientId);
                      return (
                        <tr key={s.id}>
                          <td className="td font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</td>
                          <td className="td"><Badge tone={s.program === "OTP" ? "action" : "amber"}>{s.program}</Badge></td>
                          <td className="td">{s.muac} cm</td>
                          <td className="td">{shortDate(s.date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {SPHERE.map((s) => (
                <div key={s.k} className="card">
                  <p className="text-xs font-bold uppercase text-mist-400">{s.k}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-mist-900">0%</p>
                  <p className="text-[11px] text-mist-400">WHO Sphere target {s.target}</p>
                </div>
              ))}
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
            addCmamScreening({ ...f, date: new Date(f.date).toISOString(), cls, program });
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
    </div>
  );
}
