// Appointments Page Component
// -------------------------------------------------------------
// This component manages appointment scheduling, filtering,
// calendar interactions, and modal workflows for booking,
// viewing, and joining consultations.

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const TAB_MATCH = {
    Upcoming: (a) => a.status === "active" || a.status === "pending-review",
    "Awaiting confirmation": (a) => a.status === "pending-review",
    Completed: (a) => a.status === "completed",
    Missed: (a) => a.status === "missed",
    Cancelled: (a) => a.status === "cancelled",
  };
  const tabCounts = Object.fromEntries(Object.entries(TAB_MATCH).map(([tab, match]) => [tab, appointments.filter(match).length]));
  const filteredAppointments = showAllAppointments
    ? appointments
    : appointments.filter(TAB_MATCH[activeTab] || (() => true)).sort((a, b) => activeTab === "Upcoming" || activeTab === "Awaiting confirmation" ? new Date(a.startsAt) - new Date(b.startsAt) : new Date(b.startsAt) - new Date(a.startsAt));

  // "Join" on the dashboard links here as /appointments?join=<id>; open that call once it has loaded.
  const [searchParams, setSearchParams] = useSearchParams();
  const joinId = searchParams.get("join");
  useEffect(() => {
    if (!joinId || !data) return;
    const target = appointments.find((a) => a.id === joinId);
    if (target?.joinOpen) setJoinApt(target);
    setSearchParams((params) => { params.delete("join"); return params; }, { replace: true });
  }, [joinId, data]); // eslint-disable-line react-hooks/exhaustive-deps

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
              Book, join and manage your consultations in one place.
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
        <FilterTabs active={showAllAppointments ? "" : activeTab} onChange={handleFilterChange} counts={data ? tabCounts : {}} />

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
