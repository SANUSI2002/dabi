import { useMemo, useState } from "react";
import { Syringe, Printer, TriangleAlert, ShieldCheck } from "lucide-react";
import { PageHeader, Button, Badge, StatCard } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { ImmunizationCardDoc } from "@/components/print/documents";
import { useEmr } from "@/store/useEmr";
import { useIdentity } from "@/store/useIdentity";
import { VACCINES } from "@/data/catalog";
import { shortDate, dateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { differenceInWeeks } from "date-fns";
import type { Aefi } from "@/data/types";

const ageWeeksOf = (dob: string) => differenceInWeeks(new Date(), new Date(dob));

export default function Immunization() {
  const { patients, patientById, immunizations, recordImmunization, recordAefi } = useEmr();
  const me = useIdentity((s) => s.user.name);
  const [pid, setPid] = useState<string | null>(patients.find((p) => p.category === "U5")?.id ?? null);
  const [printCard, setPrintCard] = useState(false);
  const [giveFor, setGiveFor] = useState<{ code: string; name: string; site: string } | null>(null);
  const [gf, setGf] = useState({ batchNo: "", site: "" });
  const [aefiFor, setAefiFor] = useState<string | null>(null);
  const [af, setAf] = useState<{ symptoms: string; severity: Aefi["severity"]; onsetHours: number; action: string }>({ symptoms: "", severity: "Non-serious", onsetHours: 6, action: "" });

  const child = patientById(pid);
  const childImm = useMemo(() => immunizations.filter((i) => i.patientId === pid), [immunizations, pid]);
  const givenMap = useMemo(() => Object.fromEntries(childImm.map((i) => [i.vaccineCode, i])), [childImm]);
  const ageWeeks = child ? ageWeeksOf(child.dob) : 0;

  const schedule = VACCINES.map((v) => {
    const rec = givenMap[v.code];
    const status = rec ? "Given" : ageWeeks >= v.ageWeeks + 4 ? "Overdue" : ageWeeks >= v.ageWeeks ? "Due" : "Upcoming";
    return { ...v, status, rec };
  });

  const u5 = patients.filter((p) => p.category === "U5");
  const defaulters = u5.flatMap((p) => {
    const gm = new Set(immunizations.filter((i) => i.patientId === p.id).map((i) => i.vaccineCode));
    const aw = ageWeeksOf(p.dob);
    return VACCINES.filter((v) => !gm.has(v.code) && aw >= v.ageWeeks + 4).map((v) => ({ p, v, weeksLate: aw - v.ageWeeks }));
  });

  const aefiRecords = immunizations.filter((i) => i.aefi);
  const givenGiven = Object.fromEntries(immunizations.filter((i) => i.patientId === pid).map((i) => [i.vaccineCode, i.givenAt]));

  return (
    <div>
      <PageHeader title="Immunization" subtitle="Routine EPI schedule, defaulter tracking & AEFI — persisted & NHMIS-fed" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Doses given (total)" value={immunizations.length} tone="brand" icon={<Syringe size={18} />} />
        <StatCard label="Children reached" value={new Set(immunizations.map((i) => i.patientId)).size} tone="mist" delay={0.05} />
        <StatCard label="Defaulter children" value={new Set(defaulters.map((d) => d.p.id)).size} tone={defaulters.length ? "action" : "brand"} delay={0.1} />
        <StatCard label="AEFI reported" value={aefiRecords.length} tone={aefiRecords.some((r) => r.aefi!.severity === "Serious") ? "action" : "mist"} delay={0.15} icon={<TriangleAlert size={18} />} />
      </div>

      <Tabs tabs={["Give Vaccine", `Defaulters (${new Set(defaulters.map((d) => d.p.id)).size})`, `AEFI (${aefiRecords.length})`, "Women (TD)"]}>
        {(t) =>
          t === "Give Vaccine" ? (
            <div className="space-y-4">
              <div className="card flex flex-wrap items-center gap-4">
                <div className="min-w-[280px] flex-1"><PatientPicker value={pid} onChange={setPid} placeholder="Search child…" filter={(p) => p.category === "U5"} /></div>
                {child && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-mist-400">Age: <b className="text-mist-700">{ageWeeks} weeks</b> · {childImm.length} doses on file</span>
                    <Button variant="ghost" className="text-xs" onClick={() => setPrintCard(true)}><Printer size={13} /> Print card</Button>
                  </div>
                )}
              </div>

              {child && (
                <Table columns={["Vaccine", "Due age", "Dose", "Route / Site", "Status", "Given", ""]}>
                  {schedule.map((v, vi) => (
                    <Row key={v.code} index={vi} className={v.status === "Overdue" ? "bg-action-50/40" : undefined}>
                      <Cell className="font-medium">{v.name}<span className="block text-[11px] text-mist-400">{v.code}{v.rec ? ` · batch ${v.rec.batchNo}` : ""}</span></Cell>
                      <Cell>{v.ageLabel}</Cell>
                      <Cell>{v.dose}</Cell>
                      <Cell className="text-mist-500">{v.route} · {v.site}</Cell>
                      <Cell>
                        <Badge tone={v.status === "Given" ? "brand" : v.status === "Overdue" ? "action" : v.status === "Due" ? "amber" : "mist"}>{v.status}</Badge>
                        {v.rec?.aefi && <Badge tone="action"><TriangleAlert size={10} /> AEFI</Badge>}
                      </Cell>
                      <Cell className="text-mist-400">{v.rec ? shortDate(v.rec.givenAt) : "—"}</Cell>
                      <Cell>
                        <div className="flex justify-end gap-1.5">
                          {!v.rec && (v.status === "Due" || v.status === "Overdue") && (
                            <button onClick={() => { setGiveFor({ code: v.code, name: v.name, site: v.site }); setGf({ batchNo: "", site: v.site }); }} className="btn-primary px-2.5 py-1 text-xs">Give</button>
                          )}
                          {v.rec && !v.rec.aefi && (
                            <button onClick={() => { setAefiFor(v.rec!.id); setAf({ symptoms: "", severity: "Non-serious", onsetHours: 6, action: "" }); }} className="btn-ghost px-2 py-1 text-xs">Report AEFI</button>
                          )}
                        </div>
                      </Cell>
                    </Row>
                  ))}
                </Table>
              )}
            </div>
          ) : t.startsWith("Defaulters") ? (
            <Table columns={["Child", "Age (wk)", "Vaccine due", "Due age", "Weeks late"]}>
              {defaulters.sort((a, b) => b.weeksLate - a.weeksLate).map((d, i) => (
                <Row key={`${d.p.id}-${d.v.code}`} index={i}>
                  <Cell><PatientLink patient={d.p} /></Cell>
                  <Cell>{ageWeeksOf(d.p.dob)}</Cell>
                  <Cell className="font-medium">{d.v.name}</Cell>
                  <Cell className="text-mist-500">{d.v.ageLabel}</Cell>
                  <Cell><Badge tone="action">{d.weeksLate} wk</Badge></Cell>
                </Row>
              ))}
              {defaulters.length === 0 && <Row><Cell className="text-mist-400">No under-5 defaulters — all antigens up to date.</Cell><Cell /><Cell /><Cell /><Cell /></Row>}
            </Table>
          ) : t.startsWith("AEFI") ? (
            <Table columns={["Child", "Vaccine", "Symptoms", "Severity", "Onset", "Action", "Reported"]}>
              {aefiRecords.map((r, i) => (
                <Row key={r.id} index={i}>
                  <Cell><PatientLink patient={patientById(r.patientId)} /></Cell>
                  <Cell>{r.vaccineName}</Cell>
                  <Cell className="max-w-[240px] text-mist-600">{r.aefi!.symptoms}</Cell>
                  <Cell><Badge tone={r.aefi!.severity === "Serious" ? "action" : "amber"}>{r.aefi!.severity}</Badge></Cell>
                  <Cell>{r.aefi!.onsetHours}h</Cell>
                  <Cell className="text-mist-500">{r.aefi!.action}</Cell>
                  <Cell className="text-mist-400">{dateTime(r.aefi!.reportedAt)}</Cell>
                </Row>
              ))}
              {aefiRecords.length === 0 && <Row><Cell className="text-mist-400">No AEFI reported. Serious events auto-notify Surveillance.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>}
            </Table>
          ) : (
            <div className="card">
              <p className="mb-3 text-sm text-mist-500">Tetanus–Diphtheria (TD) for women 15–49. Schedule TD1–TD5.</p>
              <div className="grid gap-2 sm:grid-cols-5">
                {["TD1", "TD2", "TD3", "TD4", "TD5"].map((d, i) => (
                  <div key={d} className="rounded-xl bg-mist-50 p-3 text-center text-sm ring-1 ring-mist-200">
                    <p className="font-bold text-mist-800">{d}</p>
                    <p className="text-[11px] text-mist-400">{["At contact", "+4 weeks", "+6 months", "+1 year", "+1 year"][i]}</p>
                  </div>
                ))}
              </div>
            </div>
          )
        }
      </Tabs>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[11px] text-mist-300">
        <ShieldCheck size={12} /> Doses persist to the record, feed the Immunization report and the NHMIS EPI dataset
      </p>

      <Modal
        open={!!giveFor}
        onClose={() => setGiveFor(null)}
        title={`Give ${giveFor?.name ?? ""}`}
        footer={<><Button variant="ghost" onClick={() => setGiveFor(null)}>Cancel</Button>
          <Button disabled={!gf.batchNo.trim() || !gf.site.trim() || !pid} onClick={() => {
            if (pid && giveFor) recordImmunization(pid, { vaccineCode: giveFor.code, vaccineName: giveFor.name, batchNo: gf.batchNo.trim(), site: gf.site.trim(), givenBy: me });
            setGiveFor(null);
          }}>Record dose</Button></>}
      >
        <div className="space-y-4">
          {child && <p className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600"><b>{child.firstName} {child.lastName}</b> · {ageWeeks} weeks · MRN {child.mrn}</p>}
          <Field label="Batch / lot number"><Input value={gf.batchNo} onChange={(e) => setGf({ ...gf, batchNo: e.target.value })} placeholder="e.g. PENTA-1120" /></Field>
          <Field label="Site"><Input value={gf.site} onChange={(e) => setGf({ ...gf, site: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal
        open={!!aefiFor}
        onClose={() => setAefiFor(null)}
        title="Report Adverse Event Following Immunization"
        footer={<><Button variant="ghost" onClick={() => setAefiFor(null)}>Cancel</Button>
          <Button variant={af.severity === "Serious" ? "action" : "primary"} disabled={!af.symptoms.trim() || !af.action.trim()} onClick={() => {
            if (aefiFor) recordAefi(aefiFor, { ...af, reportedBy: me });
            setAefiFor(null);
          }}>{af.severity === "Serious" ? "Report & notify Surveillance" : "Record AEFI"}</Button></>}
      >
        <div className="space-y-4">
          <Field label="Symptoms / reaction"><Input value={af.symptoms} onChange={(e) => setAf({ ...af, symptoms: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Severity"><Select value={af.severity} onChange={(e) => setAf({ ...af, severity: e.target.value as Aefi["severity"] })} options={["Non-serious", "Serious"]} /></Field>
            <Field label="Onset (hours after dose)"><Input type="number" value={af.onsetHours} onChange={(e) => setAf({ ...af, onsetHours: +e.target.value })} /></Field>
          </div>
          <Field label="Action taken"><Input value={af.action} onChange={(e) => setAf({ ...af, action: e.target.value })} /></Field>
          {af.severity === "Serious" && (
            <p className="rounded-xl bg-action-50 px-3 py-2 text-xs text-action-700 ring-1 ring-action-200">
              A serious AEFI opens a suspected case in Surveillance for IDSR review.
            </p>
          )}
        </div>
      </Modal>

      {child && printCard && <ImmunizationCardDoc patient={child} given={givenGiven} open onClose={() => setPrintCard(false)} />}
    </div>
  );
}
