import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Car, CheckCircle2, Clock3, MapPin, MessageCircle, Navigation, QrCode,
} from "lucide-react";

import "../../styles/share.css";
import "./Hospitals.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getAppointments } from "../appointments/appointmentStore";
import { checkIn, getCheckIn } from "./hospitalStore";
import { openExternalDirections } from "../../utils/mapUtils";

export function CheckInPage() {
  const [zoom] = useZoom();
  const { appointmentId } = useParams();
  const navigate = useNavigate();

  const appointment = getAppointments().find((a) => a.id === appointmentId);
  const [record, setRecord] = useState(() => getCheckIn(appointmentId));

  if (!appointment) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that appointment.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/appointments")}>Back to Appointments</button>
          </div>
        </div>
      </div>
    );
  }

  const handleCheckIn = () => setRecord(checkIn(appointmentId));

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-hospitals-main">
        <Topbar placeholder="Search appointments..." />

        <button className="sabi-rxd-back" onClick={() => navigate("/appointments")}>
          <ArrowLeft size={18} /> Back to Appointments
        </button>

        <header className="sabi-hospitals-wizard-header">
          <div>
            <h1>Pre-Arrival Check-in</h1>
            <p>Complete your check-in now to bypass the reception desk.</p>
          </div>
        </header>

        <div className="sabi-hospitals-wizard-layout">
          <div className="sabi-hospitals-booking-steps">
            <div className="sabi-card sabi-hospitals-checkin-ready">
              <div>
                <strong>Ready for your appointment?</strong>
                <span>Checking in now will secure your place in the queue at {appointment.location}.</span>
              </div>
              <button type="button" className="sabi-btn-primary" disabled={!!record} onClick={handleCheckIn}>
                {record ? "Checked In" : "Check-in Online"}
              </button>
            </div>

            {record && (
              <div className="sabi-hospitals-queue-row">
                <div className="sabi-card sabi-hospitals-queue-card">
                  <span className="label">Queue Number</span>
                  <strong className="big">{record.queueNumber ?? "Not available yet"}</strong>
                </div>
                <div className="sabi-card sabi-hospitals-queue-card">
                  <span className="label"><Clock3 size={14} /> Est. Wait Time</span>
                  <strong className="big">{record.estimatedWaitMinutes != null ? <>{record.estimatedWaitMinutes} <small>mins</small></> : "Not available yet"}</strong>
                </div>
              </div>
            )}

            <div className="sabi-hospitals-checkin-grid">
              <div className="sabi-card">
                <h4><Navigation size={16} /> Navigation</h4>
                <p className="sabi-hospitals-wizard-note">{appointment.location}</p>
                <button
                  type="button"
                  className="sabi-btn-outline"
                  onClick={() => openExternalDirections(appointment.lat, appointment.lng, appointment.location)}
                >
                  Open in Maps
                </button>
              </div>
              <div className="sabi-card">
                <h4><Car size={16} /> Parking Guidance</h4>
                <div className="sabi-hospitals-parking-row">
                  <div><span>LEVEL</span><strong>02</strong></div>
                  <div><span>ZONE</span><strong>B</strong></div>
                </div>
                <p className="sabi-hospitals-wizard-note">Automated valet available for premium members.</p>
              </div>
            </div>

            <div className="sabi-card sabi-hospitals-help-row">
              <MessageCircle size={20} />
              <div>
                <strong>Need help before arrival?</strong>
                <span>Our care team is online and ready to assist you via chat.</span>
              </div>
              <button type="button" className="sabi-btn-outline">Chat Now</button>
            </div>
          </div>

          <aside className="sabi-hospitals-sidebar">
            <div className="sabi-card sabi-hospitals-entry-pass">
              <h4>Digital Entry Pass</h4>
              <div className="sabi-hospitals-qr-box">
                <QrCode size={90} />
              </div>
              <p>Scan at any kiosk for instant entry</p>
              <span className={`sabi-hospitals-entry-status ${record ? "active" : ""}`}>
                <CheckCircle2 size={14} /> {record ? "Active Check-in" : "Not checked in yet"}
              </span>
            </div>

            <div className="sabi-card sabi-hospitals-appt-summary">
              <h4>Appointment Summary</h4>
              <div className="row"><MapPin size={15} /><div><span>Hospital</span><strong>{appointment.location}</strong></div></div>
              <div className="row"><Clock3 size={15} /><div><span>Doctor</span><strong>{appointment.doctor}, {appointment.specialty}</strong></div></div>
              <div className="row"><Clock3 size={15} /><div><span>Date &amp; Time</span><strong>{appointment.date} · {appointment.time}</strong></div></div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default CheckInPage;
