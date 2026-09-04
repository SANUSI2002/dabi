import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, CreditCard, ScrollText, ListPlus, MoreVertical } from "lucide-react";
import { PageHeader, Button, Badge } from "@/components/ui/primitives";
import { Table, Row, Cell } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid } from "@/components/ui/form";
import { useEmr } from "@/store/useEmr";
import { PATIENT_CATEGORIES } from "@/data/catalog";
import { ageFromDob, shortDate } from "@/lib/format";
import { PatientCardDoc, BirthCertificateDoc } from "@/components/print/documents";
import { PatientLink } from "@/components/ui/PatientLink";
import type { Patient, Sex, Payer } from "@/data/types";

const blank = {
  firstName: "", lastName: "", otherName: "", sex: "F" as Sex, dob: "",
  phone: "", address: "", lga: "Amuwo-Odofin", state: "Lagos", ward: "",
  category: "GEN", payer: "Out of Pocket" as Payer, nin: "", bloodGroup: "",
  allergies: "", nextOfKin: "", nokPhone: "",
};

export default function Registration() {
  const nav = useNavigate();
  const { patients, registerPatient, addToQueue } = useEmr();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const [row, setRow] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ kind: "card" | "birth"; patient: Patient } | null>(null);

  const set = (k: keyof typeof blank, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const list = patients.filter((p) =>
    `${p.firstName} ${p.lastName} ${p.mrn} ${p.phone ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  const cat = (c: string) => PATIENT_CATEGORIES.find((x) => x.code === c);

  return (
    <div>
      <PageHeader
        title="Patient Registry"
        subtitle={`${patients.length} patients · 6,763 households`}
        actions={
          <>
            <Button variant="ghost">
              <ScrollText size={15} /> Review Duplicates
            </Button>
            <Button onClick={() => { setForm(blank); setOpen(true); }}>
              <UserPlus size={15} /> New Patient
            </Button>
          </>
        }
      />

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, file number, MRN, phone…"
        className="input mb-4 max-w-md"
      />

      <Table columns={["File Number", "Name", "Age / Sex", "Payer / Category", "Location", ""]}>
        {list.map((p, i) => (
          <Row key={p.id} index={i} active={row === p.id}>
            <Cell className="font-mono text-[11px] text-mist-500">{p.mrn}</Cell>
            <Cell>
              <PatientLink patient={p} sub={p.otherName ? p.otherName : undefined} />
            </Cell>
            <Cell>
              {ageFromDob(p.dob)} · {p.sex}
            </Cell>
            <Cell>
              <div className="flex items-center gap-1.5">
                <span className="text-mist-700">{p.payer}</span>
                {cat(p.category)?.exempt && <Badge tone="brand">Exempt</Badge>}
              </div>
              <span className="text-[11px] text-mist-400">{cat(p.category)?.name}</span>
            </Cell>
            <Cell className="max-w-[220px] truncate text-mist-500">{p.address}</Cell>
            <Cell>
              <div className="relative flex justify-end">
                <button
                  onClick={() => setRow(row === p.id ? null : p.id)}
                  className="rounded-lg p-1.5 text-mist-400 hover:bg-mist-100"
                >
                  <MoreVertical size={16} />
                </button>
                {row === p.id && (
                  <div className="absolute right-0 top-8 z-10 w-44 rounded-xl bg-white p-1 text-sm shadow-pop ring-1 ring-mist-200">
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50"
                      onClick={() => { setRow(null); nav(`/patients/${p.id}`); }}
                    >
                      <ScrollText size={14} /> Open Chart
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50"
                      onClick={() => { addToQueue(p.id, "Vital" as never, "Normal" as never); setRow(null); nav("/queue"); }}
                    >
                      <ListPlus size={14} /> Add to Queue
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50"
                      onClick={() => { setDoc({ kind: "card", patient: p }); setRow(null); }}
                    >
                      <CreditCard size={14} /> Print Card
                    </button>
                    <button
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50"
                      onClick={() => { setDoc({ kind: "birth", patient: p }); setRow(null); }}
                    >
                      <ScrollText size={14} /> Issue Birth Certificate
                    </button>
                  </div>
                )}
              </div>
            </Cell>
          </Row>
        ))}
      </Table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register New Patient"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              disabled={!form.firstName || !form.lastName || !form.dob}
              onClick={() => {
                registerPatient(form as Omit<Patient, "id" | "mrn" | "registeredAt">);
                setOpen(false);
              }}
            >
              Register Patient
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Demographics</p>
            <Grid cols={3}>
              <Field label="Surname"><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></Field>
              <Field label="First name"><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></Field>
              <Field label="Other name"><Input value={form.otherName} onChange={(e) => set("otherName", e.target.value)} /></Field>
              <Field label="Date of birth"><Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
              <Field label="Sex"><Select value={form.sex} onChange={(e) => set("sex", e.target.value)} options={["F", "M"]} /></Field>
              <Field label="Phone"><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="NIN"><Input value={form.nin} onChange={(e) => set("nin", e.target.value)} placeholder="11 digits" /></Field>
              <Field label="Blood group"><Select value={form.bloodGroup} onChange={(e) => set("bloodGroup", e.target.value)} options={["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]} /></Field>
              <Field label="Allergies"><Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} placeholder="NKA" /></Field>
            </Grid>
          </section>
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Address</p>
            <Grid cols={2}>
              <Field label="Address"><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label="State"><Input value={form.state} onChange={(e) => set("state", e.target.value)} /></Field>
              <Field label="LGA"><Input value={form.lga} onChange={(e) => set("lga", e.target.value)} /></Field>
              <Field label="Ward"><Input value={form.ward} onChange={(e) => set("ward", e.target.value)} /></Field>
            </Grid>
          </section>
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Category & Payment</p>
            <Grid cols={3}>
              <Field label="Patient category">
                <Select
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                  options={PATIENT_CATEGORIES.map((c) => ({ value: c.code, label: `${c.name}${c.exempt ? " (Exempt)" : ""}` }))}
                />
              </Field>
              <Field label="Who is paying?">
                <Select value={form.payer} onChange={(e) => set("payer", e.target.value)} options={["Out of Pocket", "Government Scheme", "NHIS"]} />
              </Field>
              <Field label="Next of kin"><Input value={form.nextOfKin} onChange={(e) => set("nextOfKin", e.target.value)} /></Field>
            </Grid>
            {cat(form.category)?.exempt && (
              <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
                Exempt — {cat(form.category)?.reason}. Invoice payer will read as: {form.payer}
              </div>
            )}
          </section>
        </div>
      </Modal>

      <p className="mt-3 text-right text-[11px] text-mist-300">Registry as of {shortDate(new Date())}</p>

      {doc?.kind === "card" && (
        <PatientCardDoc patient={doc.patient} open onClose={() => setDoc(null)} />
      )}
      {doc?.kind === "birth" && (
        <BirthCertificateDoc patient={doc.patient} open onClose={() => setDoc(null)} />
      )}
    </div>
  );
}
