import React from "react";
import { Card } from "design-system";
import { SectionTitle } from "../share";
import { FAMILY } from "../data";

export function FamilyHealthCard() {
  return (
    <Card>
      <SectionTitle>Family Health</SectionTitle>
      <div className="sabi-family-row">
        {FAMILY.map((f, i) => (
          <div className="sabi-family-avatar" style={{ background: f.bg }} key={i}>
            {f.initials}
            {f.online && <span className="sabi-family-status" />}
          </div>
        ))}
        <div className="sabi-family-add">+</div>
      </div>
    </Card>
  );
}

export default FamilyHealthCard;
