// Appointments Page Component
// -------------------------------------------------------------
// This component manages appointment scheduling, filtering,
// calendar interactions, and modal workflows for booking,
// viewing, and joining consultations.

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, colors } from "design-system";
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

import {
  getAppointments,
  subscribeToAppointments,
  addAppointment,
  cancelAppointment,
  respondToBookingRequest,
} from "./appointmentStore";

import { getSessionAppointments, subscribeToWellness } from "../wellness/wellnessStore";

import "../dashboard/Dashboard.css";
import "./Appointments.css";

// Avatar color rotation for newly created appointments
const AVATAR_COLORS = [
  colors.primary,
  colors.warning,
  colors.danger,
  colors.primaryDark,
];


// Incremental ID generator for manually booked appointments
let nextAptId = 1;

export function Appointments() {
  // Zoom level from custom hook
  const [zoom] = useZoom();

  // Router navigation
  const navigate = useNavigate();

  // Active filter tab
  const [activeTab, setActiveTab] = useState("Upcoming");

  // Toggle between filtered and full appointment list
  const [showAllAppointments, setShowAllAppointments] = useState(false);

// Appointment data state — merges the appointmentStore (doctor/hospital
  // bookings) with upcoming Wellness Hub engagement sessions (caregiver,
  // fitness coach, therapist, etc.), so a session booked from Wellness
  // Hub shows up here too instead of only living inside that section.
  const [appointments, setAppointments] = useState(() => [...getAppointments(), ...getSessionAppointments()]);

  useEffect(() => {
    const refresh = () => setAppointments([...getAppointments(), ...getSessionAppointments()]);
    const unsubAppointments = subscribeToAppointments(refresh);
    const unsubWellness = subscribeToWellness(refresh);
    return () => {
      unsubAppointments();
      unsubWellness();
    };
  }, []);



  useEffect(() => subscribeToAppointments(() => setAppointments(getAppointments())), []);

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
  const handleBook = ({ doctor, date, time }) => {
    const initials = doctor.name
      .replace("Dr. ", "")
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2);

    const appointment = {
      id: `apt-manual-${nextAptId++}`,
      doctor: doctor.name,
      initials,
      color: AVATAR_COLORS[appointments.length % AVATAR_COLORS.length],
      specialty: doctor.specialty,
      location: doctor.location,
      lat: doctor.lat,
      lng: doctor.lng,
      date:
        date instanceof Date
          ? date.toISOString().split("T")[0]
          : date,
      time,
      status: "pending",
    };

    addAppointment(appointment);
    setShowBookModal(false);
  };

  /*
    CANCEL APPOINTMENT HANDLER
    ---------------------------------------------------------
    Removes an appointment from the list by ID.
  */
  const handleCancel = (id) => {
    cancelAppointment(id);
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
          userName="Alex Johnson"
          userId="Patient #S-2940"
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
        <StatsRow />

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
    </div>
  );
}

export default Appointments;
