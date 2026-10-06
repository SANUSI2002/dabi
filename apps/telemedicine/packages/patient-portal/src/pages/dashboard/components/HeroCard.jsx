import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "design-system";
import artwork from "../../../../../shared-portal/assets/wellness-at-home-v1.png";
import { getCurrentUser } from "../../../utils/sabiIdentity";

export function HeroCard() {
  const navigate = useNavigate();
  const firstName = getCurrentUser()?.fullName?.trim().split(/\s+/)[0] || "there";

  return (
    <Card className="sabi-hero" style={{ background: "linear-gradient(135deg, var(--sabi-primary) 0%, var(--sabi-primary-dark) 100%)", color: "#fff" }}>
      <div className="sabi-hero-rings" aria-hidden="true">
        <span className="ring ring-1" />
        <span className="ring ring-2" />
        <span className="ring ring-3" />
      </div>

      <div className="sabi-hero-copy">
        <div>
          <span className="sabi-care-eyebrow">YOUR HEALTH, IN ONE PLACE</span>
          <h2>Good to see you, {firstName}.</h2>
          <p>Welcome back to Sabi Health.</p>
        </div>
        <Button variant="secondary" className="sabi-hero-cta" onClick={() => navigate("/vitals")}>
          View my vitals
        </Button>
      </div>

      <div className="sabi-hero-art" aria-hidden="true"><img src={artwork} alt="" width="1536" height="1024" decoding="async" /></div>
    </Card>
  );
}

export default HeroCard;
