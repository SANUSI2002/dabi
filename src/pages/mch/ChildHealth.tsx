import { useState } from "react";
import { Baby, Plus } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { GuidelineBanner } from "@/components/clinical/GuidelineBanner";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Textarea } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { useEmr } from "@/store/useEmr";
import { shortDate, ageFromDob } from "@/lib/format";

function classify(muac: number): "Normal" | "MAM" | "SAM" {
  if (muac < 11.5) return "SAM";
  if (muac < 12.5) return "MAM";
  return "Normal";
}

export default function ChildHealth() {
  const { childVisits, cmamScreenings, patientById, addChildVisit, addCmamScreening } = useEmr();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ patientId: "", weight: 0, height: 0, muac: 0, waz: 0, feeding: "Exclusive breastfeeding", date: "" });
  const status = classify(f.muac || 13);

  return (
    <div>
      <PageHeader
        title="Child Health"
        subtitle="Growth monitoring & nutrition surveillance for under-5s"
        actions={<Button onClick={() => setOpen(true)}><Plus size={15} /> Record Visit</Button>}
      />

      <GuidelineBanner guidelineKey="imci-2014" className="mb-5" />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Under-5 Visits" value={childVisits.length} tone="brand" icon={<Baby size={18} />} />
        <StatCard label="Normal" value={childVisits.filter((v) => v.status === "Normal").length} tone="brand" delay={0.05} />
        <StatCard label="MAM" value={childVisits.filter((v) => v.status === "MAM").length} tone="amber" delay={0.1} />
        <StatCard label="SAM" value={childVisits.filter((v) => v.status === "SAM").length} tone="action" delay={0.15} />
      </div>

      <Tabs tabs={["Growth Monitoring", "Nutrition (MUAC)"]}>
        {(t) =>
          t === "Growth Monitoring" ? (
            <Table columns={["Child", "Age", "Visit date", "Weight", "Height", "MUAC", "WAZ", "Status", "Feeding"]}>
              {childVisits.map((v, i) => {
                const p = patientById(v.patientId);
                return (
                  <Row key={v.id} index={i}>
                    <Cell className="font-semibold">{p ? `${p.firstName} ${p.lastName}` : "—"}</Cell>
                    <Cell>{p ? ageFromDob(p.dob) : "—"}</Cell>
                    <Cell>{shortDate(v.date)}</Cell>
                    <Cell>{v.weight} kg</Cell>
                    <Cell>{v.height} cm</Cell>
                    <Cell>{v.muac} cm</Cell>
                    <Cell>{v.waz ?? "—"}</Cell>
                    <Cell>
                      <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                      {v.status !== "Normal" && cmamScreenings.some((c) => c.patientId === v.patientId && c.cls === v.status) && (
                        <span className="ml-1 text-[11px] text-mist-400">→ CMAM</span>
                      )}
                    </Cell>
                    <Cell className="text-mist-500">{v.feeding}</Cell>
                  </Row>
                );
              })}
            </Table>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {(["Normal", "MAM", "SAM"] as const).map((s) => (
                <div key={s} className="card text-center">
                  <p className="text-xs font-bold uppercase text-mist-400">{s}</p>
                  <p className="mt-1 font-display text-3xl font-bold text-mist-900">{childVisits.filter((v) => v.status === s).length}</p>
                </div>
              ))}
            </div>
          )
        }
      </Tabs>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Record Growth Visit"
        footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!f.patientId || !f.date} onClick={() => {
            addChildVisit({ ...f, status } as never);
            if (status !== "Normal") {
              addCmamScreening({
                patientId: f.patientId, date: new Date(f.date).toISOString(), muac: f.muac, oedema: "None",
                appetite: "Pass", cls: status, program: status === "SAM" ? "OTP" : "SFP", source: "Child Health",
              });
            }
            setOpen(false);
          }}>Save Visit</Button></>}
      >
        <div className="space-y-4">
          <Field label="Child (under 5)"><PatientPicker value={f.patientId} onChange={(id) => setF({ ...f, patientId: id })} /></Field>
          <Grid cols={2}>
            <Field label="Visit date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Feeding"><Select value={f.feeding} onChange={(e) => setF({ ...f, feeding: e.target.value })} options={["Exclusive breastfeeding", "Complementary + breast", "Family diet", "Formula"]} /></Field>
          </Grid>
          <Grid cols={3}>
            <Field label="Weight (kg)"><Input type="number" step="0.1" value={f.weight || ""} onChange={(e) => setF({ ...f, weight: +e.target.value })} /></Field>
            <Field label="Height (cm)"><Input type="number" value={f.height || ""} onChange={(e) => setF({ ...f, height: +e.target.value })} /></Field>
            <Field label="MUAC (cm)"><Input type="number" step="0.1" value={f.muac || ""} onChange={(e) => setF({ ...f, muac: +e.target.value })} /></Field>
          </Grid>
          <Field label="Weight-for-age Z (WAZ)"><Input type="number" step="0.1" value={f.waz || ""} onChange={(e) => setF({ ...f, waz: +e.target.value })} /></Field>
          <div className={`rounded-xl px-3 py-2 text-sm font-semibold ${status === "Normal" ? "bg-brand-50 text-brand-700" : status === "MAM" ? "bg-amber-50 text-amber-700" : "bg-action-50 text-action-700"}`}>
            Auto-classification: {status}
            {status === "SAM" && " — auto-enrols in CMAM/OTP on save"}
            {status === "MAM" && " — auto-enrols in CMAM/SFP on save"}
          </div>
        </div>
      </Modal>
    </div>
  );
}
