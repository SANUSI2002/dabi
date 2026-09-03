import { useState } from "react";
import { HeartPulse } from "lucide-react";
import { PageHeader, Button, StatCard, EmptyState, Badge } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { shortDate } from "@/lib/format";

const DANGER = ["Not feeding well", "Convulsions", "Fast breathing (>60/min)", "Severe chest indrawing", "Hypothermia (<35.5°)", "Fever (>37.5°)", "Jaundice", "Umbilical infection"];

export default function Postnatal() {
  const [visits, setVisits] = useState<any[]>([]);
  const [f, setF] = useState<any>({ patientId: "", timing: "48–72 hours", daysPP: 3, bp: "", temp: "", uterus: "Well contracted", lochia: "Normal", breast: "Normal", babyName: "", babyWeight: "", breastfeeding: "Exclusive", fpCounselled: false });

  return (
    <div>
      <PageHeader title="Postnatal Care (PNC)" subtitle="Mother & newborn assessment, danger signs, FP counselling" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="PNC Visits" value={visits.length} tone="brand" icon={<HeartPulse size={18} />} />
        <StatCard label="Within 48h" value={visits.filter((v) => v.daysPP <= 2).length} tone="mist" delay={0.05} />
        <StatCard label="Danger signs" value={0} tone="action" delay={0.1} />
        <StatCard label="FP counselled" value={visits.filter((v) => v.fpCounselled).length} tone="brand" delay={0.15} />
      </div>

      <Tabs tabs={["Record Visit", "PNC Records"]}>
        {(t) =>
          t === "Record Visit" ? (
            <div className="card space-y-5">
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Mother & delivery link</p>
                <Grid cols={2}>
                  <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} filter={(p) => p.sex === "F"} /></Field>
                  <Field label="Link to delivery (optional)"><Select options={["Select a delivery…", "Recent facility delivery"]} /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Visit & vitals</p>
                <Grid cols={3}>
                  <Field label="Visit timing"><Select value={f.timing} onChange={(e) => setF({ ...f, timing: e.target.value })} options={["Within 24 hours", "48–72 hours", "7–14 days", "6 weeks"]} /></Field>
                  <Field label="Days postpartum"><Input type="number" value={f.daysPP} onChange={(e) => setF({ ...f, daysPP: +e.target.value })} /></Field>
                  <Field label="BP"><Input value={f.bp} onChange={(e) => setF({ ...f, bp: e.target.value })} placeholder="120/80" /></Field>
                  <Field label="Uterus"><Select value={f.uterus} onChange={(e) => setF({ ...f, uterus: e.target.value })} options={["Well contracted", "Poorly contracted", "Tender"]} /></Field>
                  <Field label="Lochia"><Select value={f.lochia} onChange={(e) => setF({ ...f, lochia: e.target.value })} options={["Normal", "Excessive", "Offensive"]} /></Field>
                  <Field label="Breast"><Select value={f.breast} onChange={(e) => setF({ ...f, breast: e.target.value })} options={["Normal", "Engorged", "Cracked nipple", "Mastitis"]} /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Newborn assessment</p>
                <Grid cols={3}>
                  <Field label="Baby name (if named)"><Input value={f.babyName} onChange={(e) => setF({ ...f, babyName: e.target.value })} /></Field>
                  <Field label="Baby weight (kg)"><Input type="number" step="0.1" value={f.babyWeight} onChange={(e) => setF({ ...f, babyWeight: e.target.value })} /></Field>
                  <Field label="Breastfeeding"><Select value={f.breastfeeding} onChange={(e) => setF({ ...f, breastfeeding: e.target.value })} options={["Exclusive", "Mixed", "Not breastfeeding"]} /></Field>
                </Grid>
                <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase text-mist-400">Danger signs</p>
                <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-4">
                  {DANGER.map((d) => <label key={d} className="flex items-center gap-2 text-sm text-mist-600"><input type="checkbox" className="h-3.5 w-3.5 rounded border-mist-300 text-brand-600" /> {d}</label>)}
                </div>
              </section>
              <label className="flex items-center gap-2 text-sm text-mist-600">
                <input type="checkbox" checked={f.fpCounselled} onChange={(e) => setF({ ...f, fpCounselled: e.target.checked })} className="h-4 w-4 rounded border-mist-300 text-brand-600" />
                Family planning counselled
              </label>
              <Field label="Notes"><Textarea placeholder="Concerns, education provided, follow-up plan…" /></Field>
              <div className="flex justify-end">
                <Button disabled={!f.patientId} onClick={() => setVisits((v) => [{ ...f, id: Math.random(), date: new Date().toISOString() }, ...v])}>Save Visit</Button>
              </div>
            </div>
          ) : visits.length === 0 ? (
            <EmptyState title="No PNC visits yet" hint='Switch to "Record Visit" to add one.' />
          ) : (
            <div className="card p-0">
              <table className="w-full">
                <thead className="border-b border-mist-200 bg-mist-50/60"><tr>{["Visit date", "Timing", "Days PP", "BP", "Uterus", "Breastfeeding"].map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
                <tbody className="divide-y divide-mist-100">
                  {visits.map((v) => (
                    <tr key={v.id}>
                      <td className="td">{shortDate(v.date)}</td><td className="td">{v.timing}</td><td className="td">{v.daysPP}</td>
                      <td className="td">{v.bp || "—"}</td><td className="td">{v.uterus}</td>
                      <td className="td"><Badge tone="brand">{v.breastfeeding}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </Tabs>
    </div>
  );
}
