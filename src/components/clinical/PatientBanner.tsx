import { type ReactNode, useMemo } from "react";
import { TriangleAlert, ShieldCheck, MapPin, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { useEmr } from "@/store/useEmr";
import { useClinical, selectAllergiesFor } from "@/store/useClinical";
import { PATIENT_CATEGORIES } from "@/data/catalog";
import { ageFromDob, initials, timeAgo } from "@/lib/format";
import type { Patient } from "@/data/types";

// Persistent patient-context header. Shows identity, the safety-critical alerts
// (allergies, active problems), where the patient physically is right now, and
// when the record was last touched — so a clinician always knows who they are
// looking at and what is currently true.
export function PatientBanner({
  patient,
  actions,
  compact = false,
}: {
  patient: Patient;
  actions?: ReactNode;
  compact?: boolean;
}) {
  const emr = useEmr();
  const allergyRecords = useClinical((state) => state.allergies);
  const conditionRecords = useClinical((state) => state.conditions);
  const allergies = useMemo(() => selectAllergiesFor(allergyRecords, patient), [allergyRecords, patient]);
  const conditions = useMemo(
    () => conditionRecords.filter((condition) => condition.patientId === patient.id),
    [conditionRecords, patient.id],
  );

  const activeAllergies = allergies.filter((allergy) => allergy.clinicalStatus === "active");
  const highRiskAllergies = activeAllergies.filter((allergy) => allergy.criticality === "high");
  const activeProblems = conditions.filter(
    (condition) => condition.category === "problem-list-item" && condition.clinicalStatus === "active",
  );
  const unreviewedAllergy = activeAllergies.some((allergy) => allergy.verificationStatus === "unconfirmed");

  const admission = emr.admissions.find((entry) => entry.patientId === patient.id && entry.status === "Active");
  const queued = emr.queue.find(
    (entry) => entry.patientId === patient.id && (entry.status === "Waiting" || entry.status === "In Progress"),
  );
  const category = PATIENT_CATEGORIES.find((entry) => entry.code === patient.category);

  const lastUpdated = [
    ...emr.encounters.filter((entry) => entry.patientId === patient.id).map((entry) => entry.date),
    ...emr.labOrders.filter((entry) => entry.patientId === patient.id).map((entry) => entry.orderedAt),
    ...conditions.map((entry) => entry.recordedDate),
    ...allergies.map((entry) => entry.recordedDate),
    ...(emr.vitals[patient.id] ?? []).map((entry) => entry.takenAt),
    patient.registeredAt,
  ].sort((left, right) => +new Date(right) - +new Date(left))[0];

  return (
    <div className="card mb-5 border-l-4 border-l-brand-500">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={cnAvatar(compact)}>{initials(`${patient.firstName} ${patient.lastName}`)}</div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-mist-900">
              {patient.firstName} {patient.lastName} {patient.otherName ?? ""}
            </h2>
            <p className="mt-0.5 text-sm text-mist-500">
              <span className="font-mono">{patient.mrn}</span>
              {patient.nin ? <> · NIN {patient.nin}</> : null} · {ageFromDob(patient.dob)} ·{" "}
              {patient.sex === "M" ? "Male" : "Female"} · {patient.phone ?? "no phone on file"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {highRiskAllergies.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-action-50 px-2 py-0.5 text-[11px] font-bold text-action-700 ring-1 ring-action-200">
                  <TriangleAlert size={12} aria-hidden /> High-risk allergy: {highRiskAllergies.map((allergy) => allergy.substance.display).join(", ")}
                </span>
              ) : activeAllergies.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  <TriangleAlert size={12} aria-hidden /> Allergy: {activeAllergies.map((allergy) => allergy.substance.display).join(", ")}
                  {unreviewedAllergy ? " (unconfirmed)" : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">
                  <ShieldCheck size={12} aria-hidden /> No known allergies
                </span>
              )}
              {activeProblems.length > 0 && (
                <Badge tone="mist">{activeProblems.length} active problem{activeProblems.length > 1 ? "s" : ""}</Badge>
              )}
              {patient.bloodGroup && <Badge tone="mist">Blood group {patient.bloodGroup}</Badge>}
              {category?.exempt ? <Badge tone="brand">{category.name} · fee-exempt</Badge> : <Badge tone="mist">{patient.payer}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-mist-400">
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} aria-hidden />
                {admission
                  ? `Admitted · ${admission.ward} · ${admission.bed}`
                  : queued
                    ? `In clinic · ${queued.station} queue · ${queued.status}`
                    : "Not currently in a care episode"}
              </span>
              {lastUpdated && (
                <span className="inline-flex items-center gap-1">
                  <Clock3 size={12} aria-hidden /> Record last updated {timeAgo(lastUpdated)}
                </span>
              )}
            </div>
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

function cnAvatar(compact: boolean) {
  return [
    "grid shrink-0 place-items-center rounded-2xl bg-brand-gradient font-bold text-white",
    compact ? "h-10 w-10 text-sm" : "h-12 w-12 text-base",
  ].join(" ");
}
