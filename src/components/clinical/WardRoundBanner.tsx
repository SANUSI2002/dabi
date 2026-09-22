import { useMemo } from "react";
import { TriangleAlert, ShieldCheck, BedDouble, Clock3, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { useClinical, selectAllergiesFor } from "@/store/useClinical";
import { ageFromDob, initials, timeAgo } from "@/lib/format";
import type { Admission, Patient } from "@/data/types";

// Ward Round's own header banner — extends the shared PatientBanner pattern with
// admission-specific facts (ward/bed/LOS/admitting consultant/primary diagnosis)
// that a bedside review needs pinned at the top. Reuses useClinical for
// allergies/problems so there is one allergy-severity rule in the whole app.
export function WardRoundBanner({ patient, admission }: { patient: Patient; admission: Admission }) {
  const allergyRecords = useClinical((state) => state.allergies);
  const conditionRecords = useClinical((state) => state.conditions);
  const allergies = useMemo(() => selectAllergiesFor(allergyRecords, patient), [allergyRecords, patient]);
  const activeProblems = useMemo(
    () =>
      conditionRecords.filter(
        (condition) => condition.patientId === patient.id && condition.category === "problem-list-item" && condition.clinicalStatus === "active",
      ),
    [conditionRecords, patient.id],
  );

  const activeAllergies = allergies.filter((allergy) => allergy.clinicalStatus === "active");
  const highRiskAllergies = activeAllergies.filter((allergy) => allergy.criticality === "high");

  const losDays = daysSince(admission.admittedAt);

  return (
    <div className="card sticky top-0 z-10 mb-5 border-l-4 border-l-brand-500 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-gradient text-base font-bold text-white">
            {initials(`${patient.firstName} ${patient.lastName}`)}
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold text-mist-900">
              {patient.firstName} {patient.lastName} {patient.otherName ?? ""}
            </h2>
            <p className="mt-0.5 text-sm text-mist-500">
              <span className="font-mono">{patient.mrn}</span> · {ageFromDob(patient.dob)} · {patient.sex === "M" ? "Male" : "Female"}
              {patient.bloodGroup ? <> · Blood group {patient.bloodGroup}</> : null}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {highRiskAllergies.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-action-50 px-2 py-0.5 text-[11px] font-bold text-action-700 ring-1 ring-action-200">
                  <TriangleAlert size={12} aria-hidden /> High-risk allergy: {highRiskAllergies.map((a) => a.substance.display).join(", ")}
                </span>
              ) : activeAllergies.length > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  <TriangleAlert size={12} aria-hidden /> Allergy: {activeAllergies.map((a) => a.substance.display).join(", ")}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-200">
                  <ShieldCheck size={12} aria-hidden /> No known allergies
                </span>
              )}
              {activeProblems.length > 0 && (
                <Badge tone="mist">
                  {activeProblems.length} active problem{activeProblems.length > 1 ? "s" : ""}
                </Badge>
              )}
              {admission.isolation && <Badge tone="amber">Isolation: {admission.isolation}</Badge>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-mist-400">
              <span className="inline-flex items-center gap-1">
                <BedDouble size={12} aria-hidden />
                {admission.ward} · Bed {admission.bed} · Day {losDays} of admission
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock3 size={12} aria-hidden /> Admitted {timeAgo(admission.admittedAt)}
              </span>
              {admission.admittingClinician && (
                <span className="inline-flex items-center gap-1">
                  <Stethoscope size={12} aria-hidden /> Admitting: {admission.admittingClinician}
                </span>
              )}
            </div>
            {admission.diagnosis && (
              <p className="mt-2 text-sm text-mist-700">
                <span className="font-semibold text-mist-500">Primary diagnosis:</span> {admission.diagnosis}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function daysSince(iso: string) {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
