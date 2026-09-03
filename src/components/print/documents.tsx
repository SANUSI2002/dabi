import { PrintDoc, Line, Section, SignRow } from "./PrintFrame";
import type { Patient, LabOrder, Encounter } from "@/data/types";
import { PATIENT_CATEGORIES, LAB_TESTS, VACCINES } from "@/data/catalog";
import { ageFromDob, shortDate, dateTime } from "@/lib/format";
import { differenceInWeeks } from "date-fns";

const catName = (c: string) => PATIENT_CATEGORIES.find((x) => x.code === c);

/* ---------------- Patient Card ---------------- */
export function PatientCardDoc({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  return (
    <PrintDoc open={open} onClose={onClose} docTitle="Patient Card">
      <div className="grid grid-cols-[120px_1fr] gap-6">
        <div className="grid h-[120px] place-items-center rounded-lg bg-mist-100 text-[10px] text-mist-400">PHOTO</div>
        <div>
          <p className="font-display text-2xl font-bold text-mist-900">
            {patient.firstName} {patient.lastName} {patient.otherName ?? ""}
          </p>
          <p className="font-mono text-sm tracking-wide text-brand-700">{patient.mrn}</p>
          <div className="mt-3 grid grid-cols-2 gap-x-8">
            <Line label="Sex" value={patient.sex === "M" ? "Male" : "Female"} />
            <Line label="Date of birth" value={shortDate(patient.dob)} />
            <Line label="Age" value={ageFromDob(patient.dob)} />
            <Line label="Phone" value={patient.phone} />
            <Line label="Blood group" value={patient.bloodGroup} />
            <Line label="Allergies" value={patient.allergies || "NKA"} />
          </div>
        </div>
      </div>

      <div className="my-6 rounded-lg bg-mist-50 py-4 text-center font-mono text-lg tracking-[0.3em] text-mist-800">
        {patient.mrn}
        <p className="mt-1 font-sans text-[10px] tracking-normal text-mist-400">Scan or enter file number at registration</p>
      </div>

      <Section title="Registration Details">
        <div className="grid grid-cols-2 gap-x-8">
          <Line label="Category" value={`${catName(patient.category)?.name}${catName(patient.category)?.exempt ? " (Exempt)" : ""}`} />
          <Line label="Payer" value={patient.payer} />
          <Line label="Address" value={patient.address} />
          <Line label="LGA / State" value={`${patient.lga}, ${patient.state}`} />
          <Line label="Ward" value={patient.ward} />
          <Line label="Next of kin" value={patient.nextOfKin} />
          <Line label="Registered" value={shortDate(patient.registeredAt)} />
        </div>
      </Section>
    </PrintDoc>
  );
}

/* ---------------- Birth Certificate ---------------- */
export function BirthCertificateDoc({ patient, open, onClose }: { patient: Patient; open: boolean; onClose: () => void }) {
  return (
    <PrintDoc open={open} onClose={onClose} docTitle="Notification of Birth">
      <p className="mb-6 text-center text-sm text-mist-500">
        This is to certify that the birth described below was notified at this health facility.
      </p>

      <Section title="Child's Details">
        <div className="grid grid-cols-2 gap-x-8">
          <Line label="Surname" value={patient.lastName} />
          <Line label="Other names" value={`${patient.firstName} ${patient.otherName ?? ""}`} />
          <Line label="Sex" value={patient.sex === "M" ? "Male" : "Female"} />
          <Line label="Date of birth" value={shortDate(patient.dob)} />
          <Line label="Place of birth" value={`${patient.ward ?? patient.lga}`} />
          <Line label="State / LGA of birth" value={`${patient.state} / ${patient.lga}`} />
        </div>
      </Section>

      <Section title="Mother's Details">
        <div className="grid grid-cols-2 gap-x-8">
          <Line label="Full name" value={patient.nextOfKin} />
          <Line label="Phone" value={patient.nokPhone} />
          <Line label="Nationality" value="Nigerian" />
          <Line label="Address" value={patient.address} />
        </div>
      </Section>

      <Section title="Certifying Officer">
        <div className="grid grid-cols-2 gap-x-8">
          <Line label="Notified by" value="Dr. Adaeze Okonjo" />
          <Line label="Designation" value="Medical Officer" />
          <Line label="Date notified" value={dateTime(new Date())} />
          <Line label="Certificate no." value={`BN/${patient.mrn.slice(-6)}`} />
        </div>
      </Section>

      <SignRow roles={["Informant's signature", "Certifying officer", "Facility stamp"]} />
    </PrintDoc>
  );
}

/* ---------------- Lab Report ---------------- */
export function LabReportDoc({
  patient,
  orders,
  open,
  onClose,
}: {
  patient: Patient;
  orders: LabOrder[];
  open: boolean;
  onClose: () => void;
}) {
  return (
    <PrintDoc open={open} onClose={onClose} docTitle="Laboratory Report">
      <Section title="Patient">
        <div className="grid grid-cols-2 gap-x-8">
          <Line label="Name" value={`${patient.firstName} ${patient.lastName}`} />
          <Line label="File no." value={patient.mrn} />
          <Line label="Age / Sex" value={`${ageFromDob(patient.dob)} · ${patient.sex}`} />
          <Line label="Report date" value={dateTime(new Date())} />
        </div>
      </Section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500">
            <th className="py-2">Test</th>
            <th>Result</th>
            <th>Flag</th>
            <th>Reference range</th>
            <th>Verified by</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-mist-100">
              <td className="py-2 font-medium">{o.test}</td>
              <td className="font-semibold">{o.result ?? "Pending"}</td>
              <td>{o.flag ?? "—"}</td>
              <td className="text-mist-500">{LAB_TESTS.find((t) => t.name === o.test)?.ref ?? "—"}</td>
              <td className="text-mist-500">{o.verifiedBy ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mt-4 text-[11px] italic text-mist-400">
        Results relate only to the sample(s) tested. Clinical correlation is advised.
      </p>
      <SignRow roles={["Analysed by", "Verified / countersigned"]} />
    </PrintDoc>
  );
}

/* ---------------- Immunization Card ---------------- */
export function ImmunizationCardDoc({
  patient,
  given,
  open,
  onClose,
}: {
  patient: Patient;
  given: Record<string, string>;
  open: boolean;
  onClose: () => void;
}) {
  const ageWeeks = differenceInWeeks(new Date(), new Date(patient.dob));
  return (
    <PrintDoc open={open} onClose={onClose} docTitle="Child Immunization Card">
      <Section title="Child">
        <div className="grid grid-cols-2 gap-x-8">
          <Line label="Name" value={`${patient.firstName} ${patient.lastName}`} />
          <Line label="File no." value={patient.mrn} />
          <Line label="Date of birth" value={shortDate(patient.dob)} />
          <Line label="Age" value={`${ageWeeks} weeks`} />
          <Line label="Caregiver" value={patient.nextOfKin} />
          <Line label="Ward" value={patient.ward} />
        </div>
      </Section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y border-mist-300 text-left text-[11px] uppercase text-mist-500">
            <th className="py-2">Antigen</th>
            <th>Due age</th>
            <th>Dose</th>
            <th>Route / site</th>
            <th>Date given</th>
          </tr>
        </thead>
        <tbody>
          {VACCINES.map((v) => (
            <tr key={v.code} className="border-b border-mist-100">
              <td className="py-2 font-medium">{v.name}</td>
              <td>{v.ageLabel}</td>
              <td>{v.dose}</td>
              <td className="text-mist-500">{v.route} · {v.site}</td>
              <td className="font-semibold text-brand-700">{given[v.code] ? shortDate(given[v.code]) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[11px] text-mist-400">Keep this card and bring it to every visit. Next visit is shown by the health worker.</p>
    </PrintDoc>
  );
}

/* ---------------- Consolidated EMR ---------------- */
export function ConsolidatedEmrDoc({
  patient,
  encounters,
  labs,
  open,
  onClose,
}: {
  patient: Patient;
  encounters: Encounter[];
  labs: LabOrder[];
  open: boolean;
  onClose: () => void;
}) {
  const meds = encounters.flatMap((e) => e.prescriptions.map((r) => ({ ...r, date: e.date })));
  return (
    <PrintDoc open={open} onClose={onClose} docTitle="Consolidated Medical Record">
      <Section title="Patient">
        <div className="grid grid-cols-2 gap-x-8">
          <Line label="Name" value={`${patient.firstName} ${patient.lastName}`} />
          <Line label="File no." value={patient.mrn} />
          <Line label="DOB / Age" value={`${shortDate(patient.dob)} · ${ageFromDob(patient.dob)}`} />
          <Line label="Sex" value={patient.sex === "M" ? "Male" : "Female"} />
          <Line label="Blood group" value={patient.bloodGroup} />
          <Line label="Allergies" value={patient.allergies || "NKA"} />
          <Line label="Payer" value={patient.payer} />
        </div>
      </Section>

      <Section title={`Encounters (${encounters.length})`}>
        {encounters.length === 0 && <p className="text-sm text-mist-400">No encounters recorded.</p>}
        {encounters.map((e) => (
          <div key={e.id} className="mb-3 rounded-lg border border-mist-200 p-3 text-sm">
            <p className="font-semibold text-mist-800">
              {dateTime(e.date)} · {e.provider} · {e.station}
            </p>
            <p><b>Complaint:</b> {e.complaint}</p>
            {e.examination && <p><b>Examination:</b> {e.examination}</p>}
            {e.assessment && <p><b>Assessment:</b> {e.assessment}</p>}
            {e.plan && <p><b>Plan:</b> {e.plan}</p>}
            {e.diagnoses.length > 0 && (
              <p><b>Diagnoses:</b> {e.diagnoses.map((d) => `${d.name} (${d.code})`).join("; ")}</p>
            )}
          </div>
        ))}
      </Section>

      <Section title={`Medications (${meds.length})`}>
        {meds.length === 0 && <p className="text-sm text-mist-400">No medications dispensed.</p>}
        {meds.map((m, i) => (
          <p key={i} className="text-sm">
            • {m.drug} — {m.dose}, {m.frequency} for {m.duration} (Qty {m.qty}) — {m.status}
          </p>
        ))}
      </Section>

      <Section title={`Laboratory (${labs.length})`}>
        {labs.length === 0 && <p className="text-sm text-mist-400">No lab results.</p>}
        {labs.map((l) => (
          <p key={l.id} className="text-sm">
            • {l.test}: <b>{l.result ?? l.status}</b> {l.flag ? `(${l.flag})` : ""} — {shortDate(l.orderedAt)}
          </p>
        ))}
      </Section>

      <p className="mt-6 text-center text-[11px] text-mist-400">— End of consolidated record —</p>
    </PrintDoc>
  );
}
