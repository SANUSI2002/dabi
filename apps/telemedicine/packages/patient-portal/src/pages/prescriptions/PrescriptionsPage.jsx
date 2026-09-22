import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/share.css";
import "./Prescriptions.css";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";

import { Sidebar, Topbar } from "../dashboard/components";
import {
  PrescriptionsHeader,
  StatsGrid,
  RecentPrescriptions,
  PrescriptionsList,
  AdherenceCard,
  AIAssistantCard,
} from "./components";
import {
  PRESCRIPTION_STATS,
  ADHERENCE,
  AI_INSIGHT,
} from "./data";
import { getAllPrescriptionSummaries } from "./prescriptionStore";

export function PrescriptionsPage() {
  const [zoom] = useZoom();
  const prescriptions = getAllPrescriptionSummaries();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const navigate = useNavigate();
  /* DEBUG NOTE: Prescriptions refactor - Share one search and status filter across prescription sections. */
  const filteredPrescriptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return prescriptions.filter((prescription) => {
      const matchesQuery = !query || [prescription.name, prescription.purpose, prescription.doctor?.name, prescription.dosage]
        .some((value) => value?.toLowerCase().includes(query));
      return matchesQuery && (statusFilter === "All" || prescription.status === statusFilter);
    });
  }, [prescriptions, searchQuery, statusFilter]);

  const handleViewDetails = (prescription) => {
    navigate(`/prescriptions/${prescription.id}`);
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        {/* DEBUG NOTE: Prescriptions refactor - Retired renewal and upload actions from the page header. */}
        <PrescriptionsHeader />

        <StatsGrid stats={PRESCRIPTION_STATS} />

        <div className="sabi-grid sabi-rx-grid">
          <div className="sabi-col">
            {/* DEBUG NOTE: Prescriptions refactor - Recent prescriptions uses the same filtered results as the list. */}
            <RecentPrescriptions prescriptions={filteredPrescriptions} onViewDetails={handleViewDetails} />
          </div>

          <div className="sabi-col sabi-rx-main-col">
            <PrescriptionsList
              prescriptions={filteredPrescriptions}
              onViewDetails={handleViewDetails}
              searchQuery={searchQuery}
              statusFilter={statusFilter}
              onSearchQueryChange={setSearchQuery}
              onStatusFilterChange={setStatusFilter}
            />

            <div className="sabi-rx-bottom-grid">
              <AdherenceCard adherence={ADHERENCE} />
              <AIAssistantCard
                insight={AI_INSIGHT}
                onAskQuestion={() => console.log("Ask a question clicked")}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default PrescriptionsPage;
