import React, { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
    CalendarDays,
    CheckCircle2,
    MapPin,
    MessageSquare,
    Search,
    Sparkles,
    Star,
    Stethoscope
} from "lucide-react";

import "../../styles/share.css";
import "./Doctor.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { openExternalDirections } from "../../utils/mapUtils";

import { Sidebar, Topbar } from "../dashboard/components";
import { DOCTORS, SPECIALTIES } from "./data";
import { BookingModal } from "./components/BookingModal";
import { DoctorProfileModal } from "./components/DoctorProfileModal";
import { addAppointmentFromBooking, addAppointmentRequest } from "../appointments/appointmentStore";

function SpecialtyGrid({ activeSpecialty, onSelect }) {
    return (
        <section className="sabi-doctor-specialties">
            <div className="sabi-doctor-section-heading">
                <div>
                    <h2>Featured Specialties</h2>
                    <p>Find experts in the most requested medical fields</p>
                </div>
            </div>

            <div className="sabi-doctor-specialty-grid">
                {SPECIALTIES.map(({ label, count, icon: Icon }) => (
                    <button
                        key={label}
                        type="button"
                        onClick={() =>
                            onSelect(activeSpecialty === label ? "" : label)
                        }
                        className={`sabi-doctor-specialty ${
                            activeSpecialty === label ? "active" : ""
                        }`}
                    >
                        <span>
                            <Icon />
                        </span>
                        <strong>{label}</strong>
                        <small>{count} Doctors</small>
                    </button>
                ))}
            </div>
        </section>
    );
}

function DoctorCard({ doctor, onBook, onViewProfile }) {
    return (
        <article className="sabi-doctor-card sabi-card">
            <div className="sabi-doctor-photo">
                <img src={doctor.photo} alt={doctor.name} />

                <span>
                    <CheckCircle2 size={13} /> Verified
                </span>

                <em>
                    <Star size={13} fill="currentColor" /> {doctor.rating}
                </em>
            </div>

            <div className="sabi-doctor-card-body">
                <div className="sabi-doctor-card-title">
                    <div>
                        <h3>{doctor.name}</h3>
                        <p>{doctor.specialty}</p>
                    </div>

                    <button
                        type="button"
                        aria-label={`Message ${doctor.name}`}
                    >
                        <MessageSquare size={18} />
                    </button>
                </div>

                <ul>
                    <li>
                        <Stethoscope size={15} /> {doctor.experience} years
                        experience
                    </li>

                    <li>
                        <MapPin size={15} /> {doctor.clinic} ·{" "}
                        {doctor.distance}km away
                    </li>

                    <li className="available">
                        <CalendarDays size={15} /> Next available:{" "}
                        {doctor.nextAvailable}
                    </li>
                </ul>

                <footer>
                    <div>
                        <small>CONSULTATION FEE</small>
                        <strong>₦{doctor.fee.toLocaleString()}</strong>
                    </div>

                    <button
                        type="button"
                        className="sabi-doctor-outline"
                        onClick={() => onViewProfile(doctor)}
                    >
                        View Profile
                    </button>


                    <button
                        type="button"
                        className="sabi-doctor-primary"
                        onClick={() => onBook(doctor)}
                    >
                        Book
                    </button>
                </footer>
            </div>
        </article>
    );
}

