import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, colors } from "design-system";
import { Plus } from "lucide-react";
import { SectionTitle } from "../share";
import { useApiData } from "../../../api/useApiData";
import { listDependents } from "../../../api/sabiApi";

const PALETTE = [colors.primary, colors.warning, colors.primaryDark, colors.danger];
const initialsOf = (name = "") => name.split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function FamilyHealthCard() {
  const navigate = useNavigate();
  const { data } = useApiData(listDependents, []);
  const FAMILY = (data || []).map((d, i) => ({ initials: initialsOf(d.name), bg: PALETTE[i % PALETTE.length], online: false }));
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
        <button type="button" className="sabi-family-add" aria-label="Add family member" onClick={() => navigate("/family/add")}>
          <Plus size={18} />
        </button>
      </div>
    </Card>
  );
}

export default FamilyHealthCard;
