import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "design-system";
import { Plus, X } from "lucide-react";
import { Sidebar, Topbar } from "../dashboard/components";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import { VITAL_TYPES } from "./data";
import "../dashboard/Dashboard.css";
import "./Vitals.css";

export function SelectVitalType() {
  const [zoom] = useZoom();
  const navigate = useNavigate();

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <Link to="/vitals" className="sabi-vitals-crumb">
          <Plus size={14} /> New Entry
        </Link>

        <div className="sabi-vitals-add-header">
          <div>
            <h1>Add Vital Reading</h1>
            <p>Select the type of health metric you would like to record to keep your medical profile accurate and up-to-date.</p>
          </div>
          <button type="button" className="sabi-apt-secondary-btn sabi-vitals-cancel" onClick={() => navigate("/vitals")}>
            <X size={15} style={{ marginRight: 6 }} /> Cancel Entry
          </button>
        </div>

        <div className="sabi-vitaltype-grid">
          {VITAL_TYPES.map((v) => (
            <Card
              key={v.id}
              className="sabi-vitaltype-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/vitals/add/${v.id}`)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/vitals/add/${v.id}`)}
            >
              <div className="sabi-vitaltype-icon">
                <v.icon size={22} />
              </div>
              <div className="sabi-vitaltype-label">{v.label}</div>
              <p className="sabi-vitaltype-desc">{v.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SelectVitalType;
