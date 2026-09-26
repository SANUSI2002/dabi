// Appointments Page Component
// -------------------------------------------------------------
// This component manages appointment scheduling, filtering,
// calendar interactions, and modal workflows for booking,
// viewing, and joining consultations.

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "design-system";
import { Plus } from "lucide-react";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";

import {
  StatsRow,
  FilterTabs,
  AppointmentCalendar,
  UpcomingAppointments,
  NearbyHealthcare,
} from "./components";

import { BookAppointmentModal } from "./components/BookAppointmentModal";
import { AppointmentDetailModal } from "./components/AppointmentDetailModal";
import { JoinConsultationModal } from "./components/JoinConsultationModal";
import { HospitalAppointmentsCard } from "./components/HospitalAppointmentsCard";

import { ConfirmModal } from "./ConfirmModal";
import { useApiData } from "../../api/useApiData";
import { bookDoctor, cancelDoctorAppointment, listUiAppointments } from "../../api/doctorsApi";
import { listMyHospitalAppointments } from "../../api/sabiApi";

import "../dashboard/Dashboard.css";
import "./Appointments.css";

// Doctor bookings (shown in the list) plus hospital appointments (for the stats and calendar).
async function loadAppointments() {
  const [doctor, hospital] = await Promise.all([listUiAppointments(), listMyHospitalAppointments()]);
  return { doctor, hospital };
}

