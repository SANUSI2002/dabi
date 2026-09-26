import React, { useEffect, useState } from "react";
import { useApiData } from "../../../api/useApiData";
import { formatClock, listMedications, setMedicationTaken } from "../../../api/dashboardApi";

// Today's doses from the patient's medication list, grouped by time of day.
const GROUPS = [
  { key: "morning", label: "Morning", until: 12 * 60 },
  { key: "afternoon", label: "Afternoon", until: 17 * 60 },
  { key: "evening", label: "Evening", until: 21 * 60 },
  { key: "night", label: "Night", until: 24 * 60 },
];
const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

function toScheduleMed(m) {
  const due = minutesOf(m.time) <= new Date().getHours() * 60 + new Date().getMinutes();
  return {
    id: m.id,
    name: m.name,
    dosage: "",
    instructions: m.instructions || "As directed",
    scheduledTime: formatClock(m.time),
    status: m.isTaken ? "Taken" : due ? "Due Now" : "Upcoming",
    takenAt: m.isTaken ? formatClock(m.time) : null,
    nextDose: { date: "Tomorrow", time: formatClock(m.time) },
    courseCompleted: false,
    minutes: minutesOf(m.time),
  };
}

function buildSchedule(meds) {
  const items = meds.map(toScheduleMed);
  let from = 0;
  return GROUPS.map((group) => {
    const medications = items.filter((m) => m.minutes >= from && m.minutes < group.until);
    from = group.until;
    return { key: group.key, label: group.label, medications };
  }).filter((group) => group.medications.length);
}

const statusClassMap = {
  "Due Now": "sabi-rx-med-status due",
  Upcoming: "sabi-rx-med-status upcoming",
  Taken: "sabi-rx-med-status taken",
  Missed: "sabi-rx-med-status missed",
};

/* DEBUG NOTE: Prescriptions refactor - Replaced the static schedule with active filtered prescription results. */
export function RecentPrescriptions({ prescriptions, onViewDetails }) {
  const { data: meds } = useApiData(listMedications, []);
  const [medicationSchedule, setMedicationSchedule] = useState([]);
  useEffect(() => {
    if (meds) setMedicationSchedule(buildSchedule(meds));
  }, [meds]);
  const plannedDoses = medicationSchedule.reduce((sum, group) => sum + group.medications.length, 0);

  const handleMarkTaken = async (medicationId) => {
    try {
      await setMedicationTaken(medicationId, true);
    } catch (err) {
      alert(err.message);
      return;
    }
    setMedicationSchedule((schedule) =>
      schedule.map((group) => ({
        ...group,
        medications: group.medications.map((medication) =>
          medication.id === medicationId
            ? {
                ...medication,
                status: "Taken",
                takenAt: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
              }
            : medication
        ),
      }))
    );
  };

  return (
    <section className="sabi-card sabi-rx-schedule-card" aria-label="Recent Prescriptions">
      <div className="sabi-rx-schedule-head">
        <span className="sabi-rx-schedule-title">Recent Prescriptions</span>
        <span className="sabi-rx-schedule-date">{prescriptions.length} shown</span>
      </div>
      <div className="sabi-timeline">
        {prescriptions.length ? prescriptions.slice(0, 3).map((prescription, index) => (
          <div className={`sabi-timeline-item ${index === 0 ? "active" : ""}`} key={prescription.id}>
            <div className="sabi-timeline-marker"><span className="sabi-timeline-dot" /><span className="sabi-timeline-line" /></div>
            <div className="sabi-rx-slot">
              <div className="sabi-timeline-time">{prescription.prescribed}</div>
              <div className="sabi-rx-slot-card">
                <div className="sabi-rx-slot-name">{prescription.name}</div>
                <div className="sabi-rx-slot-detail">{prescription.dosage} · {prescription.frequency}</div>
                <button className="sabi-rx-view-link" onClick={() => onViewDetails(prescription)}>View Details</button>
              </div>
            </div>
          </div>
        )) : <p className="sabi-rx-empty">No recent prescriptions match the current filters.</p>}
      </div>

      <div className="sabi-rx-med-schedule" aria-labelledby="todays-medication-schedule">
        <div className="sabi-rx-schedule-head">
          <span className="sabi-rx-schedule-title" id="todays-medication-schedule">Today's Medication Schedule</span>
          <span className="sabi-rx-schedule-date">Today • {plannedDoses} planned dose{plannedDoses === 1 ? "" : "s"}</span>
        </div>

        <div className="sabi-rx-med-groups">
          {meds && !plannedDoses && <p className="sabi-rx-empty">No medications scheduled for today.</p>}
          {medicationSchedule.map((group) => (
            <div className="sabi-rx-med-group" key={group.key}>
              <div className="sabi-rx-med-group-title">{group.label}</div>

              {group.medications.map((medication) => {
                const showTakenState = medication.status === "Taken";
                const showNextDose = medication.nextDose && !medication.courseCompleted && showTakenState;
                const showCourseCompleted = medication.courseCompleted;

                return (
                  <article className="sabi-rx-med-card" key={medication.id}>
                    <div className="sabi-rx-med-card-top">
                      <div>
                        <div className="sabi-rx-med-name">{medication.name}</div>
                        <div className="sabi-rx-med-meta">{[medication.dosage, medication.instructions].filter(Boolean).join(" • ")}</div>
                      </div>
                      <span className={statusClassMap[medication.status] || "sabi-rx-med-status"}>{medication.status}</span>
                    </div>

                    <div className="sabi-rx-med-details">
                      <div>
                        <div className="sabi-rx-med-detail-label">Scheduled</div>
                        <div className="sabi-rx-med-detail-value">{medication.scheduledTime}</div>
                      </div>
                      <div>
                        <div className="sabi-rx-med-detail-label">Status</div>
                        <div className="sabi-rx-med-detail-value">{medication.status}</div>
                      </div>
                    </div>

                    {medication.status === "Due Now" ? (
                      <button
                        type="button"
                        className="sabi-rx-med-action"
                        onClick={() => handleMarkTaken(medication.id)}
                      >
                        Mark Taken
                      </button>
                    ) : null}

                    {showTakenState ? (
                      <div className="sabi-rx-med-taken" aria-live="polite">
                        ✓ Taken at {medication.takenAt}
                      </div>
                    ) : null}

                    {showNextDose ? (
                      <div className="sabi-rx-med-next-dose">
                        <div className="sabi-rx-med-detail-label">Next Dose</div>
                        <div className="sabi-rx-med-detail-value">{medication.nextDose.date} • {medication.nextDose.time}</div>
                      </div>
                    ) : null}

                    {showCourseCompleted ? (
                      <div className="sabi-rx-med-completed">Course Completed</div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default RecentPrescriptions;
