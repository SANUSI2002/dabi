import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "design-system";
import { ArrowLeft, Printer, User, Stethoscope, ClipboardList, Pill, FlaskConical, CalendarClock, Sparkles, AlertTriangle } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { useApiData } from "../../api/useApiData";
import { getRecord } from "../../api/recordsApi";
import { getProfile } from "../../api/profileApi";
import "../dashboard/Dashboard.css";
import "./ConsultationReport.css";

export function ConsultationReport() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [zoom] = useZoom();
  const { data, loading, error } = useApiData(async () => {
    const [record, profile] = await Promise.all([getRecord(id), getProfile()]);
    return { record, profile };
  }, [id]);

  if (!data) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>{loading && !error ? "Loading report…" : "We couldn't find that record."}</p>
            <button className="sabi-btn-primary" onClick={() => navigate(-1)}>Back</button>
          </div>
        </div>
      </div>
    );
  }

  // The patient's own record and profile, in the report's shape. Sections the record doesn't hold stay empty.
  const { record, profile } = data;
  const dob = profile.form.dob ? new Date(profile.form.dob) : null;
  const PATIENT = {
    name: profile.form.fullName || "—",
    age: dob ? Math.floor((Date.now() - dob.getTime()) / 31557600000) : "—",
    gender: "—",
    patientId: (profile.account.patientId || "—").replace(/^#/, ""),
  };
  const report = {
    title: record.title,
    date: record.date,
    doctor: record.doctorName || "Not recorded",
    specialty: "Not recorded",
    reason: record.notes || "Not recorded.",
    assessment: record.diagnosis || "Not recorded.",
    treatment: record.treatment,
    medications: [],
    lifestyle: [],
    testsReferrals: [],
    followUp: { nextAppointment: "As advised by your doctor", warningSigns: [] },
    aiSummary: null,
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-report-header">
          <button type="button" className="sabi-report-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} /> Back
          </button>
          <div className="sabi-report-header-row">
            <div>
              <h1>{report.title}</h1>
              <p>Sabi Health Consultation Report</p>
            </div>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
              Print / Save PDF
            </Button>
          </div>
        </div>

        <div className="sabi-report-doc">
          {/* 1. Patient Information */}
          <section className="sabi-report-section">
            <h2><User size={16} /> Patient Information</h2>
            <div className="sabi-report-grid">
              <div><span>Name</span>{PATIENT.name}</div>
              <div><span>Age</span>{PATIENT.age}</div>
              <div><span>Gender</span>{PATIENT.gender}</div>
              <div><span>Patient ID</span>#{PATIENT.patientId}</div>
              <div><span>Consultation Date & Time</span>{report.date}</div>
            </div>
          </section>

          {/* 2. Doctor Information */}
          <section className="sabi-report-section">
            <h2><Stethoscope size={16} /> Doctor Information</h2>
            <div className="sabi-report-grid">
              <div><span>Doctor's Name</span>{report.doctor}</div>
              <div><span>Specialty</span>{report.specialty}</div>
            </div>
          </section>

          {/* 3. Reason for Visit */}
          <section className="sabi-report-section">
            <h2><ClipboardList size={16} /> Reason for Visit</h2>
            <p>{report.reason}</p>
          </section>

          {/* 4. Assessment */}
          <section className="sabi-report-section">
            <h2><ClipboardList size={16} /> Assessment</h2>
            <p>{report.assessment}</p>
          </section>

          {/* 5. Treatment Plan */}
          <section className="sabi-report-section">
            <h2><Pill size={16} /> Treatment Plan</h2>
            {report.medications.length > 0 ? (
              <table className="sabi-report-table">
                <thead>
                  <tr><th>Medication</th><th>Dosage</th><th>Duration</th></tr>
                </thead>
                <tbody>
                  {report.medications.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      <td>{m.dosage}</td>
                      <td>{m.duration}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className={report.treatment ? undefined : "sabi-report-muted"}>{report.treatment || "No medications prescribed at this visit."}</p>
            )}
            <div className="sabi-report-sublabel">Lifestyle Recommendations</div>
            <ul>
              {!report.lifestyle.length && <li>None recorded</li>}
              {report.lifestyle.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </section>

          {/* 6. Tests & Referrals */}
          <section className="sabi-report-section">
            <h2><FlaskConical size={16} /> Tests & Referrals</h2>
            <ul>
              {!report.testsReferrals.length && <li>None recorded</li>}
              {report.testsReferrals.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>

          {/* 7. Follow-up */}
          <section className="sabi-report-section">
            <h2><CalendarClock size={16} /> Follow-up</h2>
            <div className="sabi-report-grid">
              <div><span>Next Appointment</span>{report.followUp.nextAppointment}</div>
            </div>
            <div className="sabi-report-warning">
              <AlertTriangle size={15} />
              <div>
                <div className="sabi-report-sublabel" style={{ margin: 0 }}>Warning signs that need urgent attention</div>
                <ul>
                  {!report.followUp.warningSigns.length && <li>Any new or worsening symptoms — contact your doctor promptly.</li>}
                  {report.followUp.warningSigns.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {/* 8. AI Summary */}
          {report.aiSummary && <section className="sabi-report-section sabi-report-ai">
            <h2><Sparkles size={16} /> AI Summary (Sabi AI)</h2>
            <p><strong>In plain terms:</strong> {report.aiSummary.explanation}</p>
            <p><strong>Your medication:</strong> {report.aiSummary.medicationInstructions}</p>
            <div className="sabi-report-sublabel">Personalized Health Tips</div>
            <ul>
              {report.aiSummary.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>}
        </div>

        <p className="sabi-report-disclaimer">
          This report is generated for informational purposes and does not replace professional medical advice.
          Always consult your doctor for questions about your diagnosis or treatment.
        </p>
      </div>
    </div>
  );
}

export default ConsultationReport;
