import React from "react";
import { Card } from "design-system";
import { Plus } from "lucide-react";
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
        <button type="button" className="sabi-family-add" aria-label="Add family member">
          <Plus size={18} />
        </button>
      </div>
    </Card>
  );
}

export default FamilyHealthCard;
