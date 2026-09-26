// Appointments: doctor bookings (booked from Find a Doctor, confirmed by the doctor) and hospital
// appointments, all from the Sabi API.

import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "design-system";
import { Plus } from "lucide-react";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { StatsRow, FilterTabs, AppointmentCalendar, UpcomingAppointments, NearbyHealthcare } from "./components";
import { HospitalAppointmentsCard } from "./components/HospitalAppointmentsCard";
import { useApiData } from "../../api/useApiData";
import { listMyDoctorAppointments } from "../../api/doctorsApi";
import { listMyHospitalAppointments } from "../../api/sabiApi";
import { isSameDay } from "./components/AppointmentCalendar";

import "../dashboard/Dashboard.css";
import "./Appointments.css";

const FILTERS = {
  Upcoming: (a) => a.upcoming,
  Awaiting: (a) => a.status === "REQUESTED" && a.upcoming,
  Past: (a) => a.status === "COMPLETED" || (a.active && !a.upcoming),
  Cancelled: (a) => a.status === "CANCELLED" || a.status === "DECLINED",
  All: () => true,
};

async function loadAll() {
  const [doctor, hospital] = await Promise.all([listMyDoctorAppointments(), listMyHospitalAppointments()]);
  return { doctor, hospital };
}

export function Appointments() {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApiData(loadAll, []);
  const [activeTab, setActiveTab] = useState("Upcoming");
  const [selectedDate, setSelectedDate] = useState(null);
  // Stable reference: the calendar re-centres whenever this object changes.
  const today = useMemo(() => new Date(), []);

  const doctor = data?.doctor || [];
  const hospital = data?.hospital || [];
  const now = Date.now();

  const stats = useMemo(() => {
    if (!data) return {};
    const hospitalFuture = (h) => new Date(h.requestedAt).getTime() > now;
    return {
      upcoming: doctor.filter((a) => a.upcoming).length + hospital.filter((h) => ["PENDING", "SCHEDULED"].includes(h.status) && hospitalFuture(h)).length,
      awaiting: doctor.filter((a) => a.status === "REQUESTED" && a.upcoming).length + hospital.filter((h) => h.status === "PENDING" && hospitalFuture(h)).length,
      completed: doctor.filter((a) => a.status === "COMPLETED").length + hospital.filter((h) => h.status === "CHECKED_IN").length,
      cancelled: doctor.filter((a) => ["CANCELLED", "DECLINED"].includes(a.status)).length + hospital.filter((h) => ["CANCELLED", "REJECTED"].includes(h.status)).length,
    };
  }, [data, doctor, hospital, now]);

  // Calendar dots: every active doctor booking and hospital appointment.
  const calendarItems = useMemo(
    () => [
      ...doctor.filter((a) => a.active).map((a) => ({ date: a.startsAt })),
      ...hospital.filter((h) => ["PENDING", "SCHEDULED", "CHECKED_IN"].includes(h.status)).map((h) => ({ date: h.requestedAt })),
    ],
    [doctor, hospital],
  );

  const listed = useMemo(() => {
    const items = selectedDate ? doctor.filter((a) => isSameDay(a.startsAt, selectedDate)) : doctor.filter(FILTERS[activeTab]);
    const soonestFirst = selectedDate || activeTab === "Upcoming" || activeTab === "Awaiting";
    return [...items].sort((a, b) => (soonestFirst ? 1 : -1) * (new Date(a.startsAt) - new Date(b.startsAt)));
  }, [doctor, activeTab, selectedDate]);

  const title = selectedDate
    ? `Doctor Appointments · ${selectedDate.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}`
    : `${activeTab === "All" ? "All" : activeTab} Doctor Appointments`;

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />

      <div className="sabi-main">
        <Topbar placeholder="Search appointments, doctors..." showHelp />

        <div className="sabi-apt-header">
          <div>
            <h1>Appointments</h1>
            <p>Book verified doctors, follow each request until it&apos;s confirmed, and keep hospital visits in one place.</p>
          </div>
          <Button variant="primary" className="sabi-apt-book-btn" onClick={() => navigate("/doctor")}>
            <Plus size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Book a Doctor
          </Button>
        </div>

        <StatsRow stats={stats} />

        <FilterTabs
          active={selectedDate ? null : activeTab}
          onChange={(tab) => {
            setSelectedDate(null);
            setActiveTab(tab);
          }}
        />

        <div className="sabi-grid sabi-apt-grid">
          <div className="sabi-col">
            <AppointmentCalendar
              selectedDate={selectedDate || today}
              onDateSelect={(date) => setSelectedDate((current) => (current && isSameDay(current, date) ? null : date))}
              appointments={calendarItems}
            />
            {selectedDate && (
              <button type="button" className="sabi-apt-secondary-btn sabi-apt-clear-day" onClick={() => setSelectedDate(null)}>
                Show {activeTab.toLowerCase()} appointments instead
              </button>
            )}
          </div>

          <div className="sabi-col">
            <UpcomingAppointments
              title={title}
              appointments={listed}
              loading={loading && !data}
              error={error}
              onRetry={reload}
              onViewAll={activeTab !== "All" || selectedDate ? () => { setSelectedDate(null); setActiveTab("All"); } : undefined}
              onReschedule={(appointment) => navigate(`/appointments/reschedule/${appointment.id}`)}
              onChanged={reload}
            />
            <HospitalAppointmentsCard />
          </div>
        </div>

        <NearbyHealthcare />
      </div>
    </div>
  );
}

export default Appointments;
