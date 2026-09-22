import { useState } from "react";
import { Baby, FileCheck2, Stamp, BadgeCheck } from "lucide-react";
import { PageHeader, Button, Badge, StatCard, EmptyState, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Textarea, Grid } from "@/components/ui/form";
import { PatientPicker } from "@/components/ui/PatientPicker";
import { PatientLink } from "@/components/ui/PatientLink";
import { BirthCertificateDoc } from "@/components/print/documents";
import { useEmr } from "@/store/useEmr";
import { shortDate, dateTime } from "@/lib/format";
import type { Sex } from "@/data/types";

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
  const { deliveries, birthRegister, patientById, addDelivery, notifyBirth, registerBirth, issueBirthCertificate } = useEmr();
  const [f, setF] = useState({
    patientId: "", date: "", mode: "SVD", gaWeeks: 39,
    motherStatus: "Alive" as const, bloodLoss: 250,
    babySex: "F" as Sex, babyStatus: "Alive" as const, weight: 3.1, apgar1: 8, apgar5: 10, breastfed1h: true,
    conductedBy: "Dr. Adaeze Okonjo",
  });
  const [certFor, setCertFor] = useState<string | null>(null);
  const [notifyFor, setNotifyFor] = useState<string | null>(null);
  const [nf, setNf] = useState({ babyName: "", informantName: "", informantRelation: "Mother", fatherName: "" });

  const live = deliveries.filter((d) => d.babyStatus === "Alive").length;
  const registeredId = (dId: string) => birthRegister.find((b) => b.deliveryId === dId);
  const notifiedCount = birthRegister.length;
  const certCount = birthRegister.filter((b) => b.status === "Certificate issued").length;

  return (
    <div>
      <PageHeader title="Labour and Delivery" subtitle="Delivery records, NHMIS indicators, birth certificates" />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Deliveries" value={deliveries.length} tone="brand" icon={<Baby size={18} />} />
        <StatCard label="Live Births" value={live} tone="brand" delay={0.05} />
        <StatCard label="Births notified" value={`${notifiedCount}/${live}`} tone={notifiedCount < live ? "amber" : "brand"} delay={0.1} icon={<FileCheck2 size={18} />} />
        <StatCard label="Certificates issued" value={certCount} tone="brand" delay={0.15} icon={<BadgeCheck size={18} />} />
      </div>

      <Tabs tabs={["Record Delivery", "Delivery Records", "Birth Register"]}>
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
                  <Field label="Date & time"><Input type="datetime-local" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
                  <Field label="GA (weeks)"><Input type="number" value={f.gaWeeks} onChange={(e) => setF({ ...f, gaWeeks: +e.target.value })} /></Field>
                  <Field label="Mode"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })} options={["SVD", "Assisted (vacuum)", "Breech", "Caesarean (referred)"]} /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Mother outcome</p>
                <Grid cols={3}>
                  <Field label="Status"><Select value={f.motherStatus} onChange={(e) => setF({ ...f, motherStatus: e.target.value as never })} options={["Alive", "Died", "Referred"]} /></Field>
                  <Field label="Blood loss (ml)"><Input type="number" value={f.bloodLoss} onChange={(e) => setF({ ...f, bloodLoss: +e.target.value })} /></Field>
                  <Field label="Complications"><Input placeholder="None" /></Field>
                </Grid>
              </section>
              <section>
                <p className="mb-2 text-xs font-bold uppercase text-mist-400">Baby outcome</p>
                <Grid cols={3}>
                  <Field label="Sex"><Select value={f.babySex} onChange={(e) => setF({ ...f, babySex: e.target.value as Sex })} options={["F", "M"]} /></Field>
                  <Field label="Birth weight (kg)"><Input type="number" step="0.1" value={f.weight} onChange={(e) => setF({ ...f, weight: +e.target.value })} /></Field>
                  <Field label="Status"><Select value={f.babyStatus} onChange={(e) => setF({ ...f, babyStatus: e.target.value as never })} options={["Alive", "Fresh stillbirth", "Macerated stillbirth"]} /></Field>
                  <Field label="APGAR @ 1 min"><Input type="number" value={f.apgar1} onChange={(e) => setF({ ...f, apgar1: +e.target.value })} /></Field>
                  <Field label="APGAR @ 5 min"><Input type="number" value={f.apgar5} onChange={(e) => setF({ ...f, apgar5: +e.target.value })} /></Field>
                  <Field label="Breastfeeding within 1 hr"><Select value={f.breastfed1h ? "Yes" : "No"} onChange={(e) => setF({ ...f, breastfed1h: e.target.value === "Yes" })} options={["Yes", "No"]} /></Field>
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
                <Button
                  disabled={!f.patientId || !f.date}
                  onClick={() => { addDelivery({ ...f, date: new Date(f.date).toISOString() }); setF({ ...f, patientId: "", date: "" }); }}
                >
                  Save Delivery
                </Button>
              </div>
            </div>
          ) : t === "Delivery Records" ? (
            deliveries.length === 0 ? (
              <EmptyState title="No deliveries recorded yet" hint='Switch to "Record Delivery" to add one.' />
            ) : (
              <Table columns={["Mother", "Date", "Mode", "GA", "Mother", "Baby", "Weight", "APGAR", ""]}>
                {deliveries.map((d, i) => {
                  const p = patientById(d.patientId);
                  return (
                    <Row key={d.id} index={i}>
                      <Cell className="font-semibold"><PatientLink patient={p} /></Cell>
                      <Cell>{shortDate(d.date)}</Cell>
                      <Cell>{d.mode}</Cell>
                      <Cell>{d.gaWeeks}w</Cell>
                      <Cell><Badge tone={d.motherStatus === "Alive" ? "brand" : "action"}>{d.motherStatus}</Badge></Cell>
                      <Cell><Badge tone={d.babyStatus === "Alive" ? "brand" : "action"}>{d.babyStatus}</Badge></Cell>
                      <Cell>{d.weight} kg</Cell>
                      <Cell>{d.apgar1}/{d.apgar5}</Cell>
                      <Cell>
                        {d.babyStatus === "Alive" && !registeredId(d.id) && (
                          <button
                            onClick={() => { setNotifyFor(d.id); setNf({ babyName: "", informantName: p ? `${p.firstName} ${p.lastName}` : "", informantRelation: "Mother", fatherName: "" }); }}
                            className="btn-primary px-2.5 py-1 text-xs"
                          >
                            <FileCheck2 size={12} /> Notify birth
                          </button>
                        )}
                        {registeredId(d.id) && (
                          <Badge tone={statusTone(registeredId(d.id)!.status)}>{registeredId(d.id)!.status}</Badge>
                        )}
                      </Cell>
                    </Row>
                  );
                })}
              </Table>
            )
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-mist-400">
                Statutory register under the Births, Deaths etc. (Compulsory Registration) Act. Notify → register with NPopC →
                issue certificate. Entries are built from live-birth deliveries and written to the audit log.
              </p>
              <Table columns={["Notification / Reg no.", "Baby", "Born", "Mother", "Informant", "Status", ""]}>
                {birthRegister.map((b, i) => (
                  <Row key={b.id} index={i}>
                    <Cell className="font-mono text-[11px]">
                      {b.npopcNo}
                      {b.regNo && <span className="block text-brand-600">{b.regNo}</span>}
                    </Cell>
                    <Cell className="font-semibold">
                      {b.babyName || <span className="text-mist-400">unnamed</span>}
                      <span className="block text-[11px] font-normal text-mist-400">{b.sex} · {b.weight} kg</span>
                    </Cell>
                    <Cell>{dateTime(b.bornAt)}</Cell>
                    <Cell><PatientLink patient={patientById(b.patientId)} /></Cell>
                    <Cell className="text-mist-500">{b.informantName}<span className="block text-[11px] text-mist-400">{b.informantRelation}</span></Cell>
                    <Cell><Badge tone={statusTone(b.status)}>{b.status}</Badge></Cell>
                    <Cell>
                      <div className="flex justify-end gap-1.5">
                        {b.status === "Notified" && (
                          <button onClick={() => registerBirth(b.id)} className="btn-primary px-2.5 py-1 text-xs"><Stamp size={12} /> Register</button>
                        )}
                        {b.status === "Registered" && (
                          <button onClick={() => issueBirthCertificate(b.id)} className="btn-primary px-2.5 py-1 text-xs"><BadgeCheck size={12} /> Issue certificate</button>
                        )}
                        {b.status === "Certificate issued" && (
                          <button onClick={() => setCertFor(b.patientId)} className="btn-soft px-2.5 py-1 text-xs">Print certificate</button>
                        )}
                      </div>
                    </Cell>
                  </Row>
                ))}
                {birthRegister.length === 0 && (
                  <Row><Cell className="text-mist-400">No births notified yet — use “Notify birth” on a live-birth delivery.</Cell><Cell /><Cell /><Cell /><Cell /><Cell /><Cell /></Row>
                )}
              </Table>
            </div>
          )
        }
      </Tabs>

      {certFor && patientById(certFor) && (
        <BirthCertificateDoc patient={patientById(certFor)!} open onClose={() => setCertFor(null)} />
      )}

      <Modal
        open={!!notifyFor}
        onClose={() => setNotifyFor(null)}
        title="Birth notification"
        footer={<><Button variant="ghost" onClick={() => setNotifyFor(null)}>Cancel</Button>
          <Button
            disabled={!nf.informantName.trim()}
            onClick={() => { if (notifyFor) notifyBirth(notifyFor, nf); setNotifyFor(null); }}
          ><FileCheck2 size={14} /> Issue notification</Button></>}
      >
        {(() => {
          const d = notifyFor ? deliveries.find((x) => x.id === notifyFor) : undefined;
          const p = d ? patientById(d.patientId) : undefined;
          return (
            <div className="space-y-4">
              {d && (
                <div className="rounded-xl bg-mist-50 px-3 py-2 text-sm text-mist-600">
                  <b>{p ? `${p.firstName} ${p.lastName}` : "—"}</b> · delivered {dateTime(d.date)} · {d.babySex} · {d.weight} kg · {d.mode}
                </div>
              )}
              <Field label="Child's name (may be added later)">
                <Input value={nf.babyName} onChange={(e) => setNf({ ...nf, babyName: e.target.value })} placeholder="Baby of …" />
              </Field>
              <Grid cols={2}>
                <Field label="Informant"><Input value={nf.informantName} onChange={(e) => setNf({ ...nf, informantName: e.target.value })} /></Field>
                <Field label="Relationship">
                  <Select value={nf.informantRelation} onChange={(e) => setNf({ ...nf, informantRelation: e.target.value })} options={["Mother", "Father", "Grandparent", "Guardian", "Health worker"]} />
                </Field>
              </Grid>
              <Field label="Father's name (optional)"><Input value={nf.fatherName} onChange={(e) => setNf({ ...nf, fatherName: e.target.value })} /></Field>
              <p className="rounded-xl bg-mist-50 px-3 py-2 text-xs text-mist-500">
                A birth-notification number is generated immediately. Registration with NPopC and certificate issue are the
                next steps in the register.
              </p>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
