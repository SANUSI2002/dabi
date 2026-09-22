import React from "react";
import { useNavigate } from "react-router-dom";
import {
  HeartHandshake, Salad, Dumbbell, Brain, GraduationCap, ChevronRight, Clock3, Sparkles,
} from "lucide-react";

import "../../styles/share.css";
import "./Wellness.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";
import { CATEGORIES, getRequests, getEngagements } from "./wellnessStore";

const CATEGORY_ICONS = {
  caregiver: HeartHandshake,
  nutritionist: Salad,
  fitness_coach: Dumbbell,
  therapist: Brain,
  health_educator: GraduationCap,
};

export function WellnessHubPage() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  const requests = getRequests();
  const engagements = getEngagements();
  const activeEngagements = engagements.filter((e) => e.status === "active" || e.status === "awaiting_renewal");
  const pendingRequests = requests.filter((r) => r.status !== "declined");

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main sabi-wellness-main">
        <Topbar placeholder="Search caregivers, coaches, therapists..." />

        <header className="sabi-wellness-hero">
          <div>
            <h1>Wellness Hub</h1>
            <p>Book ongoing, personalized care and support — caregivers, nutrition, fitness, therapy, and health education, matched to your schedule.</p>
          </div>
          <Sparkles size={120} className="sabi-wellness-hero-icon" />
        </header>

        <button type="button" className="sabi-wellness-my-engagements-btn" onClick={() => navigate("/wellness-hub/engagements")}>
          <span className="sabi-wellness-my-engagements-icon">
            <Clock3 size={20} />
          </span>
          <span className="sabi-wellness-my-engagements-text">
            <strong>My Engagements</strong>
            <span>
              {activeEngagements.length > 0 || pendingRequests.length > 0
                ? `${activeEngagements.length} active · ${pendingRequests.length} in progress`
                : "View your bookings, requests, and history"}
            </span>
          </span>
          {(activeEngagements.length + pendingRequests.length) > 0 && (
            <span className="sabi-wellness-my-engagements-badge">{activeEngagements.length + pendingRequests.length}</span>
          )}
          <ChevronRight size={18} />
        </button>

        <h2 className="sabi-wellness-section-title">Browse by Category</h2>
        <div className="sabi-wellness-category-grid">
          {CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id];
            return (
              <button
                type="button"
                key={cat.id}
                className="sabi-wellness-category-card"
                onClick={() => navigate(`/wellness-hub/${cat.id}`)}
              >
                <span className="sabi-wellness-category-icon">
                  <Icon size={28} />
                </span>
                <strong>{cat.label}</strong>
                <span className="sabi-wellness-category-desc">{cat.description}</span>
                <span className="sabi-wellness-category-cta">
                  Browse {cat.label} <ChevronRight size={14} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default WellnessHubPage;
