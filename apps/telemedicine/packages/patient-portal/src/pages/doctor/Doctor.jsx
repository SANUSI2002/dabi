import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { CalendarDays, CheckCircle2, MapPin, Search, Stethoscope, Video, User2, Wallet } from "lucide-react";

import "../../styles/share.css";
import "./Doctor.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { LoadState } from "../hospitals/hospitalShared";
import { useApiData } from "../../api/useApiData";
import { CONSULTATION_LABELS, formatNaira, listDoctors } from "../../api/doctorsApi";
import { BookingModal } from "./components/BookingModal";
import { DoctorProfileModal } from "./components/DoctorProfileModal";

const when = (iso) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const WEEK = 7 * 86400000;

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function DoctorCard({ doctor, onBook, onViewProfile }) {
  return (
    <article className="sabi-doctor-card sabi-card">
      <div className="sabi-doctor-card-head">
        <span className="sabi-doctor-avatar" aria-hidden="true">{doctor.initials}</span>
        <span className="sabi-doctor-verified"><CheckCircle2 size={13} /> Verified</span>
      </div>

      <div className="sabi-doctor-card-body">
        <div className="sabi-doctor-card-title">
          <div>
            <h3>{doctor.name}</h3>
            <p>{doctor.specialty}</p>
          </div>
        </div>

        <ul>
          {doctor.yearsOfExperience != null && (
            <li><Stethoscope size={15} /> {doctor.yearsOfExperience} years experience</li>
          )}
          {(doctor.practiceName || doctor.practiceAddress) && (
            <li><MapPin size={15} /> {doctor.practiceName || doctor.practiceAddress}</li>
          )}
          {doctor.consultationTypes.length > 0 && (
            <li>{doctor.consultationTypes.includes("VIRTUAL") ? <Video size={15} /> : <User2 size={15} />} {doctor.consultationTypes.map((t) => CONSULTATION_LABELS[t]).join(" · ")}</li>
          )}
          <li className={doctor.nextAvailableAt ? "available" : "unavailable"}>
            <CalendarDays size={15} /> {doctor.nextAvailableAt ? `Next available: ${when(doctor.nextAvailableAt)}` : "No open times yet"}
          </li>
        </ul>

        <footer>
          <div>
            <small>CONSULTATION FEE</small>
            <strong>{doctor.fee != null ? formatNaira(doctor.fee) : "—"}</strong>
          </div>
          <button type="button" className="sabi-doctor-outline" onClick={() => onViewProfile(doctor)}>View Profile</button>
          <button type="button" className="sabi-doctor-primary" onClick={() => onBook(doctor)} disabled={!doctor.nextAvailableAt} title={doctor.nextAvailableAt ? undefined : "This doctor hasn't published any open times yet"}>
            Book
          </button>
        </footer>
      </div>
    </article>
  );
}

