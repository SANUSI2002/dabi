import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, colors } from "design-system";
import { Plus } from "lucide-react";
import { SectionTitle } from "../share";
import { useApiData } from "../../../api/useApiData";
import { listDependents } from "../../../api/sabiApi";

const PALETTE = [colors.primary, colors.warning, colors.primaryDark, colors.danger];
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

// Avatars open the Family page rather than a member profile: the Family pages still use their own
// local store, so they can't open a member by API id yet.
export function FamilyHealthCard() {
  const navigate = useNavigate();
  const { data, error } = useApiData(listDependents, []);

  return (
    <Card>
      <SectionTitle action="Manage" onAction={() => navigate("/family")}>Family Health</SectionTitle>
      {error ? (
        <p className="sabi-dash-empty">{error.message}</p>
      ) : (
        <div className="sabi-family-row">
          {(data || []).map((f, i) => (
            <button
              type="button"
              className="sabi-family-avatar"
              style={{ background: PALETTE[i % PALETTE.length] }}
              key={f.id}
              title={f.name}
              aria-label={`${f.name} — open Family`}
              onClick={() => navigate("/family")}
            >
              {initials(f.name)}
            </button>
          ))}
          <button type="button" className="sabi-family-add" aria-label="Add family member" onClick={() => navigate("/family")}>
            <Plus size={18} />
          </button>
        </div>
      )}
      {data && data.length === 0 && <p className="sabi-dash-empty">Add the people you care for to manage their health here.</p>}
    </Card>
  );
}

export default FamilyHealthCard;
