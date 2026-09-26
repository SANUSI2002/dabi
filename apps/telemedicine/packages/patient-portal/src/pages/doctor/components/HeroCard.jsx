import React from "react";
import { Card, Button } from "design-system";

export function HeroCard() {
  return (
    <Card className="sabi-hero" style={{ background: "var(--sabi-primary-dark)", color: "#fff" }}>
      <div className="sabi-hero-rings" aria-hidden="true">
        <span className="ring ring-1" />
        <span className="ring ring-2" />
        <span className="ring ring-3" />
      </div>

      <div className="sabi-hero-copy">
        <div>
          <h2>Hello, John 👋</h2>
          <p>Welcome back to Sabi Health. Your recovery progress is looking excellent this week. Keep up the great work!</p>
        </div>
        <Button variant="secondary" className="sabi-hero-cta">
          View Full Health Report
        </Button>
      </div>

      {/* Swap this for a real <img src="..." alt="..." /> once you have the asset */}
      <div className="sabi-hero-art" role="img" aria-label="Wellness illustration">
        <span className="sabi-hero-art-glyph">🩺</span>
      </div>
    </Card>
  );
}

export default HeroCard;
