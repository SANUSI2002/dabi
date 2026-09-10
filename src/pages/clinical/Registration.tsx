import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserPlus, CreditCard, ScrollText, ListPlus, MoreVertical, TriangleAlert, Users } from "lucide-react";
import { PageHeader, Button, Badge, EmptyState } from "@/components/ui/primitives";
import { Table, Row, Cell, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, Grid, Checkbox } from "@/components/ui/form";
import { useEmr } from "@/store/useEmr";
import { PATIENT_CATEGORIES } from "@/data/catalog";
import { ageFromDob, shortDate } from "@/lib/format";
import { PatientCardDoc, BirthCertificateDoc } from "@/components/print/documents";
import { PatientLink } from "@/components/ui/PatientLink";
import type { Patient, Sex, Payer } from "@/data/types";

const BLANK = {
  firstName: "", lastName: "", otherName: "", preferredName: "", sex: "F" as Sex, dob: "",
  phone: "", consentToContact: true, address: "", lga: "Amuwo-Odofin", state: "Lagos", ward: "",
  language: "", occupation: "", category: "GEN", payer: "Out of Pocket" as Payer, nin: "", hospitalNumber: "",
  bloodGroup: "", allergies: "", nextOfKin: "", nokPhone: "", nokRelation: "",
  emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
};

const LANGUAGES = ["English", "Yoruba", "Igbo", "Hausa", "Pidgin", "French", "Other"];

