import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useWardRound } from "./useWardRound";
import { useEmr, prescriptionsForPatient } from "./useEmr";
import { useNursing } from "./useNursing";
import { useIdentity } from "./useIdentity";
import type { Admission, Patient, Prescription } from "@/data/types";
import type { ExaminationSystemKey } from "@/data/wardRound";

function makeAdmissionAndPatient(): { admission: Admission; patient: Patient } {
  const patient = useEmr.getState().patientById("p1")!;
  const admissionId = useEmr.getState().admit(patient.id, "Kirikiri", "Bed 1", "Community-acquired pneumonia");
  const admission = useEmr.getState().admissions.find((a) => a.id === admissionId)!;
  return { admission, patient };
}

describe("useWardRound — ward round clinical workflow", () => {
  beforeEach(() => {
    useIdentity.getState().setUser("s1");
  });

  afterEach(() => {
    useWardRound.setState({ rounds: [], medicationChanges: [], examinations: [] });
    useEmr.setState({ admissions: [], encounters: [] });
    useNursing.setState({ observations: [], administrations: [] });
  });

  it("auto-identifies the authenticated clinician when a round is started", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;
    expect(round.clinicianName).toBe("Dr. Adaeze Okonjo");
    expect(round.clinicianId).toBe("s1");
    expect(round.clinicianRole).toBeTruthy();
    expect(round.status).toBe("draft");
  });

  it("exposes the most recent vitals with a timestamp, and keeps previous vitals available", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    useNursing.getState().addObservation({ admissionId: admission.id, patientId: patient.id, temp: 37.1, pulse: 88, bp: "120/80" });
    useNursing.getState().addObservation({ admissionId: admission.id, patientId: patient.id, temp: 38.4, pulse: 102, bp: "128/84" });

    const observations = useNursing.getState().observationsFor(admission.id);
    expect(observations).toHaveLength(2);
    expect(observations[0].temp).toBe(38.4); // most recent first
    expect(observations[0].recordedAt).toBeTruthy();
    expect(observations[1].temp).toBe(37.1); // earlier reading still available, not overwritten
  });

  it("increasing a dose preserves the previous dose, the new dose and the reason — never overwriting history", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;

    const original: Prescription = { id: "rx-1", drug: "Amlodipine", dose: "5 mg", frequency: "OD", duration: "30 days", qty: 30, route: "Oral", status: "Dispensed" };
    useEmr.getState().appendPrescriptions(round.encounterId, [original]);

    const result = useWardRound.getState().changeMedication({
      patientId: patient.id,
      wardRoundId: round.id,
      encounterId: round.encounterId,
      target: original,
      action: "DOSE_INCREASED",
      newDose: "10 mg",
      reason: "Blood pressure remains above treatment target.",
    });
    expect(result.ok).toBe(true);

    const encounter = useEmr.getState().encounters.find((e) => e.id === round.encounterId)!;
    const oldRow = encounter.prescriptions.find((p) => p.id === "rx-1")!;
    const newRow = encounter.prescriptions.find((p) => p.replacesId === "rx-1")!;
    expect(oldRow.status).toBe("Replaced");
    expect(oldRow.dose).toBe("5 mg"); // never mutated in place
    expect(newRow.dose).toBe("10 mg");
    expect(newRow.status).toBe("Dispensed");

    const change = useWardRound.getState().medicationChangesFor(patient.id)[0];
    expect(change.action).toBe("DOSE_INCREASED");
    expect(change.previousDose).toBe("5 mg");
    expect(change.newDose).toBe("10 mg");
    expect(change.reason).toBe("Blood pressure remains above treatment target.");
    expect(change.clinicianName).toBe("Dr. Adaeze Okonjo");
  });

  it("decreasing a dose records the same before/after audit trail", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;
    const original: Prescription = { id: "rx-2", drug: "Furosemide", dose: "40 mg", frequency: "BD", duration: "7 days", qty: 14, route: "Oral", status: "Dispensed" };
    useEmr.getState().appendPrescriptions(round.encounterId, [original]);

    const result = useWardRound.getState().changeMedication({
      patientId: patient.id, wardRoundId: round.id, encounterId: round.encounterId,
      target: original, action: "DOSE_DECREASED", newDose: "20 mg", reason: "Improving renal function, risk of hypokalaemia.",
    });
    expect(result.ok).toBe(true);
    const change = useWardRound.getState().medicationChangesFor(patient.id)[0];
    expect(change.previousDose).toBe("40 mg");
    expect(change.newDose).toBe("20 mg");
  });

  it("rejects a medication change with no reason", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;
    const original: Prescription = { id: "rx-3", drug: "Metformin", dose: "500 mg", frequency: "BD", duration: "30 days", qty: 60, route: "Oral", status: "Dispensed" };
    useEmr.getState().appendPrescriptions(round.encounterId, [original]);

    const result = useWardRound.getState().changeMedication({
      patientId: patient.id, wardRoundId: round.id, encounterId: round.encounterId,
      target: original, action: "STOPPED", reason: "",
    });
    expect(result.ok).toBe(false);
  });

  it("adds a new medication during the round and records it as STARTED", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;

    const result = useWardRound.getState().addMedication({
      patientId: patient.id, wardRoundId: round.id, encounterId: round.encounterId,
      drug: "Ceftriaxone", dose: "1 g", frequency: "OD", duration: "5 days", qty: 5, route: "IV",
    });
    expect(result.ok).toBe(true);

    const meds = prescriptionsForPatient(useEmr.getState().encounters, patient.id);
    expect(meds.some((m) => m.drug === "Ceftriaxone" && m.status === "Dispensed")).toBe(true);
    const change = useWardRound.getState().medicationChangesFor(patient.id)[0];
    expect(change.action).toBe("STARTED");
  });

  it("holding a medication marks it Held without creating a replacement row", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;
    const original: Prescription = { id: "rx-4", drug: "Warfarin", dose: "5 mg", frequency: "OD", duration: "30 days", qty: 30, route: "Oral", status: "Dispensed" };
    useEmr.getState().appendPrescriptions(round.encounterId, [original]);

    useWardRound.getState().changeMedication({
      patientId: patient.id, wardRoundId: round.id, encounterId: round.encounterId,
      target: original, action: "HELD", reason: "INR supratherapeutic, holding pending recheck.",
    });

    const encounter = useEmr.getState().encounters.find((e) => e.id === round.encounterId)!;
    expect(encounter.prescriptions.find((p) => p.id === "rx-4")!.status).toBe("Held");
    expect(encounter.prescriptions.filter((p) => p.replacesId === "rx-4")).toHaveLength(0);
  });

  it("stopping a medication marks it Stopped", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;
    const original: Prescription = { id: "rx-5", drug: "Co-amoxiclav", dose: "625 mg", frequency: "TDS", duration: "7 days", qty: 21, route: "Oral", status: "Dispensed" };
    useEmr.getState().appendPrescriptions(round.encounterId, [original]);

    useWardRound.getState().changeMedication({
      patientId: patient.id, wardRoundId: round.id, encounterId: round.encounterId,
      target: original, action: "STOPPED", reason: "Course completed early — afebrile 48h.",
    });

    const encounter = useEmr.getState().encounters.find((e) => e.id === round.encounterId)!;
    expect(encounter.prescriptions.find((p) => p.id === "rx-5")!.status).toBe("Stopped");
  });

  it("medication changes propagate to the MAR from their effective time, without rewriting past administrations", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;
    const original: Prescription = { id: "rx-6", drug: "Paracetamol", dose: "1 g", frequency: "QDS", duration: "3 days", qty: 12, route: "Oral", status: "Dispensed" };
    useEmr.getState().appendPrescriptions(round.encounterId, [original]);

    const beforeSlots = useNursing.getState().marFor(admission, prescriptionsForPatient(useEmr.getState().encounters, patient.id));
    const firstSlot = beforeSlots.find((s) => s.prescriptionId === "rx-6")!;
    useNursing.getState().recordDose(admission, firstSlot, "given");
    const recordedAdministration = useNursing.getState().administrations.find((a) => a.slotKey === firstSlot.slotKey)!;
    expect(recordedAdministration.dose).toBe("1 g");

    useWardRound.getState().changeMedication({
      patientId: patient.id, wardRoundId: round.id, encounterId: round.encounterId,
      target: original, action: "DOSE_INCREASED", newDose: "1.5 g", reason: "Inadequate analgesia at current dose.",
    });

    // the already-recorded administration is untouched
    const stillRecorded = useNursing.getState().administrations.find((a) => a.slotKey === firstSlot.slotKey)!;
    expect(stillRecorded.dose).toBe("1 g");

    // the MAR regenerated from the current prescriptions now serves the new dose
    const afterSlots = useNursing.getState().marFor(admission, prescriptionsForPatient(useEmr.getState().encounters, patient.id));
    const newDoseSlots = afterSlots.filter((s) => s.drug === "Paracetamol" && s.dose === "1.5 g");
    expect(newDoseSlots.length).toBeGreaterThan(0);
    // the old prescription's own slots are no longer generated since it is now Replaced (not Dispensed)
    expect(afterSlots.some((s) => s.prescriptionId === "rx-6")).toBe(false);
  });

  it("records a physical examination against the correct patient and encounter, across multiple systems", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;

    const systems: { system: ExaminationSystemKey; status: "Normal" | "Abnormal" | "Not Examined" }[] = [
      { system: "cardiovascular", status: "Abnormal" },
      { system: "respiratory", status: "Normal" },
      { system: "neurological", status: "Normal" },
      { system: "musculoskeletal", status: "Not Examined" },
      { system: "abdominal", status: "Abnormal" },
    ];
    const examId = useWardRound.getState().recordExamination({
      patientId: patient.id,
      encounterId: round.encounterId,
      wardRoundId: round.id,
      systems: systems.map((s) => ({ system: s.system, status: s.status, findings: s.status === "Abnormal" ? { Findings: "reduced air entry" } : undefined })),
    });

    const exam = useWardRound.getState().examinationFor(examId)!;
    expect(exam.patientId).toBe(patient.id);
    expect(exam.encounterId).toBe(round.encounterId);
    expect(exam.systems.find((s) => s.system === "cardiovascular")!.status).toBe("Abnormal");
    expect(exam.systems.find((s) => s.system === "musculoskeletal")!.status).toBe("Not Examined");
    expect(exam.systems.find((s) => s.system === "musculoskeletal")!.findings).toBeUndefined();
  });

  it("marking a system Not Examined never fabricates findings", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const round = useWardRound.getState().roundById(roundId)!;
    const examId = useWardRound.getState().recordExamination({
      patientId: patient.id, encounterId: round.encounterId, wardRoundId: round.id,
      systems: [{ system: "genitourinary", status: "Not Examined" }],
    });
    const exam = useWardRound.getState().examinationFor(examId)!;
    expect(exam.systems[0].findings).toBeUndefined();
    expect(exam.systems[0].notes).toBeUndefined();
  });

  it("requires a progress note and at least one problem or plan item before signing", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const incomplete = useWardRound.getState().sign(roundId);
    expect(incomplete.ok).toBe(false);

    useWardRound.getState().updateDraft(roundId, { progressNote: "Patient stable overnight, chest clear." });
    useWardRound.getState().addTask(roundId, { type: "Repeat vitals", description: "Recheck vitals in 4 hours", priority: "Routine", status: "Pending" });

    const complete = useWardRound.getState().sign(roundId);
    expect(complete.ok).toBe(true);
    const round = useWardRound.getState().roundById(roundId)!;
    expect(round.status).toBe("signed");
    expect(round.signedBy).toBe("Dr. Adaeze Okonjo");
    expect(round.signedAt).toBeTruthy();
  });

  it("a signed ward round cannot be silently edited", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    useWardRound.getState().updateDraft(roundId, { progressNote: "Improving.", clinicalProgress: "Improving" });
    useWardRound.getState().addTask(roundId, { type: "Other", description: "Continue current management", priority: "Routine", status: "Pending" });
    useWardRound.getState().sign(roundId);

    useWardRound.getState().updateDraft(roundId, { progressNote: "SILENTLY CHANGED" });
    const round = useWardRound.getState().roundById(roundId)!;
    expect(round.progressNote).toBe("Improving."); // unchanged — updateDraft is a no-op once signed
  });

  it("an amendment preserves the original signed content and appends alongside it", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    useWardRound.getState().updateDraft(roundId, { progressNote: "Stable, plan unchanged." });
    useWardRound.getState().addTask(roundId, { type: "Other", description: "Continue monitoring", priority: "Routine", status: "Pending" });
    useWardRound.getState().sign(roundId);

    const result = useWardRound.getState().addAmendment(roundId, "Correction: temperature was 38.9°C, not 37.9°C as originally charted.");
    expect(result.ok).toBe(true);

    const round = useWardRound.getState().roundById(roundId)!;
    expect(round.status).toBe("amended");
    expect(round.progressNote).toBe("Stable, plan unchanged."); // original preserved
    expect(round.amendments).toHaveLength(1);
    expect(round.amendments[0].note).toContain("38.9");
    expect(round.amendments[0].by).toBe("Dr. Adaeze Okonjo");
  });

  it("cannot amend a round that has not been signed yet", () => {
    const { admission, patient } = makeAdmissionAndPatient();
    const roundId = useWardRound.getState().startRound(admission, patient);
    const result = useWardRound.getState().addAmendment(roundId, "Too early");
    expect(result.ok).toBe(false);
  });

  it("surfaces an allergy warning when screening a new medication against a known allergy, without blocking prescribing", () => {
    const patient = useEmr.getState().patientById("p3")!; // seeded with a Penicillin allergy
    const alerts = useWardRound.getState().screenNewMedication(patient.id, "Amoxicillin 500mg");
    expect(alerts.some((a) => a.kind === "allergy")).toBe(true);
  });
});
