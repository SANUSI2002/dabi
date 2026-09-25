import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "design-system";
import { Stethoscope } from "lucide-react";
import { getCurrentUser } from "../../../utils/sabiIdentity";

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
};

export function HeroCard() {
  const navigate = useNavigate();
  const firstName = getCurrentUser()?.fullName?.trim().split(/\s+/)[0];

  return (
    <Card className="sabi-hero" style={{ background: "linear-gradient(135deg, var(--sabi-primary) 0%, var(--sabi-primary-dark) 100%)", color: "#fff" }}>
      <div className="sabi-hero-rings" aria-hidden="true">
        <span className="ring ring-1" />
        <span className="ring ring-2" />
        <span className="ring ring-3" />
      </div>

      <div className="sabi-hero-copy">
        <div>
          <h2>
            {greeting()}
            {firstName ? `, ${firstName}` : ""} 👋
          </h2>
          <p>Welcome back to Sabi Health.</p>
        </div>
        <Button variant="secondary" className="sabi-hero-cta" onClick={() => navigate("/vitals")}>
          View Your Vitals
        </Button>
      </div>

      <div className="sabi-hero-art" aria-hidden="true">
        <span className="sabi-hero-art-glyph">
          <Stethoscope />
        </span>
      </div>
    </Card>
  );
}

export default HeroCard;