export default function FindYourDoctor() {
  const [zoom] = useZoom();
  const location = useLocation();
  // Arriving from a family member's profile: book for that dependent.
  const bookingFor = location.state?.bookingForId ? { id: location.state.bookingForId, name: location.state.bookingForName } : null;

  const [query, setQuery] = useState("");
  const search = useDebounced(query);
  const [specialty, setSpecialty] = useState("");
  const [type, setType] = useState("");
  const [thisWeek, setThisWeek] = useState(false);
  const [profileDoctor, setProfileDoctor] = useState(null);
  const [bookingDoctor, setBookingDoctor] = useState(null);

  // Specialty chips come from the whole directory; results honour search + specialty on the server.
  const all = useApiData(() => listDoctors(), []);
  const results = useApiData(() => listDoctors({ search, specialty }), [search, specialty]);

  const specialties = useMemo(() => {
    const counts = new Map();
    for (const d of all.data || []) counts.set(d.specialty, (counts.get(d.specialty) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [all.data]);

  const doctors = useMemo(
    () =>
      (results.data || []).filter(
        (d) =>
          (!type || d.consultationTypes.includes(type)) &&
          (!thisWeek || (d.nextAvailableAt && new Date(d.nextAvailableAt).getTime() < Date.now() + WEEK)),
      ),
    [results.data, type, thisWeek],
  );

  const clearFilters = () => {
    setQuery("");
    setSpecialty("");
    setType("");
    setThisWeek(false);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />

      <main className="sabi-main sabi-doctor-main">
        <Topbar placeholder="Search doctors, specialties, or clinics..." />

        {bookingFor && (
          <div className="sabi-doctor-booking-for-banner">
            Finding a doctor for <strong>{bookingFor.name}</strong>. Choose a doctor and a time — {bookingFor.name.split(" ")[0]} is preselected.
          </div>
        )}

        <header className="sabi-doctor-hero">
          <p className="sabi-doctor-eyebrow">Verified doctors, real availability</p>
          <h1>Find Your Doctor</h1>
          <p>Every doctor here has been verified by Sabi Health. Pick an open time — the doctor confirms your appointment.</p>

          <label className="sabi-doctor-search">
            <Search size={20} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or specialty..." aria-label="Search doctors" />
            {query && <button type="button" onClick={() => setQuery("")}>Clear</button>}
          </label>
        </header>

        {specialties.length > 0 && (
          <section className="sabi-doctor-specialties">
            <div className="sabi-doctor-section-heading">
              <div>
                <h2>Specialties</h2>
                <p>Filter by the care you need</p>
              </div>
            </div>
            <div className="sabi-doctor-specialty-grid">
              {specialties.map(([label, count]) => (
                <button key={label} type="button" onClick={() => setSpecialty(specialty === label ? "" : label)} className={`sabi-doctor-specialty ${specialty === label ? "active" : ""}`} aria-pressed={specialty === label}>
                  <span><Stethoscope /></span>
                  <strong>{label}</strong>
                  <small>{count} {count === 1 ? "Doctor" : "Doctors"}</small>
                </button>
              ))}
            </div>
          </section>
        )}

        <section id="doctor-results" className="sabi-doctor-results">
          <aside className="sabi-doctor-filters sabi-card">
            <div className="sabi-doctor-filter-head">
              <h2>Filters</h2>
              <button type="button" onClick={clearFilters}>Clear all</button>
            </div>

            <fieldset>
              <legend>Consultation type</legend>
              <div className="sabi-doctor-filter-pills">
                {[["", "Any"], ["IN_PERSON", "In person"], ["VIRTUAL", "Video"]].map(([value, label]) => (
                  <button key={label} type="button" className={type === value ? "active" : ""} aria-pressed={type === value} onClick={() => setType(value)}>{label}</button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Availability</legend>
              <label>
                <input type="checkbox" checked={thisWeek} onChange={(e) => setThisWeek(e.target.checked)} />
                Open times in the next 7 days
              </label>
            </fieldset>

            <div className="sabi-doctor-fee-note">
              <Wallet size={18} />
              <p>Fees are set by each doctor and paid to their practice.</p>
            </div>
          </aside>

          <div>
            <div className="sabi-doctor-results-head">
              <h2>
                {specialty || "Available Doctors"} <span>({doctors.length} {doctors.length === 1 ? "result" : "results"})</span>
              </h2>
            </div>

            <LoadState loading={results.loading && !results.data} error={results.error} onRetry={results.reload} label="Finding doctors…">
              <div className="sabi-doctor-card-grid">
                {doctors.map((doctor) => (
                  <DoctorCard key={doctor.id} doctor={doctor} onBook={setBookingDoctor} onViewProfile={setProfileDoctor} />
                ))}
                {!doctors.length && (
                  <div className="sabi-doctor-empty">
                    {(all.data || []).length === 0
                      ? "No verified doctors are taking bookings yet. Check back soon."
                      : "No doctors match those filters. Clear a filter to see more."}
                  </div>
                )}
              </div>
            </LoadState>
          </div>
        </section>

        {profileDoctor && (
          <DoctorProfileModal
            doctor={profileDoctor}
            onClose={() => setProfileDoctor(null)}
            onBook={(doctor) => {
              setProfileDoctor(null);
              setBookingDoctor(doctor);
            }}
          />
        )}

        {bookingDoctor && (
          <BookingModal
            doctor={bookingDoctor}
            preselectDependentId={bookingFor?.id}
            onClose={() => {
              setBookingDoctor(null);
              results.reload();
            }}
          />
        )}
      </main>
    </div>
  );
}
