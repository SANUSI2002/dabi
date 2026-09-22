import React from "react";
import "./Dashboard.css";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import "../../styles/share.css";

import {
  Sidebar,
  Topbar,
  HeroCard,
  QuickActions,
  VitalHistory,
  RecentConsultations,
  HealthScoreCard,
  TodaysSchedule,
  MedicationsCard,
  FamilyHealthCard,
  InsightCard,
} from "./components";

export function Dashboard() {
  const [zoom] = useZoom();

  return (
    <div className="sabi-dashboard sabi-dashboard-home" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-grid">
          <div className="sabi-col">
            <HeroCard />
            <QuickActions />
            <VitalHistory />
            <RecentConsultations />
          </div>

          <div className="sabi-col">
            <HealthScoreCard />
            <TodaysSchedule />
            <MedicationsCard />
            <FamilyHealthCard />
            <InsightCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
