import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Sparkles } from "lucide-react";

import "../../styles/share.css";
import "./ComingSoon.css";

import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { Sidebar, Topbar } from "../dashboard/components";

/* Generic "coming soon" placeholder for nav destinations that don't have
 * a built experience yet — keeps the nav item honest (it goes somewhere
 * real) without faking a feature that doesn't exist. */
export function ComingSoonPage({
  icon: Icon = Sparkles,
  eyebrow = "Coming Soon",
  title = "This feature is on the way",
  description = "We're building this out. Check back soon.",
  bullets = [],
}) {
  const [zoom] = useZoom();
  const navigate = useNavigate();
  const [notified, setNotified] = useState(false);

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <button className="sabi-rxd-back" onClick={() => navigate("/dashboard")}>
          <ArrowLeft size={18} /> Back to Dashboard
        </button>

        <div className="sabi-coming-soon-card sabi-card">
          <div className="sabi-coming-soon-icon">
            <Icon size={36} strokeWidth={2} />
          </div>
          <span className="sabi-coming-soon-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>

          {bullets.length > 0 && (
            <ul className="sabi-coming-soon-bullets">
              {bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}

          <button
            type="button"
            className="sabi-btn-primary"
            disabled={notified}
            onClick={() => setNotified(true)}
          >
            <Bell size={16} />
            {notified ? "We'll notify you" : "Notify me when it's ready"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ComingSoonPage;
