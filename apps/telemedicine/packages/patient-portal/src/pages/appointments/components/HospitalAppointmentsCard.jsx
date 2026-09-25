import React from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { Building2, LogIn } from "lucide-react";
import { SectionTitle } from "../../dashboard/share";
import { useApiData } from "../../../api/useApiData";
import { listMyHospitalAppointments } from "../../../api/sabiApi";
import { formatDateTime } from "../../hospitals/hospitalShared";

const tone = (status) => (status === "SCHEDULED" || status === "CHECKED_IN" ? "good" : status === "PENDING" ? "pending" : status === "CANCELLED" ? "neutral" : "bad");

/** Hospital appointment requests from the Sabi API, newest first. */
export function HospitalAppointmentsCard() {
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApiData(() => listMyHospitalAppointments(), []);
  const items = [...(data || [])].sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

  return (
    <Card>
      <SectionTitle action="Find a Hospital" onAction={() => navigate("/hospitals")}>Hospital Appointments</SectionTitle>
      {error ? (
        <p className="sabi-modal-empty" role="alert">
          Couldn&apos;t load hospital appointments. <button type="button" className="sabi-apt-secondary-btn" onClick={reload}>Retry</button>
        </p>
      ) : loading && !data ? (
        <p className="sabi-modal-empty">Loading hospital appointments…</p>
      ) : items.length === 0 ? (
        <p className="sabi-modal-empty">No hospital appointments yet. Enroll with a hospital to book one.</p>
      ) : (
        <div className="sabi-apt-list">
          {items.map((a) => (
            <div className="sabi-apt-item" key={a.id}>
              <div className="sabi-apt-item-top">
                <div className="sabi-apt-avatar" aria-hidden="true"><Building2 size={18} /></div>
                <div className="sabi-apt-item-body">
                  <div className="sabi-apt-item-name">{a.hospitalName}</div>
                  <div className="sabi-apt-item-sub">{a.appointmentType}{a.memberName ? ` · for ${a.memberName}` : ""}</div>
                  <div className="sabi-apt-item-location"><span className={`sabi-status-pill ${tone(a.status)}`}>{a.statusLabel}</span></div>
                </div>
                <div className="sabi-apt-item-when">
                  <div className="sabi-apt-item-date">{formatDateTime(a.requestedAt)}</div>
                </div>
              </div>
              {(a.status === "SCHEDULED" || a.status === "CHECKED_IN") && (
                <div className="sabi-apt-item-actions">
                  <button type="button" className="sabi-apt-checkin-btn" onClick={() => navigate(`/hospitals/check-in/${a.id}`)}>
                    <LogIn size={15} /> {a.status === "CHECKED_IN" ? "View Check-in" : "Check-in"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default HospitalAppointmentsCard;
