import React from "react";
import "./Dashboard.css";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import "../../styles/share.css";

import {
  Sidebar,
  Topbar,
  QuickActions,
  VitalHistory,
  RecentConsultations,
  HealthScoreCard,
  TodaysSchedule,
  MedicationsCard,
  FamilyHealthCard,
  InsightCard,
  NextAppointmentCard,
} from "./components";

export function Dashboard() {
  const [zoom] = useZoom();

  return (
    <div className="sabi-dashboard sabi-dashboard-home" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />
        <h1 className="sx-sr-only">Overview</h1>

        <NextAppointmentCard />

        <div className="sabi-grid">
          <div className="sabi-col">
            <QuickActions />
            <VitalHistory />
            <RecentConsultations />
          </div>

          <div className="sabi-col">
            <TodaysSchedule />
            <MedicationsCard />
            <FamilyHealthCard />
            <HealthScoreCard />
            <InsightCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
