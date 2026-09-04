import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Printer, ListPlus, Receipt, CalendarPlus, Stethoscope } from "lucide-react";
import { Button, Badge, StatCard, statusTone } from "@/components/ui/primitives";
import { Tabs } from "@/components/ui/Tabs";
import { Table, Row, Cell } from "@/components/ui/Table";
import { ConsolidatedEmrDoc, PatientCardDoc } from "@/components/print/documents";
import { useEmr, serviceLine } from "@/store/useEmr";
import { PATIENT_CATEGORIES } from "@/data/catalog";
import { ageFromDob, shortDate, dateTime, naira, initials } from "@/lib/format";

export default function PatientChart() {
  const { id } = useParams();
  const nav = useNavigate();
  const emr = useEmr();
  const p = emr.patientById(id);
  const [doc, setDoc] = useState<"emr" | "card" | null>(null);

  if (!p) {
    return (
      <div className="card py-20 text-center text-mist-400">
        Patient not found. <Link to="/registration" className="text-brand-700 underline">Back to registry</Link>
      </div>
    );
  }

  const encs = emr.encounters.filter((e) => e.patientId === p.id);
  const labs = emr.labOrders.filter((l) => l.patientId === p.id);
  const meds = encs.flatMap((e) => e.prescriptions.map((r) => ({ ...r, date: e.date })));
  const invoices = emr.invoices.filter((i) => i.patientId === p.id);
  const appts = emr.appointments.filter((a) => a.patientId === p.id);
  const adms = emr.admissions.filter((a) => a.patientId === p.id);
  const xfers = emr.transfers.filter((t) => t.patientId === p.id);
  const imms = emr.immunizations.filter((i) => i.patientId === p.id);
  const vitals = emr.vitals[p.id] ?? [];
  const cat = PATIENT_CATEGORIES.find((c) => c.code === p.category);
  const balance = invoices.filter((i) => i.status === "Unpaid").reduce((n, i) => n + i.lines.reduce((m, l) => m + l.qty * l.unitPrice, 0), 0);

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-mist-500 hover:text-mist-800">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="card mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-lg font-bold text-white">
            {initials(`${p.firstName} ${p.lastName}`)}
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-mist-900">
              {p.firstName} {p.lastName} {p.otherName ?? ""}
            </h1>
            <p className="mt-0.5 text-sm text-mist-500">
              <span className="font-mono">{p.mrn}</span> · {ageFromDob(p.dob)} · {p.sex === "M" ? "Male" : "Female"} ·{" "}
              {p.phone ?? "no phone"}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="mist">{p.payer}</Badge>
              {cat?.exempt ? <Badge tone="brand">{cat.name} · exempt</Badge> : <Badge tone="mist">{cat?.name}</Badge>}
              {p.allergies && p.allergies !== "NKA" ? <Badge tone="action">Allergy: {p.allergies}</Badge> : <Badge tone="brand">NKA</Badge>}
              {p.bloodGroup && <Badge tone="mist">{p.bloodGroup}</Badge>}
              {balance > 0 && <Badge tone="action">Balance {naira(balance)}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" onClick={() => { emr.addToQueue(p.id, "Vital" as never, "Normal" as never); nav("/queue"); }}>
            <ListPlus size={14} /> Add to Queue
          </Button>
          <Button variant="ghost" onClick={() => nav("/appointments")}><CalendarPlus size={14} /> Appointment</Button>
          <Button variant="ghost" onClick={() => { emr.createInvoice(p.id, [serviceLine("CONS")]); nav("/billing"); }}>
            <Receipt size={14} /> Invoice
          </Button>
          <Button variant="ghost" onClick={() => setDoc("card")}><Printer size={14} /> Card</Button>
          <Button onClick={() => setDoc("emr")}><Printer size={14} /> Consolidated EMR</Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Encounters" value={encs.length} tone="brand" icon={<Stethoscope size={18} />} />
        <StatCard label="Lab tests" value={labs.length} tone="mist" delay={0.05} />
        <StatCard label="Prescriptions" value={meds.length} tone="mist" delay={0.1} />
        <StatCard label="Outstanding" value={naira(balance)} tone={balance > 0 ? "action" : "mist"} delay={0.15} />
      </div>

      <Tabs tabs={["Timeline", `Encounters (${encs.length})`, `Labs (${labs.length})`, `Meds (${meds.length})`, "Vitals", `Billing (${invoices.length})`, "Appointments", "Admissions"]}>
        {(t) => {
          if (t === "Timeline") {
            const items = [
              ...encs.map((e) => ({ ts: e.date, kind: "Encounter", text: `${e.complaint} — ${e.provider}` })),
              ...labs.map((l) => ({ ts: l.orderedAt, kind: "Lab", text: `${l.test}: ${l.result ?? l.status}` })),
              ...invoices.map((i) => ({ ts: i.createdAt, kind: "Invoice", text: `${i.number} · ${i.status}` })),
              ...appts.map((a) => ({ ts: a.date, kind: "Appointment", text: `${a.type} with ${a.provider} · ${a.status}` })),
              ...adms.map((a) => ({ ts: a.admittedAt, kind: "Admission", text: `${a.ward} · ${a.diagnosis}` })),
              ...xfers.map((t) => ({ ts: t.date, kind: "Transfer", text: `${t.direction === "Out" ? "Out to" : "In from"} ${t.facility} · ${t.reason} · ${t.status}` })),
              ...imms.map((i) => ({ ts: i.givenAt, kind: "Immunization", text: `${i.vaccineName} · batch ${i.batchNo}${i.aefi ? ` · AEFI (${i.aefi.severity})` : ""}` })),
            ].sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
            return (
              <div className="card">
                <div className="space-y-4">
                  {items.map((it, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-gradient" />
                        {i < items.length - 1 && <span className="w-px flex-1 bg-mist-200" />}
                      </div>
                      <div className="pb-1">
                        <p className="text-sm">
                          <Badge tone="mist">{it.kind}</Badge>{" "}
                          <span className="text-mist-700">{it.text}</span>
                        </p>
                        <p className="text-[11px] text-mist-400">{dateTime(it.ts)}</p>
                      </div>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-sm text-mist-400">No activity recorded for this patient yet.</p>}
                </div>
              </div>
            );
          }
          if (t.startsWith("Encounters"))
            return (
              <Table columns={["Date", "Provider", "Complaint", "Diagnoses", "Plan"]}>
                {encs.map((e, i) => (
                  <Row key={e.id} index={i}>
                    <Cell>{shortDate(e.date)}</Cell>
                    <Cell className="font-semibold">{e.provider}</Cell>
                    <Cell>{e.complaint}</Cell>
                    <Cell>{e.diagnoses.map((d) => d.name).join(", ") || "—"}</Cell>
                    <Cell className="text-mist-500">{e.plan ?? "—"}</Cell>
                  </Row>
                ))}
              </Table>
            );
          if (t.startsWith("Labs"))
            return (
              <Table columns={["Test", "Ordered", "Status", "Result", "Flag"]}>
                {labs.map((l, i) => (
                  <Row key={l.id} index={i}>
                    <Cell className="font-semibold">{l.test}</Cell>
                    <Cell>{dateTime(l.orderedAt)}</Cell>
                    <Cell><Badge tone={statusTone(l.status)}>{l.status}</Badge></Cell>
                    <Cell>{l.result ?? "—"}</Cell>
                    <Cell>{l.flag ? <Badge tone={statusTone(l.flag)}>{l.flag}</Badge> : "—"}</Cell>
                  </Row>
                ))}
              </Table>
            );
          if (t.startsWith("Meds"))
            return (
              <Table columns={["Drug", "Dose", "Frequency", "Duration", "Qty", "Status"]}>
                {meds.map((m, i) => (
                  <Row key={i} index={i}>
                    <Cell className="font-semibold">{m.drug}</Cell>
                    <Cell>{m.dose}</Cell>
                    <Cell>{m.frequency}</Cell>
                    <Cell>{m.duration}</Cell>
                    <Cell>{m.qty}</Cell>
                    <Cell><Badge tone={statusTone(m.status)}>{m.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            );
          if (t === "Vitals")
            return (
              <Table columns={["Taken", "BP", "Temp", "Pulse", "Resp", "SpO₂", "Weight", "By"]}>
                {vitals.map((v, i) => (
                  <Row key={i} index={i}>
                    <Cell>{dateTime(v.takenAt)}</Cell>
                    <Cell>{v.bp ?? "—"}</Cell>
                    <Cell>{v.temp ? `${v.temp}°C` : "—"}</Cell>
                    <Cell>{v.pulse ?? "—"}</Cell>
                    <Cell>{v.resp ?? "—"}</Cell>
                    <Cell>{v.spo2 ? `${v.spo2}%` : "—"}</Cell>
                    <Cell>{v.weight ? `${v.weight} kg` : "—"}</Cell>
                    <Cell className="text-mist-500">{v.takenBy}</Cell>
                  </Row>
                ))}
              </Table>
            );
          if (t.startsWith("Billing"))
            return (
              <Table columns={["Invoice", "Date", "Items", "Amount", "Status"]}>
                {invoices.map((inv, i) => (
                  <Row key={inv.id} index={i}>
                    <Cell className="font-mono text-xs">{inv.number}</Cell>
                    <Cell>{shortDate(inv.createdAt)}</Cell>
                    <Cell className="text-mist-500">{inv.lines.map((l) => l.name).join(", ")}</Cell>
                    <Cell className="font-semibold">{naira(inv.lines.reduce((n, l) => n + l.qty * l.unitPrice, 0))}</Cell>
                    <Cell><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            );
          if (t === "Appointments")
            return (
              <Table columns={["Date", "Time", "Type", "Provider", "Status"]}>
                {appts.map((a, i) => (
                  <Row key={a.id} index={i}>
                    <Cell>{shortDate(a.date)}</Cell>
                    <Cell>{a.time}</Cell>
                    <Cell><Badge tone="mist">{a.type}</Badge></Cell>
                    <Cell>{a.provider}</Cell>
                    <Cell><Badge tone={statusTone(a.status)}>{a.status}</Badge></Cell>
                  </Row>
                ))}
              </Table>
            );
          return (
            <Table columns={["Ward", "Bed", "Diagnosis", "Admitted", "Status", "Outcome"]}>
              {adms.map((a, i) => (
                <Row key={a.id} index={i}>
                  <Cell className="font-semibold">{a.ward}</Cell>
                  <Cell>{a.bed}</Cell>
                  <Cell>{a.diagnosis}</Cell>
                  <Cell>{dateTime(a.admittedAt)}</Cell>
                  <Cell><Badge tone={statusTone(a.status)}>{a.status}</Badge></Cell>
                  <Cell>{a.outcome ?? "—"}</Cell>
                </Row>
              ))}
            </Table>
          );
        }}
      </Tabs>

      {doc === "emr" && <ConsolidatedEmrDoc patient={p} encounters={encs} labs={labs} open onClose={() => setDoc(null)} />}
      {doc === "card" && <PatientCardDoc patient={p} open onClose={() => setDoc(null)} />}
    </div>
  );
}
