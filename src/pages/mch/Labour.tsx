import { useState } from "react";
import { Baby } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, EmptyState } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Field, Input, Select, Textarea, Grid, Checkbox } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";

const NHMIS_LABOUR = [
  "Decision-to-seek-care ≤ 24 hours", "Arrived by ambulance / referral",
  "Labour monitored with partograph", "Delivery by Skilled Birth Attendant (SBA)",
  "Uterotonic given in 3rd stage",
];
const NHMIS_NEWBORN = [
  "Cord clamped / cut after 1 minute", "Chlorhexidine applied to cord",
  "Skin-to-skin within 1 hour", "Early initiation of breastfeeding (< 1 hr)",
  "Newborn temperature taken at 1 hour",
];

export default function Labour() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [f, setF] = useState<any>({ patientId: "", mode: "SVD", gaWeeks: 39, motherStatus: "Alive", bloodLoss: 250, babySex: "F", apgar1: 8, apgar5: 10, weight: 3.1, breastfeed: true });

  return (
    <div>
      <PageHeader title="Labour and Delivery" subtitle="Delivery records, NHMIS indicators, birth certificates" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deliveries" value={deliveries.length} tone="brand" icon={<Baby size={18} />} />
        <StatCard label="Live Births" value={deliveries.filter((d) => d.motherStatus === "Alive").length} tone="brand" delay={0.05} />
        <StatCard label="Stillbirths" value={0} tone="action" delay={0.1} />
        <StatCard label="Birth Certs Issued" value={0} tone="mist" delay={0.15} />
      </div>

      <Tabs tabs={["Record Delivery", "Delivery Records", "Birth Certificates"]}>
        {(t) =>
          t === "Record Delivery" ? (
            <div className="card space-y-5">
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Mother & ANC link</p>
                <Grid cols={2}>
                  <Field label="Patient"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} filter={(p) => p.sex === "F"} /></Field>
                  <Field label="Booking status"><Select options={["Booked", "Unbooked", "Referred in"]} /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Delivery</p>
                <Grid cols={3}>
                  <Field label="Date & time"><Input type="datetime-local" /></Field>
                  <Field label="GA (weeks)"><Input type="number" value={f.gaWeeks} onChange={(e) => setF({ ...f, gaWeeks: +e.target.value })} /></Field>
                  <Field label="Mode"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={["SVD", "Assisted (vacuum)", "Breech", "Caesarean (referred)"]} /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Mother outcome</p>
                <Grid cols={3}>
                  <Field label="Status"><Select value={f.motherStatus} onChange={(e) => setF({ ...f, motherStatus: e.target.value })} options={["Alive", "Died", "Referred"]} /></Field>
                  <Field label="Blood loss (ml)"><Input type="number" value={f.bloodLoss} onChange={(e) => setF({ ...f, bloodLoss: +e.target.value })} /></Field>
                  <Field label="Complications"><Input placeholder="None" /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Baby outcome</p>
                <Grid cols={3}>
                  <Field label="Sex"><Select value={f.babySex} onChange={(e) => setF({ ...f, babySex: e.target.value })} options={["F", "M"]} /></Field>
                  <Field label="Birth weight (kg)"><Input type="number" step="0.1" value={f.weight} onChange={(e) => setF({ ...f, weight: +e.target.value })} /></Field>
                  <Field label="Status"><Select options={["Alive", "Fresh stillbirth", "Macerated stillbirth"]} /></Field>
                  <Field label="APGAR @ 1 min"><Input type="number" value={f.apgar1} onChange={(e) => setF({ ...f, apgar1: +e.target.value })} /></Field>
                  <Field label="APGAR @ 5 min"><Input type="number" value={f.apgar5} onChange={(e) => setF({ ...f, apgar5: +e.target.value })} /></Field>
                  <Field label="Breastfeeding within 1 hr"><Select options={["Yes", "No"]} /></Field>
                </Grid>
              </section>
              <section className="rounded-2xl bg-brand-gradient p-4 text-white">
                <p className="mb-3 text-xs font-bold uppercase text-white/80">NHMIS Delivery Indicators</p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase text-white/70">Labour details</p>
                    <div className="space-y-1 text-sm text-white/90">
                      {NHMIS_LABOUR.map((x) => <label key={x} className="flex items-center gap-2"><input type="checkbox" className="h-3.5 w-3.5 rounded border-white/40 bg-white/20" /> {x}</label>)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[11px] font-bold uppercase text-white/70">Newborn care</p>
                    <div className="space-y-1 text-sm text-white/90">
                      {NHMIS_NEWBORN.map((x) => <label key={x} className="flex items-center gap-2"><input type="checkbox" className="h-3.5 w-3.5 rounded border-white/40 bg-white/20" /> {x}</label>)}
                    </div>
                  </div>
                </div>
              </section>
              <Field label="Conducted by & notes"><Textarea placeholder="Brief notes / complications…" /></Field>
              <div className="flex justify-end">
                <Button disabled={!f.patientId} onClick={() => setDeliveries((d) => [{ ...f, id: Math.random() }, ...d])}>Save Delivery</Button>
              </div>
            </div>
          ) : t === "Delivery Records" ? (
            deliveries.length === 0 ? (
              <EmptyState title="No deliveries recorded yet" hint='Switch to "Record Delivery" to add one.' />
            ) : (
              <div className="card p-0">
                <table className="w-full">
                  <thead className="border-b border-mist-200 bg-mist-50/60"><tr>{["Mode", "GA", "Mother", "Baby sex", "Weight", "APGAR"].map((c) => <th key={c} className="th">{c}</th>)}</tr></thead>
                  <tbody className="divide-y divide-mist-100">
                    {deliveries.map((d) => (
                      <tr key={d.id}>
                        <td className="td">{d.mode}</td><td className="td">{d.gaWeeks}w</td>
                        <td className="td"><Badge tone="brand">{d.motherStatus}</Badge></td>
                        <td className="td">{d.babySex}</td><td className="td">{d.weight} kg</td>
                        <td className="td">{d.apgar1}/{d.apgar5}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <EmptyState title="No birth certificates issued" hint="Certificates can be issued from Registration or after recording a live birth." />
          )
        }
      </Tabs>
    </div>
  );
}