export default function Registration() {
  const nav = useNavigate();
  const { patients, registerPatient, addToQueue, duplicateRisk, likelyDuplicatePairs } = useEmr();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [doc, setDoc] = useState<{ kind: "card" | "birth"; patient: Patient } | null>(null);
  const [acknowledgedDuplicate, setAcknowledgedDuplicate] = useState(false);

  const setField = (key: keyof typeof BLANK, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setAcknowledgedDuplicate(false);
  };

  const list = patients.filter((patient) =>
    `${patient.firstName} ${patient.lastName} ${patient.otherName ?? ""} ${patient.mrn} ${patient.phone ?? ""} ${patient.nin ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );

  const categoryOf = (code: string) => PATIENT_CATEGORIES.find((entry) => entry.code === code);
  const duplicatePairs = useMemo(() => likelyDuplicatePairs(), [likelyDuplicatePairs, patients.length]);

  const matches = useMemo(
    () =>
      form.firstName && form.lastName
        ? duplicateRisk({ firstName: form.firstName, lastName: form.lastName, dob: form.dob, phone: form.phone, nin: form.nin })
        : [],
    [form.firstName, form.lastName, form.dob, form.phone, form.nin, duplicateRisk],
  );
  const strongMatch = matches.some((match) => match.score >= 5);

  const dobInFuture = form.dob !== "" && new Date(form.dob).getTime() > Date.now();
  const ninInvalid = form.nin !== "" && !/^\d{11}$/.test(form.nin.replace(/\s/g, ""));
  const canRegister =
    Boolean(form.firstName.trim() && form.lastName.trim() && form.dob) &&
    !dobInFuture &&
    !ninInvalid &&
    (!strongMatch || acknowledgedDuplicate);

  function submit() {
    if (!canRegister) return;
    registerPatient(form as unknown as Omit<Patient, "id" | "mrn" | "registeredAt">);
    setOpen(false);
    setForm(BLANK);
    setAcknowledgedDuplicate(false);
  }

  return (
    <div>
      <PageHeader
        title="Patient registry"
        subtitle={`${patients.length} patients on file`}
        actions={
          <>
            <Button variant="ghost" onClick={() => setDuplicatesOpen(true)}>
              <ScrollText size={15} /> Review duplicates{duplicatePairs.length ? ` (${duplicatePairs.length})` : ""}
            </Button>
            <Button onClick={() => { setForm(BLANK); setAcknowledgedDuplicate(false); setOpen(true); }}>
              <UserPlus size={15} /> New patient
            </Button>
          </>
        }
      />

      <label className="mb-4 block max-w-md">
        <span className="sr-only">Search patients</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name, file number, phone or NIN…"
          className="input"
        />
      </label>

      {list.length === 0 && query ? (
        <EmptyState
          variant="empty"
          title={`No patient matches “${query}”`}
          hint="Check the spelling, or register the patient if they are new to this facility."
          action={<Button onClick={() => { setForm({ ...BLANK }); setOpen(true); }}><UserPlus size={14} /> Register new patient</Button>}
        />
      ) : (
        <Table columns={["File number", "Name", "Age / Sex", "Payer / Category", "Location", ""]} caption="Registered patients">
          {list.length === 0 && <EmptyRow colSpan={6}>No patients are registered yet.</EmptyRow>}
          {list.map((patient, index) => (
            <Row key={patient.id} index={index} active={expandedRow === patient.id}>
              <Cell className="font-mono text-[11px] text-mist-500">{patient.mrn}</Cell>
              <Cell>
                <PatientLink patient={patient} sub={patient.preferredName ? `“${patient.preferredName}”` : patient.otherName || undefined} />
              </Cell>
              <Cell>{ageFromDob(patient.dob)} · {patient.sex}</Cell>
              <Cell>
                <div className="flex items-center gap-1.5">
                  <span className="text-mist-700">{patient.payer}</span>
                  {categoryOf(patient.category)?.exempt && <Badge tone="brand">Fee-exempt</Badge>}
                </div>
                <span className="text-[11px] text-mist-400">{categoryOf(patient.category)?.name}</span>
              </Cell>
              <Cell className="max-w-[220px] truncate text-mist-500">{patient.address}</Cell>
              <Cell>
                <div className="relative flex justify-end">
                  <button
                    onClick={() => setExpandedRow(expandedRow === patient.id ? null : patient.id)}
                    aria-label={`Actions for ${patient.firstName} ${patient.lastName}`}
                    aria-expanded={expandedRow === patient.id}
                    className="rounded-lg p-1.5 text-mist-400 hover:bg-mist-100"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {expandedRow === patient.id && (
                    <div className="absolute right-0 top-8 z-10 w-48 rounded-xl bg-white p-1 text-sm shadow-pop ring-1 ring-mist-200">
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50" onClick={() => { setExpandedRow(null); nav(`/patients/${patient.id}`); }}>
                        <ScrollText size={14} /> Open chart
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50" onClick={() => { addToQueue(patient.id, "Vital", "Normal"); setExpandedRow(null); nav("/queue"); }}>
                        <ListPlus size={14} /> Add to queue
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50" onClick={() => { setDoc({ kind: "card", patient }); setExpandedRow(null); }}>
                        <CreditCard size={14} /> Print card
                      </button>
                      <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 hover:bg-brand-50" onClick={() => { setDoc({ kind: "birth", patient }); setExpandedRow(null); }}>
                        <ScrollText size={14} /> Issue birth certificate
                      </button>
                    </div>
                  )}
                </div>
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      <p className="mt-3 text-right text-[11px] text-mist-300">Registry as of {shortDate(new Date())}</p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Register new patient"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!canRegister} onClick={submit}>Register patient</Button>
          </>
        }
      >
        <div className="space-y-5">
          {matches.length > 0 && (
            <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${strongMatch ? "bg-action-50 text-action-800 ring-action-200" : "bg-amber-50 text-amber-800 ring-amber-200"}`}>
              <p className="flex items-center gap-1.5 font-semibold">
                <TriangleAlert size={15} aria-hidden />
                {strongMatch ? "This looks like an existing patient" : "Possible existing patient"}
              </p>
              <ul className="mt-1.5 space-y-1">
                {matches.slice(0, 4).map((match) => (
                  <li key={match.patient.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {match.patient.firstName} {match.patient.lastName} · {match.patient.mrn} · {ageFromDob(match.patient.dob)} ·{" "}
                      <span className="text-mist-500">{match.reasons.join(", ")}</span>
                    </span>
                    <button type="button" className="font-semibold underline" onClick={() => { setOpen(false); nav(`/patients/${match.patient.id}`); }}>
                      Open their chart
                    </button>
                  </li>
                ))}
              </ul>
              {strongMatch && (
                <label className="mt-2 flex items-center gap-2 text-[13px] font-medium">
                  <input type="checkbox" checked={acknowledgedDuplicate} onChange={(event) => setAcknowledgedDuplicate(event.target.checked)} className="h-4 w-4 rounded border-action-300 text-action-600" />
                  I have checked and this is a different person — create a new record
                </label>
              )}
            </div>
          )}

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Identity</p>
            <Grid cols={3}>
              <Field label="Surname *"><Input value={form.lastName} onChange={(event) => setField("lastName", event.target.value)} /></Field>
              <Field label="First name *"><Input value={form.firstName} onChange={(event) => setField("firstName", event.target.value)} /></Field>
              <Field label="Other name"><Input value={form.otherName} onChange={(event) => setField("otherName", event.target.value)} /></Field>
              <Field label="Preferred / known-as name"><Input value={form.preferredName} onChange={(event) => setField("preferredName", event.target.value)} placeholder="Optional" /></Field>
              <Field label="Date of birth *" hint={dobInFuture ? "Date of birth cannot be in the future." : undefined}>
                <Input type="date" value={form.dob} onChange={(event) => setField("dob", event.target.value)} className={dobInFuture ? "ring-2 ring-action-300" : undefined} />
              </Field>
              <Field label="Sex"><Select value={form.sex} onChange={(event) => setField("sex", event.target.value)} options={["F", "M"]} /></Field>
            </Grid>
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Contact &amp; personal</p>
            <Grid cols={3}>
              <Field label="Phone"><Input value={form.phone} onChange={(event) => setField("phone", event.target.value)} placeholder="080X XXX XXXX" /></Field>
              <Field label="Preferred language"><Select value={form.language} onChange={(event) => setField("language", event.target.value)} options={["", ...LANGUAGES]} /></Field>
              <Field label="Occupation"><Input value={form.occupation} onChange={(event) => setField("occupation", event.target.value)} placeholder="Optional" /></Field>
            </Grid>
            <div className="mt-3">
              <Checkbox label="Patient consents to contact by phone / SMS for reminders" checked={form.consentToContact} onChange={(event) => setField("consentToContact", event.target.checked)} />
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Identifiers</p>
            <Grid cols={2}>
              <Field label="NIN" hint={ninInvalid ? "NIN must be exactly 11 digits." : "National Identification Number"}>
                <Input value={form.nin} onChange={(event) => setField("nin", event.target.value)} placeholder="11 digits" className={ninInvalid ? "ring-2 ring-action-300" : undefined} />
              </Field>
              <Field label="Hospital / paper-file number" hint="Alternate identifier from an older paper record">
                <Input value={form.hospitalNumber} onChange={(event) => setField("hospitalNumber", event.target.value)} placeholder="Optional" />
              </Field>
            </Grid>
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Address</p>
            <Grid cols={2}>
              <Field label="Address"><Input value={form.address} onChange={(event) => setField("address", event.target.value)} /></Field>
              <Field label="State"><Input value={form.state} onChange={(event) => setField("state", event.target.value)} /></Field>
              <Field label="LGA"><Input value={form.lga} onChange={(event) => setField("lga", event.target.value)} /></Field>
              <Field label="Ward"><Input value={form.ward} onChange={(event) => setField("ward", event.target.value)} /></Field>
            </Grid>
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Next of kin &amp; emergency contact</p>
            <Grid cols={3}>
              <Field label="Next of kin"><Input value={form.nextOfKin} onChange={(event) => setField("nextOfKin", event.target.value)} /></Field>
              <Field label="Next-of-kin phone"><Input value={form.nokPhone} onChange={(event) => setField("nokPhone", event.target.value)} /></Field>
              <Field label="Relationship"><Input value={form.nokRelation} onChange={(event) => setField("nokRelation", event.target.value)} placeholder="e.g. Spouse" /></Field>
              <Field label="Emergency contact name"><Input value={form.emergencyContactName} onChange={(event) => setField("emergencyContactName", event.target.value)} placeholder="If different from next of kin" /></Field>
              <Field label="Emergency contact phone"><Input value={form.emergencyContactPhone} onChange={(event) => setField("emergencyContactPhone", event.target.value)} /></Field>
              <Field label="Emergency contact relationship"><Input value={form.emergencyContactRelation} onChange={(event) => setField("emergencyContactRelation", event.target.value)} /></Field>
            </Grid>
          </section>

          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-mist-400">Clinical flags &amp; payment</p>
            <Grid cols={3}>
              <Field label="Blood group"><Select value={form.bloodGroup} onChange={(event) => setField("bloodGroup", event.target.value)} options={["", "O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]} /></Field>
              <Field label="Known allergies" hint="Structured allergy records are added later from the chart">
                <Input value={form.allergies} onChange={(event) => setField("allergies", event.target.value)} placeholder="NKA" />
              </Field>
              <Field label="Patient category">
                <Select value={form.category} onChange={(event) => setField("category", event.target.value)} options={PATIENT_CATEGORIES.map((entry) => ({ value: entry.code, label: `${entry.name}${entry.exempt ? " (fee-exempt)" : ""}` }))} />
              </Field>
              <Field label="Who is paying?">
                <Select value={form.payer} onChange={(event) => setField("payer", event.target.value)} options={["Out of Pocket", "Government Scheme", "NHIS"]} />
              </Field>
            </Grid>
            {categoryOf(form.category)?.exempt && (
              <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-brand-200">
                Fee-exempt — {categoryOf(form.category)?.reason}. Invoices will show the payer as {form.payer}.
              </div>
            )}
          </section>
        </div>
      </Modal>

      <Modal
        open={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        title="Possible duplicate records"
        wide
        footer={<Button variant="ghost" onClick={() => setDuplicatesOpen(false)}>Close</Button>}
      >
        {duplicatePairs.length === 0 ? (
          <EmptyState variant="empty" title="No likely duplicates found" hint="No two records share a name + date of birth, phone number or NIN." />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-mist-500">
              These pairs share an identifier. Review each carefully — records are never merged automatically.
              Chart merging is not available in this build; correct records from the source registry.
            </p>
            {duplicatePairs.map((pair, index) => (
              <div key={index} className="rounded-xl bg-mist-50 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <Users size={13} aria-hidden /> {pair.reasons.join(" · ")}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[pair.left, pair.right].map((patient) => (
                    <button
                      key={patient.id}
                      type="button"
                      onClick={() => { setDuplicatesOpen(false); nav(`/patients/${patient.id}`); }}
                      className="rounded-lg bg-white p-2.5 text-left text-sm ring-1 ring-mist-200 hover:ring-brand-300"
                    >
                      <p className="font-semibold text-mist-800">{patient.firstName} {patient.lastName}</p>
                      <p className="font-mono text-[11px] text-mist-400">{patient.mrn}</p>
                      <p className="text-[11px] text-mist-500">{ageFromDob(patient.dob)} · {patient.sex} · {patient.phone ?? "no phone"}{patient.nin ? ` · NIN ${patient.nin}` : ""}</p>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {doc?.kind === "card" && <PatientCardDoc patient={doc.patient} open onClose={() => setDoc(null)} />}
      {doc?.kind === "birth" && <BirthCertificateDoc patient={doc.patient} open onClose={() => setDoc(null)} />}
    </div>
  );
}
