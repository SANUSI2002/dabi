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

import { Sidebar, Topbar } from "../dashboard/components";
import { SPECIALTIES, inSpecialty } from "./data";
import { useApiData } from "../../api/useApiData";
import { listUiDoctors } from "../../api/doctorsApi";
import { BookingModal } from "./components/BookingModal";
import { DoctorProfileModal } from "./components/DoctorProfileModal";

function SpecialtyGrid({ activeSpecialty, onSelect, doctors }) {
    return (
        <section className="sabi-doctor-specialties">
            <div className="sabi-doctor-section-heading">
                <div>
                    <h2>Featured Specialties</h2>
                    <p>Find experts in the most requested medical fields</p>
                </div>
            </div>

            <div className="sabi-doctor-specialty-grid">
                {SPECIALTIES.map(({ label, icon: Icon }) => (
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
                        <small>{doctors.filter((d) => inSpecialty(d, label)).length} Doctors</small>
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
                {doctor.photo ? <img src={doctor.photo} alt={doctor.name} /> : <div className="sabi-doctor-photo-initials" aria-hidden="true">{doctor.initials}</div>}

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
                        <Stethoscope size={15} /> {doctor.experience ?? "—"} years
                        experience
                    </li>

                    <li>
                        <MapPin size={15} /> {doctor.clinic || "Practice not listed"}
                        {doctor.distance != null && <> · {doctor.distance}km away</>}
                    </li>

                    <li className="available">
                        <CalendarDays size={15} /> Next available:{" "}
                        {doctor.nextAvailable}
                    </li>
                </ul>

                <footer>
                    <div>
                        <small>CONSULTATION FEE</small>
                        <strong>{doctor.fee != null ? `₦${doctor.fee.toLocaleString()}` : "—"}</strong>
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

// "1-5" | "5-10" | "10+" -> whether the doctor's published years of experience fall in range.
function inExperienceRange(years, range) {
    if (years == null) return false;
    if (range === "10+") return years >= 10;
    const [min, max] = range.split("-").map(Number);
    return years >= min && years <= max;
}

// Filter pill label -> consultation type the doctor offers. Home visits aren't offered yet.
const CONSULT_PILLS = [["Physical", "IN_PERSON"], ["Video", "VIRTUAL"], ["Home visit", "HOME_VISIT"]];

export default function FindYourDoctor() {
    const location = useLocation();
    const bookingFor = location.state?.bookingForId
        ? { id: location.state.bookingForId, name: location.state.bookingForName, isSelf: false, isDependent: location.state.isDependent }
        : null;

    const [query, setQuery] = useState("");
    const [specialty, setSpecialty] = useState("");
    const [experience, setExperience] = useState("");
    const [consultType, setConsultType] = useState("");
    const { data: allDoctors = [], loading, error } = useApiData(listUiDoctors, []);
    const [notice, setNotice] = useState("");
    const [profileDoctor, setProfileDoctor] = useState(null);
    const [bookingDoctor, setBookingDoctor] = useState(null);
    const [matching, setMatching] = useState(false);

    const [zoom] = useZoom();

    const doctors = useMemo(
        () =>
            (allDoctors || []).filter((doctor) =>
                (!specialty || inSpecialty(doctor, specialty)) &&
                (!query ||
                    `${doctor.name} ${doctor.specialty}`
                        .toLowerCase()
                        .includes(query.toLowerCase())) &&
                (!experience || inExperienceRange(doctor.experience, experience)) &&
                (!consultType || doctor.consultationTypes.includes(consultType))
            ),
        [allDoctors, consultType, experience, query, specialty]
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
                            onClick={() => {
                                const next = doctors.find((d) => d.nextAvailableAt) || (allDoctors || []).find((d) => d.nextAvailableAt);
                                if (next) setBookingDoctor(next);
                                else notify("No doctor has open times yet");
                            }}
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
                    doctors={allDoctors || []}
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
                                    setConsultType("");
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
                                {CONSULT_PILLS.map(([label, value]) => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={consultType === value ? "active" : ""}
                                        onClick={() => setConsultType(consultType === value ? "" : value)}
                                    >
                                        {label}
                                    </button>
                                ))}
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
                                        const best = [...(allDoctors || [])].sort(
                                            (a, b) => (b.experience ?? -1) - (a.experience ?? -1)
                                        )[0];
                                        if (!best) return notify("No verified doctors yet");
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
                                    {error
                                        ? error.message
                                        : loading
                                        ? "Loading doctors…"
                                        : consultType === "HOME_VISIT"
                                        ? "Home visits aren't available yet. Choose Physical or Video."
                                        : (allDoctors || []).length === 0
                                        ? "No verified doctors are taking bookings yet."
                                        : "No doctors match those filters. Clear a filter to see more specialists."}
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
                        onBooked={(doctor) => notify(`Request sent to ${doctor.name} — pending their review`)}
                    />
                )}
            </main>
        </div>
    );
}
