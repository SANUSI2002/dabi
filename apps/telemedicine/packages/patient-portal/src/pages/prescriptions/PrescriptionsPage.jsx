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
import { getAllPrescriptionSummaries } from "./prescriptionStore";
import { getDrugInfo } from "./drugInfo";
import { useApiData } from "../../api/useApiData";
import { listMedications } from "../../api/dashboardApi";

const two = (n) => String(n).padStart(2, "0");
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Prescriptions and today's medication list, both from the Sabi API.
async function loadPrescriptions() {
  const [prescriptions, meds] = await Promise.all([getAllPrescriptionSummaries(), listMedications().catch(() => [])]);
  return { prescriptions, meds };
}

function buildStats(prescriptions, meds) {
  const taken = meds.filter((m) => m.isTaken).length;
  return [
    { key: "active", label: "Active Prescriptions", value: two(prescriptions.length), icon: "Pill", tone: "primary" },
    { key: "dueToday", label: "Due Today", value: two(meds.length - taken), icon: "CalendarClock", tone: "primary" },
    { key: "adherence", label: "Adherence Score", value: meds.length ? `${Math.round((taken / meds.length) * 100)}%` : "—", icon: "BarChart3", tone: "primary" },
    { key: "renewals", label: "Renewals Needed", value: "00", icon: "BellRing", tone: "danger" },
  ];
}

export function PrescriptionsPage() {
  const [zoom] = useZoom();
  const loaded = useApiData(loadPrescriptions, []);
  const prescriptions = useMemo(() => loaded.data?.prescriptions || [], [loaded.data]);
  const meds = loaded.data?.meds || [];
  const stats = buildStats(prescriptions, meds);
  const pending = meds.filter((m) => !m.isTaken).length;
  const adherence = {
    message: !meds.length
      ? "Add your medications on the dashboard to track your doses."
      : pending
        ? `You have ${pending} dose${pending === 1 ? "" : "s"} left to take today.`
        : "You've taken all of today's doses. Keep it up!",
    days: DAYS,
    activeDay: DAYS[(new Date().getDay() + 6) % 7],
  };
  const firstDrug = prescriptions[0]?.name.replace(/ \+\d+ more$/, "");
  const insight = firstDrug
    ? { quote: getDrugInfo(firstDrug).criticalInteraction.body, note: "General guidance — confirm with your pharmacist or doctor" }
    : { quote: "Prescriptions your doctor issues on Sabi Health will appear here.", note: "No prescriptions on file yet" };
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

        <StatsGrid stats={stats} />
        {loaded.error && <p className="sabi-rx-empty" role="alert">We couldn&apos;t load your prescriptions. Please refresh to try again.</p>}

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
              <AdherenceCard adherence={adherence} />
              <AIAssistantCard
                insight={insight}
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