export default function FindYourDoctor() {
    const location = useLocation();
    const bookingFor = location.state?.bookingForId
        ? { id: location.state.bookingForId, name: location.state.bookingForName, isSelf: false, isDependent: location.state.isDependent }
        : null;

    const [query, setQuery] = useState("");
    const [specialty, setSpecialty] = useState("");
    const [experience, setExperience] = useState("10+");
    const [notice, setNotice] = useState("");
    const [profileDoctor, setProfileDoctor] = useState(null);
    const [bookingDoctor, setBookingDoctor] = useState(null);
    const [matching, setMatching] = useState(false);

    const [zoom] = useZoom();

    const doctors = useMemo(
        () =>
            DOCTORS.filter((doctor) =>
                (!specialty || doctor.specialty === specialty) &&
                (!query ||
                    `${doctor.name} ${doctor.specialty}`
                        .toLowerCase()
                        .includes(query.toLowerCase())) &&
                (experience !== "10+" || doctor.experience >= 10)
            ),
        [experience, query, specialty]
    );

    const notify = (message) => {
        setNotice(message);
        window.setTimeout(() => setNotice(""), 2400);
    };

    return (
        <div
            className="sabi-dashboard"
            style={{ ...pageVars, zoom }}
        >
            <Sidebar />

            <main className="sabi-main sabi-doctor-main">
                <Topbar placeholder="Search doctors, specialties, or clinics..." />

                {bookingFor && (
                    <div className="sabi-doctor-booking-for-banner">
                        Finding a doctor for <strong>{bookingFor.name}</strong>. Pick a doctor and book — {bookingFor.isDependent === false ? `${bookingFor.name} will need to accept it` : "it'll appear on their calendar automatically"}.
                    </div>
                )}

                <header className="sabi-doctor-hero">
                    <p className="sabi-doctor-eyebrow">
                        Verified care, matched to you
                    </p>

                    <h1>Find Your Doctor</h1>

                    <p>
                        Discover verified healthcare professionals, compare
                        expertise, and book appointments with confidence.
                    </p>

                    <div className="sabi-doctor-hero-actions">
                        <button
                            type="button"
                            className="sabi-doctor-primary"
                            onClick={() =>
                                document
                                    .getElementById("doctor-results")
                                    ?.scrollIntoView({ behavior: "smooth" })
                            }
                        >
                            Find a Doctor
                        </button>

                        <button
                            type="button"
                            className="sabi-doctor-outline"
                            onClick={() => setBookingDoctor(doctors[0] || DOCTORS[0])}
                        >
                            Book Appointment
                        </button>
                    </div>

                    <label className="sabi-doctor-search">
                        <Search size={20} />

                        <input
                            value={query}
                            onChange={(event) =>
                                setQuery(event.target.value)
                            }
                            placeholder="Search by name or specialty..."
                        />

                        <button
                            type="button"
                            onClick={() =>
                                notify(
                                    query
                                        ? `Searching for ${query}`
                                        : "Showing all doctors"
                                )
                            }
                        >
                            Search
                        </button>
                    </label>
                </header>

                <SpecialtyGrid
                    activeSpecialty={specialty}
                    onSelect={setSpecialty}
                />

                <section
                    id="doctor-results"
                    className="sabi-doctor-results"
                >
                    <aside className="sabi-doctor-filters sabi-card">
                        <div className="sabi-doctor-filter-head">
                            <h2>Filters</h2>

                            <button
                                type="button"
                                onClick={() => {
                                    setQuery("");
                                    setSpecialty("");
                                    setExperience("");
                                }}
                            >
                                Clear all
                            </button>
                        </div>

                        <fieldset>
                            <legend>Experience</legend>

                            {["1-5", "5-10", "10+"].map((value) => (
                                <label key={value}>
                                    <input
                                        type="radio"
                                        name="experience"
                                        checked={experience === value}
                                        onChange={() =>
                                            setExperience(value)
                                        }
                                    />
                                    {value} years
                                </label>
                            ))}
                        </fieldset>

                        <fieldset>
                            <legend>Consultation type</legend>

                            <div className="sabi-doctor-filter-pills">
                                <button type="button" className="active">
                                    Physical
                                </button>

                                <button type="button">Video</button>

                                <button type="button">Home visit</button>
                            </div>
                        </fieldset>

                        <div className="sabi-doctor-match">
                            <Sparkles size={22} />

                            <h3>AI Smart Match</h3>

                            <p>
                                Let us analyze your needs and find the best
                                specialist for you.
                            </p>

                            <button
                                type="button"
                                disabled={matching}
                                onClick={() => {
                                    setMatching(true);
                                    window.setTimeout(() => {
                                        setMatching(false);
                                        const best = [...DOCTORS].sort(
                                            (a, b) => b.experience - a.experience
                                        )[0];
                                        setProfileDoctor(best);
                                        notify(`Best match: ${best.name}`);
                                    }, 900);
                                }}
                            >
                                {matching ? "Matching…" : "Start AI Match"}
                            </button>
                        </div>
                    </aside>

                    <div>
                        <div className="sabi-doctor-results-head">
                            <h2>
                                Available Specialists{" "}
                                <span>({doctors.length} results)</span>
                            </h2>

                            <button type="button">Recommended</button>
                        </div>

                        <div className="sabi-doctor-card-grid">
                            {doctors.map((doctor) => (
                                <DoctorCard
                                    key={doctor.id}
                                    doctor={doctor}
                                    onBook={setBookingDoctor}
                                    onViewProfile={setProfileDoctor}
                                />
                            ))}

                            {!doctors.length && (
                                <div className="sabi-doctor-empty">
                                    No doctors match those filters. Clear a
                                    filter to see more specialists.
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {notice && (
                    <div className="sabi-doctor-toast">{notice}</div>
                )}

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
                        bookingFor={bookingFor}
                        onClose={() => setBookingDoctor(null)}
                        onConfirmed={(doctor, selection) => {
                            const appointment = addAppointmentFromBooking(doctor, selection);
                            notify(
                                appointment.status === "awaiting-acceptance"
                                    ? `Reservation sent to ${bookingFor?.name} — awaiting their acceptance`
                                    : `Appointment confirmed with ${doctor.name} — check My Appointments`
                            );
                        }}
                        onRequestSubmitted={(doctor, request) => {
                            addAppointmentRequest(doctor, request);
                            notify(`Request sent to ${doctor.name} — pending their review`);
                        }}
                    />
                )}
            </main>
        </div>
    );
}