export function Appointments() {
  // Zoom level from custom hook
  const [zoom] = useZoom();

  // Router navigation
  const navigate = useNavigate();

  // Active filter tab
  const [activeTab, setActiveTab] = useState("Upcoming");

  // Toggle between filtered and full appointment list
  const [showAllAppointments, setShowAllAppointments] = useState(false);

  // Doctor bookings from the Sabi API (hospital appointments also have their own card below).
  const { data, reload } = useApiData(loadAppointments, []);
  const appointments = data?.doctor || [];
  const hospital = data?.hospital || [];
  const [cancelId, setCancelId] = useState(null);

  // Stat card values, counted from live doctor + hospital appointments.
  const statValues = useMemo(() => {
    if (!data) return {};
    const future = (h) => new Date(h.requestedAt).getTime() > Date.now();
    return {
      Upcoming: appointments.filter((a) => a.status === "active" || a.status === "pending-review").length + hospital.filter((h) => ["PENDING", "SCHEDULED"].includes(h.status) && future(h)).length,
      Completed: appointments.filter((a) => a.status === "completed").length + hospital.filter((h) => h.status === "CHECKED_IN").length,
      "Missed Out": appointments.filter((a) => a.status === "missed").length,
      Pending: appointments.filter((a) => a.status === "pending-review").length + hospital.filter((h) => h.status === "PENDING" && future(h)).length,
    };
  }, [data, appointments, hospital]);

  // Selected date for calendar
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Modal visibility states
  const [showBookModal, setShowBookModal] = useState(false);
  const [detailApt, setDetailApt] = useState(null);
  const [joinApt, setJoinApt] = useState(null);

  /*
    FILTER APPOINTMENTS
    ---------------------------------------------------------
    Applies filtering logic based on active tab selection.
  */
  const filteredAppointments = showAllAppointments
    ? appointments
    : appointments.filter((appointment) => {
        const appointmentDate = new Date(appointment.date);
        const today = new Date();

        switch (activeTab) {
          case "Today":
            return appointmentDate.toDateString() === today.toDateString();

          case "Upcoming":
            return (
              appointment.status === "active" ||
              appointment.status === "pending" ||
              appointment.status === "pending-review" ||
              appointment.status === "awaiting-acceptance" ||
              appointment.status === "declined-by-member"
            );

          case "Request":
            return appointment.status === "pending-review";

          case "Completed":
            return appointment.status === "completed";

          case "Cancelled":
            return appointment.status === "cancelled";

          case "Follow-ups":
            return appointment.status === "follow-up";

          default:
            return true;
        }
      });

  // Handle filter tab change
  const handleFilterChange = (tab) => {
    setShowAllAppointments(false);
    setActiveTab(tab);
  };

  /*
    BOOK APPOINTMENT HANDLER
    ---------------------------------------------------------
    Creates a new appointment entry and appends it to the list.
  */
  const handleBook = async ({ slotId, consultationType }) => {
    await bookDoctor({ slotId, consultationType });
    setShowBookModal(false);
    reload();
  };

  /*
    CANCEL APPOINTMENT HANDLER
    ---------------------------------------------------------
    Asks for confirmation, then cancels the booking with the doctor.
  */
  const handleCancel = (id) => setCancelId(id);
  const confirmCancel = async () => {
    const id = cancelId;
    setCancelId(null);
    await cancelDoctorAppointment(id).catch(() => {});
    reload();
  };
  const respondToBookingRequest = () => {};

  return (
    <div
      className="sabi-dashboard"
      style={{
        ...pageVars,
        zoom,
      }}
    >
      {/* Sidebar Navigation */}
      <Sidebar />

      <div className="sabi-main">
        {/* Top Navigation Bar */}
        <Topbar
          placeholder="Search appointments, doctors..."
          showHelp
        />

        {/* Page Header */}
        <div className="sabi-apt-header">
          <div>
            <h1>Appointments</h1>
            <p>
              Schedule, manage, and attend your healthcare appointments in one
              place with empathetic precision.
            </p>
          </div>

          {/* Book Appointment Button */}
          <Button
            variant="primary"
            className="sabi-apt-book-btn"
            onClick={() => setShowBookModal(true)}
          >
            <Plus
              size={16}
              style={{
                verticalAlign: "-3px",
                marginRight: 6,
              }}
            />
            Book Appointment
          </Button>
        </div>

        {/* Stats Overview */}
        <StatsRow values={statValues} />

        {/* Filter Tabs */}
        <FilterTabs active={activeTab} onChange={handleFilterChange} />

        {/* Main Grid Layout */}
        <div className="sabi-grid sabi-apt-grid">
          {/* Calendar Column */}
          <div className="sabi-col">
            <AppointmentCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              appointments={appointments}
            />
          </div>

          {/* Upcoming Appointments Column */}
          <div className="sabi-col">
            <UpcomingAppointments
              title={showAllAppointments ? "All" : activeTab}
              appointments={filteredAppointments}
              onViewAll={() => {
                setShowAllAppointments(true);
                setActiveTab("All");
              }}
              onReschedule={(appointment) =>
                navigate(`/appointments/reschedule/${appointment.id}`)
              }
              onJoin={(appointment) => setJoinApt(appointment)}
              onCheckIn={(appointment) => navigate(`/hospitals/check-in/${appointment.id}`)}
              onViewWellness={(appointment) => navigate(`/wellness-hub/engagements/${appointment.wellnessEngagementId}`)}

              onViewDetails={(appointment) => setDetailApt(appointment)}
              onCancel={handleCancel}
              onRespondToRequest={(id, accepted) => respondToBookingRequest(id, accepted)}
            />
            <HospitalAppointmentsCard />
          </div>
        </div>

        {/* Nearby Healthcare Section */}
        <NearbyHealthcare />
      </div>

      {/* Book Appointment Modal */}
      {showBookModal && (
        <BookAppointmentModal
          onClose={() => setShowBookModal(false)}
          onBook={handleBook}
        />
      )}

      {/* Appointment Detail Modal */}
      {detailApt && (
        <AppointmentDetailModal
          appointment={detailApt}
          onClose={() => setDetailApt(null)}
        />
      )}

      {/* Join Consultation Modal */}
      {joinApt && (
        <JoinConsultationModal
          appointment={joinApt}
          onClose={() => setJoinApt(null)}
        />
      )}

      {/* Cancel confirmation */}
      <ConfirmModal
        open={Boolean(cancelId)}
        title="Cancel this appointment?"
        message="Your booking with the doctor is cancelled and the time is released for other patients."
        confirmLabel="Yes, Cancel"
        cancelLabel="Keep Appointment"
        danger
        onConfirm={confirmCancel}
        onCancel={() => setCancelId(null)}
      />
    </div>
  );
}

export default Appointments;
