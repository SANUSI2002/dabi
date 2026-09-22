import React, { useState } from "react";

const initialMedicationSchedule = [
  {
    key: "morning",
    label: "Morning",
    medications: [
      {
        id: 1,
        name: "Metformin",
        dosage: "500mg",
        instructions: "After Food",
        scheduledTime: "08:00 AM",
        status: "Due Now",
        nextDose: { date: "Today", time: "08:00 AM" },
      },
    ],
  },
  {
    key: "afternoon",
    label: "Afternoon",
    medications: [
      {
        id: 2,
        name: "Omega-3",
        dosage: "1 capsule",
        instructions: "With Water",
        scheduledTime: "01:30 PM",
        status: "Upcoming",
        nextDose: { date: "Today", time: "01:30 PM" },
      },
    ],
  },
  {
    key: "evening",
    label: "Evening",
    medications: [
      {
        id: 3,
        name: "Vitamin D",
        dosage: "1000 IU",
        instructions: "After Food",
        scheduledTime: "06:30 PM",
        status: "Missed",
        nextDose: { date: "Tomorrow", time: "06:30 PM" },
      },
    ],
  },
  {
    key: "night",
    label: "Night",
    medications: [
      {
        id: 4,
        name: "Lisinopril",
        dosage: "10mg",
        instructions: "Before Bed",
        scheduledTime: "09:00 PM",
        status: "Taken",
        takenAt: "09:00 AM",
        nextDose: { date: "Tomorrow", time: "09:00 PM" },
        courseCompleted: false,
      },
    ],
  },
];

const statusClassMap = {
  "Due Now": "sabi-rx-med-status due",
  Upcoming: "sabi-rx-med-status upcoming",
  Taken: "sabi-rx-med-status taken",
  Missed: "sabi-rx-med-status missed",
};

/* DEBUG NOTE: Prescriptions refactor - Replaced the static schedule with active filtered prescription results. */
export function RecentPrescriptions({ prescriptions, onViewDetails }) {
  const [medicationSchedule, setMedicationSchedule] = useState(initialMedicationSchedule);

  const handleMarkTaken = (medicationId) => {
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
          <span className="sabi-rx-schedule-date">Today • 4 planned doses</span>
        </div>

        <div className="sabi-rx-med-groups">
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
                        <div className="sabi-rx-med-meta">{medication.dosage} • {medication.instructions}</div>
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
