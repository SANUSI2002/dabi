import React from "react";
import { useNavigate } from "react-router-dom";
import { HeartHandshake, Salad, Dumbbell, Brain, GraduationCap, ChevronRight, Clock3, Sparkles } from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { useApiData } from "../../api/useApiData";
import { listMyWellnessBookings, listWellnessOfferings } from "../../api/sabiApi";
import { PageShell } from "../hospitals/hospitalShared";
import { CATEGORIES } from "./wellnessStore";

const CATEGORY_ICONS = { caregiver: HeartHandshake, nutritionist: Salad, fitness_coach: Dumbbell, therapist: Brain, health_educator: GraduationCap };

export function WellnessHubPage() {
  const navigate = useNavigate();
  const offerings = useApiData(() => listWellnessOfferings(), []);
  const bookings = useApiData(() => listMyWellnessBookings(), []);

  const countFor = (id) => (offerings.data?.items || []).filter((o) => o.category === id).length;
  const open = (bookings.data?.items || []).filter((b) => b.status === "PENDING" || b.status === "CONFIRMED");

  return (
    <PageShell placeholder="Search wellness services..." mainClassName="sabi-main sabi-wellness-main">
      <header className="sabi-wellness-hero">
        <div>
          <h1>Wellness Hub</h1>
          <p>Book care and support from verified providers — caregivers, nutrition, fitness, therapy, and health education.</p>
        </div>
        <Sparkles size={120} className="sabi-wellness-hero-icon" />
      </header>

      <button type="button" className="sabi-wellness-my-engagements-btn" onClick={() => navigate("/wellness-hub/engagements")}>
        <span className="sabi-wellness-my-engagements-icon"><Clock3 size={20} /></span>
        <span className="sabi-wellness-my-engagements-text">
          <strong>My Bookings</strong>
          <span>{open.length > 0 ? `${open.length} open booking${open.length === 1 ? "" : "s"}` : "View your bookings and their status"}</span>
        </span>
        {open.length > 0 && <span className="sabi-wellness-my-engagements-badge">{open.length}</span>}
        <ChevronRight size={18} />
      </button>

      <h2 className="sabi-wellness-section-title">Browse by Category</h2>
      {offerings.error && <p className="sabi-form-error" role="alert">Couldn&apos;t load wellness services: {offerings.error.message}</p>}
      <div className="sabi-wellness-category-grid">
        {CATEGORIES.map((cat) => {
          const Icon = CATEGORY_ICONS[cat.id];
          const count = countFor(cat.id);
          return (
            <button type="button" key={cat.id} className="sabi-wellness-category-card" onClick={() => navigate(`/wellness-hub/${cat.id}`)}>
              <span className="sabi-wellness-category-icon"><Icon size={28} /></span>
              <strong>{cat.label}</strong>
              <span className="sabi-wellness-category-desc">{cat.description}</span>
              <span className="sabi-wellness-category-cta">
                {offerings.loading ? "Loading…" : count > 0 ? `${count} service${count === 1 ? "" : "s"}` : "No services yet"} <ChevronRight size={14} />
              </span>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}

export default WellnessHubPage;
