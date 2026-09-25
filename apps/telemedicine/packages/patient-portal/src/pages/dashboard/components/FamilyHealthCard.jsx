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
              aria-label={`Open ${f.name}'s profile`}
              onClick={() => navigate(`/family/member/${f.id}`)}
            >
              {initials(f.name)}
            </button>
          ))}
          <button type="button" className="sabi-family-add" aria-label="Add a dependent" onClick={() => navigate("/family/add/dependent")}>
            <Plus size={18} />
          </button>
        </div>
      )}
      {data && data.length === 0 && <p className="sabi-dash-empty">Add the people you care for to manage their health here.</p>}
    </Card>
  );
}

export default FamilyHealthCard;
