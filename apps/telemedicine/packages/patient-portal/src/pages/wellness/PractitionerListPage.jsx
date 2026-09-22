import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Star, CheckCircle2, MapPin, CalendarDays, MessageSquare, Award,
} from "lucide-react";

import "../../styles/share.css";
import "../doctor/Doctor.css";
import "./Wellness.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { getCategory, getPractitioners } from "./wellnessStore";

function PractitionerCard({ practitioner, onBook, onViewProfile }) {
  return (
    <article className="sabi-doctor-card sabi-card">
      <div className="sabi-doctor-photo">
        <img src={practitioner.photo} alt={practitioner.name} />
        {practitioner.verified && (
          <span>
            <CheckCircle2 size={13} /> Verified
          </span>
        )}
        <em>
          <Star size={13} fill="currentColor" /> {practitioner.rating} ({practitioner.reviews})
        </em>
      </div>

      <div className="sabi-doctor-card-body">
        <div className="sabi-doctor-card-title">
          <div>
            <h3>{practitioner.name}</h3>
            <p>{practitioner.specialty.toUpperCase()}</p>
          </div>
          <button type="button" aria-label={`Message ${practitioner.name}`}>
            <MessageSquare size={18} />
          </button>
        </div>

        <ul>
          <li>
            <Award size={15} /> {practitioner.yearsExperience}+ years experience
          </li>
          <li>
            <MapPin size={15} />
            {practitioner.supportsPhysical
              ? `${practitioner.base} · ${practitioner.distanceKm}km away`
              : `Consults virtually from ${practitioner.base}`}
          </li>
          <li className="available">
            <CalendarDays size={15} /> Next available: {practitioner.nextAvailable}
          </li>
        </ul>

        <footer>
          <div>
            <small>{practitioner.rateUnit === "day" ? "DAILY RATE" : "HOURLY RATE"}</small>
            <strong>₦{practitioner.rate.toLocaleString()}</strong>
          </div>

          <button type="button" className="sabi-doctor-outline" onClick={() => onViewProfile(practitioner)}>
            View Profile
          </button>

          <button type="button" className="sabi-doctor-primary" onClick={() => onBook(practitioner)}>
            Book
          </button>
        </footer>
      </div>
    </article>
  );
}

export function PractitionerListPage() {
  const [zoom] = useZoom();
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const category = getCategory(categoryId);
  const [sort, setSort] = useState("rating");

  if (!category) {
    return (
      <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
        <Sidebar />
        <div className="sabi-main">
          <Topbar />
          <div className="sabi-card">
            <p>We couldn&apos;t find that category.</p>
            <button className="sabi-btn-primary" onClick={() => navigate("/wellness-hub")}>Back to Wellness Hub</button>
          </div>
        </div>
      </div>
    );
  }

  const practitioners = [...getPractitioners(categoryId)].sort((a, b) =>
    sort === "rating" ? b.rating - a.rating : a.rate - b.rate
  );

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-wellness-main">
        <Topbar placeholder={`Search ${category.label.toLowerCase()}...`} />

        <button className="sabi-rxd-back" onClick={() => navigate("/wellness-hub")}>
          <ArrowLeft size={18} /> Back to Wellness Hub
        </button>

        <header className="sabi-wellness-list-header">
          <div>
            <h1>Available {category.label} <span style={{ color: "var(--sabi-text-secondary)", fontWeight: 600 }}>({practitioners.length} results)</span></h1>
            <p>{category.description}</p>
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="sabi-wellness-sort">
            <option value="rating">Sort by Rating</option>
            <option value="price">Sort by Price</option>
          </select>
        </header>

        <div className="sabi-doctor-card-grid">
          {practitioners.map((p) => (
            <PractitionerCard
              key={p.id}
              practitioner={p}
              onViewProfile={(pr) => navigate(`/wellness-hub/${categoryId}/${pr.id}`)}
              onBook={(pr) => navigate(`/wellness-hub/${categoryId}/${pr.id}/book`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default PractitionerListPage;
