import React, { useState } from "react";
import { Sidebar, Topbar } from "../dashboard/components";
import { StatsRow, VitalInfoCard, RecordsSection, RecentActivityCard, HealthInsightCard, OrganizedRecords } from "./components";
import { INITIAL_RECORDS, DEFAULT_CATEGORIES } from "./data";
import { pageVars } from "../../pageVars";
import { useZoom } from "../../hooks/useZoom";
import "../dashboard/Dashboard.css";
import "./Records.css";

let nextRecordId = 1;

export function Records() {
  const [zoom] = useZoom();
  const [records, setRecords] = useState(INITIAL_RECORDS);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);

  const timelineRecords = records.filter((r) => r.isTimelineEntry);

  const handleAddCategory = ({ label, icon }) => {
    const id = `cat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
    setCategories((prev) => [...prev, { id, label, icon, unit: "Documents", baseCount: 0, primary: false }]);
  };

  const handleAssign = (recordId, categoryId) => {
    setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, categoryId } : r)));
  };

  const handleUnassign = (recordId) => {
    setRecords((prev) => prev.map((r) => (r.id === recordId ? { ...r, categoryId: null } : r)));
  };

  const handleCreateRecord = (categoryId, fields) => {
    const id = `rec-manual-${nextRecordId++}`;
    setRecords((prev) => [...prev, { id, isTimelineEntry: false, categoryId, ...fields }]);
  };

  // Deleting a category only removes the folder itself — it's only
  // ever allowed once every record has been taken out of it first
  // (enforced in CategoryDetailModal), so no record is ever touched
  // here. Records are never deletable by the patient at all.
  const handleDeleteCategory = (categoryId) => {
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
  };

  return (
    <div className="sabi-dashboard" style={{ ...pageVars, zoom }}>
      <Sidebar />
      <div className="sabi-main">
        <Topbar />

        <div className="sabi-records-header">
          <h1>Medical Records</h1>
          <p>Securely access and manage your complete health history. Your records are encrypted and private by default.</p>
        </div>

        <StatsRow records={records} />

        <div className="sabi-grid sabi-records-grid">
          <div className="sabi-col">
            <RecordsSection records={timelineRecords} />
            <OrganizedRecords
              categories={categories}
              allRecords={records}
              onAddCategory={handleAddCategory}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onCreateRecord={handleCreateRecord}
              onDeleteCategory={handleDeleteCategory}
            />
          </div>

          <div className="sabi-col">
            <VitalInfoCard />
            <RecentActivityCard />
            <HealthInsightCard />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Records;
