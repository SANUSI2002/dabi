import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, Button } from "design-system";
import { Stethoscope } from "lucide-react";

export function HeroCard() {
  const navigate = useNavigate();

  return (
    <Card className="sabi-hero" style={{ background: "linear-gradient(135deg, var(--sabi-primary) 0%, var(--sabi-primary-dark) 100%)", color: "#fff" }}>
      <div className="sabi-hero-rings" aria-hidden="true">
        <span className="ring ring-1" />
        <span className="ring ring-2" />
        <span className="ring ring-3" />
      </div>

      <div className="sabi-hero-copy">
        <div>
          <h2>Hello, John 👋</h2>
          <p>Welcome back to Sabi Health.</p>
        </div>
        <Button variant="secondary" className="sabi-hero-cta" onClick={() => navigate("/vitals")}>
          View Full Health Report
        </Button>
      </div>

      {/* Swap this for a real <img src="..." alt="..." /> once you have the asset */}
      <div className="sabi-hero-art" role="img" aria-label="Wellness illustration">
        <span className="sabi-hero-art-glyph">
          <Stethoscope />
        </span>
      </div>
    </Card>
  );
}

export default HeroCard;
